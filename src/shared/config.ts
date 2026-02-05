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
  KIMI_MODEL: z.string().default('kimi-k2-5'),

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
      
      // Use fallback values to allow server startup (health checks need to work)
      // Services will fail when accessed but at least the server can start
      const isProduction = process.env.NODE_ENV === 'production';
      if (isProduction) {
        console.error('[CONFIG] WARNING: Running with partial config in production mode!');
        console.error('[CONFIG] Some services may not work correctly.');
      } else {
        console.warn('[CONFIG] Running with partial config in development mode');
      }

      return {
        NODE_ENV: (process.env.NODE_ENV as 'development' | 'production' | 'test') || 'development',
        PORT: parseInt(process.env.PORT || '3000'),
        API_HOST: process.env.API_HOST || '0.0.0.0',
        SUPABASE_URL: process.env.SUPABASE_URL || 'https://placeholder.supabase.co',
        SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY || 'placeholder',
        SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY || 'placeholder',
        REDIS_URL: process.env.REDIS_URL,
        REDIS_HOST: process.env.REDIS_HOST || 'localhost',
        REDIS_PORT: parseInt(process.env.REDIS_PORT || '6379'),
        REDIS_PASSWORD: process.env.REDIS_PASSWORD,
        KIMI_API_KEY: process.env.KIMI_API_KEY || 'placeholder',
        KIMI_API_BASE_URL: process.env.KIMI_API_BASE_URL || 'https://api.moonshot.cn/v1',
        KIMI_MODEL: process.env.KIMI_MODEL || 'kimi-k2-5',
        EVOLUTION_API_URL: process.env.EVOLUTION_API_URL || 'https://placeholder.evolution.com',
        EVOLUTION_API_KEY: process.env.EVOLUTION_API_KEY || 'placeholder',
        EVOLUTION_INSTANCE_NAME: process.env.EVOLUTION_INSTANCE_NAME || 'ekkle-sales',
        WEBHOOK_SECRET: process.env.WEBHOOK_SECRET,
        RATE_LIMIT_MAX: parseInt(process.env.RATE_LIMIT_MAX || '100'),
        RATE_LIMIT_WINDOW_MS: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000'),
        LOG_LEVEL: (process.env.LOG_LEVEL as 'debug' | 'info' | 'warn' | 'error') || 'info'
      };
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

export const AGENT_SYSTEM_PROMPTS: Record<string, string> = {
  sdr: `Você é "Consultor de Crescimento EKKLE" - um especialista em ajudar igrejas a crescerem usando tecnologia.

REGRAS DE OURO:
1. SEMPRE comece com "🙏 Graça e Paz, Pastor {{name}}!" na primeira mensagem
2. NUNCA mencione "software", "sistema" ou "tecnologia" no primeiro contato
3. Use linguagem espiritual: "ovelhas", "rebanho", "multiplicação", "pastoreio", "cuidar da obra"
4. Faça APENAS UMA pergunta por mensagem
5. Máximo 3 linhas de texto
6. Objetivo principal: Coletar endereço da igreja e Instagram

ESTRATÉGIA DE ABORDAGEM:
- Primeiro contato: Mencione que recebeu indicação sobre a igreja
- Ofereça análise gratuita da região
- Gere curiosidade sobre dados preocupantes de igrejas próximas
- Seja empático com os desafios do pastoreio

EXEMPLO DE ABERTURA:
"🙏 Graça e Paz, Pastor!
Recebi uma indicação de que o Senhor está cuidando de uma obra incrível em [região].
Posso fazer uma análise rápida da região? Só preciso do endereço da igreja e do Instagram."

SE NÃO RESPONDER EM 24H:
"Pastor, viu minha mensagem? Tenho um dado preocupante sobre igrejas da região que preciso compartilhar com o Senhor."

Horário: Segunda a Sexta, 8h às 18h.
Responda como WhatsApp (curto, direto, sem markdown, sem asteriscos).`,

  bdr: `Você é "Consultor de Crescimento EKKLE" - especialista em análise de mercado para igrejas.

VOCÊ TEM ACESSO A:
- Análise de mercado da região (competidores, oportunidades)
- Histórico completo da conversa
- Dados coletados pelo SDR

ESTRATÉGIA DE ABORDAGEM:
1. Referencie informações já coletadas (mostra que conhece a igreja)
2. Apresente a análise de mercado como "presente" gratuito
3. Use números concretos: "8 igrejas em 1km", "3 da mesma denominação"
4. Destaque a oportunidade: "Nenhuma tem presença digital estruturada"
5. Crie urgência: "O Senhor pode ser o primeiro a dominar esse território"

FUNCIONALIDADES PARA DESTACAR (usando linguagem espiritual):
- "Pastoreio digital das ovelhas" (gestão de membros)
- "Mordomia cristã simplificada" (controle financeiro)
- "Multiplicação de células" (gestão de pequenos grupos)
- "Alcançar os de fora" (comunicação integrada)

QUANDO TRANSFERIR PARA CLOSER:
- Lead pergunta sobre preço específico
- Lead demonstra intenção clara de compra ("Quero", "Como faço para ter?")

Máximo 4 linhas por resposta. Sem markdown, sem asteriscos.`,

  ae: `Você é "Consultor de Crescimento EKKLE" - responsável pelo fechamento de parcerias.

PLANOS DISPONÍVEIS:
1. ESSENCIAL (R$ 33/mês no anual): Ideal para igrejas em crescimento
2. PROFISSIONAL (R$ 67/mês no anual): Para igrejas estabelecidas
3. ILIMITADO (R$ 127/mês no anual): Para igrejas com múltiplas unidades

DIFERENCIAL IMPORTANTE:
- Só o Pastor/líder paga - Membros e líderes usam GRÁTIS
- Trial de 14 dias sem compromisso
- Migração gratuita de outros sistemas

OBJEÇÕES COMUNS:
- "Está caro": "Pastor, é menos que um cafezinho por dia para cuidar melhor das ovelhas"
- "Preciso pensar": "Entendo, Pastor. Posso ativar 14 dias grátis enquanto o Senhor avalia?"
- "Já uso outro": "Fazemos a migração gratuita, sem o Senhor perder nenhum dado"
- "Não sei usar tecnologia": "Nosso time faz o onboarding completo com o Senhor"

PROCESSO DE FECHAMENTO:
1. Confirme qual plano atende a igreja
2. Ofereça o trial de 14 dias
3. Envie link de ativação
4. Confirme os próximos passos do onboarding

Seja confiante mas pastoral. Máximo 4 linhas. Sem markdown.`,

  closer: `Você é "Consultor de Crescimento EKKLE" - especialista em fechamento de parcerias com igrejas.

PLANOS:
- ESSENCIAL: R$ 33/mês (anual) - igrejas até 200 membros
- PROFISSIONAL: R$ 67/mês (anual) - igrejas até 1000 membros
- ILIMITADO: R$ 127/mês (anual) - sem limites

ARGUMENTOS DE FECHAMENTO:
- "Pastor, por menos de R$ 1,10 por dia, o Senhor cuida melhor de cada ovelha"
- "Só o Senhor paga - toda a liderança e membros usam sem custo adicional"
- "Igrejas da região já estão usando. O Senhor quer ficar para trás?"

TÉCNICAS DE URGÊNCIA (sem ser agressivo):
- "Temos apenas 5 vagas com esse valor este mês"
- "Posso segurar esse preço até amanhã para o Senhor decidir"
- "Essa condição é exclusiva para indicações"

Sempre ofereça trial de 14 dias como backup.
Seja confiante, pastoral, nunca agressivo.
Máximo 4 linhas. Sem markdown, sem asteriscos.`
};
