/**
 * EKKLE SALES OS - Supabase Client
 * Cliente configurado do Supabase
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { config } from './config';
import { createLogger } from './logger';

const logger = createLogger('supabase');

// ===========================================
// Database Types (gerado do schema)
// ===========================================

export interface Database {
  public: {
    Tables: {
      leads: {
        Row: {
          id: string;
          phone: string;
          name: string | null;
          church_name: string | null;
          status: string;
          temperature: string;
          assigned_agent: string;
          embedding: number[] | null;
          metadata: Record<string, unknown>;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          phone: string;
          name?: string | null;
          church_name?: string | null;
          status?: string;
          temperature?: string;
          assigned_agent?: string;
          embedding?: number[] | null;
          metadata?: Record<string, unknown>;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          phone?: string;
          name?: string | null;
          church_name?: string | null;
          status?: string;
          temperature?: string;
          assigned_agent?: string;
          embedding?: number[] | null;
          metadata?: Record<string, unknown>;
          created_at?: string;
          updated_at?: string;
        };
      };
      conversations: {
        Row: {
          id: string;
          lead_id: string;
          message: string;
          direction: string;
          agent_name: string;
          intent_detected: string;
          metadata: Record<string, unknown>;
          created_at: string;
        };
        Insert: {
          id?: string;
          lead_id: string;
          message: string;
          direction: string;
          agent_name: string;
          intent_detected: string;
          metadata?: Record<string, unknown>;
          created_at?: string;
        };
        Update: {
          id?: string;
          lead_id?: string;
          message?: string;
          direction?: string;
          agent_name?: string;
          intent_detected?: string;
          metadata?: Record<string, unknown>;
          created_at?: string;
        };
      };
      agent_executions: {
        Row: {
          id: string;
          lead_id: string;
          agent_name: string;
          input_message: string;
          output_message: string | null;
          intent_detected: string | null;
          tokens_used: number;
          execution_time_ms: number;
          status: string;
          error_message: string | null;
          metadata: Record<string, unknown>;
          created_at: string;
        };
        Insert: {
          id?: string;
          lead_id: string;
          agent_name: string;
          input_message: string;
          output_message?: string | null;
          intent_detected?: string | null;
          tokens_used?: number;
          execution_time_ms?: number;
          status: string;
          error_message?: string | null;
          metadata?: Record<string, unknown>;
          created_at?: string;
        };
        Update: {
          id?: string;
          lead_id?: string;
          agent_name?: string;
          input_message?: string;
          output_message?: string | null;
          intent_detected?: string | null;
          tokens_used?: number;
          execution_time_ms?: number;
          status?: string;
          error_message?: string | null;
          metadata?: Record<string, unknown>;
          created_at?: string;
        };
      };
      payments: {
        Row: {
          id: string;
          lead_id: string;
          amount: number;
          currency: string;
          status: string;
          payment_method: string | null;
          external_id: string | null;
          metadata: Record<string, unknown>;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          lead_id: string;
          amount: number;
          currency?: string;
          status?: string;
          payment_method?: string | null;
          external_id?: string | null;
          metadata?: Record<string, unknown>;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          lead_id?: string;
          amount?: number;
          currency?: string;
          status?: string;
          payment_method?: string | null;
          external_id?: string | null;
          metadata?: Record<string, unknown>;
          created_at?: string;
          updated_at?: string;
        };
      };
      analytics: {
        Row: {
          id: string;
          lead_id: string;
          analysis_type: string;
          address: string | null;
          instagram: string | null;
          competitor_count: number;
          digital_score: number;
          opportunity: string;
          raw_data: Record<string, unknown>;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          lead_id: string;
          analysis_type?: string;
          address?: string | null;
          instagram?: string | null;
          competitor_count?: number;
          digital_score?: number;
          opportunity?: string;
          raw_data?: Record<string, unknown>;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          lead_id?: string;
          analysis_type?: string;
          address?: string | null;
          instagram?: string | null;
          competitor_count?: number;
          digital_score?: number;
          opportunity?: string;
          raw_data?: Record<string, unknown>;
          created_at?: string;
          updated_at?: string;
        };
      };
      conversation_summaries: {
        Row: {
          id: string;
          lead_id: string;
          summary: string;
          messages_count: number;
          last_message_id: string | null;
          key_points: string[];
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          lead_id: string;
          summary: string;
          messages_count?: number;
          last_message_id?: string | null;
          key_points?: string[];
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          lead_id?: string;
          summary?: string;
          messages_count?: number;
          last_message_id?: string | null;
          key_points?: string[];
          created_at?: string;
          updated_at?: string;
        };
      };
    };
  };
}

// ===========================================
// Supabase Clients
// ===========================================

let supabaseClient: SupabaseClient<Database> | null = null;
let supabaseAdmin: SupabaseClient<Database> | null = null;

/**
 * Cliente público do Supabase (usa anon key)
 * Use para operações que respeitam RLS
 */
export const getSupabaseClient = (): SupabaseClient<Database> => {
  if (!supabaseClient) {
    logger.info('Initializing Supabase client');
    supabaseClient = createClient<Database>(
      config.SUPABASE_URL,
      config.SUPABASE_ANON_KEY,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );
  }
  return supabaseClient;
};

/**
 * Cliente admin do Supabase (usa service role key)
 * Use para operações que precisam bypass de RLS
 */
export const getSupabaseAdmin = (): SupabaseClient<Database> => {
  if (!supabaseAdmin) {
    logger.info('Initializing Supabase admin client');
    supabaseAdmin = createClient<Database>(
      config.SUPABASE_URL,
      config.SUPABASE_SERVICE_ROLE_KEY,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );
  }
  return supabaseAdmin;
};

// ===========================================
// Helper Functions
// ===========================================

/**
 * Verifica conexão com o Supabase
 */
export const checkSupabaseConnection = async (): Promise<boolean> => {
  try {
    const supabase = getSupabaseAdmin();
    const { error } = await supabase.from('leads').select('id').limit(1);
    
    if (error && error.code !== 'PGRST116') {
      // PGRST116 = tabela não existe (ok se ainda não criou)
      logger.error('Supabase connection check failed', error);
      return false;
    }
    
    logger.info('Supabase connection verified');
    return true;
  } catch (error) {
    logger.error('Supabase connection error', error);
    return false;
  }
};

export type { SupabaseClient };
