/**
 * EKKLE SALES OS - Redis Client
 * Cliente configurado do Redis para BullMQ
 */

import Redis from 'ioredis';
import { config, getRedisConfig } from './config';
import { createLogger } from './logger';

const logger = createLogger('redis');

let redisClient: Redis | null = null;

/**
 * Obtém instância do cliente Redis
 */
export const getRedisClient = (): Redis => {
  if (!redisClient) {
    const redisConfig = getRedisConfig();
    
    logger.info('Initializing Redis client', { 
      host: 'url' in redisConfig ? 'from URL' : redisConfig.host,
      port: 'url' in redisConfig ? 'from URL' : redisConfig.port
    });

    if ('url' in redisConfig && redisConfig.url) {
      redisClient = new Redis(redisConfig.url, {
        maxRetriesPerRequest: null,
        enableReadyCheck: false
      });
    } else {
      redisClient = new Redis({
        host: (redisConfig as { host: string }).host,
        port: (redisConfig as { port: number }).port,
        password: (redisConfig as { password?: string }).password,
        maxRetriesPerRequest: null,
        enableReadyCheck: false
      });
    }

    redisClient.on('connect', () => {
      logger.info('Redis connected');
    });

    redisClient.on('error', (error) => {
      logger.error('Redis error', error);
    });

    redisClient.on('close', () => {
      logger.warn('Redis connection closed');
    });
  }

  return redisClient;
};

/**
 * Fecha conexão Redis
 */
export const closeRedisConnection = async (): Promise<void> => {
  if (redisClient) {
    logger.info('Closing Redis connection');
    await redisClient.quit();
    redisClient = null;
  }
};

/**
 * Verifica conexão Redis
 */
export const checkRedisConnection = async (): Promise<boolean> => {
  try {
    const redis = getRedisClient();
    const pong = await redis.ping();
    logger.info('Redis connection verified', { response: pong });
    return pong === 'PONG';
  } catch (error) {
    logger.error('Redis connection check failed', error);
    return false;
  }
};

/**
 * Configuração de conexão para BullMQ
 */
export const getBullMQConnection = () => {
  const redisConfig = getRedisConfig();
  
  if ('url' in redisConfig && redisConfig.url) {
    // Parse URL para extrair componentes
    const url = new URL(redisConfig.url);
    return {
      host: url.hostname,
      port: parseInt(url.port) || 6379,
      password: url.password || undefined,
      maxRetriesPerRequest: null
    };
  }
  
  return {
    host: (redisConfig as { host: string }).host,
    port: (redisConfig as { port: number }).port,
    password: (redisConfig as { password?: string }).password,
    maxRetriesPerRequest: null
  };
};
