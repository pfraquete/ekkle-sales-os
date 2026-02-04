/**
 * EKKLE SALES OS - Lead Service
 * Operações de banco de dados para leads
 */

import { getSupabaseAdmin } from '../../shared/supabase';
import { createLogger } from '../../shared/logger';
import type { Lead, CreateLeadInput, UpdateLeadInput, PaginatedResponse } from '../../shared/types';
import { NotFoundError } from '../middleware/errorHandler';

const logger = createLogger('lead-service');

/**
 * Busca lead por telefone
 */
export const findLeadByPhone = async (phone: string): Promise<Lead | null> => {
  try {
    const supabase = getSupabaseAdmin();
    
    logger.db('SELECT', 'leads', { phone });
    
    const { data, error } = await supabase
      .from('leads')
      .select('*')
      .eq('phone', phone)
      .single();

    if (error && error.code !== 'PGRST116') {
      throw error;
    }

    return data as Lead | null;
  } catch (error) {
    logger.error('Error finding lead by phone', error, { phone });
    throw error;
  }
};

/**
 * Busca lead por ID
 */
export const findLeadById = async (id: string): Promise<Lead | null> => {
  try {
    const supabase = getSupabaseAdmin();
    
    logger.db('SELECT', 'leads', { id });
    
    const { data, error } = await supabase
      .from('leads')
      .select('*')
      .eq('id', id)
      .single();

    if (error && error.code !== 'PGRST116') {
      throw error;
    }

    return data as Lead | null;
  } catch (error) {
    logger.error('Error finding lead by id', error, { id });
    throw error;
  }
};

/**
 * Cria novo lead ou retorna existente (idempotente)
 */
export const createOrGetLead = async (input: CreateLeadInput): Promise<{ lead: Lead; isNew: boolean }> => {
  try {
    // Primeiro tenta encontrar lead existente
    const existingLead = await findLeadByPhone(input.phone);
    
    if (existingLead) {
      logger.info('Lead already exists', { phone: input.phone, id: existingLead.id });
      return { lead: existingLead, isNew: false };
    }

    // Cria novo lead
    const supabase = getSupabaseAdmin();
    
    logger.db('INSERT', 'leads', { phone: input.phone });
    
    const { data, error } = await supabase
      .from('leads')
      .insert({
        phone: input.phone,
        name: input.name || null,
        church_name: input.church_name || null,
        status: input.status || 'new',
        temperature: input.temperature || 'cold',
        assigned_agent: input.assigned_agent || 'sdr',
        metadata: input.metadata || {}
      })
      .select()
      .single();

    if (error) {
      // Se erro de unique constraint, tenta buscar novamente (race condition)
      if (error.code === '23505') {
        const lead = await findLeadByPhone(input.phone);
        if (lead) {
          return { lead, isNew: false };
        }
      }
      throw error;
    }

    logger.info('Lead created', { id: data.id, phone: input.phone });
    return { lead: data as Lead, isNew: true };
  } catch (error) {
    logger.error('Error creating lead', error, { phone: input.phone });
    throw error;
  }
};

/**
 * Atualiza lead existente
 */
export const updateLead = async (id: string, input: UpdateLeadInput): Promise<Lead> => {
  try {
    const supabase = getSupabaseAdmin();
    
    logger.db('UPDATE', 'leads', { id, ...input });
    
    const { data, error } = await supabase
      .from('leads')
      .update(input)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        throw new NotFoundError('Lead');
      }
      throw error;
    }

    logger.info('Lead updated', { id });
    return data as Lead;
  } catch (error) {
    logger.error('Error updating lead', error, { id });
    throw error;
  }
};

/**
 * Lista leads com paginação e filtros
 */
export const listLeads = async (options: {
  page?: number;
  limit?: number;
  status?: string;
  temperature?: string;
  search?: string;
}): Promise<PaginatedResponse<Lead>> => {
  try {
    const page = options.page || 1;
    const limit = options.limit || 20;
    const offset = (page - 1) * limit;

    const supabase = getSupabaseAdmin();
    
    logger.db('SELECT', 'leads', { page, limit, ...options });

    // Query base
    let query = supabase
      .from('leads')
      .select('*', { count: 'exact' });

    // Aplicar filtros
    if (options.status) {
      query = query.eq('status', options.status);
    }
    if (options.temperature) {
      query = query.eq('temperature', options.temperature);
    }
    if (options.search) {
      query = query.or(`name.ilike.%${options.search}%,church_name.ilike.%${options.search}%,phone.ilike.%${options.search}%`);
    }

    // Paginação e ordenação
    const { data, error, count } = await query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      throw error;
    }

    const total = count || 0;
    const totalPages = Math.ceil(total / limit);

    return {
      success: true,
      data: data as Lead[],
      pagination: {
        page,
        limit,
        total,
        totalPages
      }
    };
  } catch (error) {
    logger.error('Error listing leads', error);
    throw error;
  }
};

/**
 * Conta total de leads
 */
export const countLeads = async (): Promise<number> => {
  try {
    const supabase = getSupabaseAdmin();
    
    const { count, error } = await supabase
      .from('leads')
      .select('*', { count: 'exact', head: true });

    if (error) {
      throw error;
    }

    return count || 0;
  } catch (error) {
    logger.error('Error counting leads', error);
    throw error;
  }
};
