import { Request, Response, NextFunction } from 'express';
import pino from 'pino';

const logger = pino({ name: 'skillbridge-api' });

export class AppError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public details?: unknown
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export function errorHandler(err: Error, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      error: err.message,
      ...(err.details ? { details: err.details } : {}),
    });
  }

  logger.error({ err }, 'Unhandled error');
  return res.status(500).json({ error: 'Internal server error' });
}
