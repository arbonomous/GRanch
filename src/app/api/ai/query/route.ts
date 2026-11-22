import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { aiQueryRequestSchema } from '@/lib/validation';
import { executeAiQuery } from '@/lib/ranch-queries';

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request, 'dual');
  if (!auth.ok) return auth.response;

  try {
    const body = await request.json();
    const parsed = aiQueryRequestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          ok: false,
          error: 'Invalid query payload.',
          details: parsed.error.flatten(),
        },
        { status: 400 }
      );
    }

    const result = await executeAiQuery(parsed.data);

    return NextResponse.json({
      ok: true,
      ...result,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to run ranch query.';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
