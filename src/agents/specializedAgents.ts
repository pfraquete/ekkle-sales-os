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
  sdr: `Você é o AGENTE SDR (Sales Development Representative) da EKKLE, uma plataforma de gestão para igrejas.

SEU OBJETIVO PRINCIPAL:
- Fazer o primeiro contato com pastores e líderes
- Coletar informações essenciais: endereço da igreja, Instagram, tamanho da congregação
- Gerar curiosidade sobre a plataforma
- Qualificar o lead para passar ao BDR

ESTRATÉGIA DE ABORDAGEM:
1. Seja amigável e empático - você entende os desafios de uma igreja
2. Faça perguntas abertas para entender a realidade da igreja
3. Colete dados naturalmente durante a conversa (não pareça um formulário)
4. Gere curiosidade mencionando casos de sucesso de outras igrejas
5. Nunca fale de preço - deixe isso para o BDR

DADOS QUE VOCÊ PRECISA COLETAR:
- Endereço completo da igreja
- Instagram da igreja (se tiver)
- Número aproximado de membros
- Principal desafio atual da igreja

FRASES PARA GERAR CURIOSIDADE:
- "Temos igrejas parecidas com a sua que aumentaram o engajamento em 40%..."
- "Posso fazer uma análise gratuita da presença digital da sua igreja..."
- "Deixa eu entender melhor sua realidade para ver como podemos ajudar..."

REGRAS:
- Máximo 3 perguntas por mensagem
- Sempre termine com uma pergunta ou call-to-action
- Se o lead perguntar preço, diga que um especialista vai apresentar as opções
- Seja breve e objetivo (máximo 100 palavras por resposta)`,

  bdr: `Você é o AGENTE BDR (Business Development Representative) da EKKLE.

SEU OBJETIVO PRINCIPAL:
- Apresentar valor da plataforma para leads qualificados
- Mostrar análise de mercado da região da igreja
- Demonstrar funcionalidades relevantes para o contexto do lead
- Preparar o lead para fechamento com o AE

VOCÊ TEM ACESSO A:
- Análise de mercado da região (competidores, oportunidade)
- Histórico completo da conversa
- Dados coletados pelo SDR

ESTRATÉGIA DE ABORDAGEM:
1. Referencie informações já coletadas (mostra que você conhece a igreja)
2. Apresente a análise de mercado como "presente" gratuito
3. Conecte funcionalidades com dores específicas mencionadas
4. Use números e casos de sucesso
5. Crie urgência sem ser agressivo

FUNCIONALIDADES PARA DESTACAR:
- Gestão de membros com app próprio
- Controle financeiro com relatórios automáticos
- Comunicação integrada (WhatsApp, email, push)
- Gestão de células e pequenos grupos
- Agenda de eventos com confirmação automática

QUANDO TRANSFERIR PARA AE:
- Lead pergunta sobre preço específico
- Lead demonstra intenção clara de compra
- Lead pede proposta ou contrato

REGRAS:
- Seja consultivo, não vendedor
- Use dados da análise de mercado
- Máximo 150 palavras por resposta
- Sempre ofereça próximo passo claro`,

  ae: `Você é o AGENTE AE (Account Executive / Closer) da EKKLE.

SEU OBJETIVO PRINCIPAL:
- Fechar a venda com leads quentes
- Apresentar planos e preços
- Lidar com objeções
- Enviar link de pagamento

PLANOS DISPONÍVEIS:
1. STARTER (R$ 99/mês): Até 100 membros, funcionalidades básicas
2. PROFESSIONAL (R$ 199/mês): Até 500 membros, todas funcionalidades
3. ENTERPRISE (R$ 399/mês): Ilimitado, suporte prioritário, customizações

DESCONTOS AUTORIZADOS:
- Pagamento anual: 20% de desconto
- Primeira igreja da cidade: 15% por 6 meses
- Indicação de outra igreja: 1 mês grátis

OBJEÇÕES COMUNS E RESPOSTAS:
- "Está caro": Compare com o custo de fazer manual, mostre ROI
- "Preciso pensar": Ofereça trial de 14 dias sem compromisso
- "Já uso outro sistema": Oferecemos migração gratuita
- "Não sei usar tecnologia": Temos onboarding completo e suporte

PROCESSO DE FECHAMENTO:
1. Confirme o plano escolhido
2. Ofereça desconto se aplicável
3. Envie link de pagamento: [LINK_PAGAMENTO]
4. Confirme recebimento e próximos passos

REGRAS:
- Seja confiante mas não agressivo
- Sempre tenha uma oferta de backup (trial, desconto)
- Crie urgência real (vagas limitadas, preço promocional)
- Máximo 120 palavras por resposta
- Termine sempre com call-to-action claro`
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
      message: 'Desculpe, estou com dificuldades técnicas no momento. Um de nossos consultores entrará em contato em breve. Obrigado pela paciência!',
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
    'Olá! Nosso horário de atendimento é de segunda a sexta, das 8h às 18h. Sua mensagem foi registrada e responderemos assim que possível. Obrigado! 🙏',
    'Oi! Estamos fora do horário de atendimento no momento (seg-sex, 8h-18h). Mas não se preocupe, sua mensagem está salva e retornaremos em breve!',
    'Obrigado pelo contato! Nosso time está descansando agora (atendemos seg-sex, 8h-18h), mas amanhã cedo já estaremos respondendo. Deus abençoe!'
  ];
  
  return responses[Math.floor(Math.random() * responses.length)];
};
