import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';

/**
 * Verifies `Authorization: Bearer <API_KEY>` against `process.env.AI_API_KEY`.
 * Returns null if valid, or a 401/500 NextResponse if unauthorized/misconfigured.
 */
export function verifyAiAuth(request: NextRequest): NextResponse | null {
  const configuredKey = process.env.AI_API_KEY?.trim();

  if (!configuredKey) {
    return NextResponse.json(
      {
        error: 'Server misconfiguration: AI_API_KEY is not set.',
      },
      { status: 500 }
    );
  }

  const authHeader = request.headers.get('authorization') ?? '';
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  if (!match) {
    return NextResponse.json(
      {
        error: 'Unauthorized. Provide Authorization: Bearer <AI_API_KEY> header.',
      },
      { status: 401 }
    );
  }

  const providedKey = match[1].trim();
  const expectedBuf = Buffer.from(configuredKey, 'utf8');
  const providedBuf = Buffer.from(providedKey, 'utf8');

  if (
    expectedBuf.length !== providedBuf.length ||
    !crypto.timingSafeEqual(expectedBuf, providedBuf)
  ) {
    return NextResponse.json(
      {
        error: 'Unauthorized. Invalid API key.',
      },
      { status: 401 }
    );
  }

  return null;
}
