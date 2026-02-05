/**
 * EKKLE SALES OS - Agent Prompts
 * Exporta todos os prompts dos agentes
 */

export { SDR_PROMPT } from './sdr-prompt';
export { BDR_PROMPT } from './bdr-prompt';
export { CLOSER_PROMPT } from './closer-prompt';

import { SDR_PROMPT } from './sdr-prompt';
import { BDR_PROMPT } from './bdr-prompt';
import { CLOSER_PROMPT } from './closer-prompt';

/**
 * Mapa de prompts por tipo de agente
 */
export const AGENT_PROMPTS: Record<string, string> = {
  sdr: SDR_PROMPT,
  bdr: BDR_PROMPT,
  closer: CLOSER_PROMPT,
  ae: CLOSER_PROMPT // AE usa mesmo prompt do Closer
};

/**
 * Interface para contexto do prompt
 */
export interface PromptContext {
  // Lead info
  name?: string;
  church_name?: string;
  status?: string;
  temperature?: number;
  address?: string;
  instagram?: string;
  interested_plan?: string;
  previous_objections?: string;

  // Conversation
  message: string;
  last_message?: string;
  conversation_history?: string;

  // Analytics
  competitor_count?: number;
  digital_score?: number;

  // Payment
  payment_link?: string;
}

/**
 * Substitui variaveis no prompt com valores do contexto
 */
export const buildPrompt = (agentType: string, context: PromptContext): string => {
  let prompt = AGENT_PROMPTS[agentType] || AGENT_PROMPTS.sdr;

  // Substituir todas as variaveis
  const replacements: Record<string, string> = {
    '{{name}}': context.name || 'Pastor',
    '{{church_name}}': context.church_name || 'sua igreja',
    '{{status}}': context.status || 'new',
    '{{temperature}}': String(context.temperature || 0),
    '{{address}}': context.address || '',
    '{{instagram}}': context.instagram || '',
    '{{interested_plan}}': context.interested_plan || 'Essencial',
    '{{previous_objections}}': context.previous_objections || 'nenhuma',
    '{{message}}': context.message || '',
    '{{last_message}}': context.last_message || '',
    '{{conversation_history}}': context.conversation_history || 'Primeiro contato',
    '{{competitor_count}}': String(context.competitor_count || 5),
    '{{digital_score}}': String(context.digital_score || 3),
    '{{payment_link}}': context.payment_link || 'https://pay.ekkle.com.br/checkout'
  };

  for (const [key, value] of Object.entries(replacements)) {
    prompt = prompt.replace(new RegExp(key.replace(/[{}]/g, '\\$&'), 'g'), value);
  }

  return prompt;
};

export default AGENT_PROMPTS;
