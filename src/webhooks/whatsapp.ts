/**
 * EKKLE SALES OS - WhatsApp Webhook Handler
 * Recebe mensagens do Evolution API
 */

import { Elysia, t } from 'elysia';
import { createLogger } from '../shared/logger';
import { config } from '../shared/config';
import { enqueueWhatsAppMessage } from '../api/services/queueService';
import { EvolutionWebhookPayloadSchema } from '../shared/schemas';

const logger = createLogger('whatsapp-webhook');

/**
 * Extrai número de telefone limpo do remoteJid
 * Formato: 5511999999999@s.whatsapp.net → 5511999999999
 */
const extractPhoneNumber = (remoteJid: string): string => {
  return remoteJid.split('@')[0].replace(/\D/g, '');
};

/**
 * Extrai texto da mensagem
 */
const extractMessageText = (message: any): string | null => {
  if (message.conversation) {
    return message.conversation;
  }
  if (message.extendedTextMessage?.text) {
    return message.extendedTextMessage.text;
  }
  // Outros tipos de mensagem (imagem, áudio, etc) não são processados por agora
  return null;
};

/**
 * Valida webhook secret (se configurado)
 */
const validateWebhookSecret = (headers: Headers): boolean => {
  if (!config.WEBHOOK_SECRET) {
    return true; // Se não configurado, aceita tudo
  }
  
  const secret = headers.get('x-webhook-secret') || headers.get('authorization');
  return secret === config.WEBHOOK_SECRET || secret === `Bearer ${config.WEBHOOK_SECRET}`;
};

export const whatsappWebhook = new Elysia({ prefix: '/webhook' })
  /**
   * POST /webhook/whatsapp
   * Recebe mensagens do Evolution API e joga na fila Redis
   */
  .post('/whatsapp', async ({ body, request, set }) => {
    const startTime = Date.now();
    
    // Validar secret
    if (!validateWebhookSecret(request.headers)) {
      logger.warn('Invalid webhook secret');
      set.status = 401;
      return { success: false, error: 'Unauthorized' };
    }

    try {
      // Log do payload recebido
      logger.info('WhatsApp webhook received', { 
        event: (body as any).event,
        instance: (body as any).instance
      });

      // Validar payload
      const parseResult = EvolutionWebhookPayloadSchema.safeParse(body);
      
      if (!parseResult.success) {
        logger.warn('Invalid webhook payload', { 
          errors: parseResult.error.errors 
        });
        // Retorna 200 mesmo assim para não reenviar
        return { 
          success: true, 
          message: 'Payload ignored (invalid format)',
          processed: false
        };
      }

      const payload = parseResult.data;

      // Ignorar mensagens enviadas por nós (fromMe = true)
      if (payload.data.key.fromMe) {
        logger.debug('Ignoring outbound message');
        return { 
          success: true, 
          message: 'Outbound message ignored',
          processed: false
        };
      }

      // Extrair dados da mensagem
      const phone = extractPhoneNumber(payload.data.key.remoteJid);
      const messageText = extractMessageText(payload.data.message);

      // Ignorar mensagens sem texto
      if (!messageText) {
        logger.debug('Ignoring non-text message');
        return { 
          success: true, 
          message: 'Non-text message ignored',
          processed: false
        };
      }

      // Adicionar na fila para processamento
      const jobId = await enqueueWhatsAppMessage({
        phone,
        message: messageText,
        pushName: payload.data.pushName,
        messageId: payload.data.key.id,
        timestamp: payload.data.messageTimestamp
      });

      const processingTime = Date.now() - startTime;
      
      logger.info('Message enqueued for processing', {
        phone,
        messageId: payload.data.key.id,
        jobId,
        processingTimeMs: processingTime
      });

      // Resposta imediata (200 OK)
      return {
        success: true,
        message: 'Message queued for processing',
        processed: true,
        jobId,
        processingTimeMs: processingTime
      };

    } catch (error) {
      logger.error('Error processing webhook', error);
      
      // Retorna 200 para evitar retry infinito do Evolution API
      // O erro será tratado internamente
      return {
        success: true,
        message: 'Error logged, will retry internally',
        processed: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }, {
    body: t.Any() // Aceita qualquer formato para validar manualmente
  })

  /**
   * GET /webhook/whatsapp
   * Verificação de endpoint (alguns serviços fazem GET para verificar)
   */
  .get('/whatsapp', () => {
    return {
      success: true,
      message: 'WhatsApp webhook endpoint active',
      service: 'ekkle-sales-os'
    };
  });
