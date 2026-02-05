/**
 * EKKLE SALES OS - Agent Execution Service
 * Operações de banco de dados para log de execuções de agentes
 */

import { getSupabaseAdmin, type Database } from '../../shared/supabase';
import { createLogger } from '../../shared/logger';
import type { AgentExecution, CreateAgentExecutionInput } from '../../shared/types';

const logger = createLogger('agent-execution-service');

type AgentExecutionInsert = Database['public']['Tables']['agent_executions']['Insert'];
type AgentExecutionUpdate = Database['public']['Tables']['agent_executions']['Update'];
type AgentExecutionRow = Database['public']['Tables']['agent_executions']['Row'];

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
    
    const insertData: AgentExecutionInsert = {
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
    };
    
    const { data, error } = await supabase
      .from('agent_executions')
      .insert(insertData)
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
    
    const updateData: AgentExecutionUpdate = {
      ...(updates.output_message !== undefined && { output_message: updates.output_message }),
      ...(updates.intent_detected !== undefined && { intent_detected: updates.intent_detected }),
      ...(updates.tokens_used !== undefined && { tokens_used: updates.tokens_used }),
      ...(updates.execution_time_ms !== undefined && { execution_time_ms: updates.execution_time_ms }),
      ...(updates.status !== undefined && { status: updates.status }),
      ...(updates.error_message !== undefined && { error_message: updates.error_message })
    };
    
    const { data, error } = await supabase
      .from('agent_executions')
      .update(updateData)
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

    const statsData = stats as AgentExecutionRow[] | null;
    const total = statsData?.length || 0;
    const completed = statsData?.filter(s => s.status === 'completed').length || 0;
    const failed = statsData?.filter(s => s.status === 'failed').length || 0;
    
    const avgTokens = total > 0 && statsData
      ? Math.round(statsData.reduce((sum, s) => sum + (s.tokens_used || 0), 0) / total)
      : 0;
    
    const avgTimeMs = total > 0 && statsData
      ? Math.round(statsData.reduce((sum, s) => sum + (s.execution_time_ms || 0), 0) / total)
      : 0;

    return { total, completed, failed, avgTokens, avgTimeMs };
  } catch (error) {
    logger.error('Error getting execution stats', error);
    throw error;
  }
};
