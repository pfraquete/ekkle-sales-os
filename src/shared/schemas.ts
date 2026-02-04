/**
 * EKKLE SALES OS - Zod Schemas
 * Validação de dados em runtime
 */

import { z } from 'zod';

// ===========================================
// Enums
// ===========================================

export const LeadStatusSchema = z.enum([
  'new',
  'contacted',
  'qualified',
  'negotiating',
  'won',
  'lost'
]);

export const LeadTemperatureSchema = z.enum(['cold', 'warm', 'hot']);

export const AgentTypeSchema = z.enum(['sdr', 'bdr', 'closer']);

export const MessageDirectionSchema = z.enum(['inbound', 'outbound']);

export const IntentTypeSchema = z.enum([
  'greeting',
  'pricing',
  'features',
  'technical',
  'objection',
  'closing',
  'support',
  'off_hours',
  'unknown'
]);

export const ExecutionStatusSchema = z.enum(['started', 'completed', 'failed']);

export const PaymentStatusSchema = z.enum([
  'pending',
  'processing',
  'completed',
  'failed',
  'refunded'
]);

// ===========================================
// Lead Schemas
// ===========================================

export const CreateLeadSchema = z.object({
  phone: z.string().min(10).max(20),
  name: z.string().max(255).optional(),
  church_name: z.string().max(255).optional(),
  status: LeadStatusSchema.optional().default('new'),
  temperature: LeadTemperatureSchema.optional().default('cold'),
  assigned_agent: AgentTypeSchema.optional().default('sdr'),
  metadata: z.record(z.unknown()).optional().default({})
});

export const UpdateLeadSchema = z.object({
  name: z.string().max(255).optional(),
  church_name: z.string().max(255).optional(),
  status: LeadStatusSchema.optional(),
  temperature: LeadTemperatureSchema.optional(),
  assigned_agent: AgentTypeSchema.optional(),
  metadata: z.record(z.unknown()).optional()
});

// ===========================================
// Conversation Schemas
// ===========================================

export const CreateConversationSchema = z.object({
  lead_id: z.string().uuid(),
  message: z.string().min(1),
  direction: MessageDirectionSchema,
  agent_name: AgentTypeSchema,
  intent_detected: IntentTypeSchema,
  metadata: z.record(z.unknown()).optional().default({})
});

// ===========================================
// Agent Execution Schemas
// ===========================================

export const CreateAgentExecutionSchema = z.object({
  lead_id: z.string().uuid(),
  agent_name: AgentTypeSchema,
  input_message: z.string().min(1),
  output_message: z.string().optional(),
  intent_detected: IntentTypeSchema.optional(),
  tokens_used: z.number().int().nonnegative().optional().default(0),
  execution_time_ms: z.number().int().nonnegative().optional().default(0),
  status: ExecutionStatusSchema,
  error_message: z.string().optional(),
  metadata: z.record(z.unknown()).optional().default({})
});

// ===========================================
// Payment Schemas
// ===========================================

export const CreatePaymentSchema = z.object({
  lead_id: z.string().uuid(),
  amount: z.number().positive(),
  currency: z.string().length(3).optional().default('BRL'),
  status: PaymentStatusSchema.optional().default('pending'),
  payment_method: z.string().max(50).optional(),
  external_id: z.string().max(255).optional(),
  metadata: z.record(z.unknown()).optional().default({})
});

// ===========================================
// WhatsApp Webhook Schemas
// ===========================================

export const WhatsAppMessageKeySchema = z.object({
  remoteJid: z.string(),
  fromMe: z.boolean(),
  id: z.string()
});

export const WhatsAppMessageContentSchema = z.object({
  conversation: z.string().optional(),
  extendedTextMessage: z.object({
    text: z.string()
  }).optional()
});

export const WhatsAppMessageSchema = z.object({
  key: WhatsAppMessageKeySchema,
  message: WhatsAppMessageContentSchema,
  messageTimestamp: z.number(),
  pushName: z.string().optional()
});

export const EvolutionWebhookPayloadSchema = z.object({
  event: z.string(),
  instance: z.string(),
  data: WhatsAppMessageSchema
});

// ===========================================
// Query Schemas
// ===========================================

export const PaginationQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().max(100).optional().default(20),
  status: LeadStatusSchema.optional(),
  temperature: LeadTemperatureSchema.optional(),
  search: z.string().optional()
});

// ===========================================
// Type Exports
// ===========================================

export type CreateLeadInput = z.infer<typeof CreateLeadSchema>;
export type UpdateLeadInput = z.infer<typeof UpdateLeadSchema>;
export type CreateConversationInput = z.infer<typeof CreateConversationSchema>;
export type CreateAgentExecutionInput = z.infer<typeof CreateAgentExecutionSchema>;
export type CreatePaymentInput = z.infer<typeof CreatePaymentSchema>;
export type EvolutionWebhookPayload = z.infer<typeof EvolutionWebhookPayloadSchema>;
export type PaginationQuery = z.infer<typeof PaginationQuerySchema>;
