/**
 * EKKLE SALES OS - Evolution API Client
 * Cliente para enviar mensagens via WhatsApp
 */

import { config } from '../shared/config';
import { createLogger } from '../shared/logger';

const logger = createLogger('evolution-client');

interface SendMessageResponse {
  success: boolean;
  messageId?: string;
  error?: string;
}

/**
 * Formata número de telefone para o formato do WhatsApp
 * 5511999999999 → 5511999999999@s.whatsapp.net
 */
const formatPhoneNumber = (phone: string): string => {
  const cleanPhone = phone.replace(/\D/g, '');
  return `${cleanPhone}@s.whatsapp.net`;
};

/**
 * Envia mensagem de texto via Evolution API
 */
export const sendWhatsAppMessage = async (
  phone: string,
  message: string
): Promise<SendMessageResponse> => {
  const startTime = Date.now();
  
  try {
    const url = `${config.EVOLUTION_API_URL}/message/sendText/${config.EVOLUTION_INSTANCE_NAME}`;
    
    logger.api('evolution', 'sendText', {
      phone,
      messageLength: message.length
    });

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': config.EVOLUTION_API_KEY
      },
      body: JSON.stringify({
        number: formatPhoneNumber(phone),
        text: message,
        delay: 1000 // Delay de 1s para parecer mais natural
      })
    });

    const latency = Date.now() - startTime;

    if (!response.ok) {
      const errorText = await response.text();
      logger.error('Evolution API error response', null, {
        status: response.status,
        error: errorText,
        latencyMs: latency
      });

      return {
        success: false,
        error: `HTTP ${response.status}: ${errorText}`
      };
    }

    const data = await response.json();
    
    logger.info('WhatsApp message sent', {
      phone,
      messageId: data.key?.id,
      latencyMs: latency
    });

    return {
      success: true,
      messageId: data.key?.id
    };

  } catch (error) {
    const latency = Date.now() - startTime;
    
    logger.error('Error sending WhatsApp message', error, {
      phone,
      latencyMs: latency
    });

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
};

/**
 * Verifica status da instância Evolution API
 */
export const checkEvolutionStatus = async (): Promise<{
  connected: boolean;
  instance: string;
  error?: string;
}> => {
  try {
    const url = `${config.EVOLUTION_API_URL}/instance/connectionState/${config.EVOLUTION_INSTANCE_NAME}`;
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'apikey': config.EVOLUTION_API_KEY
      }
    });

    if (!response.ok) {
      return {
        connected: false,
        instance: config.EVOLUTION_INSTANCE_NAME,
        error: `HTTP ${response.status}`
      };
    }

    const data = await response.json();
    
    return {
      connected: data.state === 'open',
      instance: config.EVOLUTION_INSTANCE_NAME
    };

  } catch (error) {
    return {
      connected: false,
      instance: config.EVOLUTION_INSTANCE_NAME,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
};

/**
 * Envia mensagem com typing indicator (mais natural)
 */
export const sendMessageWithTyping = async (
  phone: string,
  message: string
): Promise<SendMessageResponse> => {
  try {
    // Simular typing (opcional - depende da Evolution API suportar)
    const typingUrl = `${config.EVOLUTION_API_URL}/chat/presence/${config.EVOLUTION_INSTANCE_NAME}`;
    
    // Tentar enviar presence (não crítico se falhar)
    try {
      await fetch(typingUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': config.EVOLUTION_API_KEY
        },
        body: JSON.stringify({
          number: formatPhoneNumber(phone),
          presence: 'composing'
        })
      });
      
      // Aguardar um pouco para parecer que está digitando
      const typingDelay = Math.min(message.length * 30, 3000); // Max 3s
      await new Promise(resolve => setTimeout(resolve, typingDelay));
    } catch {
      // Ignorar erro de typing
    }

    // Enviar mensagem
    return await sendWhatsAppMessage(phone, message);

  } catch (error) {
    logger.error('Error in sendMessageWithTyping', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
};
