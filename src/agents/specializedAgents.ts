/**
 * EKKLE SALES OS - Specialized Agents
 * Agentes especializados: SDR, BDR e AE (Account Executive)
 */

import { chatCompletion, analyzeIntent, type ChatMessage } from './kimiClient';
import { buildContext, extractLeadInfo, type AgentContext } from './memoryService';
import { createLogger } from '../shared/logger';
import type { Lead, IntentType, AgentType } from '../shared/types';

const logger = createLogger('specialized-agents');

// ===========================================
// Agent Types
// ===========================================

export type SpecializedAgentType = 'sdr' | 'bdr' | 'ae';

export interface AgentResponse {
  message: string;
  intent: IntentType;
  agentUsed: SpecializedAgentType;
  shouldUpdateStatus: boolean;
  newStatus?: string;
  newTemperature?: string;
  extractedData?: Record<string, unknown>;
  shouldTriggerAnalysis: boolean;
  tokensUsed: number;
}

// ===========================================
// Agent Prompts
// ===========================================

const AGENT_PROMPTS: Record<SpecializedAgentType, string> = {
  sdr: `Você é "Consultor de Crescimento EKKLE" - um especialista em ajudar igrejas a crescerem.

SEU OBJETIVO PRINCIPAL:
- Fazer o primeiro contato com pastores e líderes
- Coletar: endereço da igreja e Instagram
- Gerar curiosidade sobre análise de mercado gratuita
- Qualificar o lead para passar ao BDR

REGRAS DE OURO:
1. SEMPRE comece com "🙏 Graça e Paz, Pastor!" na primeira mensagem
2. NUNCA mencione "software", "sistema" ou "tecnologia" no primeiro contato
3. Use linguagem espiritual: "ovelhas", "rebanho", "multiplicação", "pastoreio", "cuidar da obra"
4. Faça APENAS UMA pergunta por mensagem
5. Máximo 3 linhas de texto

DADOS QUE VOCÊ PRECISA COLETAR:
- Endereço completo da igreja
- Instagram da igreja (se tiver)

EXEMPLO DE ABERTURA PERFEITA:
"🙏 Graça e Paz, Pastor!
Recebi uma indicação de que o Senhor está cuidando de uma obra incrível em [região].
Posso fazer uma análise rápida da região? Só preciso do endereço da igreja e do Instagram."

FRASES PARA GERAR CURIOSIDADE:
- "Tenho um dado preocupante sobre igrejas da região que preciso compartilhar..."
- "Encontrei uma oportunidade que nenhuma igreja da sua região está aproveitando..."
- "Posso fazer uma análise gratuita do território ao redor da sua igreja..."

SE NÃO RESPONDER EM 24H:
"Pastor, viu minha mensagem? Tenho um dado preocupante sobre igrejas da região."

REGRAS:
- Nunca fale de preço - deixe isso para o BDR/AE
- Responda como WhatsApp (curto, direto, sem markdown, sem asteriscos)`,

  bdr: `Você é "Consultor de Crescimento EKKLE" - especialista em análise de mercado para igrejas.

SEU OBJETIVO PRINCIPAL:
- Apresentar análise de mercado da região
- Mostrar oportunidades de crescimento
- Conectar funcionalidades com linguagem espiritual
- Preparar o lead para fechamento

VOCÊ TEM ACESSO A:
- Análise de mercado da região (competidores, oportunidade)
- Histórico completo da conversa
- Dados coletados pelo SDR

ESTRATÉGIA DE ABORDAGEM:
1. Referencie informações já coletadas (mostra que conhece a igreja)
2. Apresente a análise como "presente" gratuito
3. Use números concretos: "8 igrejas em 1km", "3 da mesma denominação"
4. Destaque: "Nenhuma tem presença digital estruturada"
5. Crie oportunidade: "O Senhor pode ser o primeiro a dominar esse território"

FUNCIONALIDADES COM LINGUAGEM ESPIRITUAL:
- "Pastoreio digital das ovelhas" (gestão de membros)
- "Mordomia cristã simplificada" (controle financeiro)
- "Multiplicação de células" (gestão de pequenos grupos)
- "Alcançar os de fora" (comunicação integrada)

EXEMPLO DE APRESENTAÇÃO DA ANÁLISE:
"⚠️ Encontrei 8 igrejas em 1km do seu endereço.
3 da mesma denominação.

💡 Oportunidade: Nenhuma tem presença digital estruturada.
O Senhor pode ser o primeiro a dominar esse território.

Quer ver como funciona?"

QUANDO TRANSFERIR PARA AE:
- Lead pergunta sobre preço específico
- Lead diz "Quero", "Como faço?", "Quanto custa?"

REGRAS:
- Máximo 4 linhas por resposta
- Sem markdown, sem asteriscos
- Sempre ofereça próximo passo claro`,

  ae: `Você é "Consultor de Crescimento EKKLE" - responsável pelo fechamento de parcerias com igrejas.

SEU OBJETIVO PRINCIPAL:
- Fechar a parceria com leads quentes
- Apresentar planos e preços
- Lidar com objeções de forma pastoral
- Ativar conta ou trial

PLANOS DISPONÍVEIS (preços no plano anual):
1. ESSENCIAL (R$ 33/mês): Igrejas até 200 membros
2. PROFISSIONAL (R$ 67/mês): Igrejas até 1000 membros
3. ILIMITADO (R$ 127/mês): Sem limites, múltiplas unidades

DIFERENCIAL IMPORTANTE:
- Só o Pastor/líder paga - Membros e líderes usam GRÁTIS
- Trial de 14 dias sem compromisso
- Migração gratuita de outros sistemas
- Onboarding completo incluído

OBJEÇÕES E RESPOSTAS PASTORAIS:
- "Está caro": "Pastor, é menos que R$ 1,10 por dia para cuidar melhor de cada ovelha. E só o Senhor paga - toda a liderança usa grátis."
- "Preciso pensar": "Entendo, Pastor. Posso ativar 14 dias grátis enquanto o Senhor avalia com calma?"
- "Já uso outro": "Fazemos a migração gratuita, sem o Senhor perder nenhum dado das ovelhas."
- "Não sei usar": "Nosso time faz o onboarding completo. O Senhor só precisa nos dar uma hora."

TÉCNICAS DE URGÊNCIA (sem ser agressivo):
- "Temos apenas 5 vagas com esse valor este mês"
- "Posso segurar esse preço até amanhã"
- "Essa condição é exclusiva para indicações"

PROCESSO DE FECHAMENTO:
1. Confirme qual plano atende a igreja
2. Ofereça trial de 14 dias como opção
3. Envie link de ativação
4. Confirme próximos passos do onboarding

REGRAS:
- Seja confiante mas pastoral, nunca agressivo
- Sempre tenha backup (trial, desconto)
- Máximo 4 linhas por resposta
- Sem markdown, sem asteriscos
- Termine com call-to-action claro`
};

// ===========================================
// Agent Router
// ===========================================

/**
 * Determina qual agente deve processar baseado no status do lead
 */
export const routeToAgent = (lead: Lead): SpecializedAgentType => {
  const status = lead.status;
  const temperature = lead.temperature;

  // Lógica de roteamento
  switch (status) {
    case 'new':
    case 'contacted':
      return 'sdr';
    
    case 'qualified':
      return 'bdr';
    
    case 'negotiating':
    case 'won':
      return 'ae';
    
    default:
      // Fallback baseado em temperatura
      if (temperature === 'hot') {
        return 'ae';
      } else if (temperature === 'warm') {
        return 'bdr';
      }
      return 'sdr';
  }
};

/**
 * Verifica se deve atualizar status baseado na conversa
 */
const determineStatusUpdate = (
  currentStatus: string,
  intent: IntentType,
  agentUsed: SpecializedAgentType
): { shouldUpdate: boolean; newStatus?: string; newTemperature?: string } => {
  
  // SDR coletou dados → qualificar
  if (agentUsed === 'sdr' && currentStatus === 'new') {
    return { 
      shouldUpdate: true, 
      newStatus: 'contacted',
      newTemperature: 'warm'
    };
  }

  // Lead perguntou preço → está qualificado
  if (intent === 'pricing' && currentStatus !== 'qualified' && currentStatus !== 'negotiating') {
    return {
      shouldUpdate: true,
      newStatus: 'qualified',
      newTemperature: 'warm'
    };
  }

  // Lead quer fechar → negociando
  if (intent === 'closing') {
    return {
      shouldUpdate: true,
      newStatus: 'negotiating',
      newTemperature: 'hot'
    };
  }

  // Dúvida técnica de lead novo → qualificar
  if (intent === 'technical' && (currentStatus === 'new' || currentStatus === 'contacted')) {
    return {
      shouldUpdate: true,
      newStatus: 'qualified',
      newTemperature: 'warm'
    };
  }

  return { shouldUpdate: false };
};

// ===========================================
// Main Processing Function
// ===========================================

/**
 * Processa mensagem com agente especializado
 */
export const processWithSpecializedAgent = async (
  lead: Lead,
  message: string,
  marketAnalysis?: {
    competitorCount: number;
    digitalScore: number;
    opportunity: string;
  }
): Promise<AgentResponse> => {
  const startTime = Date.now();
  
  try {
    // 1. Construir contexto com memória de longo prazo
    const context = await buildContext(lead);
    
    // 2. Analisar intent da mensagem
    const intent = await analyzeIntent(message) as IntentType;
    
    // 3. Determinar agente apropriado
    const agentType = routeToAgent(lead);
    
    logger.agent(agentType, 'processing', {
      leadId: lead.id,
      intent,
      status: lead.status
    });

    // 4. Extrair informações da mensagem (endereço, Instagram, etc.)
    const extractedData = await extractLeadInfo(
      message, 
      (lead.metadata || {}) as Record<string, unknown>
    );
    
    // 5. Verificar se deve triggerar análise de mercado
    const shouldTriggerAnalysis = 
      agentType === 'sdr' && 
      (extractedData.address || extractedData.instagram) &&
      !marketAnalysis;

    // 6. Construir mensagens para o LLM
    const systemPrompt = AGENT_PROMPTS[agentType];
    
    // Adicionar análise de mercado ao contexto se disponível
    let additionalContext = '';
    if (marketAnalysis && agentType === 'bdr') {
      additionalContext = `

=== ANÁLISE DE MERCADO DA REGIÃO ===
Competidores na região: ${marketAnalysis.competitorCount}
Score digital da igreja: ${marketAnalysis.digitalScore}/10
Oportunidade: ${marketAnalysis.opportunity}
`;
    }

    const messages: ChatMessage[] = [
      { role: 'system', content: systemPrompt },
      { role: 'system', content: context.contextPrompt + additionalContext },
      { role: 'user', content: message }
    ];

    // 7. Chamar Kimi API
    const result = await chatCompletion(messages, {
      temperature: 0.7,
      maxTokens: 500
    });

    // 8. Determinar se deve atualizar status
    const statusUpdate = determineStatusUpdate(lead.status, intent, agentType);

    const executionTime = Date.now() - startTime;

    logger.agent(agentType, 'completed', {
      leadId: lead.id,
      tokensUsed: result.tokensUsed,
      executionTimeMs: executionTime,
      shouldTriggerAnalysis
    });

    return {
      message: result.content,
      intent,
      agentUsed: agentType,
      shouldUpdateStatus: statusUpdate.shouldUpdate,
      newStatus: statusUpdate.newStatus,
      newTemperature: statusUpdate.newTemperature,
      extractedData,
      shouldTriggerAnalysis,
      tokensUsed: result.tokensUsed
    };

  } catch (error) {
    const executionTime = Date.now() - startTime;
    
    logger.error('Specialized agent processing error', error, {
      leadId: lead.id,
      executionTimeMs: executionTime
    });

    // Resposta de fallback
    return {
      message: '🙏 Pastor, desculpe! Tivemos um probleminha técnico. Um de nossos consultores entrará em contato em breve. Deus abençoe sua paciência!',
      intent: 'unknown',
      agentUsed: 'sdr',
      shouldUpdateStatus: false,
      extractedData: {},
      shouldTriggerAnalysis: false,
      tokensUsed: 0
    };
  }
};

/**
 * Verifica se está dentro do horário comercial
 */
export const isBusinessHours = (): boolean => {
  const now = new Date();
  
  // Ajustar para horário de Brasília (UTC-3)
  const brasiliaOffset = -3 * 60;
  const localOffset = now.getTimezoneOffset();
  const brasiliaTime = new Date(now.getTime() + (localOffset + brasiliaOffset) * 60000);
  
  const dayOfWeek = brasiliaTime.getDay();
  const hour = brasiliaTime.getHours();
  
  // 0 = Domingo, 6 = Sábado
  if (dayOfWeek === 0 || dayOfWeek === 6) {
    return false;
  }
  
  // 8h às 18h
  return hour >= 8 && hour < 18;
};

/**
 * Gera resposta de fora do horário
 */
export const getOffHoursResponse = (): string => {
  const responses = [
    '🙏 Graça e Paz, Pastor! Estamos em momento de descanso (atendemos seg-sex, 8h-18h). Sua mensagem foi registrada e responderemos logo cedo. Deus abençoe!',
    '🙏 Paz do Senhor! Nosso time está descansando agora (seg-sex, 8h-18h), mas sua mensagem está guardada. Amanhã cedo retornamos. Fique com Deus!',
    '🙏 Olá, Pastor! Estamos fora do horário (seg-sex, 8h-18h). Mas não se preocupe, registramos sua mensagem e responderemos assim que possível. Deus abençoe sua noite!'
  ];

  return responses[Math.floor(Math.random() * responses.length)];
};
