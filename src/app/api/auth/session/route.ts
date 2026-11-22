import { NextRequest, NextResponse } from 'next/server';
import { hasValidSession } from '@/lib/auth';
import { isPasscodeConfigured } from '@/lib/session';

export async function GET(request: NextRequest) {
  const authenticated = await hasValidSession(request);
  return NextResponse.json(
    {
      authenticated,
      configured: isPasscodeConfigured(),
    },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}
