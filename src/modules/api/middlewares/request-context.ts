import { randomUUID } from 'node:crypto';
import type { Request, Response, NextFunction } from 'express';

/* eslint-disable @typescript-eslint/no-namespace */
declare global {
  namespace Express {
    interface Request {
      requestId?: string;
    }
  }
}
/* eslint-enable @typescript-eslint/no-namespace */

export function requestContextMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const incomingId = req.header('X-Request-Id');
  const requestId =
    typeof incomingId === 'string' && incomingId.trim().length > 0
      ? incomingId.trim()
      : randomUUID();

  req.requestId = requestId;
  res.setHeader('X-Request-Id', requestId);
  next();
}
