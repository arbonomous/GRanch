import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import openApiSpec from '@/lib/openapi.json';

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request, 'dual');
  if (!auth.ok) return auth.response;

  const spec = structuredClone(openApiSpec);
  const origin = request.nextUrl.origin;
  if (origin && Array.isArray(spec.servers)) {
    spec.servers = [
      {
        url: origin,
        description: 'Active GRanch deployment',
      },
    ];
  }

  return NextResponse.json(spec, {
    status: 200,
    headers: {
      'Cache-Control': 'no-store',
    },
  });
}
