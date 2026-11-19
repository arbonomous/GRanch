import { NextRequest, NextResponse } from 'next/server';
import { verifyAiAuth } from '@/lib/auth';
import { aiIngestRequestSchema } from '@/lib/validation';
import { parseTranscriptToActions } from '@/lib/ai-parser';
import { executeAiActionsAtomically } from '@/lib/ai-executor';

export async function POST(request: NextRequest) {
  const authError = verifyAiAuth(request);
  if (authError) return authError;

  try {
    const body = await request.json();
    const parsed = aiIngestRequestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          ok: false,
          error: 'Invalid request payload.',
          details: parsed.error.flatten(),
        },
        { status: 400 }
      );
    }

    const { transcript, raw_transcript, actions: structuredActions } = parsed.data;
    let actionsToRun = structuredActions ?? [];
    let parser: 'structured' | 'openai' | 'deterministic' = 'structured';

    if (actionsToRun.length === 0 && transcript) {
      const result = await parseTranscriptToActions(transcript);
      actionsToRun = result.actions;
      parser = result.parser;
    }

    if (actionsToRun.length === 0) {
      return NextResponse.json(
        {
          ok: false,
          error: 'Could not extract any ranch actions from the provided input.',
        },
        { status: 400 }
      );
    }

    const execution = await executeAiActionsAtomically(
      actionsToRun,
      raw_transcript ?? transcript ?? null
    );

    return NextResponse.json(
      {
        ok: true,
        parser,
        parsed_actions: actionsToRun,
        message: execution.message,
        results: execution.results,
      },
      { status: 201 }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to ingest ranch event.';
    const status = message.includes('was not found') ? 404 : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
