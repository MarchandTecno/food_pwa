import { randomUUID } from 'crypto';
import type { NextFunction, Request, Response } from 'express';

const REQUEST_ID_HEADER = 'x-request-id';

function normalizeRequestId(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) {
    return value[0]?.trim() || null;
  }

  if (typeof value === 'string' && value.trim()) {
    return value.trim();
  }

  return null;
}

export function requestIdMiddleware(req: Request, res: Response, next: NextFunction): void {
  const incoming = normalizeRequestId(req.headers[REQUEST_ID_HEADER]);
  const requestId = incoming ?? randomUUID();

  res.locals.requestId = requestId;
  res.setHeader(REQUEST_ID_HEADER, requestId);

  next();
}
