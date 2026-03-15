import type { NextFunction, Request, Response } from 'express';
import { verifyToken } from '../auth';

const FORBIDDEN_MESSAGE = 'FORBIDDEN: observability endpoints require superadmin or internal network access';

function toSingleHeaderValue(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0]?.trim();
  return value?.trim();
}

function normalizeIp(rawIp: string | undefined): string | null {
  if (!rawIp) return null;

  const trimmed = rawIp.trim();
  if (!trimmed) return null;

  if (trimmed === '::1') return '127.0.0.1';

  const mappedIpv4 = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(trimmed);
  if (mappedIpv4) {
    return mappedIpv4[1];
  }

  const ipv4WithPort = /^(\d+\.\d+\.\d+\.\d+):(\d+)$/.exec(trimmed);
  if (ipv4WithPort) {
    return ipv4WithPort[1];
  }

  const bracketedIpv6 = /^\[(.+)](?::\d+)?$/.exec(trimmed);
  if (bracketedIpv6) {
    return bracketedIpv6[1];
  }

  return trimmed;
}

function parseFirstForwardedIp(forwardedFor: string | undefined): string | null {
  if (!forwardedFor) return null;

  const first = forwardedFor
    .split(',')
    .map((part) => part.trim())
    .find((part) => part.length > 0);

  return normalizeIp(first);
}

function isPrivateIpv4(ip: string): boolean {
  const octets = ip.split('.').map((octet) => Number(octet));
  if (octets.length !== 4 || octets.some((octet) => Number.isNaN(octet) || octet < 0 || octet > 255)) {
    return false;
  }

  if (octets[0] === 10) return true;
  if (octets[0] === 127) return true;
  if (octets[0] === 192 && octets[1] === 168) return true;
  if (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31) return true;

  return false;
}

export function isInternalNetworkIp(ip: string): boolean {
  const normalized = normalizeIp(ip);
  if (!normalized) return false;

  if (normalized.includes(':')) {
    const lowered = normalized.toLowerCase();
    if (lowered === '::1') return true;
    if (lowered.startsWith('fc') || lowered.startsWith('fd')) return true;
    return false;
  }

  return isPrivateIpv4(normalized);
}

export function resolveEffectiveRequestIp(req: Request): string | null {
  const directIp = normalizeIp(req.ip ?? req.socket?.remoteAddress);
  if (!directIp) return null;

  const forwardedIp = parseFirstForwardedIp(toSingleHeaderValue(req.headers['x-forwarded-for']));

  // Trust x-forwarded-for only when the immediate sender is already on an internal network.
  if (forwardedIp && isInternalNetworkIp(directIp)) {
    return forwardedIp;
  }

  return directIp;
}

function hasSuperAdminToken(req: Request): boolean {
  const authHeader = toSingleHeaderValue(req.headers.authorization);
  const tokenPayload = verifyToken(authHeader);
  return tokenPayload?.role === 'superadmin';
}

export function createObservabilityAccessMiddleware() {
  return (req: Request, res: Response, next: NextFunction): void => {
    const effectiveIp = resolveEffectiveRequestIp(req);

    if (effectiveIp && isInternalNetworkIp(effectiveIp)) {
      next();
      return;
    }

    if (hasSuperAdminToken(req)) {
      next();
      return;
    }

    res.status(403).json({
      error: 'FORBIDDEN',
      message: FORBIDDEN_MESSAGE,
    });
  };
}