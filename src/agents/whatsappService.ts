/**
 * EKKLE SALES OS - WhatsApp Service
 * Classe para enviar mensagens via Evolution API com delay humanizado
 */

import { config } from '../shared/config';
import { createLogger } from '../shared/logger';

const logger = createLogger('whatsapp-service');

// ===========================================
// Types
// ===========================================

export interface SendMessageResult {
  success: boolean;
  messageId?: string;
  error?: string;
  timestamp?: number;
}

export interface MessageOptions {
  delay?: number;  // Delay em ms antes de enviar
  typing?: boolean; // Simular digitação
}

// ===========================================
// WhatsApp Service Class
// ===========================================

export class WhatsAppService {
  private baseUrl: string;
  private apiKey: string;
  private instanceName: string;

  constructor() {
    this.baseUrl = config.EVOLUTION_API_URL;
    this.apiKey = config.EVOLUTION_API_KEY;
    this.instanceName = config.EVOLUTION_INSTANCE_NAME;
  }

  // ===========================================
  // Private Helpers
  // ===========================================

  /**
   * Formata número de telefone para o formato do WhatsApp
   */
  private formatPhoneNumber(phone: string): string {
    const cleanPhone = phone.replace(/\D/g, '');
    return `${cleanPhone}@s.whatsapp.net`;
  }

  /**
   * Gera delay humanizado aleatório (1-3 segundos)
   */
  private getHumanizedDelay(): number {
    // Entre 1000ms e 3000ms
    return Math.floor(Math.random() * 2000) + 1000;
  }

  /**
   * Aguarda um tempo específico
   */
  private async sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Faz requisição para a Evolution API
   */
  private async makeRequest(
    endpoint: string,
    method: 'GET' | 'POST' = 'POST',
    body?: Record<string, unknown>
  ): Promise<Response> {
    const url = `${this.baseUrl}${endpoint}`;
    
    const options: RequestInit = {
      method,
      headers: {
        'Content-Type': 'application/json',
        'apikey': this.apiKey
      }
    };

    if (body) {
      options.body = JSON.stringify(body);
    }

    return fetch(url, options);
  }

  // ===========================================
  // Presence/Typing Methods
  // ===========================================

  /**
   * Envia indicador de "digitando"
   */
  async sendTypingIndicator(to: string): Promise<void> {
    try {
      const endpoint = `/chat/presence/${this.instanceName}`;
      
      await this.makeRequest(endpoint, 'POST', {
        number: this.formatPhoneNumber(to),
        presence: 'composing'
      });

      logger.info('Typing indicator sent', { to });
    } catch (error) {
      // Não é crítico se falhar
      logger.warn('Failed to send typing indicator', { to, error });
    }
  }

  /**
   * Remove indicador de "digitando"
   */
  async clearTypingIndicator(to: string): Promise<void> {
    try {
      const endpoint = `/chat/presence/${this.instanceName}`;
      
      await this.makeRequest(endpoint, 'POST', {
        number: this.formatPhoneNumber(to),
        presence: 'paused'
      });
    } catch {
      // Ignorar erro
    }
  }

  // ===========================================
  // Send Methods
  // ===========================================

  /**
   * Envia mensagem de texto com delay humanizado
   */
  async sendText(
    to: string,
    message: string,
    options: MessageOptions = {}
  ): Promise<SendMessageResult> {
    const startTime = Date.now();
    
    try {
      logger.api('evolution', 'sendText', {
        to,
        messageLength: message.length
      });

      // 1. Simular digitação se habilitado
      if (options.typing !== false) {
        await this.sendTypingIndicator(to);
        
        // Calcular tempo de digitação baseado no tamanho da mensagem
        // ~50ms por caractere, máximo 5 segundos
        const typingTime = Math.min(message.length * 50, 5000);
        await this.sleep(typingTime);
      }

      // 2. Aplicar delay humanizado
      const delay = options.delay ?? this.getHumanizedDelay();
      if (delay > 0) {
        logger.info('Applying humanized delay', { delayMs: delay });
        await this.sleep(delay);
      }

      // 3. Enviar mensagem
      const endpoint = `/message/sendText/${this.instanceName}`;
      
      const response = await this.makeRequest(endpoint, 'POST', {
        number: this.formatPhoneNumber(to),
        text: message,
        delay: 500 // Delay interno da Evolution API
      });

      // 4. Limpar indicador de digitação
      await this.clearTypingIndicator(to);

      const latency = Date.now() - startTime;

      if (!response.ok) {
        const errorText = await response.text();
        logger.error('Evolution API error', null, {
          status: response.status,
          error: errorText,
          latencyMs: latency
        });

        return {
          success: false,
          error: `HTTP ${response.status}: ${errorText}`,
          timestamp: Date.now()
        };
      }

      const data = await response.json();
      
      logger.info('WhatsApp text message sent', {
        to,
        messageId: data.key?.id,
        latencyMs: latency
      });

      return {
        success: true,
        messageId: data.key?.id,
        timestamp: Date.now()
      };

    } catch (error) {
      const latency = Date.now() - startTime;
      
      logger.error('Error sending WhatsApp text', error, {
        to,
        latencyMs: latency
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: Date.now()
      };
    }
  }

  /**
   * Envia imagem com caption
   */
  async sendImage(
    to: string,
    imageUrl: string,
    caption?: string,
    options: MessageOptions = {}
  ): Promise<SendMessageResult> {
    const startTime = Date.now();
    
    try {
      logger.api('evolution', 'sendImage', {
        to,
        imageUrl,
        hasCaption: !!caption
      });

      // 1. Simular digitação
      if (options.typing !== false) {
        await this.sendTypingIndicator(to);
        await this.sleep(1500); // Tempo para "selecionar" imagem
      }

      // 2. Aplicar delay humanizado
      const delay = options.delay ?? this.getHumanizedDelay();
      if (delay > 0) {
        await this.sleep(delay);
      }

      // 3. Enviar imagem
      const endpoint = `/message/sendMedia/${this.instanceName}`;
      
      const response = await this.makeRequest(endpoint, 'POST', {
        number: this.formatPhoneNumber(to),
        mediatype: 'image',
        media: imageUrl,
        caption: caption || ''
      });

      // 4. Limpar indicador de digitação
      await this.clearTypingIndicator(to);

      const latency = Date.now() - startTime;

      if (!response.ok) {
        const errorText = await response.text();
        logger.error('Evolution API error sending image', null, {
          status: response.status,
          error: errorText,
          latencyMs: latency
        });

        return {
          success: false,
          error: `HTTP ${response.status}: ${errorText}`,
          timestamp: Date.now()
        };
      }

      const data = await response.json();
      
      logger.info('WhatsApp image sent', {
        to,
        messageId: data.key?.id,
        latencyMs: latency
      });

      return {
        success: true,
        messageId: data.key?.id,
        timestamp: Date.now()
      };

    } catch (error) {
      const latency = Date.now() - startTime;
      
      logger.error('Error sending WhatsApp image', error, {
        to,
        latencyMs: latency
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: Date.now()
      };
    }
  }

  /**
   * Envia documento/arquivo
   */
  async sendDocument(
    to: string,
    documentUrl: string,
    filename: string,
    caption?: string,
    options: MessageOptions = {}
  ): Promise<SendMessageResult> {
    const startTime = Date.now();
    
    try {
      logger.api('evolution', 'sendDocument', {
        to,
        filename
      });

      // Delay humanizado
      const delay = options.delay ?? this.getHumanizedDelay();
      if (delay > 0) {
        await this.sleep(delay);
      }

      const endpoint = `/message/sendMedia/${this.instanceName}`;
      
      const response = await this.makeRequest(endpoint, 'POST', {
        number: this.formatPhoneNumber(to),
        mediatype: 'document',
        media: documentUrl,
        fileName: filename,
        caption: caption || ''
      });

      const latency = Date.now() - startTime;

      if (!response.ok) {
        const errorText = await response.text();
        return {
          success: false,
          error: `HTTP ${response.status}: ${errorText}`,
          timestamp: Date.now()
        };
      }

      const data = await response.json();
      
      logger.info('WhatsApp document sent', {
        to,
        filename,
        messageId: data.key?.id,
        latencyMs: latency
      });

      return {
        success: true,
        messageId: data.key?.id,
        timestamp: Date.now()
      };

    } catch (error) {
      logger.error('Error sending WhatsApp document', error, { to });

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: Date.now()
      };
    }
  }

  /**
   * Envia link de pagamento formatado
   */
  async sendPaymentLink(
    to: string,
    paymentUrl: string,
    planName: string,
    amount: number
  ): Promise<SendMessageResult> {
    const message = `💳 *Link de Pagamento*

Plano: *${planName}*
Valor: *R$ ${amount.toFixed(2)}*

Clique no link abaixo para finalizar sua assinatura:
${paymentUrl}

✅ Pagamento seguro via Stripe
🔒 Seus dados estão protegidos

Após o pagamento, você receberá o acesso imediatamente!`;

    return this.sendText(to, message);
  }

  // ===========================================
  // Status Methods
  // ===========================================

  /**
   * Verifica status da conexão
   */
  async checkConnectionStatus(): Promise<{
    connected: boolean;
    instance: string;
    state?: string;
    error?: string;
  }> {
    try {
      const endpoint = `/instance/connectionState/${this.instanceName}`;
      
      const response = await this.makeRequest(endpoint, 'GET');

      if (!response.ok) {
        return {
          connected: false,
          instance: this.instanceName,
          error: `HTTP ${response.status}`
        };
      }

      const data = await response.json();
      
      return {
        connected: data.state === 'open',
        instance: this.instanceName,
        state: data.state
      };

    } catch (error) {
      return {
        connected: false,
        instance: this.instanceName,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Obtém informações da instância
   */
  async getInstanceInfo(): Promise<Record<string, unknown> | null> {
    try {
      const endpoint = `/instance/fetchInstances`;
      
      const response = await this.makeRequest(endpoint, 'GET');

      if (!response.ok) {
        return null;
      }

      const data = await response.json();
      
      // Encontrar instância específica
      const instance = data.find((i: any) => i.instance?.instanceName === this.instanceName);
      
      return instance || null;

    } catch (error) {
      logger.error('Error getting instance info', error);
      return null;
    }
  }
}

// ===========================================
// Singleton Instance
// ===========================================

let whatsappServiceInstance: WhatsAppService | null = null;

/**
 * Obtém instância singleton do WhatsAppService
 */
export const getWhatsAppService = (): WhatsAppService => {
  if (!whatsappServiceInstance) {
    whatsappServiceInstance = new WhatsAppService();
  }
  return whatsappServiceInstance;
};

// ===========================================
// Convenience Functions
// ===========================================

/**
 * Envia texto via WhatsApp (função de conveniência)
 */
export const sendWhatsAppText = async (
  to: string,
  message: string,
  options?: MessageOptions
): Promise<SendMessageResult> => {
  const service = getWhatsAppService();
  return service.sendText(to, message, options);
};

/**
 * Envia imagem via WhatsApp (função de conveniência)
 */
export const sendWhatsAppImage = async (
  to: string,
  imageUrl: string,
  caption?: string,
  options?: MessageOptions
): Promise<SendMessageResult> => {
  const service = getWhatsAppService();
  return service.sendImage(to, imageUrl, caption, options);
};
