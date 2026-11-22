import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { SESSION_COOKIE_NAME, verifySessionToken } from './session';

export type AuthActor = 'owner' | 'instinct_ai';
export type AuthMode = 'dual' | 'session_only';

export interface AuthSuccess {
  ok: true;
  actor: AuthActor;
}

export interface AuthFailure {
  ok: false;
  response: NextResponse;
}

export function hasValidBearerKey(request: NextRequest): boolean {
  const configuredKey = process.env.AI_API_KEY?.trim();
  if (!configuredKey) return false;

  const authHeader = request.headers.get('authorization') ?? '';
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  if (!match) return false;

  const providedKey = match[1].trim();
  const expectedBuf = Buffer.from(configuredKey, 'utf8');
  const providedBuf = Buffer.from(providedKey, 'utf8');

  if (expectedBuf.length !== providedBuf.length) return false;
  return crypto.timingSafeEqual(expectedBuf, providedBuf);
}

export async function hasValidSession(request: NextRequest): Promise<boolean> {
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const payload = await verifySessionToken(token);
  return payload !== null;
}

/**
 * Enforces API authentication across all endpoints.
 * - `dual`: accepts signed UI owner session cookie OR `Authorization: Bearer <AI_API_KEY>`.
 * - `session_only`: requires signed UI owner session cookie; returns 403 if a Bearer token attempts destructive/admin operations.
 */
export async function requireAuth(
  request: NextRequest,
  mode: AuthMode = 'dual'
): Promise<AuthSuccess | AuthFailure> {
  if (await hasValidSession(request)) {
    return { ok: true, actor: 'owner' };
  }

  const bearerValid = hasValidBearerKey(request);

  if (mode === 'session_only') {
    if (bearerValid) {
      return {
        ok: false,
        response: NextResponse.json(
          {
            ok: false,
            error:
              'Forbidden. Destructive and admin actions require a signed-in ranch owner session.',
          },
          { status: 403 }
        ),
      };
    }
    return {
      ok: false,
      response: NextResponse.json(
        { ok: false, error: 'Unauthorized. Sign in with the ranch passcode.' },
        { status: 401 }
      ),
    };
  }

  if (bearerValid) {
    return { ok: true, actor: 'instinct_ai' };
  }

  return {
    ok: false,
    response: NextResponse.json(
      {
        ok: false,
        error:
          'Unauthorized. Sign in with the ranch passcode or provide Authorization: Bearer <AI_API_KEY>.',
      },
      { status: 401 }
    ),
  };
}

export function getClientIp(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    const first = forwarded.split(',')[0]?.trim();
    if (first) return first;
  }
  const realIp = request.headers.get('x-real-ip')?.trim();
  if (realIp) return realIp;
  return 'unknown';
}
