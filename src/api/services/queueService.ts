/**
 * EKKLE SALES OS - Queue Service
 * Gerenciamento de filas BullMQ
 */

import { Queue } from 'bullmq';
import { getBullMQConnection } from '../../shared/redis';
import { QUEUE_NAMES } from '../../shared/config';
import { createLogger } from '../../shared/logger';
import type { WhatsAppQueueJob } from '../../shared/types';

const logger = createLogger('queue-service');

let whatsappIncomingQueue: Queue<WhatsAppQueueJob> | null = null;

/**
 * Obtém ou cria a fila de mensagens WhatsApp recebidas
 */
export const getWhatsAppIncomingQueue = (): Queue<WhatsAppQueueJob> => {
  if (!whatsappIncomingQueue) {
    logger.info('Initializing WhatsApp incoming queue');
    
    whatsappIncomingQueue = new Queue<WhatsAppQueueJob>(
      QUEUE_NAMES.WHATSAPP_INCOMING,
      {
        connection: getBullMQConnection(),
        defaultJobOptions: {
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 1000
          },
          removeOnComplete: {
            count: 1000,
            age: 24 * 3600 // 24 horas
          },
          removeOnFail: {
            count: 5000,
            age: 7 * 24 * 3600 // 7 dias
          }
        }
      }
    );
  }
  
  return whatsappIncomingQueue;
};

/**
 * Adiciona mensagem WhatsApp na fila para processamento
 */
export const enqueueWhatsAppMessage = async (job: WhatsAppQueueJob): Promise<string> => {
  try {
    const queue = getWhatsAppIncomingQueue();
    
    // Usa messageId como jobId para idempotência
    const addedJob = await queue.add(
      'process-message',
      job,
      {
        jobId: job.messageId, // Previne duplicatas
        priority: 1
      }
    );

    logger.queue(QUEUE_NAMES.WHATSAPP_INCOMING, 'enqueued', addedJob.id, {
      phone: job.phone,
      messageId: job.messageId
    });

    return addedJob.id || job.messageId;
  } catch (error) {
    // Se job já existe (idempotência), retorna sucesso
    if ((error as Error).message?.includes('Job with id')) {
      logger.info('Job already exists (idempotent)', { messageId: job.messageId });
      return job.messageId;
    }
    
    logger.error('Error enqueuing WhatsApp message', error, { 
      phone: job.phone,
      messageId: job.messageId 
    });
    throw error;
  }
};

/**
 * Obtém estatísticas da fila
 */
export const getQueueStats = async () => {
  try {
    const queue = getWhatsAppIncomingQueue();
    
    const [waiting, active, completed, failed, delayed] = await Promise.all([
      queue.getWaitingCount(),
      queue.getActiveCount(),
      queue.getCompletedCount(),
      queue.getFailedCount(),
      queue.getDelayedCount()
    ]);

    return {
      queue: QUEUE_NAMES.WHATSAPP_INCOMING,
      waiting,
      active,
      completed,
      failed,
      delayed,
      total: waiting + active + delayed
    };
  } catch (error) {
    logger.error('Error getting queue stats', error);
    throw error;
  }
};

/**
 * Fecha conexões das filas
 */
export const closeQueues = async (): Promise<void> => {
  if (whatsappIncomingQueue) {
    logger.info('Closing WhatsApp incoming queue');
    await whatsappIncomingQueue.close();
    whatsappIncomingQueue = null;
  }
};
