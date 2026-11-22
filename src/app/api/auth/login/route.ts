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
  const windowStart = new Date(Date.now() - WINDOW_MS);

  try {
    // Prune stale attempts older than 15 minutes and count recent failures for this IP
    await prisma.loginAttempt.deleteMany({
      where: { created_at: { lt: windowStart } },
    });

    const recentAttempts = await prisma.loginAttempt.findMany({
      where: {
        ip,
        created_at: { gte: windowStart },
      },
      orderBy: { created_at: 'asc' },
    });

    if (recentAttempts.length >= MAX_FAILED_ATTEMPTS) {
      const oldest = recentAttempts[0].created_at.getTime();
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
      await prisma.loginAttempt.create({ data: { ip } });
      const remaining = Math.max(0, MAX_FAILED_ATTEMPTS - (recentAttempts.length + 1));
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

    // Clear failed attempts on successful login
    await prisma.loginAttempt.deleteMany({ where: { ip } });

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
