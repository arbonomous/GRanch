import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { updateDailyLogSchema } from '@/lib/validation';
import { parseDateInput } from '@/lib/dates';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(request, 'dual');
  if (!auth.ok) return auth.response;

  try {
    const { id } = await context.params;
    const log = await prisma.dailyLog.findUnique({
      where: { id },
      include: {
        cow: { select: { id: true, tag_number: true, name: true } },
        transaction: { select: { id: true, type: true, amount: true, category: true } },
      },
    });
    if (!log) {
      return NextResponse.json({ error: 'Daily log not found.' }, { status: 404 });
    }
    return NextResponse.json({
      log: {
        ...log,
        transaction: log.transaction
          ? { ...log.transaction, amount: Number(log.transaction.amount) }
          : null,
      },
    });
  } catch (err) {
    console.error('GET /api/logs/[id] error:', err);
    return NextResponse.json({ error: 'Failed to load daily log.' }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(request, 'dual');
  if (!auth.ok) return auth.response;

  try {
    const { id } = await context.params;
    const body = await request.json();
    const parsed = updateDailyLogSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid daily log update.', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const data = parsed.data;
    const updated = await prisma.dailyLog.update({
      where: { id },
      data: {
        ...(data.timestamp ? { timestamp: parseDateInput(data.timestamp) ?? undefined } : {}),
        ...(data.category !== undefined ? { category: data.category } : {}),
        ...(data.summary !== undefined ? { summary: data.summary } : {}),
        ...(data.raw_transcript !== undefined ? { raw_transcript: data.raw_transcript || null } : {}),
        ...(data.cow_id !== undefined ? { cow_id: data.cow_id || null } : {}),
        ...(data.transaction_id !== undefined
          ? { transaction_id: data.transaction_id || null }
          : {}),
      },
    });

    return NextResponse.json({ log: updated });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
      return NextResponse.json({ error: 'Daily log not found.' }, { status: 404 });
    }
    console.error('PATCH /api/logs/[id] error:', err);
    return NextResponse.json({ error: 'Failed to update daily log.' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(request, 'session_only');
  if (!auth.ok) return auth.response;

  try {
    const { id } = await context.params;
    await prisma.dailyLog.delete({ where: { id } });
    return NextResponse.json({ ok: true, id });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
      return NextResponse.json({ error: 'Daily log not found.' }, { status: 404 });
    }
    console.error('DELETE /api/logs/[id] error:', err);
    return NextResponse.json({ error: 'Failed to delete daily log.' }, { status: 500 });
  }
}
