/**
 * EKKLE SALES OS - WhatsApp Message Worker
 * Processa mensagens da fila com agentes AI
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
import { processWithAgent } from '../agents/baseAgent';
import { sendMessageWithTyping } from '../agents/evolutionClient';
import type { WhatsAppQueueJob } from '../shared/types';

const logger = createLogger('whatsapp-worker');

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

    // 2. Atualizar nome se veio no pushName e lead não tinha
    if (pushName && !lead.name) {
      await updateLead(lead.id, { name: pushName });
      lead.name = pushName;
    }

    // 3. Salvar mensagem recebida no banco
    await createConversation({
      lead_id: lead.id,
      message,
      direction: 'inbound',
      agent_name: lead.assigned_agent as any,
      intent_detected: 'unknown',
      metadata: { messageId, timestamp }
    });

    // 4. Criar registro de execução do agente
    const execution = await createAgentExecution({
      lead_id: lead.id,
      agent_name: lead.assigned_agent as any,
      input_message: message,
      status: 'started'
    });

    // 5. Buscar conversas recentes para contexto
    const recentConversations = await getRecentConversations(lead.id, 10);

    // 6. Processar com agente AI
    const agentResponse = await processWithAgent(
      {
        lead,
        recentConversations,
        systemPrompt: '' // Será definido pelo agente
      },
      message
    );

    // 7. Atualizar execução com resultado
    const executionTime = Date.now() - startTime;
    await updateAgentExecution(execution.id, {
      output_message: agentResponse.message,
      intent_detected: agentResponse.intent,
      tokens_used: agentResponse.tokensUsed,
      execution_time_ms: executionTime,
      status: 'completed'
    });

    // 8. Salvar resposta do agente no banco
    await createConversation({
      lead_id: lead.id,
      message: agentResponse.message,
      direction: 'outbound',
      agent_name: agentResponse.shouldTransfer 
        ? agentResponse.transferTo! 
        : lead.assigned_agent as any,
      intent_detected: agentResponse.intent,
      metadata: { executionId: execution.id }
    });

    // 9. Atualizar agente do lead se houve transferência
    if (agentResponse.shouldTransfer && agentResponse.transferTo) {
      await updateLead(lead.id, { 
        assigned_agent: agentResponse.transferTo 
      });
      
      logger.info('Lead transferred to new agent', {
        leadId: lead.id,
        from: lead.assigned_agent,
        to: agentResponse.transferTo
      });
    }

    // 10. Atualizar temperatura do lead baseado na intent
    const temperatureMap: Record<string, string> = {
      'closing': 'hot',
      'pricing': 'warm',
      'features': 'warm',
      'greeting': 'cold'
    };
    
    if (temperatureMap[agentResponse.intent]) {
      const newTemp = temperatureMap[agentResponse.intent];
      if (newTemp !== lead.temperature) {
        await updateLead(lead.id, { temperature: newTemp as any });
      }
    }

    // 11. Enviar resposta via WhatsApp
    const sendResult = await sendMessageWithTyping(phone, agentResponse.message);

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

/**
 * Cria e inicia o worker
 */
export const createWhatsAppWorker = (): Worker<WhatsAppQueueJob> => {
  logger.info('Creating WhatsApp worker');

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
