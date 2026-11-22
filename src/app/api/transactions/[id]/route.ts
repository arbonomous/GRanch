import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { updateTransactionSchema } from '@/lib/validation';
import { parseDateInput } from '@/lib/dates';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(request, 'dual');
  if (!auth.ok) return auth.response;

  try {
    const { id } = await context.params;
    const transaction = await prisma.transaction.findUnique({
      where: { id },
      include: {
        cow: { select: { id: true, tag_number: true, name: true } },
      },
    });
    if (!transaction) {
      return NextResponse.json({ error: 'Transaction not found.' }, { status: 404 });
    }
    return NextResponse.json({
      transaction: { ...transaction, amount: Number(transaction.amount) },
    });
  } catch (err) {
    console.error('GET /api/transactions/[id] error:', err);
    return NextResponse.json({ error: 'Failed to load transaction.' }, { status: 500 });
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
    const parsed = updateTransactionSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid transaction update.', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const data = parsed.data;
    const updated = await prisma.$transaction(async (tx) => {
      const record = await tx.transaction.update({
        where: { id },
        data: {
          ...(data.date ? { date: parseDateInput(data.date) ?? undefined } : {}),
          ...(data.type !== undefined ? { type: data.type } : {}),
          ...(data.category !== undefined ? { category: data.category } : {}),
          ...(data.amount !== undefined
            ? { amount: new Prisma.Decimal(data.amount.toFixed(2)) }
            : {}),
          ...(data.vendor_or_buyer !== undefined
            ? { vendor_or_buyer: data.vendor_or_buyer || null }
            : {}),
          ...(data.cow_id !== undefined ? { cow_id: data.cow_id || null } : {}),
          ...(data.notes !== undefined ? { notes: data.notes } : {}),
        },
      });

      if (record.category === 'CATTLE_SALE' && record.cow_id) {
        await tx.cow.update({
          where: { id: record.cow_id },
          data: { status: 'SOLD' },
        });
      }

      return record;
    });

    return NextResponse.json({
      transaction: { ...updated, amount: Number(updated.amount) },
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
      return NextResponse.json({ error: 'Transaction not found.' }, { status: 404 });
    }
    console.error('PATCH /api/transactions/[id] error:', err);
    return NextResponse.json({ error: 'Failed to update transaction.' }, { status: 500 });
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
    await prisma.transaction.delete({ where: { id } });
    return NextResponse.json({ ok: true, id });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
      return NextResponse.json({ error: 'Transaction not found.' }, { status: 404 });
    }
    console.error('DELETE /api/transactions/[id] error:', err);
    return NextResponse.json({ error: 'Failed to delete transaction.' }, { status: 500 });
  }
}
