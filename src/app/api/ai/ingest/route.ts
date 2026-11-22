import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { aiIngestRequestSchema } from '@/lib/validation';
import { parseTranscriptToActions } from '@/lib/ai-parser';
import { executeAiActionsAtomically } from '@/lib/ai-executor';

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request, 'dual');
  if (!auth.ok) return auth.response;

  try {
    const body = await request.json();

    // Idempotency-Key header (or optional body.idempotency_key) prevents duplicate retries
    const rawKey =
      request.headers.get('idempotency-key')?.trim() ||
      (typeof body?.idempotency_key === 'string' ? body.idempotency_key.trim() : '') ||
      null;
    const idempotencyKey = rawKey ? rawKey.slice(0, 128) : null;

    if (idempotencyKey) {
      try {
        const existingAudit = await prisma.aiAuditLog.findUnique({
          where: { idempotency_key: idempotencyKey },
        });
        if (existingAudit) {
          const cachedPayload = JSON.parse(existingAudit.response_payload);
          return NextResponse.json(
            {
              ...cachedPayload,
              replayed: true,
              idempotency_key: idempotencyKey,
            },
            { status: 200 }
          );
        }
      } catch (auditLookupErr) {
        console.warn('[GRanch Ingest] Skipping idempotency lookup:', auditLookupErr);
      }
    }

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

    const responsePayload = {
      ok: true,
      source: auth.actor === 'instinct_ai' ? 'instinct_ai' : 'ui_console',
      parser,
      parsed_actions: actionsToRun,
      message: execution.message,
      results: execution.results,
      ...(idempotencyKey ? { idempotency_key: idempotencyKey } : {}),
    };

    // Record persistent audit entry (and idempotency cache)
    try {
      await prisma.aiAuditLog.create({
        data: {
          idempotency_key: idempotencyKey,
          source: responsePayload.source,
          endpoint: '/api/ai/ingest',
          parser,
          raw_transcript: raw_transcript ?? transcript ?? null,
          parsed_actions: JSON.stringify(actionsToRun),
          status_code: 201,
          response_message: execution.message,
          response_payload: JSON.stringify(responsePayload),
        },
      });
    } catch (auditWriteErr) {
      console.warn('[GRanch Ingest] Could not write ai_audit_logs entry:', auditWriteErr);
    }

    return NextResponse.json(responsePayload, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to ingest ranch event.';
    const status = message.includes('was not found') ? 404 : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
