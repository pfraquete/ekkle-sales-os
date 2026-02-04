/**
 * EKKLE SALES OS - Logger
 * Sistema de logging estruturado
 */

import { config } from './config';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogContext {
  [key: string]: unknown;
}

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3
};

const shouldLog = (level: LogLevel): boolean => {
  return LOG_LEVELS[level] >= LOG_LEVELS[config.LOG_LEVEL];
};

const formatMessage = (
  level: LogLevel,
  module: string,
  message: string,
  context?: LogContext
): string => {
  const timestamp = new Date().toISOString();
  const logEntry = {
    timestamp,
    level: level.toUpperCase(),
    module,
    message,
    ...context
  };
  return JSON.stringify(logEntry);
};

const createLogger = (module: string) => {
  return {
    debug: (message: string, context?: LogContext) => {
      if (shouldLog('debug')) {
        console.debug(formatMessage('debug', module, message, context));
      }
    },

    info: (message: string, context?: LogContext) => {
      if (shouldLog('info')) {
        console.info(formatMessage('info', module, message, context));
      }
    },

    warn: (message: string, context?: LogContext) => {
      if (shouldLog('warn')) {
        console.warn(formatMessage('warn', module, message, context));
      }
    },

    error: (message: string, error?: Error | unknown, context?: LogContext) => {
      if (shouldLog('error')) {
        const errorContext: LogContext = { ...context };
        
        if (error instanceof Error) {
          errorContext.errorName = error.name;
          errorContext.errorMessage = error.message;
          errorContext.errorStack = error.stack;
        } else if (error) {
          errorContext.error = error;
        }

        console.error(formatMessage('error', module, message, errorContext));
      }
    },

    // Log de operações de banco de dados
    db: (operation: string, table: string, context?: LogContext) => {
      if (shouldLog('debug')) {
        console.debug(formatMessage('debug', module, `DB ${operation}`, {
          table,
          ...context
        }));
      }
    },

    // Log de chamadas de API externa
    api: (service: string, method: string, context?: LogContext) => {
      if (shouldLog('info')) {
        console.info(formatMessage('info', module, `API ${method}`, {
          service,
          ...context
        }));
      }
    },

    // Log de processamento de fila
    queue: (queue: string, action: string, jobId?: string, context?: LogContext) => {
      if (shouldLog('info')) {
        console.info(formatMessage('info', module, `Queue ${action}`, {
          queue,
          jobId,
          ...context
        }));
      }
    },

    // Log de agentes AI
    agent: (agentName: string, action: string, context?: LogContext) => {
      if (shouldLog('info')) {
        console.info(formatMessage('info', module, `Agent ${action}`, {
          agentName,
          ...context
        }));
      }
    }
  };
};

export const logger = createLogger('app');
export { createLogger };
export type { LogContext };
