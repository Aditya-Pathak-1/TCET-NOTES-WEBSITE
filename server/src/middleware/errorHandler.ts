import { Request, Response, NextFunction } from 'express';

export interface AppError extends Error {
  status?: number;
  details?: string;
}

export function createError(message: string, status = 500, details?: string): AppError {
  const err = new Error(message) as AppError;
  err.status = status;
  if (details) err.details = details;
  return err;
}

/** Wraps an async route handler so thrown errors are forwarded to Express error middleware */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>
) {
  return (req: Request, res: Response, next: NextFunction): void => {
    fn(req, res, next).catch(next);
  };
}

/** Global error handler — must be last middleware registered */
export function errorHandler(
  err: AppError,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  const status = err.status ?? 500;
  console.error(`[${status}] ${err.message}`, err.details ?? '');
  res.status(status).json({
    error: err.message || 'Internal Server Error',
    ...(err.details && { details: err.details }),
  });
}
