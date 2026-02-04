/**
 * EKKLE SALES OS - Error Handler Middleware
 * Tratamento centralizado de erros
 */

import { Elysia } from 'elysia';
import { createLogger } from '../../shared/logger';
import { ZodError } from 'zod';

const logger = createLogger('error-handler');

/**
 * Tipos de erro customizados
 */
export class AppError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public code?: string
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string) {
    super(404, `${resource} not found`, 'NOT_FOUND');
    this.name = 'NotFoundError';
  }
}

export class ValidationError extends AppError {
  constructor(message: string) {
    super(400, message, 'VALIDATION_ERROR');
    this.name = 'ValidationError';
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Unauthorized') {
    super(401, message, 'UNAUTHORIZED');
    this.name = 'UnauthorizedError';
  }
}

/**
 * Middleware de tratamento de erros
 */
export const errorHandlerMiddleware = () => {
  return new Elysia({ name: 'error-handler' })
    .onError(({ error, set, request }) => {
      const requestId = crypto.randomUUID();
      const path = new URL(request.url).pathname;

      // Log do erro
      logger.error('Request error', error, {
        requestId,
        path,
        method: request.method
      });

      // Erro de validação Zod
      if (error instanceof ZodError) {
        set.status = 400;
        return {
          success: false,
          error: 'Validation error',
          message: error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', '),
          code: 'VALIDATION_ERROR',
          requestId
        };
      }

      // Erro customizado da aplicação
      if (error instanceof AppError) {
        set.status = error.statusCode;
        return {
          success: false,
          error: error.name,
          message: error.message,
          code: error.code,
          requestId
        };
      }

      // Erro de parse JSON
      if (error.message?.includes('JSON')) {
        set.status = 400;
        return {
          success: false,
          error: 'Invalid JSON',
          message: 'Request body must be valid JSON',
          code: 'INVALID_JSON',
          requestId
        };
      }

      // Erro genérico
      set.status = 500;
      return {
        success: false,
        error: 'Internal server error',
        message: 'An unexpected error occurred',
        code: 'INTERNAL_ERROR',
        requestId
      };
    });
};
