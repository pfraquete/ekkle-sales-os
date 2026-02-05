/**
 * EKKLE SALES OS - Shared Module Index
 * Exporta todos os módulos compartilhados
 */

// Types (interfaces e tipos base)
export type {
  Lead,
  LeadStatus,
  LeadTemperature,
  AgentType,
  Conversation,
  MessageDirection,
  IntentType,
  AgentExecution,
  ExecutionStatus,
  Payment,
  PaymentStatus,
  WhatsAppMessage,
  WhatsAppQueueJob,
  AgentResponseJob,
  ApiResponse,
  PaginatedResponse,
  AgentContext,
  AgentResponse,
} from './types';

// Schemas (validação Zod) - exporta schemas e tipos inferidos
export {
  LeadStatusSchema,
  LeadTemperatureSchema,
  AgentTypeSchema,
  MessageDirectionSchema,
  IntentTypeSchema,
  ExecutionStatusSchema,
  PaymentStatusSchema,
  CreateLeadSchema,
  UpdateLeadSchema,
  CreateConversationSchema,
  CreateAgentExecutionSchema,
  CreatePaymentSchema,
  WhatsAppMessageKeySchema,
  WhatsAppMessageContentSchema,
  WhatsAppMessageSchema,
  EvolutionWebhookPayloadSchema,
  PaginationQuerySchema,
} from './schemas';

// Tipos inferidos dos schemas (usados para input)
export type {
  CreateLeadInput,
  UpdateLeadInput,
  CreateConversationInput,
  CreateAgentExecutionInput,
  CreatePaymentInput,
  EvolutionWebhookPayload,
  PaginationQuery,
} from './schemas';

// Config
export { config } from './config';

// Logger
export { createLogger } from './logger';

// Supabase
export { 
  getSupabaseClient, 
  getSupabaseAdmin, 
  checkSupabaseConnection,
  type Database,
} from './supabase';

// Redis
export { 
  getRedisClient, 
  checkRedisConnection 
} from './redis';
