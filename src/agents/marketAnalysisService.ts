/**
 * EKKLE SALES OS - Market Analysis Service
 * Análise de mercado da região da igreja (Mock inicial)
 */

import { getSupabaseAdmin, type Database } from '../shared/supabase';
import { createLogger } from '../shared/logger';
import type { Lead } from '../shared/types';

const logger = createLogger('market-analysis');

type AnalyticsInsert = Database['public']['Tables']['analytics']['Insert'];

// ===========================================
// Types
// ===========================================

export interface MarketAnalysis {
  id: string;
  lead_id: string;
  analysis_type: string;
  address: string | null;
  instagram: string | null;
  competitor_count: number;
  digital_score: number;
  opportunity: 'low' | 'medium' | 'high';
  raw_data: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface AnalysisResult {
  competitorCount: number;
  digitalScore: number;
  opportunity: 'low' | 'medium' | 'high';
  insights: string[];
  recommendations: string[];
}

// ===========================================
// Mock Data Generation
// ===========================================

/**
 * Gera análise de mercado mock baseada no endereço
 * TODO: Integrar com APIs reais (Google Places, Instagram API, etc.)
 */
const generateMockAnalysis = (
  address: string | null,
  instagram: string | null
): AnalysisResult => {
  // Simular variação baseada no endereço
  let baseCompetitors = 5;
  let baseDigitalScore = 3;
  let opportunity: 'low' | 'medium' | 'high' = 'medium';

  // Ajustar baseado em palavras-chave do endereço
  if (address) {
    const addressLower = address.toLowerCase();
    
    // Cidades grandes = mais competidores
    if (addressLower.includes('são paulo') || addressLower.includes('rio de janeiro')) {
      baseCompetitors = Math.floor(Math.random() * 10) + 8; // 8-17
      opportunity = 'high';
    } else if (addressLower.includes('belo horizonte') || addressLower.includes('salvador')) {
      baseCompetitors = Math.floor(Math.random() * 6) + 5; // 5-10
      opportunity = 'high';
    } else if (addressLower.includes('interior') || addressLower.includes('zona rural')) {
      baseCompetitors = Math.floor(Math.random() * 3) + 1; // 1-3
      opportunity = 'medium';
    } else {
      baseCompetitors = Math.floor(Math.random() * 5) + 3; // 3-7
    }
  }

  // Ajustar score digital baseado no Instagram
  if (instagram) {
    // Se tem Instagram, score base maior
    baseDigitalScore = Math.floor(Math.random() * 4) + 4; // 4-7
  } else {
    // Sem Instagram, score baixo
    baseDigitalScore = Math.floor(Math.random() * 3) + 1; // 1-3
    opportunity = opportunity === 'high' ? 'high' : 'medium';
  }

  // Gerar insights baseados na análise
  const insights: string[] = [];
  const recommendations: string[] = [];

  // Insights sobre competidores
  if (baseCompetitors > 7) {
    insights.push(`Região com alta densidade de igrejas (${baseCompetitors} identificadas)`);
    insights.push('Mercado competitivo requer diferenciação digital');
  } else if (baseCompetitors < 4) {
    insights.push(`Região com baixa concorrência (apenas ${baseCompetitors} igrejas identificadas)`);
    insights.push('Oportunidade de se tornar referência digital na região');
  } else {
    insights.push(`Região com concorrência moderada (${baseCompetitors} igrejas)`);
  }

  // Insights sobre presença digital
  if (baseDigitalScore < 4) {
    insights.push('Presença digital atual é limitada');
    recommendations.push('Criar perfis profissionais nas redes sociais');
    recommendations.push('Desenvolver estratégia de conteúdo digital');
  } else if (baseDigitalScore >= 7) {
    insights.push('Boa presença digital já estabelecida');
    recommendations.push('Potencializar engajamento com ferramentas de gestão');
  } else {
    insights.push('Presença digital em desenvolvimento');
    recommendations.push('Fortalecer comunicação com membros via app');
  }

  // Recomendações gerais
  recommendations.push('Implementar sistema de gestão integrado');
  recommendations.push('Automatizar comunicação com membros');
  
  if (opportunity === 'high') {
    recommendations.push('Aproveitar momento para expansão digital');
  }

  return {
    competitorCount: baseCompetitors,
    digitalScore: baseDigitalScore,
    opportunity,
    insights,
    recommendations
  };
};

// ===========================================
// Database Operations
// ===========================================

/**
 * Salva análise de mercado no banco
 */
export const saveMarketAnalysis = async (
  leadId: string,
  address: string | null,
  instagram: string | null,
  analysis: AnalysisResult
): Promise<MarketAnalysis> => {
  try {
    const supabase = getSupabaseAdmin();
    
    logger.db('INSERT', 'analytics', { lead_id: leadId });
    
    const insertData: AnalyticsInsert = {
      lead_id: leadId,
      analysis_type: 'market_analysis',
      address,
      instagram,
      competitor_count: analysis.competitorCount,
      digital_score: analysis.digitalScore,
      opportunity: analysis.opportunity,
      raw_data: {
        insights: analysis.insights,
        recommendations: analysis.recommendations,
        generated_at: new Date().toISOString(),
        version: '1.0-mock'
      }
    };
    
    const { data, error } = await supabase
      .from('analytics')
      .insert(insertData)
      .select()
      .single();

    if (error) {
      throw error;
    }

    logger.info('Market analysis saved', {
      leadId,
      analysisId: data.id,
      opportunity: analysis.opportunity
    });

    return data as MarketAnalysis;
  } catch (error) {
    logger.error('Error saving market analysis', error, { leadId });
    throw error;
  }
};

/**
 * Busca análise de mercado existente para o lead
 */
export const getMarketAnalysis = async (
  leadId: string
): Promise<MarketAnalysis | null> => {
  try {
    const supabase = getSupabaseAdmin();
    
    logger.db('SELECT', 'analytics', { lead_id: leadId });
    
    const { data, error } = await supabase
      .from('analytics')
      .select('*')
      .eq('lead_id', leadId)
      .eq('analysis_type', 'market_analysis')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error && error.code !== 'PGRST116') {
      throw error;
    }

    return data as MarketAnalysis | null;
  } catch (error) {
    logger.error('Error getting market analysis', error, { leadId });
    return null;
  }
};

// ===========================================
// Main Analysis Function
// ===========================================

/**
 * Analisa a região da igreja e retorna insights
 * Esta é a função principal que deve ser chamada quando SDR coletar dados
 */
export const analyzeChurchRegion = async (
  lead: Lead,
  address: string | null,
  instagram: string | null
): Promise<AnalysisResult> => {
  logger.info('Starting market analysis', {
    leadId: lead.id,
    hasAddress: !!address,
    hasInstagram: !!instagram
  });

  try {
    // 1. Verificar se já existe análise recente (últimas 24h)
    const existingAnalysis = await getMarketAnalysis(lead.id);
    
    if (existingAnalysis) {
      const analysisAge = Date.now() - new Date(existingAnalysis.created_at).getTime();
      const oneDayMs = 24 * 60 * 60 * 1000;
      
      if (analysisAge < oneDayMs) {
        logger.info('Using existing market analysis', {
          leadId: lead.id,
          analysisId: existingAnalysis.id
        });
        
        const rawData = existingAnalysis.raw_data as {
          insights?: string[];
          recommendations?: string[];
        };
        
        return {
          competitorCount: existingAnalysis.competitor_count,
          digitalScore: existingAnalysis.digital_score,
          opportunity: existingAnalysis.opportunity as 'low' | 'medium' | 'high',
          insights: rawData.insights || [],
          recommendations: rawData.recommendations || []
        };
      }
    }

    // 2. Gerar nova análise (mock por enquanto)
    // TODO: Integrar com APIs reais:
    // - Google Places API para buscar igrejas na região
    // - Instagram API para analisar presença digital
    // - Google Maps API para dados demográficos
    const analysis = generateMockAnalysis(address, instagram);

    // 3. Salvar análise no banco
    await saveMarketAnalysis(lead.id, address, instagram, analysis);

    logger.info('Market analysis completed', {
      leadId: lead.id,
      competitorCount: analysis.competitorCount,
      digitalScore: analysis.digitalScore,
      opportunity: analysis.opportunity
    });

    return analysis;

  } catch (error) {
    logger.error('Error in market analysis', error, { leadId: lead.id });
    
    // Retornar análise padrão em caso de erro
    return {
      competitorCount: 5,
      digitalScore: 3,
      opportunity: 'medium',
      insights: ['Análise em processamento'],
      recommendations: ['Aguarde mais informações']
    };
  }
};

/**
 * Formata análise para mensagem do agente
 */
export const formatAnalysisForAgent = (analysis: AnalysisResult): string => {
  const opportunityEmoji = {
    low: '🟡',
    medium: '🟠',
    high: '🟢'
  };

  const opportunityText = {
    low: 'Baixa',
    medium: 'Média',
    high: 'Alta'
  };

  return `
📊 *ANÁLISE DE MERCADO DA REGIÃO*

🏛️ Igrejas na região: ${analysis.competitorCount}
📱 Score digital: ${analysis.digitalScore}/10
${opportunityEmoji[analysis.opportunity]} Oportunidade: ${opportunityText[analysis.opportunity]}

*Insights:*
${analysis.insights.map(i => `• ${i}`).join('\n')}

*Recomendações:*
${analysis.recommendations.map(r => `• ${r}`).join('\n')}
`.trim();
};

/**
 * Verifica se deve triggerar análise baseado nos dados do lead
 */
export const shouldTriggerAnalysis = (
  leadMetadata: Record<string, unknown>,
  newData: Record<string, unknown>
): boolean => {
  // Triggera se coletou endereço ou Instagram pela primeira vez
  const hadAddress = !!leadMetadata.address;
  const hadInstagram = !!leadMetadata.instagram;
  
  const hasNewAddress = !!newData.address && !hadAddress;
  const hasNewInstagram = !!newData.instagram && !hadInstagram;
  
  return hasNewAddress || hasNewInstagram;
};
