import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { updateHealthRecordSchema } from '@/lib/validation';
import { calculateSafeToSellDate, parseDateInput } from '@/lib/dates';

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const record = await prisma.healthRecord.findUnique({
      where: { id },
      include: {
        cow: { select: { id: true, tag_number: true, name: true } },
      },
    });
    if (!record) {
      return NextResponse.json({ error: 'Health record not found.' }, { status: 404 });
    }
    return NextResponse.json({ health_record: record });
  } catch (err) {
    console.error('GET /api/health/[id] error:', err);
    return NextResponse.json({ error: 'Failed to load health record.' }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const body = await request.json();
    const parsed = updateHealthRecordSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid health record update.', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const existing = await prisma.healthRecord.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Health record not found.' }, { status: 404 });
    }

    const data = parsed.data;
    const nextDate = data.date ? parseDateInput(data.date) ?? existing.date : existing.date;
    const nextWithdrawal =
      data.withdrawal_days !== undefined ? data.withdrawal_days : existing.withdrawal_days;

    const updated = await prisma.healthRecord.update({
      where: { id },
      data: {
        date: nextDate,
        ...(data.type !== undefined ? { type: data.type } : {}),
        ...(data.treatment_name !== undefined ? { treatment_name: data.treatment_name } : {}),
        ...(data.dosage !== undefined ? { dosage: data.dosage || null } : {}),
        withdrawal_days: nextWithdrawal ?? null,
        safe_to_sell_date: calculateSafeToSellDate(nextDate, nextWithdrawal),
        ...(data.notes !== undefined ? { notes: data.notes } : {}),
      },
    });

    return NextResponse.json({ health_record: updated });
  } catch (err) {
    console.error('PATCH /api/health/[id] error:', err);
    return NextResponse.json({ error: 'Failed to update health record.' }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    await prisma.healthRecord.delete({ where: { id } });
    return NextResponse.json({ ok: true, id });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
      return NextResponse.json({ error: 'Health record not found.' }, { status: 404 });
    }
    console.error('DELETE /api/health/[id] error:', err);
    return NextResponse.json({ error: 'Failed to delete health record.' }, { status: 500 });
  }
}
