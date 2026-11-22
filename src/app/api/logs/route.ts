import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { createDailyLogSchema } from '@/lib/validation';
import { parseDateInput } from '@/lib/dates';

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request, 'dual');
  if (!auth.ok) return auth.response;

  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category')?.trim().toUpperCase();
    const cowId = searchParams.get('cow_id')?.trim();
    const limitParam = Number(searchParams.get('limit') || 100);
    const take = Number.isNaN(limitParam) ? 100 : Math.min(Math.max(limitParam, 1), 250);

    const logs = await prisma.dailyLog.findMany({
      where: {
        ...(category && category !== 'ALL' ? { category } : {}),
        ...(cowId ? { cow_id: cowId } : {}),
      },
      include: {
        cow: { select: { id: true, tag_number: true, name: true } },
        transaction: {
          select: { id: true, type: true, category: true, amount: true, vendor_or_buyer: true },
        },
      },
      orderBy: { timestamp: 'desc' },
      take,
    });

    return NextResponse.json({
      logs: logs.map((l) => ({
        ...l,
        transaction: l.transaction
          ? { ...l.transaction, amount: Number(l.transaction.amount) }
          : null,
      })),
      count: logs.length,
    });
  } catch (err) {
    console.error('GET /api/logs error:', err);
    return NextResponse.json({ error: 'Failed to load daily logs.' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request, 'dual');
  if (!auth.ok) return auth.response;

  try {
    const body = await request.json();
    const parsed = createDailyLogSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid daily log payload.', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const data = parsed.data;
    const log = await prisma.dailyLog.create({
      data: {
        timestamp: parseDateInput(data.timestamp) ?? new Date(),
        category: data.category,
        summary: data.summary,
        raw_transcript: data.raw_transcript || null,
        cow_id: data.cow_id || null,
        transaction_id: data.transaction_id || null,
      },
      include: {
        cow: { select: { id: true, tag_number: true, name: true } },
        transaction: { select: { id: true, type: true, amount: true, category: true } },
      },
    });

    return NextResponse.json(
      {
        log: {
          ...log,
          transaction: log.transaction
            ? { ...log.transaction, amount: Number(log.transaction.amount) }
            : null,
        },
      },
      { status: 201 }
    );
  } catch (err) {
    console.error('POST /api/logs error:', err);
    return NextResponse.json({ error: 'Failed to create daily log.' }, { status: 500 });
  }
}
