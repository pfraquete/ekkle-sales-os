/**
 * EKKLE SALES OS - WhatsApp Message Worker
 * Processa mensagens da fila com agentes AI especializados
 * 
 * ATUALIZADO: Agora usa sistema de memória de longo prazo,
 * agentes especializados (SDR/BDR/AE) e análise de mercado
 */

import { Worker, Job } from 'bullmq';
import { getBullMQConnection } from '../shared/redis';
import { QUEUE_NAMES } from '../shared/config';
import { createLogger } from '../shared/logger';
import { 
  createOrGetLead, 
  updateLead, 
  findLeadByPhone 
} from '../api/services/leadService';
import { 
  createConversation, 
  getRecentConversations 
} from '../api/services/conversationService';
import { 
  createAgentExecution, 
  updateAgentExecution 
} from '../api/services/agentExecutionService';
import { 
  processWithSpecializedAgent,
  isBusinessHours,
  getOffHoursResponse,
  type SpecializedAgentType
} from '../agents/specializedAgents';
import { 
  getWhatsAppService,
  type SendMessageResult 
} from '../agents/whatsappService';
import {
  analyzeChurchRegion,
  getMarketAnalysis,
  shouldTriggerAnalysis,
  formatAnalysisForAgent
} from '../agents/marketAnalysisService';
import type { WhatsAppQueueJob, Lead } from '../shared/types';

const logger = createLogger('whatsapp-worker');

// ===========================================
// Helper Functions
// ===========================================

/**
 * Verifica se a mensagem é duplicada (idempotência)
 */
const isMessageDuplicate = async (
  leadId: string,
  messageId: string
): Promise<boolean> => {
  try {
    const conversations = await getRecentConversations(leadId, 5);
    
    return conversations.some(c => {
      const metadata = c.metadata as { messageId?: string } | null;
      return metadata?.messageId === messageId;
    });
  } catch {
    return false;
  }
};

/**
 * Processa análise de mercado se necessário
 */
const processMarketAnalysis = async (
  lead: Lead,
  extractedData: Record<string, unknown>
): Promise<{
  competitorCount: number;
  digitalScore: number;
  opportunity: string;
} | undefined> => {
  try {
    const currentMetadata = (lead.metadata || {}) as Record<string, unknown>;
    
    // Verificar se deve triggerar análise
    if (shouldTriggerAnalysis(currentMetadata, extractedData)) {
      logger.info('Triggering market analysis', { leadId: lead.id });
      
      const address = (extractedData.address || currentMetadata.address) as string | null;
      const instagram = (extractedData.instagram || currentMetadata.instagram) as string | null;
      
      const analysis = await analyzeChurchRegion(lead, address, instagram);
      
      return {
        competitorCount: analysis.competitorCount,
        digitalScore: analysis.digitalScore,
        opportunity: analysis.opportunity
      };
    }
    
    // Buscar análise existente se lead já tem dados
    if (currentMetadata.address || currentMetadata.instagram) {
      const existingAnalysis = await getMarketAnalysis(lead.id);
      
      if (existingAnalysis) {
        return {
          competitorCount: existingAnalysis.competitor_count,
          digitalScore: existingAnalysis.digital_score,
          opportunity: existingAnalysis.opportunity
        };
      }
    }
    
    return undefined;
  } catch (error) {
    logger.error('Error processing market analysis', error, { leadId: lead.id });
    return undefined;
  }
};

// ===========================================
// Main Processing Function
// ===========================================

/**
 * Processa uma mensagem WhatsApp recebida
 */
const processWhatsAppMessage = async (job: Job<WhatsAppQueueJob>): Promise<void> => {
  const { phone, message, pushName, messageId, timestamp } = job.data;
  const startTime = Date.now();

  logger.queue(QUEUE_NAMES.WHATSAPP_INCOMING, 'processing', job.id, {
    phone,
    messageId
  });

  try {
    // 1. Criar ou buscar lead
    const { lead, isNew } = await createOrGetLead({
      phone,
      name: pushName || undefined
    });

    logger.info('Lead resolved', { 
      leadId: lead.id, 
      isNew, 
      phone 
    });

    // 2. Verificar duplicidade (idempotência)
    if (messageId && await isMessageDuplicate(lead.id, messageId)) {
      logger.warn('Duplicate message detected, skipping', { 
        leadId: lead.id, 
        messageId 
      });
      return;
    }

    // 3. Atualizar nome se veio no pushName e lead não tinha
    if (pushName && !lead.name) {
      await updateLead(lead.id, { name: pushName });
      lead.name = pushName;
    }

    // 4. Salvar mensagem recebida no banco
    await createConversation({
      lead_id: lead.id,
      message,
      direction: 'inbound',
      agent_name: lead.assigned_agent as SpecializedAgentType,
      intent_detected: 'unknown',
      metadata: { messageId, timestamp }
    });

    // 5. Verificar horário comercial
    if (!isBusinessHours()) {
      logger.info('Outside business hours, sending auto-reply', { leadId: lead.id });
      
      const offHoursMessage = getOffHoursResponse();
      
      // Salvar resposta automática
      await createConversation({
        lead_id: lead.id,
        message: offHoursMessage,
        direction: 'outbound',
        agent_name: 'sdr',
        intent_detected: 'off_hours',
        metadata: { auto_reply: true }
      });
      
      // Enviar via WhatsApp
      const whatsapp = getWhatsAppService();
      await whatsapp.sendText(phone, offHoursMessage);
      
      logger.queue(QUEUE_NAMES.WHATSAPP_INCOMING, 'completed', job.id, {
        phone,
        leadId: lead.id,
        offHours: true
      });
      
      return;
    }

    // 6. Criar registro de execução do agente
    const execution = await createAgentExecution({
      lead_id: lead.id,
      agent_name: lead.assigned_agent as SpecializedAgentType,
      input_message: message,
      status: 'started'
    });

    // 7. Buscar análise de mercado existente (se houver)
    let marketAnalysis: {
      competitorCount: number;
      digitalScore: number;
      opportunity: string;
    } | undefined;
    
    const existingAnalysis = await getMarketAnalysis(lead.id);
    if (existingAnalysis) {
      marketAnalysis = {
        competitorCount: existingAnalysis.competitor_count,
        digitalScore: existingAnalysis.digital_score,
        opportunity: existingAnalysis.opportunity
      };
    }

    // 8. Processar com agente especializado
    const agentResponse = await processWithSpecializedAgent(
      lead,
      message,
      marketAnalysis
    );

    // 9. Processar análise de mercado se SDR coletou dados novos
    if (agentResponse.shouldTriggerAnalysis && agentResponse.extractedData) {
      const newAnalysis = await processMarketAnalysis(lead, agentResponse.extractedData);
      
      if (newAnalysis) {
        logger.info('Market analysis completed', {
          leadId: lead.id,
          opportunity: newAnalysis.opportunity
        });
      }
    }

    // 10. Atualizar execução com resultado
    const executionTime = Date.now() - startTime;
    await updateAgentExecution(execution.id, {
      output_message: agentResponse.message,
      intent_detected: agentResponse.intent,
      tokens_used: agentResponse.tokensUsed,
      execution_time_ms: executionTime,
      status: 'completed'
    });

    // 11. Salvar resposta do agente no banco
    await createConversation({
      lead_id: lead.id,
      message: agentResponse.message,
      direction: 'outbound',
      agent_name: agentResponse.agentUsed,
      intent_detected: agentResponse.intent,
      metadata: { executionId: execution.id }
    });

    // 12. Atualizar status/temperatura do lead se necessário
    if (agentResponse.shouldUpdateStatus) {
      const updates: Partial<Lead> = {};
      
      if (agentResponse.newStatus) {
        updates.status = agentResponse.newStatus as Lead['status'];
      }
      if (agentResponse.newTemperature) {
        updates.temperature = agentResponse.newTemperature as Lead['temperature'];
      }
      
      // Atualizar agente baseado no novo status
      if (agentResponse.newStatus === 'qualified') {
        updates.assigned_agent = 'bdr';
      } else if (agentResponse.newStatus === 'negotiating') {
        updates.assigned_agent = 'ae';
      }
      
      if (Object.keys(updates).length > 0) {
        await updateLead(lead.id, updates);
        
        logger.info('Lead updated', {
          leadId: lead.id,
          updates
        });
      }
    }

    // 13. Atualizar metadata do lead com dados extraídos
    if (agentResponse.extractedData && Object.keys(agentResponse.extractedData).length > 0) {
      const currentMetadata = (lead.metadata || {}) as Record<string, unknown>;
      const newMetadata = { ...currentMetadata, ...agentResponse.extractedData };
      
      await updateLead(lead.id, { 
        metadata: newMetadata 
      });
      
      logger.info('Lead metadata updated', {
        leadId: lead.id,
        newFields: Object.keys(agentResponse.extractedData)
      });
    }

    // 14. Enviar resposta via WhatsApp com delay humanizado
    const whatsapp = getWhatsAppService();
    const sendResult = await whatsapp.sendText(phone, agentResponse.message);

    if (!sendResult.success) {
      logger.error('Failed to send WhatsApp response', null, {
        phone,
        error: sendResult.error
      });
      // Não falha o job, pois a mensagem foi processada
    }

    logger.queue(QUEUE_NAMES.WHATSAPP_INCOMING, 'completed', job.id, {
      phone,
      leadId: lead.id,
      agentUsed: agentResponse.agentUsed,
      intent: agentResponse.intent,
      executionTimeMs: executionTime,
      messageSent: sendResult.success
    });

  } catch (error) {
    const executionTime = Date.now() - startTime;
    
    logger.error('Error processing WhatsApp message', error, {
      phone,
      messageId,
      executionTimeMs: executionTime
    });

    // Re-throw para BullMQ fazer retry
    throw error;
  }
};

// ===========================================
// Worker Creation
// ===========================================

/**
 * Cria e inicia o worker
 */
export const createWhatsAppWorker = (): Worker<WhatsAppQueueJob> => {
  logger.info('Creating WhatsApp worker with specialized agents');

  const worker = new Worker<WhatsAppQueueJob>(
    QUEUE_NAMES.WHATSAPP_INCOMING,
    processWhatsAppMessage,
    {
      connection: getBullMQConnection(),
      concurrency: 5, // Processa até 5 mensagens em paralelo
      limiter: {
        max: 10,
        duration: 1000 // Max 10 jobs por segundo
      }
    }
  );

  // Event handlers
  worker.on('completed', (job) => {
    logger.queue(QUEUE_NAMES.WHATSAPP_INCOMING, 'job-completed', job.id);
  });

  worker.on('failed', (job, error) => {
    logger.error('Job failed', error, {
      jobId: job?.id,
      attemptsMade: job?.attemptsMade
    });
  });

  worker.on('error', (error) => {
    logger.error('Worker error', error);
  });

  worker.on('stalled', (jobId) => {
    logger.warn('Job stalled', { jobId });
  });

  logger.info('WhatsApp worker created and listening');

  return worker;
};

/**
 * Para o worker gracefully
 */
export const stopWorker = async (worker: Worker): Promise<void> => {
  logger.info('Stopping WhatsApp worker');
  await worker.close();
  logger.info('WhatsApp worker stopped');
};
