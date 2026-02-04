/**
 * EKKLE SALES OS - Agent Execution Service
 * Operações de banco de dados para log de execuções de agentes
 */

import { getSupabaseAdmin } from '../../shared/supabase';
import { createLogger } from '../../shared/logger';
import type { AgentExecution, CreateAgentExecutionInput } from '../../shared/types';

const logger = createLogger('agent-execution-service');

/**
 * Cria registro de execução de agente
 */
export const createAgentExecution = async (
  input: CreateAgentExecutionInput
): Promise<AgentExecution> => {
  try {
    const supabase = getSupabaseAdmin();
    
    logger.db('INSERT', 'agent_executions', { 
      lead_id: input.lead_id, 
      agent_name: input.agent_name,
      status: input.status
    });
    
    const { data, error } = await supabase
      .from('agent_executions')
      .insert({
        lead_id: input.lead_id,
        agent_name: input.agent_name,
        input_message: input.input_message,
        output_message: input.output_message || null,
        intent_detected: input.intent_detected || null,
        tokens_used: input.tokens_used || 0,
        execution_time_ms: input.execution_time_ms || 0,
        status: input.status,
        error_message: input.error_message || null,
        metadata: input.metadata || {}
      })
      .select()
      .single();

    if (error) {
      throw error;
    }

    logger.info('Agent execution logged', { 
      id: data.id, 
      lead_id: input.lead_id,
      agent_name: input.agent_name,
      status: input.status
    });
    
    return data as AgentExecution;
  } catch (error) {
    logger.error('Error creating agent execution', error, { 
      lead_id: input.lead_id,
      agent_name: input.agent_name 
    });
    throw error;
  }
};

/**
 * Atualiza execução de agente (para completar ou falhar)
 */
export const updateAgentExecution = async (
  id: string,
  updates: Partial<Pick<AgentExecution, 
    'output_message' | 'intent_detected' | 'tokens_used' | 
    'execution_time_ms' | 'status' | 'error_message'
  >>
): Promise<AgentExecution> => {
  try {
    const supabase = getSupabaseAdmin();
    
    logger.db('UPDATE', 'agent_executions', { id, ...updates });
    
    const { data, error } = await supabase
      .from('agent_executions')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw error;
    }

    logger.info('Agent execution updated', { id, status: updates.status });
    return data as AgentExecution;
  } catch (error) {
    logger.error('Error updating agent execution', error, { id });
    throw error;
  }
};

/**
 * Busca execuções de um lead
 */
export const getLeadExecutions = async (
  leadId: string,
  limit = 20
): Promise<AgentExecution[]> => {
  try {
    const supabase = getSupabaseAdmin();
    
    logger.db('SELECT', 'agent_executions', { lead_id: leadId, limit });
    
    const { data, error } = await supabase
      .from('agent_executions')
      .select('*')
      .eq('lead_id', leadId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      throw error;
    }

    return data as AgentExecution[];
  } catch (error) {
    logger.error('Error getting lead executions', error, { leadId });
    throw error;
  }
};

/**
 * Estatísticas de execuções
 */
export const getExecutionStats = async (): Promise<{
  total: number;
  completed: number;
  failed: number;
  avgTokens: number;
  avgTimeMs: number;
}> => {
  try {
    const supabase = getSupabaseAdmin();
    
    // Total e por status
    const { data: stats, error } = await supabase
      .from('agent_executions')
      .select('status, tokens_used, execution_time_ms');

    if (error) {
      throw error;
    }

    const total = stats?.length || 0;
    const completed = stats?.filter(s => s.status === 'completed').length || 0;
    const failed = stats?.filter(s => s.status === 'failed').length || 0;
    
    const avgTokens = total > 0 
      ? Math.round(stats.reduce((sum, s) => sum + (s.tokens_used || 0), 0) / total)
      : 0;
    
    const avgTimeMs = total > 0
      ? Math.round(stats.reduce((sum, s) => sum + (s.execution_time_ms || 0), 0) / total)
      : 0;

    return { total, completed, failed, avgTokens, avgTimeMs };
  } catch (error) {
    logger.error('Error getting execution stats', error);
    throw error;
  }
};
