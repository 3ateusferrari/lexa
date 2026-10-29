import pino from 'pino';

export interface LogContext {
  requestId?: string;
  documentId?: string;
  sourceUrl?: string;
  latencyMs?: number;
  userId?: string;
  [key: string]: unknown;
}

export function createStructuredLogger(serviceName = 'lexa-app') {
  return pino({
    level: process.env.LOG_LEVEL ?? 'info',
    base: {
      service: serviceName,
      env: process.env.NODE_ENV ?? 'development'
    },
    timestamp: pino.stdTimeFunctions.isoTime
  });
}

const defaultLogger = createStructuredLogger('lexa');

export function getAppLogger(serviceName?: string) {
  if (serviceName) {
    return createStructuredLogger(serviceName);
  }
  return defaultLogger;
}
