/**
 * EKKLE SALES OS - Conversation Service
 * Operações de banco de dados para conversações
 */

import { getSupabaseAdmin, type Database } from '../../shared/supabase';
import { createLogger } from '../../shared/logger';
import type { Conversation, CreateConversationInput } from '../../shared/types';

const logger = createLogger('conversation-service');

type ConversationInsert = Database['public']['Tables']['conversations']['Insert'];

/**
 * Cria nova mensagem de conversação
 */
export const createConversation = async (input: CreateConversationInput): Promise<Conversation> => {
  try {
    const supabase = getSupabaseAdmin();
    
    logger.db('INSERT', 'conversations', { 
      lead_id: input.lead_id, 
      direction: input.direction 
    });
    
    const insertData: ConversationInsert = {
      lead_id: input.lead_id,
      message: input.message,
      direction: input.direction,
      agent_name: input.agent_name,
      intent_detected: input.intent_detected,
      metadata: input.metadata || {}
    };
    
    const { data, error } = await supabase
      .from('conversations')
      .insert(insertData)
      .select()
      .single();

    if (error) {
      throw error;
    }

    logger.info('Conversation created', { 
      id: data.id, 
      lead_id: input.lead_id,
      direction: input.direction 
    });
    
    return data as Conversation;
  } catch (error) {
    logger.error('Error creating conversation', error, { lead_id: input.lead_id });
    throw error;
  }
};

/**
 * Busca conversações recentes de um lead
 */
export const getRecentConversations = async (
  leadId: string, 
  limit = 10
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
    logger.error('Error getting recent conversations', error, { leadId });
    throw error;
  }
};

/**
 * Busca todas as conversações de um lead
 */
export const getLeadConversations = async (leadId: string): Promise<Conversation[]> => {
  try {
    const supabase = getSupabaseAdmin();
    
    logger.db('SELECT', 'conversations', { lead_id: leadId });
    
    const { data, error } = await supabase
      .from('conversations')
      .select('*')
      .eq('lead_id', leadId)
      .order('created_at', { ascending: true });

    if (error) {
      throw error;
    }

    return data as Conversation[];
  } catch (error) {
    logger.error('Error getting lead conversations', error, { leadId });
    throw error;
  }
};

/**
 * Conta mensagens de um lead
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
    throw error;
  }
};
