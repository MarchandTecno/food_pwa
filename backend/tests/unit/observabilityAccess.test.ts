import type { NextFunction, Request, Response } from 'express';
import { generateToken } from '../../src/auth';
import {
  createObservabilityAccessMiddleware,
  isInternalNetworkIp,
  resolveEffectiveRequestIp,
} from '../../src/middleware/observabilityAccess';

interface MockResponse extends Response {
  statusCodeValue?: number;
  jsonBody?: unknown;
}

function buildRequest(input: {
  ip?: string;
  remoteAddress?: string;
  forwardedFor?: string;
  authorization?: string;
}): Request {
  const headers: Record<string, string> = {};

  if (input.forwardedFor) {
    headers['x-forwarded-for'] = input.forwardedFor;
  }

  if (input.authorization) {
    headers.authorization = input.authorization;
  }

  return {
    ip: input.ip,
    socket: {
      remoteAddress: input.remoteAddress,
    },
    headers,
  } as unknown as Request;
}

function buildResponse(): MockResponse {
  const res = {} as MockResponse;

  res.status = ((code: number) => {
    res.statusCodeValue = code;
    return res;
  }) as Response['status'];

  res.json = ((payload: unknown) => {
    res.jsonBody = payload;
    return res;
  }) as Response['json'];

  return res;
}

describe('observability access middleware', () => {
  it('detects private and public network addresses correctly', () => {
    expect(isInternalNetworkIp('10.0.0.25')).toBe(true);
    expect(isInternalNetworkIp('172.20.10.4')).toBe(true);
    expect(isInternalNetworkIp('192.168.1.55')).toBe(true);
    expect(isInternalNetworkIp('127.0.0.1')).toBe(true);
    expect(isInternalNetworkIp('::1')).toBe(true);
    expect(isInternalNetworkIp('::ffff:127.0.0.1')).toBe(true);
    expect(isInternalNetworkIp('8.8.8.8')).toBe(false);
  });

  it('uses x-forwarded-for only when immediate sender is internal', () => {
    const throughInternalProxy = buildRequest({
      ip: '10.0.0.7',
      forwardedFor: '203.0.113.10, 10.0.0.7',
    });

    const spoofedHeader = buildRequest({
      ip: '203.0.113.50',
      forwardedFor: '10.0.0.3',
    });

    expect(resolveEffectiveRequestIp(throughInternalProxy)).toBe('203.0.113.10');
    expect(resolveEffectiveRequestIp(spoofedHeader)).toBe('203.0.113.50');
  });

  it('allows internal network clients without requiring token', () => {
    const middleware = createObservabilityAccessMiddleware();
    const req = buildRequest({ ip: '192.168.1.8' });
    const res = buildResponse();
    const next = jest.fn() as unknown as NextFunction;

    middleware(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.statusCodeValue).toBeUndefined();
  });

  it('blocks external clients without superadmin token', () => {
    const middleware = createObservabilityAccessMiddleware();
    const req = buildRequest({ ip: '203.0.113.8' });
    const res = buildResponse();
    const next = jest.fn() as unknown as NextFunction;

    middleware(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCodeValue).toBe(403);
    expect(res.jsonBody).toEqual(
      expect.objectContaining({
        error: 'FORBIDDEN',
      }),
    );
  });

  it('allows external clients with superadmin token', () => {
    const middleware = createObservabilityAccessMiddleware();
    const token = generateToken({
      userId: 'superadmin-user',
      role: 'superadmin',
    });

    const req = buildRequest({
      ip: '203.0.113.25',
      authorization: `Bearer ${token}`,
    });
    const res = buildResponse();
    const next = jest.fn() as unknown as NextFunction;

    middleware(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.statusCodeValue).toBeUndefined();
  });

  it('denies external clients with non-superadmin token', () => {
    const middleware = createObservabilityAccessMiddleware();
    const token = generateToken({
      userId: 'owner-user',
      role: 'admin',
    });

    const req = buildRequest({
      ip: '203.0.113.30',
      authorization: `Bearer ${token}`,
    });
    const res = buildResponse();
    const next = jest.fn() as unknown as NextFunction;

    middleware(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCodeValue).toBe(403);
  });
});
