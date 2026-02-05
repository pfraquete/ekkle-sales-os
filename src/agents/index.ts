/**
 * EKKLE SALES OS - Agents Index
 * Exporta todos os módulos de agentes
 */

// Cliente Kimi API
export * from './kimiClient';

// Sistema de memória de longo prazo
export * from './memoryService';

// Agentes especializados (SDR, BDR, AE)
export * from './specializedAgents';

// Serviço WhatsApp com delay humanizado
export * from './whatsappService';

// Análise de mercado
export * from './marketAnalysisService';

// Legacy exports (mantidos para compatibilidade)
export { isBusinessHours, getOffHoursResponse } from './specializedAgents';
