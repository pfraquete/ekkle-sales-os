/**
 * EKKLE SALES OS - Rate Limiting Middleware
 * Limita requisições por IP usando Redis
 */

import { Elysia } from 'elysia';
import { getRedisClient } from '../../shared/redis';
import { config } from '../../shared/config';
import { createLogger } from '../../shared/logger';

const logger = createLogger('rate-limit');

interface RateLimitConfig {
  max: number;
  windowMs: number;
}

/**
 * Middleware de rate limiting usando Redis
 */
export const rateLimitMiddleware = (customConfig?: Partial<RateLimitConfig>) => {
  const rateLimitConfig: RateLimitConfig = {
    max: customConfig?.max ?? config.RATE_LIMIT_MAX,
    windowMs: customConfig?.windowMs ?? config.RATE_LIMIT_WINDOW_MS
  };

  const windowSeconds = Math.ceil(rateLimitConfig.windowMs / 1000);

  return new Elysia({ name: 'rate-limit' })
    .derive(async ({ request, set }) => {
      try {
        const redis = getRedisClient();
        
        // Extrair IP do cliente
        const forwarded = request.headers.get('x-forwarded-for');
        const ip = forwarded?.split(',')[0]?.trim() || 'unknown';
        const key = `ratelimit:${ip}`;

        // Incrementar contador
        const current = await redis.incr(key);
        
        // Se é a primeira requisição, definir TTL
        if (current === 1) {
          await redis.expire(key, windowSeconds);
        }

        // Obter TTL restante
        const ttl = await redis.ttl(key);

        // Adicionar headers de rate limit
        set.headers['X-RateLimit-Limit'] = rateLimitConfig.max.toString();
        set.headers['X-RateLimit-Remaining'] = Math.max(0, rateLimitConfig.max - current).toString();
        set.headers['X-RateLimit-Reset'] = (Date.now() + ttl * 1000).toString();

        // Verificar se excedeu o limite
        if (current > rateLimitConfig.max) {
          logger.warn('Rate limit exceeded', { ip, current, max: rateLimitConfig.max });
          
          set.status = 429;
          return {
            success: false,
            error: 'Too many requests',
            message: `Rate limit exceeded. Try again in ${ttl} seconds.`,
            retryAfter: ttl
          };
        }

        return { rateLimitInfo: { ip, current, remaining: rateLimitConfig.max - current } };
      } catch (error) {
        // Em caso de erro no Redis, permitir a requisição
        logger.error('Rate limit check failed', error);
        return { rateLimitInfo: { ip: 'unknown', current: 0, remaining: rateLimitConfig.max } };
      }
    });
};

/**
 * Rate limit mais restritivo para webhooks
 */
export const webhookRateLimitMiddleware = () => {
  return rateLimitMiddleware({
    max: 500, // Webhooks podem ter mais requisições
    windowMs: 60000
  });
};
