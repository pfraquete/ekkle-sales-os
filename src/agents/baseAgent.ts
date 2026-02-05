/**
 * EKKLE SALES OS - Base Agent
 * Classe base para todos os agentes de vendas
 */

import { chatCompletion, analyzeIntent, type ChatMessage } from './kimiClient';
import { createLogger } from '../shared/logger';
import { AGENT_SYSTEM_PROMPTS } from '../shared/config';
import type { 
  Lead, 
  Conversation, 
  AgentType, 
  IntentType, 
  AgentResponse,
  AgentContext 
} from '../shared/types';

const logger = createLogger('base-agent');

/**
 * Verifica se está dentro do horário comercial
 * Segunda a Sexta, 8h às 18h (horário de Brasília)
 */
export const isBusinessHours = (): boolean => {
  const now = new Date();
  
  // Ajustar para horário de Brasília (UTC-3)
  const brasiliaOffset = -3 * 60;
  const localOffset = now.getTimezoneOffset();
  const brasiliaTime = new Date(now.getTime() + (localOffset + brasiliaOffset) * 60000);
  
  const dayOfWeek = brasiliaTime.getDay();
  const hour = brasiliaTime.getHours();
  
  // 0 = Domingo, 6 = Sábado
  if (dayOfWeek === 0 || dayOfWeek === 6) {
    return false;
  }
  
  // 8h às 18h
  return hour >= 8 && hour < 18;
};

/**
 * Formata histórico de conversas para o contexto do agente
 */
export const formatConversationHistory = (conversations: Conversation[]): string => {
  if (conversations.length === 0) {
    return 'Nenhuma conversa anterior.';
  }

  return conversations
    .map(c => {
      const role = c.direction === 'inbound' ? 'Cliente' : 'Agente';
      return `${role}: ${c.message}`;
    })
    .join('\n');
};

/**
 * Determina qual agente deve processar baseado na intent
 */
export const determineAgent = (
  intent: IntentType, 
  currentAgent: AgentType
): { agent: AgentType; shouldTransfer: boolean } => {
  // Regras de transferência
  switch (intent) {
    case 'technical':
      // Dúvidas técnicas vão para BDR
      if (currentAgent !== 'bdr') {
        return { agent: 'bdr', shouldTransfer: true };
      }
      break;
    
    case 'closing':
      // Intenção de fechar vai para Closer
      if (currentAgent !== 'closer') {
        return { agent: 'closer', shouldTransfer: true };
      }
      break;
    
    case 'pricing':
      // Preço pode ser BDR ou Closer
      if (currentAgent === 'sdr') {
        return { agent: 'bdr', shouldTransfer: true };
      }
      break;
    
    case 'off_hours':
      // Fora do horário, SDR responde
      return { agent: 'sdr', shouldTransfer: currentAgent !== 'sdr' };
    
    default:
      // Mantém agente atual
      break;
  }

  return { agent: currentAgent, shouldTransfer: false };
};

/**
 * Processa mensagem com o agente apropriado
 */
export const processWithAgent = async (
  context: AgentContext,
  message: string
): Promise<AgentResponse> => {
  const startTime = Date.now();
  
  try {
    // 1. Analisar intent da mensagem
    let intent = await analyzeIntent(message);
    
    // 2. Verificar horário comercial
    if (!isBusinessHours() && intent !== 'off_hours') {
      intent = 'off_hours';
    }
    
    // 3. Determinar agente apropriado
    const { agent: targetAgent, shouldTransfer } = determineAgent(
      intent as IntentType, 
      context.lead.assigned_agent as AgentType
    );
    
    // 4. Construir mensagens para o LLM
    const systemPrompt = AGENT_SYSTEM_PROMPTS[targetAgent];
    const conversationHistory = formatConversationHistory(context.recentConversations);
    
    const contextPrompt = `
INFORMAÇÕES DO LEAD:
- Nome: ${context.lead.name || 'Não informado'}
- Igreja: ${context.lead.church_name || 'Não informada'}
- Telefone: ${context.lead.phone}
- Status: ${context.lead.status}
- Temperatura: ${context.lead.temperature}

HISTÓRICO DE CONVERSAS:
${conversationHistory}

INTENT DETECTADA: ${intent}
${!isBusinessHours() ? '\n⚠️ ATENÇÃO: Fora do horário comercial!' : ''}
`;

    const messages: ChatMessage[] = [
      { role: 'system', content: systemPrompt },
      { role: 'system', content: contextPrompt },
      { role: 'user', content: message }
    ];

    // 5. Chamar Kimi API
    logger.agent(targetAgent, 'processing', {
      leadId: context.lead.id,
      intent,
      shouldTransfer
    });

    const result = await chatCompletion(messages, {
      temperature: 0.7,
      maxTokens: 500
    });

    const executionTime = Date.now() - startTime;

    logger.agent(targetAgent, 'completed', {
      leadId: context.lead.id,
      tokensUsed: result.tokensUsed,
      executionTimeMs: executionTime
    });

    return {
      message: result.content,
      intent: intent as IntentType,
      shouldTransfer,
      transferTo: shouldTransfer ? targetAgent : undefined,
      tokensUsed: result.tokensUsed
    };

  } catch (error) {
    const executionTime = Date.now() - startTime;
    
    logger.error('Agent processing error', error, {
      leadId: context.lead.id,
      executionTimeMs: executionTime
    });

    // Resposta de fallback em caso de erro
    return {
      message: '🙏 Pastor, desculpe! Tivemos um probleminha técnico. Por favor, tente novamente em alguns minutos. Deus abençoe!',
      intent: 'unknown',
      shouldTransfer: false,
      tokensUsed: 0
    };
  }
};
