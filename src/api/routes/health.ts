/**
 * EKKLE SALES OS - Health Check Routes
 */

import { Elysia } from 'elysia';
import { checkSupabaseConnection } from '../../shared/supabase';
import { checkRedisConnection } from '../../shared/redis';
import { createLogger } from '../../shared/logger';
import { countLeads } from '../services/leadService';

const logger = createLogger('health');

export const healthRoutes = new Elysia({ prefix: '/health' })
  /**
   * Health check básico (at /health/)
   * Note: /health is also registered directly in server.ts for Railway compatibility
   */
  .get('/', async () => {
    logger.info('Health check requested (with trailing slash)');

    return {
      success: true,
      status: 'healthy',
      timestamp: new Date().toISOString(),
      service: 'ekkle-sales-os'
    };
  })

  /**
   * Health check detalhado com verificação de dependências
   */
  .get('/detailed', async () => {
    logger.info('Detailed health check requested');
    
    const checks: Record<string, { status: string; latency?: number; error?: string }> = {};
    
    // Check Supabase
    const supabaseStart = Date.now();
    try {
      const supabaseOk = await checkSupabaseConnection();
      checks.supabase = {
        status: supabaseOk ? 'healthy' : 'unhealthy',
        latency: Date.now() - supabaseStart
      };
    } catch (error) {
      checks.supabase = {
        status: 'unhealthy',
        latency: Date.now() - supabaseStart,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }

    // Check Redis
    const redisStart = Date.now();
    try {
      const redisOk = await checkRedisConnection();
      checks.redis = {
        status: redisOk ? 'healthy' : 'unhealthy',
        latency: Date.now() - redisStart
      };
    } catch (error) {
      checks.redis = {
        status: 'unhealthy',
        latency: Date.now() - redisStart,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }

    // Contagem de leads
    try {
      const leadsCount = await countLeads();
      checks.database = {
        status: 'healthy',
        latency: 0
      };
    } catch (error) {
      checks.database = {
        status: 'unhealthy',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }

    const allHealthy = Object.values(checks).every(c => c.status === 'healthy');

    return {
      success: allHealthy,
      status: allHealthy ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      service: 'ekkle-sales-os',
      checks
    };
  })

  /**
   * Readiness probe para Kubernetes/Railway
   */
  .get('/ready', async ({ set }) => {
    try {
      const supabaseOk = await checkSupabaseConnection();
      const redisOk = await checkRedisConnection();

      if (supabaseOk && redisOk) {
        return {
          success: true,
          status: 'ready'
        };
      }

      set.status = 503;
      return {
        success: false,
        status: 'not ready',
        message: 'Dependencies not available'
      };
    } catch (error) {
      set.status = 503;
      return {
        success: false,
        status: 'not ready',
        message: 'Health check failed'
      };
    }
  })

  /**
   * Liveness probe para Kubernetes/Railway
   */
  .get('/live', () => {
    return {
      success: true,
      status: 'alive'
    };
  });
