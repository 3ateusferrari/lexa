import type { NextFunction, Request, Response } from 'express';

export interface IpRateLimiterOptions {
  windowMs?: number;
  maxRequests: number;
}

export function createIpRateLimiter(options: IpRateLimiterOptions) {
  const windowMs = options.windowMs ?? 60_000;
  const maxRequests = options.maxRequests;
  const hitsByIp = new Map<string, number[]>();

  return (req: Request, res: Response, next: NextFunction): void => {
    const ip =
      (req.headers['x-forwarded-for'] as string | undefined)?.split(',')[0]?.trim() ||
      req.ip ||
      '127.0.0.1';

    const now = Date.now();
    const recent = (hitsByIp.get(ip) ?? []).filter((ts) => now - ts < windowMs);

    if (recent.length >= maxRequests) {
      res.status(429).json({
        error: 'RATE_LIMIT_EXCEEDED',
        message: 'Muitas consultas em pouco tempo. Aguarde um minuto antes de tentar novamente.',
      });
      return;
    }

    recent.push(now);
    hitsByIp.set(ip, recent);
    next();
  };
}
