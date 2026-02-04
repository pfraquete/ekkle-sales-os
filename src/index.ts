/**
 * EKKLE SALES OS - Main Entry Point
 * Inicia API e Workers juntos (para desenvolvimento)
 */

import { createLogger } from './shared/logger';
import { startServer } from './api/server';
import { startWorkers, stopWorkers } from './workers';
import { closeRedisConnection } from './shared/redis';
import { closeQueues } from './api/services/queueService';

const logger = createLogger('main');

/**
 * Inicia todos os serviços
 */
const start = async (): Promise<void> => {
  logger.info('Starting EKKLE SALES OS...');

  try {
    // Iniciar API
    await startServer();
    
    // Iniciar Workers
    await startWorkers();

    logger.info('EKKLE SALES OS started successfully');
    logger.info('Services running:');
    logger.info('  - API Server: http://localhost:3000');
    logger.info('  - Swagger Docs: http://localhost:3000/docs');
    logger.info('  - WhatsApp Worker: Processing queue');

  } catch (error) {
    logger.error('Failed to start EKKLE SALES OS', error);
    process.exit(1);
  }
};

/**
 * Para todos os serviços gracefully
 */
const stop = async (): Promise<void> => {
  logger.info('Stopping EKKLE SALES OS...');

  try {
    await stopWorkers();
    await closeQueues();
    await closeRedisConnection();
    
    logger.info('EKKLE SALES OS stopped');
  } catch (error) {
    logger.error('Error during shutdown', error);
  }
};

/**
 * Setup graceful shutdown
 */
const setupGracefulShutdown = (): void => {
  const signals: NodeJS.Signals[] = ['SIGTERM', 'SIGINT', 'SIGUSR2'];

  signals.forEach(signal => {
    process.on(signal, async () => {
      logger.info(`Received ${signal}, initiating graceful shutdown...`);
      
      try {
        await stop();
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

// Iniciar aplicação
setupGracefulShutdown();
start();
