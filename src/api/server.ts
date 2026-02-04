/**
 * EKKLE SALES OS - API Server
 * Servidor principal Elysia.js
 */

import { Elysia } from 'elysia';
import { cors } from '@elysiajs/cors';
import { swagger } from '@elysiajs/swagger';

import { config } from '../shared/config';
import { createLogger } from '../shared/logger';
import { rateLimitMiddleware, errorHandlerMiddleware } from './middleware';
import { healthRoutes, leadsRoutes } from './routes';
import { whatsappWebhook } from '../webhooks';
import { getQueueStats } from './services/queueService';

const logger = createLogger('api-server');

/**
 * Cria e configura a aplicação Elysia
 */
export const createApp = () => {
  const app = new Elysia()
    // Plugins
    .use(cors({
      origin: true,
      methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Webhook-Secret']
    }))
    .use(swagger({
      documentation: {
        info: {
          title: 'EKKLE SALES OS API',
          version: '1.0.0',
          description: 'Sistema de vendas B2B para igrejas com WhatsApp automation'
        },
        tags: [
          { name: 'Health', description: 'Health check endpoints' },
          { name: 'Leads', description: 'Lead management' },
          { name: 'Webhook', description: 'WhatsApp webhook' }
        ]
      },
      path: '/docs'
    }))
    
    // Middlewares globais
    .use(errorHandlerMiddleware())
    .use(rateLimitMiddleware())
    
    // Rotas
    .use(healthRoutes)
    .use(leadsRoutes)
    .use(whatsappWebhook)
    
    // Rota raiz
    .get('/', () => ({
      success: true,
      service: 'EKKLE SALES OS',
      version: '1.0.0',
      docs: '/docs'
    }))
    
    // Estatísticas da fila
    .get('/stats/queue', async () => {
      try {
        const stats = await getQueueStats();
        return {
          success: true,
          data: stats
        };
      } catch (error) {
        return {
          success: false,
          error: 'Failed to get queue stats'
        };
      }
    })
    
    // Lifecycle hooks
    .onStart(() => {
      logger.info('API server starting', {
        port: config.PORT,
        env: config.NODE_ENV
      });
    })
    .onStop(() => {
      logger.info('API server stopping');
    });

  return app;
};

/**
 * Inicia o servidor
 */
export const startServer = async () => {
  const app = createApp();
  
  app.listen({
    port: config.PORT,
    hostname: config.API_HOST
  });

  logger.info('API server started', {
    url: `http://${config.API_HOST}:${config.PORT}`,
    docs: `http://${config.API_HOST}:${config.PORT}/docs`,
    env: config.NODE_ENV
  });

  return app;
};

// Se executado diretamente
if (import.meta.main) {
  startServer().catch((error) => {
    logger.error('Failed to start API server', error);
    process.exit(1);
  });
}
