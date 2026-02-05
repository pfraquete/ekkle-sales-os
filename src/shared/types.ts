/**
 * EKKLE SALES OS - Shared Types
 * Definições de tipos TypeScript para todo o sistema
 */

// ===========================================
// Lead Types
// ===========================================

export type LeadStatus = 
  | 'new'           // Novo lead
  | 'contacted'     // Já foi contatado
  | 'qualified'     // Qualificado para venda
  | 'negotiating'   // Em negociação
  | 'won'           // Venda fechada
  | 'lost';         // Perdido

export type LeadTemperature = 
  | 'cold'          // Frio - sem interesse aparente
  | 'warm'          // Morno - algum interesse
  | 'hot';          // Quente - muito interessado

export type AgentType = 
  | 'sdr'           // Sales Development Rep - primeiro contato
  | 'bdr'           // Business Development Rep - qualificação técnica
  | 'ae'            // Account Executive - fechamento de vendas
  | 'closer';       // Closer - alias para AE (compatibilidade)

export interface Lead {
  id: string;
  phone: string;
  name: string | null;
  church_name: string | null;
  status: LeadStatus;
  temperature: LeadTemperature;
  assigned_agent: AgentType;
  embedding: number[] | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface CreateLeadInput {
  phone: string;
  name?: string;
  church_name?: string;
  status?: LeadStatus;
  temperature?: LeadTemperature;
  assigned_agent?: AgentType;
  metadata?: Record<string, unknown>;
}

export interface UpdateLeadInput {
  name?: string;
  church_name?: string;
  status?: LeadStatus;
  temperature?: LeadTemperature;
  assigned_agent?: AgentType;
  metadata?: Record<string, unknown>;
}

// ===========================================
// Conversation Types
// ===========================================

export type MessageDirection = 'inbound' | 'outbound';

export type IntentType = 
  | 'greeting'           // Saudação
  | 'pricing'            // Pergunta sobre preço
  | 'features'           // Pergunta sobre funcionalidades
  | 'technical'          // Dúvida técnica
  | 'objection'          // Objeção de venda
  | 'closing'            // Intenção de fechar
  | 'support'            // Suporte
  | 'off_hours'          // Fora do horário
  | 'unknown';           // Não identificado

export interface Conversation {
  id: string;
  lead_id: string;
  message: string;
  direction: MessageDirection;
  agent_name: AgentType;
  intent_detected: IntentType;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface CreateConversationInput {
  lead_id: string;
  message: string;
  direction: MessageDirection;
  agent_name: AgentType;
  intent_detected: IntentType;
  metadata?: Record<string, unknown>;
}

// ===========================================
// Agent Execution Types
// ===========================================

export type ExecutionStatus = 'started' | 'completed' | 'failed';

export interface AgentExecution {
  id: string;
  lead_id: string;
  agent_name: AgentType;
  input_message: string;
  output_message: string | null;
  intent_detected: IntentType | null;
  tokens_used: number;
  execution_time_ms: number;
  status: ExecutionStatus;
  error_message: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface CreateAgentExecutionInput {
  lead_id: string;
  agent_name: AgentType;
  input_message: string;
  output_message?: string;
  intent_detected?: IntentType;
  tokens_used?: number;
  execution_time_ms?: number;
  status: ExecutionStatus;
  error_message?: string;
  metadata?: Record<string, unknown>;
}

// ===========================================
// Payment Types
// ===========================================

export type PaymentStatus = 
  | 'pending'       // Aguardando pagamento
  | 'processing'    // Processando
  | 'completed'     // Pago
  | 'failed'        // Falhou
  | 'refunded';     // Reembolsado

export interface Payment {
  id: string;
  lead_id: string;
  amount: number;
  currency: string;
  status: PaymentStatus;
  payment_method: string | null;
  external_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface CreatePaymentInput {
  lead_id: string;
  amount: number;
  currency?: string;
  status?: PaymentStatus;
  payment_method?: string;
  external_id?: string;
  metadata?: Record<string, unknown>;
}

// ===========================================
// WhatsApp Webhook Types
// ===========================================

export interface WhatsAppMessage {
  key: {
    remoteJid: string;
    fromMe: boolean;
    id: string;
  };
  message: {
    conversation?: string;
    extendedTextMessage?: {
      text: string;
    };
  };
  messageTimestamp: number;
  pushName?: string;
}

export interface EvolutionWebhookPayload {
  event: string;
  instance: string;
  data: WhatsAppMessage;
}

// ===========================================
// Queue Types
// ===========================================

export interface WhatsAppQueueJob {
  phone: string;
  message: string;
  pushName?: string;
  messageId: string;
  timestamp: number;
}

export interface AgentResponseJob {
  leadId: string;
  phone: string;
  response: string;
}

// ===========================================
// API Response Types
// ===========================================

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  success: boolean;
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// ===========================================
// Agent Context Types
// ===========================================

export interface AgentContext {
  lead: Lead;
  recentConversations: Conversation[];
  systemPrompt: string;
}

export interface AgentResponse {
  message: string;
  intent: IntentType;
  shouldTransfer: boolean;
  transferTo?: AgentType;
  tokensUsed: number;
}
