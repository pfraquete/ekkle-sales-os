/**
 * EKKLE SALES OS - Kimi K2.5 API Client
 * Cliente para API Kimi (OpenAI compatible)
 */

import OpenAI from 'openai';
import { config } from '../shared/config';
import { createLogger } from '../shared/logger';

const logger = createLogger('kimi-client');

let kimiClient: OpenAI | null = null;

/**
 * Obtém cliente Kimi configurado
 */
export const getKimiClient = (): OpenAI => {
  if (!kimiClient) {
    logger.info('Initializing Kimi API client', {
      baseUrl: config.KIMI_API_BASE_URL,
      model: config.KIMI_MODEL
    });

    kimiClient = new OpenAI({
      apiKey: config.KIMI_API_KEY,
      baseURL: config.KIMI_API_BASE_URL
    });
  }

  return kimiClient;
};

/**
 * Interface para resposta de chat
 */
export interface ChatCompletionResult {
  content: string;
  tokensUsed: number;
  finishReason: string | null;
}

/**
 * Interface para mensagem de chat
 */
export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

/**
 * Faz chamada de chat completion
 */
export const chatCompletion = async (
  messages: ChatMessage[],
  options?: {
    temperature?: number;
    maxTokens?: number;
  }
): Promise<ChatCompletionResult> => {
  const client = getKimiClient();
  const startTime = Date.now();

  try {
    logger.api('kimi', 'chat.completions.create', {
      model: config.KIMI_MODEL,
      messagesCount: messages.length,
      temperature: options?.temperature
    });

    const response = await client.chat.completions.create({
      model: config.KIMI_MODEL,
      messages: messages.map(m => ({
        role: m.role,
        content: m.content
      })),
      temperature: options?.temperature ?? 0.7,
      max_tokens: options?.maxTokens ?? 1024
    });

    const content = response.choices[0]?.message?.content || '';
    const tokensUsed = response.usage?.total_tokens || 0;
    const finishReason = response.choices[0]?.finish_reason || null;

    const latency = Date.now() - startTime;
    
    logger.info('Kimi API response received', {
      tokensUsed,
      finishReason,
      latencyMs: latency,
      responseLength: content.length
    });

    return {
      content,
      tokensUsed,
      finishReason
    };
  } catch (error) {
    const latency = Date.now() - startTime;
    
    logger.error('Kimi API error', error, {
      latencyMs: latency,
      model: config.KIMI_MODEL
    });

    throw error;
  }
};

/**
 * Analisa intent da mensagem usando Kimi
 */
export const analyzeIntent = async (message: string): Promise<string> => {
  const systemPrompt = `Você é um classificador de intenções. Analise a mensagem do usuário e retorne APENAS uma das seguintes categorias:
- greeting: saudação ou cumprimento
- pricing: pergunta sobre preço ou valores
- features: pergunta sobre funcionalidades
- technical: dúvida técnica específica
- objection: objeção ou resistência à compra
- closing: intenção de fechar negócio
- support: pedido de suporte
- off_hours: mensagem fora do horário comercial
- unknown: não se encaixa em nenhuma categoria

Responda APENAS com a categoria, sem explicação.`;

  try {
    const result = await chatCompletion([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: message }
    ], {
      temperature: 0.1,
      maxTokens: 20
    });

    const intent = result.content.toLowerCase().trim();
    
    // Validar se é uma intent válida
    const validIntents = [
      'greeting', 'pricing', 'features', 'technical',
      'objection', 'closing', 'support', 'off_hours', 'unknown'
    ];

    if (validIntents.includes(intent)) {
      return intent;
    }

    logger.warn('Invalid intent detected, defaulting to unknown', { 
      detected: intent 
    });
    return 'unknown';
  } catch (error) {
    logger.error('Error analyzing intent', error);
    return 'unknown';
  }
};
