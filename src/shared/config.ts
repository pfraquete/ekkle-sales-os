/**
 * EKKLE SALES OS - Configuration
 * Configuração centralizada do sistema
 */

import { z } from 'zod';

// ===========================================
// Environment Schema
// ===========================================

const envSchema = z.object({
  // Server
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3000),
  API_HOST: z.string().default('0.0.0.0'),

  // Supabase
  SUPABASE_URL: z.string().url(),
  SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),

  // Redis
  REDIS_URL: z.string().optional(),
  REDIS_HOST: z.string().default('localhost'),
  REDIS_PORT: z.coerce.number().default(6379),
  REDIS_PASSWORD: z.string().optional(),

  // Kimi API
  KIMI_API_KEY: z.string().min(1),
  KIMI_API_BASE_URL: z.string().url().default('https://api.moonshot.cn/v1'),
  KIMI_MODEL: z.string().default('moonshot-v1-128k'),

  // Evolution API
  EVOLUTION_API_URL: z.string().url(),
  EVOLUTION_API_KEY: z.string().min(1),
  EVOLUTION_INSTANCE_NAME: z.string().default('ekkle-sales'),

  // Webhook
  WEBHOOK_SECRET: z.string().optional(),

  // Rate Limiting
  RATE_LIMIT_MAX: z.coerce.number().default(100),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().default(60000),

  // Logging
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info')
});

// ===========================================
// Parse and Export Config
// ===========================================

const parseEnv = () => {
  try {
    return envSchema.parse(process.env);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const missingVars = error.errors.map(e => e.path.join('.')).join(', ');
      console.error(`[CONFIG] Missing or invalid environment variables: ${missingVars}`);
      console.error('[CONFIG] Please check your .env file');
      
      // Em desenvolvimento, retorna valores padrão para permitir inicialização
      if (process.env.NODE_ENV === 'development') {
        console.warn('[CONFIG] Running with partial config in development mode');
        return {
          NODE_ENV: 'development' as const,
          PORT: 3000,
          API_HOST: '0.0.0.0',
          SUPABASE_URL: process.env.SUPABASE_URL || 'https://placeholder.supabase.co',
          SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY || 'placeholder',
          SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY || 'placeholder',
          REDIS_URL: process.env.REDIS_URL,
          REDIS_HOST: process.env.REDIS_HOST || 'localhost',
          REDIS_PORT: parseInt(process.env.REDIS_PORT || '6379'),
          REDIS_PASSWORD: process.env.REDIS_PASSWORD,
          KIMI_API_KEY: process.env.KIMI_API_KEY || 'placeholder',
          KIMI_API_BASE_URL: process.env.KIMI_API_BASE_URL || 'https://api.moonshot.cn/v1',
          KIMI_MODEL: process.env.KIMI_MODEL || 'moonshot-v1-128k',
          EVOLUTION_API_URL: process.env.EVOLUTION_API_URL || 'https://placeholder.evolution.com',
          EVOLUTION_API_KEY: process.env.EVOLUTION_API_KEY || 'placeholder',
          EVOLUTION_INSTANCE_NAME: process.env.EVOLUTION_INSTANCE_NAME || 'ekkle-sales',
          WEBHOOK_SECRET: process.env.WEBHOOK_SECRET,
          RATE_LIMIT_MAX: parseInt(process.env.RATE_LIMIT_MAX || '100'),
          RATE_LIMIT_WINDOW_MS: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000'),
          LOG_LEVEL: 'info' as const
        };
      }
      
      throw error;
    }
    throw error;
  }
};

export const config = parseEnv();

// ===========================================
// Config Helpers
// ===========================================

export const isDevelopment = () => config.NODE_ENV === 'development';
export const isProduction = () => config.NODE_ENV === 'production';
export const isTest = () => config.NODE_ENV === 'test';

export const getRedisConfig = () => {
  if (config.REDIS_URL) {
    return { url: config.REDIS_URL };
  }
  return {
    host: config.REDIS_HOST,
    port: config.REDIS_PORT,
    password: config.REDIS_PASSWORD || undefined
  };
};

// ===========================================
// Queue Names
// ===========================================

export const QUEUE_NAMES = {
  WHATSAPP_INCOMING: 'whatsapp:incoming',
  WHATSAPP_OUTGOING: 'whatsapp:outgoing',
  AGENT_PROCESSING: 'agent:processing'
} as const;

// ===========================================
// Agent Prompts
// ===========================================

export const AGENT_SYSTEM_PROMPTS = {
  sdr: `Você é um SDR (Sales Development Representative) da EKKLE, uma plataforma de gestão para igrejas.
Seu papel é fazer o primeiro contato com pastores e líderes de igrejas interessados.
Seja amigável, profissional e empático. Entenda as necessidades da igreja.
Colete informações básicas: nome do pastor, nome da igreja, tamanho da congregação.
Se o lead mostrar interesse técnico profundo, indique que um especialista entrará em contato.
Horário de atendimento: Segunda a Sexta, 8h às 18h.
Fora do horário, informe que responderá no próximo dia útil.`,

  bdr: `Você é um BDR (Business Development Representative) técnico da EKKLE.
Seu papel é responder dúvidas técnicas sobre a plataforma.
Explique funcionalidades: gestão de membros, financeiro, eventos, comunicação.
Seja detalhado mas objetivo. Use exemplos práticos de como igrejas usam a plataforma.
Se o lead estiver pronto para comprar, transfira para o Closer.
Mantenha tom profissional e conhecedor.`,

  closer: `Você é um Closer de vendas da EKKLE.
Seu papel é fechar vendas com leads qualificados.
Apresente planos e preços de forma clara.
Trate objeções com empatia e argumentos sólidos.
Ofereça condições especiais quando apropriado.
Guie o lead pelo processo de assinatura.
Seja confiante mas não agressivo.`
} as const;
