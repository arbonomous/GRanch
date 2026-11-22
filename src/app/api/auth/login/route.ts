import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getClientIp } from '@/lib/auth';
import {
  createSessionToken,
  isPasscodeConfigured,
  SESSION_COOKIE_NAME,
  SESSION_MAX_AGE_SECONDS,
  verifyPasscode,
} from '@/lib/session';

const MAX_FAILED_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000; // 15 minutes

// In-memory fallback limiter if PostgreSQL login_attempts table is unavailable
const memoryAttempts = new Map<string, number[]>();

function getMemoryAttempts(ip: string, now: number): number[] {
  const cutoff = now - WINDOW_MS;
  const fresh = (memoryAttempts.get(ip) ?? []).filter((ts) => ts >= cutoff);
  memoryAttempts.set(ip, fresh);
  return fresh;
}

async function getRecentFailures(ip: string): Promise<{ count: number; oldestMs: number | null; mode: 'db' | 'memory' }> {
  const now = Date.now();
  const windowStart = new Date(now - WINDOW_MS);
  try {
    await prisma.loginAttempt.deleteMany({
      where: { created_at: { lt: windowStart } },
    });
    const rows = await prisma.loginAttempt.findMany({
      where: { ip, created_at: { gte: windowStart } },
      orderBy: { created_at: 'asc' },
    });
    return {
      count: rows.length,
      oldestMs: rows[0]?.created_at.getTime() ?? null,
      mode: 'db',
    };
  } catch (err) {
    console.warn('[GRanch Login] Falling back to in-memory rate limit:', err);
    const list = getMemoryAttempts(ip, now);
    return {
      count: list.length,
      oldestMs: list[0] ?? null,
      mode: 'memory',
    };
  }
}

async function recordFailure(ip: string, mode: 'db' | 'memory') {
  if (mode === 'db') {
    try {
      await prisma.loginAttempt.create({ data: { ip } });
      return;
    } catch {
      // Fall through to memory recorder
    }
  }
  const now = Date.now();
  const list = getMemoryAttempts(ip, now);
  list.push(now);
  memoryAttempts.set(ip, list);
}

async function clearFailures(ip: string, mode: 'db' | 'memory') {
  memoryAttempts.delete(ip);
  if (mode === 'db') {
    try {
      await prisma.loginAttempt.deleteMany({ where: { ip } });
    } catch {
      // Non-fatal
    }
  }
}

export async function POST(request: NextRequest) {
  if (!isPasscodeConfigured()) {
    return NextResponse.json(
      {
        ok: false,
        error:
          'RANCH_PASSCODE is not configured on the server. Add RANCH_PASSCODE to your Vercel Environment Variables and redeploy.',
      },
      { status: 503 }
    );
  }

  const ip = getClientIp(request);

  try {
    const rate = await getRecentFailures(ip);

    if (rate.count >= MAX_FAILED_ATTEMPTS) {
      const oldest = rate.oldestMs ?? Date.now();
      const retryMinutes = Math.max(1, Math.ceil((oldest + WINDOW_MS - Date.now()) / 60000));
      return NextResponse.json(
        {
          ok: false,
          error: `Too many failed attempts. Try again in ${retryMinutes} ${
            retryMinutes === 1 ? 'minute' : 'minutes'
          }.`,
        },
        { status: 429 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const passcode = typeof body?.passcode === 'string' ? body.passcode : '';

    const valid = await verifyPasscode(passcode);
    if (!valid) {
      await recordFailure(ip, rate.mode);
      const remaining = Math.max(0, MAX_FAILED_ATTEMPTS - (rate.count + 1));
      return NextResponse.json(
        {
          ok: false,
          error:
            remaining > 0
              ? `Incorrect ranch passcode. ${remaining} ${
                  remaining === 1 ? 'attempt' : 'attempts'
                } remaining.`
              : 'Incorrect ranch passcode. Too many failed attempts — locked for 15 minutes.',
        },
        { status: 401 }
      );
    }

    await clearFailures(ip, rate.mode);

    const token = await createSessionToken();
    if (!token) {
      return NextResponse.json(
        { ok: false, error: 'Unable to sign session token.' },
        { status: 500 }
      );
    }

    const response = NextResponse.json({ ok: true });
    response.cookies.set(SESSION_COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: SESSION_MAX_AGE_SECONDS,
    });

    return response;
  } catch (err) {
    console.error('POST /api/auth/login error:', err);
    return NextResponse.json(
      { ok: false, error: 'Authentication service error.' },
      { status: 500 }
    );
  }
}
