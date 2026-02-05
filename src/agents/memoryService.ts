/**
 * EKKLE SALES OS - Memory Service
 * Sistema de memória de longo prazo para contexto dos agentes
 */

import { getSupabaseAdmin } from '../shared/supabase';
import { createLogger } from '../shared/logger';
import { chatCompletion } from './kimiClient';
import type { Lead, Conversation, AgentType } from '../shared/types';

const logger = createLogger('memory-service');

// ===========================================
// Types
// ===========================================

export interface ConversationSummary {
  id: string;
  lead_id: string;
  summary: string;
  messages_count: number;
  last_message_id: string | null;
  key_points: string[];
  created_at: string;
  updated_at: string;
}

export interface AgentContext {
  lead: Lead;
  recentMessages: Conversation[];
  summary: ConversationSummary | null;
  totalMessages: number;
  contextPrompt: string;
}

// ===========================================
// Constants
// ===========================================

const RECENT_MESSAGES_LIMIT = 10;
const SUMMARY_THRESHOLD = 20;

// ===========================================
// Database Operations
// ===========================================

/**
 * Busca últimas N mensagens do lead
 */
export const getRecentMessages = async (
  leadId: string,
  limit: number = RECENT_MESSAGES_LIMIT
): Promise<Conversation[]> => {
  try {
    const supabase = getSupabaseAdmin();
    
    logger.db('SELECT', 'conversations', { lead_id: leadId, limit });
    
    const { data, error } = await supabase
      .from('conversations')
      .select('*')
      .eq('lead_id', leadId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      throw error;
    }

    // Retorna em ordem cronológica (mais antiga primeiro)
    return (data as Conversation[]).reverse();
  } catch (error) {
    logger.error('Error getting recent messages', error, { leadId });
    throw error;
  }
};

/**
 * Conta total de mensagens do lead
 */
export const countLeadMessages = async (leadId: string): Promise<number> => {
  try {
    const supabase = getSupabaseAdmin();
    
    const { count, error } = await supabase
      .from('conversations')
      .select('*', { count: 'exact', head: true })
      .eq('lead_id', leadId);

    if (error) {
      throw error;
    }

    return count || 0;
  } catch (error) {
    logger.error('Error counting lead messages', error, { leadId });
    return 0;
  }
};

/**
 * Busca resumo existente do lead
 */
export const getConversationSummary = async (
  leadId: string
): Promise<ConversationSummary | null> => {
  try {
    const supabase = getSupabaseAdmin();
    
    logger.db('SELECT', 'conversation_summaries', { lead_id: leadId });
    
    const { data, error } = await supabase
      .from('conversation_summaries')
      .select('*')
      .eq('lead_id', leadId)
      .single();

    if (error && error.code !== 'PGRST116') {
      throw error;
    }

    return data as ConversationSummary | null;
  } catch (error) {
    logger.error('Error getting conversation summary', error, { leadId });
    return null;
  }
};

/**
 * Salva ou atualiza resumo da conversa
 */
export const saveConversationSummary = async (
  leadId: string,
  summary: string,
  messagesCount: number,
  lastMessageId: string | null,
  keyPoints: string[]
): Promise<ConversationSummary> => {
  try {
    const supabase = getSupabaseAdmin();
    
    logger.db('UPSERT', 'conversation_summaries', { lead_id: leadId });
    
    const { data, error } = await supabase
      .from('conversation_summaries')
      .upsert({
        lead_id: leadId,
        summary,
        messages_count: messagesCount,
        last_message_id: lastMessageId,
        key_points: keyPoints
      }, {
        onConflict: 'lead_id'
      })
      .select()
      .single();

    if (error) {
      throw error;
    }

    logger.info('Conversation summary saved', { leadId, messagesCount });
    return data as ConversationSummary;
  } catch (error) {
    logger.error('Error saving conversation summary', error, { leadId });
    throw error;
  }
};

// ===========================================
// Summary Generation
// ===========================================

/**
 * Gera resumo da conversa usando Kimi
 */
export const generateConversationSummary = async (
  conversations: Conversation[],
  lead: Lead
): Promise<{ summary: string; keyPoints: string[] }> => {
  try {
    const conversationText = conversations
      .map(c => {
        const role = c.direction === 'inbound' ? 'Cliente' : 'Agente';
        return `${role}: ${c.message}`;
      })
      .join('\n');

    const systemPrompt = `Você é um assistente que resume conversas de vendas.
Analise a conversa abaixo e forneça:
1. Um resumo conciso (máximo 200 palavras) dos pontos principais
2. Lista de pontos-chave extraídos (máximo 5 itens)

Informações do lead:
- Nome: ${lead.name || 'Não informado'}
- Igreja: ${lead.church_name || 'Não informada'}
- Status: ${lead.status}

Responda APENAS no formato JSON:
{
  "summary": "resumo aqui",
  "keyPoints": ["ponto 1", "ponto 2", ...]
}`;

    const result = await chatCompletion([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: conversationText }
    ], {
      temperature: 0.3,
      maxTokens: 500
    });

    try {
      // Tentar parsear JSON da resposta
      const parsed = JSON.parse(result.content);
      return {
        summary: parsed.summary || result.content,
        keyPoints: Array.isArray(parsed.keyPoints) ? parsed.keyPoints : []
      };
    } catch {
      // Se não for JSON válido, usar resposta como resumo
      return {
        summary: result.content,
        keyPoints: []
      };
    }
  } catch (error) {
    logger.error('Error generating conversation summary', error);
    return {
      summary: 'Erro ao gerar resumo da conversa.',
      keyPoints: []
    };
  }
};

/**
 * Verifica se precisa gerar novo resumo
 */
export const shouldGenerateSummary = (
  totalMessages: number,
  existingSummary: ConversationSummary | null
): boolean => {
  // Se não tem resumo e passou do threshold
  if (!existingSummary && totalMessages > SUMMARY_THRESHOLD) {
    return true;
  }
  
  // Se tem resumo mas muitas mensagens novas (mais de 10 desde último resumo)
  if (existingSummary && totalMessages - existingSummary.messages_count > 10) {
    return true;
  }
  
  return false;
};

// ===========================================
// Context Building
// ===========================================

/**
 * Formata mensagens para o prompt
 */
const formatMessagesForPrompt = (messages: Conversation[]): string => {
  if (messages.length === 0) {
    return 'Nenhuma mensagem anterior.';
  }

  return messages
    .map(c => {
      const role = c.direction === 'inbound' ? 'CLIENTE' : 'AGENTE';
      const time = new Date(c.created_at).toLocaleString('pt-BR');
      return `[${time}] ${role}: ${c.message}`;
    })
    .join('\n');
};

/**
 * Constrói contexto completo para o agente
 * Esta é a função principal que monta todo o contexto
 */
export const buildContext = async (
  lead: Lead
): Promise<AgentContext> => {
  logger.info('Building context for lead', { leadId: lead.id });

  try {
    // 1. Buscar total de mensagens
    const totalMessages = await countLeadMessages(lead.id);
    
    // 2. Buscar últimas 10 mensagens
    const recentMessages = await getRecentMessages(lead.id, RECENT_MESSAGES_LIMIT);
    
    // 3. Buscar resumo existente
    let summary = await getConversationSummary(lead.id);
    
    // 4. Verificar se precisa gerar novo resumo
    if (shouldGenerateSummary(totalMessages, summary)) {
      logger.info('Generating new conversation summary', { 
        leadId: lead.id, 
        totalMessages 
      });
      
      // Buscar todas as mensagens para resumir
      const allMessages = await getRecentMessages(lead.id, 100);
      
      const { summary: newSummary, keyPoints } = await generateConversationSummary(
        allMessages,
        lead
      );
      
      // Salvar novo resumo
      const lastMessage = recentMessages[recentMessages.length - 1];
      summary = await saveConversationSummary(
        lead.id,
        newSummary,
        totalMessages,
        lastMessage?.id || null,
        keyPoints
      );
    }
    
    // 5. Construir prompt de contexto
    const contextPrompt = buildContextPrompt(lead, recentMessages, summary, totalMessages);
    
    logger.info('Context built successfully', {
      leadId: lead.id,
      recentMessagesCount: recentMessages.length,
      totalMessages,
      hasSummary: !!summary
    });

    return {
      lead,
      recentMessages,
      summary,
      totalMessages,
      contextPrompt
    };
  } catch (error) {
    logger.error('Error building context', error, { leadId: lead.id });
    
    // Retornar contexto mínimo em caso de erro
    return {
      lead,
      recentMessages: [],
      summary: null,
      totalMessages: 0,
      contextPrompt: buildMinimalContextPrompt(lead)
    };
  }
};

/**
 * Constrói o prompt de contexto completo
 */
const buildContextPrompt = (
  lead: Lead,
  recentMessages: Conversation[],
  summary: ConversationSummary | null,
  totalMessages: number
): string => {
  const parts: string[] = [];
  
  // Informações do lead
  parts.push(`=== INFORMAÇÕES DO LEAD ===
Nome: ${lead.name || 'Não informado'}
Igreja: ${lead.church_name || 'Não informada'}
Telefone: ${lead.phone}
Status: ${lead.status}
Temperatura: ${lead.temperature}
Agente Atual: ${lead.assigned_agent}
Total de Mensagens: ${totalMessages}`);

  // Dados adicionais do metadata
  if (lead.metadata && Object.keys(lead.metadata).length > 0) {
    const metadata = lead.metadata as Record<string, unknown>;
    const metadataStr = Object.entries(metadata)
      .filter(([_, v]) => v !== null && v !== undefined)
      .map(([k, v]) => `- ${k}: ${v}`)
      .join('\n');
    
    if (metadataStr) {
      parts.push(`\n=== DADOS COLETADOS ===\n${metadataStr}`);
    }
  }

  // Resumo se existir
  if (summary) {
    parts.push(`\n=== RESUMO DA CONVERSA ===
${summary.summary}`);
    
    if (summary.key_points && summary.key_points.length > 0) {
      parts.push(`\nPontos-chave:
${summary.key_points.map(p => `• ${p}`).join('\n')}`);
    }
  }

  // Mensagens recentes
  parts.push(`\n=== ÚLTIMAS ${recentMessages.length} MENSAGENS ===
${formatMessagesForPrompt(recentMessages)}`);

  return parts.join('\n');
};

/**
 * Constrói prompt mínimo em caso de erro
 */
const buildMinimalContextPrompt = (lead: Lead): string => {
  return `=== INFORMAÇÕES DO LEAD ===
Nome: ${lead.name || 'Não informado'}
Igreja: ${lead.church_name || 'Não informada'}
Telefone: ${lead.phone}
Status: ${lead.status}
Temperatura: ${lead.temperature}

(Erro ao carregar histórico de mensagens)`;
};

// ===========================================
// Utility Functions
// ===========================================

/**
 * Extrai informações importantes da mensagem
 * (endereço, Instagram, etc.)
 */
export const extractLeadInfo = async (
  message: string,
  currentMetadata: Record<string, unknown>
): Promise<Record<string, unknown>> => {
  try {
    const systemPrompt = `Analise a mensagem do cliente e extraia informações relevantes.
Retorne APENAS um JSON com os campos encontrados:
- address: endereço completo se mencionado
- instagram: @ do Instagram se mencionado
- congregation_size: número de membros se mencionado
- city: cidade se mencionada
- state: estado se mencionado

Se não encontrar algum campo, não inclua no JSON.
Responda APENAS com o JSON, sem explicações.`;

    const result = await chatCompletion([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: message }
    ], {
      temperature: 0.1,
      maxTokens: 200
    });

    try {
      const extracted = JSON.parse(result.content);
      
      // Merge com metadata existente
      return {
        ...currentMetadata,
        ...extracted
      };
    } catch {
      return currentMetadata;
    }
  } catch (error) {
    logger.error('Error extracting lead info', error);
    return currentMetadata;
  }
};
