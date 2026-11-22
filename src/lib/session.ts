export const SESSION_COOKIE_NAME = 'granch_session';
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 days

interface SessionPayload {
  role: 'owner';
  iat: number;
  exp: number;
}

const encoder = new TextEncoder();

function toBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(str: string): Uint8Array | null {
  try {
    const padded = str.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((str.length + 3) % 4);
    const binary = atob(padded);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  } catch {
    return null;
  }
}

function constantTimeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a[i] ^ b[i];
  }
  return diff === 0;
}

export function isPasscodeConfigured(): boolean {
  return Boolean(process.env.RANCH_PASSCODE?.trim());
}

/**
 * Derives the HMAC signing key from SESSION_SECRET if provided,
 * or securely from RANCH_PASSCODE + AI_API_KEY via SHA-256.
 * Fails closed (returns null) if RANCH_PASSCODE is not configured.
 */
async function getSigningKey(): Promise<CryptoKey | null> {
  const passcode = process.env.RANCH_PASSCODE?.trim();
  if (!passcode) return null;

  const explicitSecret = process.env.SESSION_SECRET?.trim();
  const seedMaterial = explicitSecret
    ? `granch-session-v1:${explicitSecret}`
    : `granch-session-v1:${passcode}:${process.env.AI_API_KEY?.trim() ?? ''}`;

  const keyHash = await crypto.subtle.digest('SHA-256', encoder.encode(seedMaterial));
  return crypto.subtle.importKey(
    'raw',
    keyHash,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  );
}

/**
 * Constant-time SHA-256 comparison so passcode length is never leaked via timing.
 */
export async function verifyPasscode(candidate: string): Promise<boolean> {
  const expected = process.env.RANCH_PASSCODE?.trim();
  if (!expected || !candidate) return false;

  const [aHash, bHash] = await Promise.all([
    crypto.subtle.digest('SHA-256', encoder.encode(candidate.trim())),
    crypto.subtle.digest('SHA-256', encoder.encode(expected)),
  ]);
  return constantTimeEqual(new Uint8Array(aHash), new Uint8Array(bHash));
}

export async function createSessionToken(): Promise<string | null> {
  const key = await getSigningKey();
  if (!key) return null;

  const now = Math.floor(Date.now() / 1000);
  const payload: SessionPayload = {
    role: 'owner',
    iat: now,
    exp: now + SESSION_MAX_AGE_SECONDS,
  };

  const payloadB64 = toBase64Url(encoder.encode(JSON.stringify(payload)));
  const sigBuffer = await crypto.subtle.sign('HMAC', key, encoder.encode(payloadB64));
  const sigB64 = toBase64Url(new Uint8Array(sigBuffer));

  return `${payloadB64}.${sigB64}`;
}

export async function verifySessionToken(token?: string | null): Promise<SessionPayload | null> {
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;

  const [payloadB64, sigB64] = parts;
  const key = await getSigningKey();
  if (!key) return null;

  const providedSig = fromBase64Url(sigB64);
  if (!providedSig) return null;

  const expectedSigBuffer = await crypto.subtle.sign('HMAC', key, encoder.encode(payloadB64));
  const expectedSig = new Uint8Array(expectedSigBuffer);
  if (!constantTimeEqual(providedSig, expectedSig)) return null;

  const payloadBytes = fromBase64Url(payloadB64);
  if (!payloadBytes) return null;

  try {
    const payload = JSON.parse(new TextDecoder().decode(payloadBytes)) as SessionPayload;
    const now = Math.floor(Date.now() / 1000);
    if (payload.role !== 'owner' || typeof payload.exp !== 'number' || payload.exp <= now) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}
