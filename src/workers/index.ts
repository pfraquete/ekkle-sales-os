/**
 * EKKLE SALES OS - Workers Entry Point
 * Inicia todos os workers de processamento
 */

import { Worker } from 'bullmq';
import { createLogger } from '../shared/logger';
import { createWhatsAppWorker, stopWorker } from './whatsappWorker';
import { closeRedisConnection } from '../shared/redis';

const logger = createLogger('workers');

let workers: Worker[] = [];

/**
 * Inicia todos os workers
 */
export const startWorkers = async (): Promise<void> => {
  logger.info('Starting workers...');

  try {
    // Criar WhatsApp worker
    const whatsappWorker = createWhatsAppWorker();
    workers.push(whatsappWorker);

    logger.info('All workers started', {
      count: workers.length
    });

  } catch (error) {
    logger.error('Failed to start workers', error);
    throw error;
  }
};

/**
 * Para todos os workers gracefully
 */
export const stopWorkers = async (): Promise<void> => {
  logger.info('Stopping all workers...');

  try {
    await Promise.all(workers.map(w => stopWorker(w)));
    workers = [];
    
    await closeRedisConnection();
    
    logger.info('All workers stopped');
  } catch (error) {
    logger.error('Error stopping workers', error);
    throw error;
  }
};

/**
 * Graceful shutdown handler
 */
const setupGracefulShutdown = (): void => {
  const signals: NodeJS.Signals[] = ['SIGTERM', 'SIGINT', 'SIGUSR2'];

  signals.forEach(signal => {
    process.on(signal, async () => {
      logger.info(`Received ${signal}, shutting down gracefully...`);
      
      try {
        await stopWorkers();
        process.exit(0);
      } catch (error) {
        logger.error('Error during shutdown', error);
        process.exit(1);
      }
    });
  });

  process.on('uncaughtException', (error) => {
    logger.error('Uncaught exception', error);
    process.exit(1);
  });

  process.on('unhandledRejection', (reason) => {
    logger.error('Unhandled rejection', reason as Error);
    process.exit(1);
  });
};

// Se executado diretamente
if (import.meta.main) {
  setupGracefulShutdown();
  
  startWorkers()
    .then(() => {
      logger.info('Workers running. Press Ctrl+C to stop.');
    })
    .catch((error) => {
      logger.error('Failed to start workers', error);
      process.exit(1);
    });
}

export { createWhatsAppWorker, stopWorker };
