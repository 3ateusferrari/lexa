import type { NextFunction, Request, Response } from 'express';

interface HttpErrorLike {
  status?: number;
  statusCode?: number;
  type?: string;
  message?: string;
}

export function errorHandlerMiddleware(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  const httpErr = (typeof err === 'object' && err !== null ? err : {}) as HttpErrorLike;
  const statusCode =
    typeof httpErr.status === 'number'
      ? httpErr.status
      : typeof httpErr.statusCode === 'number'
        ? httpErr.statusCode
        : httpErr.type === 'entity.too.large'
          ? 413
          : 500;

  const message = err instanceof Error ? err.message : 'Unexpected server error';
  const errorCode =
    statusCode === 413
      ? 'PAYLOAD_TOO_LARGE'
      : statusCode === 400
        ? 'BAD_REQUEST'
        : 'INTERNAL_SERVER_ERROR';

  res.status(statusCode).json({
    error: errorCode,
    message,
  });
}
