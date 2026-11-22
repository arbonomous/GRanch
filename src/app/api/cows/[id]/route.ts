import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { updateCowSchema } from '@/lib/validation';
import { calculateExpectedDueDate, parseDateInput } from '@/lib/dates';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(request, 'dual');
  if (!auth.ok) return auth.response;

  try {
    const { id } = await context.params;
    const cow = await prisma.cow.findUnique({
      where: { id },
      include: {
        dam: { select: { id: true, tag_number: true, name: true, category: true, breed: true } },
        sire: { select: { id: true, tag_number: true, name: true, category: true, breed: true } },
        calves_as_dam: {
          select: {
            id: true,
            tag_number: true,
            name: true,
            category: true,
            status: true,
            birth_date: true,
            breed: true,
          },
          orderBy: { birth_date: 'desc' },
        },
        calves_as_sire: {
          select: {
            id: true,
            tag_number: true,
            name: true,
            category: true,
            status: true,
            birth_date: true,
            breed: true,
          },
          orderBy: { birth_date: 'desc' },
        },
        health_records: { orderBy: { date: 'desc' } },
        daily_logs: {
          orderBy: { timestamp: 'desc' },
          include: {
            transaction: {
              select: { id: true, type: true, amount: true, category: true, vendor_or_buyer: true },
            },
          },
        },
        transactions: { orderBy: { date: 'desc' } },
      },
    });

    if (!cow) {
      return NextResponse.json({ error: 'Animal not found.' }, { status: 404 });
    }

    return NextResponse.json({
      cow: {
        ...cow,
        daily_logs: cow.daily_logs.map((l) => ({
          ...l,
          transaction: l.transaction
            ? { ...l.transaction, amount: Number(l.transaction.amount) }
            : null,
        })),
        transactions: cow.transactions.map((t) => ({
          ...t,
          amount: Number(t.amount),
        })),
      },
    });
  } catch (err) {
    console.error('GET /api/cows/[id] error:', err);
    return NextResponse.json({ error: 'Failed to fetch animal.' }, { status: 500 });
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
    const parsed = updateCowSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid update data.', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const existing = await prisma.cow.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Animal not found.' }, { status: 404 });
    }

    const data = parsed.data;
    const updatePayload: Prisma.CowUpdateInput = {};

    if (data.tag_number !== undefined) updatePayload.tag_number = data.tag_number;
    if (data.name !== undefined) updatePayload.name = data.name || null;
    if (data.category !== undefined) updatePayload.category = data.category;
    if (data.status !== undefined) updatePayload.status = data.status;
    if (data.breed !== undefined) updatePayload.breed = data.breed || null;
    if (data.notes !== undefined) updatePayload.notes = data.notes;
    if (data.birth_date !== undefined) {
      updatePayload.birth_date = parseDateInput(data.birth_date);
    }
    if (data.dam_id !== undefined) {
      updatePayload.dam = data.dam_id ? { connect: { id: data.dam_id } } : { disconnect: true };
    }
    if (data.sire_id !== undefined) {
      updatePayload.sire = data.sire_id ? { connect: { id: data.sire_id } } : { disconnect: true };
    }

    if (data.breeding_date !== undefined) {
      const parsedBreeding = parseDateInput(data.breeding_date);
      updatePayload.breeding_date = parsedBreeding;
      if (data.expected_due_date === undefined) {
        updatePayload.expected_due_date = calculateExpectedDueDate(parsedBreeding);
      }
    }

    if (data.expected_due_date !== undefined) {
      updatePayload.expected_due_date = parseDateInput(data.expected_due_date);
    }

    const cow = await prisma.cow.update({
      where: { id },
      data: updatePayload,
    });

    return NextResponse.json({ cow });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      return NextResponse.json(
        { error: 'Another animal already uses that tag number.' },
        { status: 409 }
      );
    }
    console.error('PATCH /api/cows/[id] error:', err);
    return NextResponse.json({ error: 'Failed to update animal.' }, { status: 500 });
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
    await prisma.cow.delete({ where: { id } });
    return NextResponse.json({ ok: true, id });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
      return NextResponse.json({ error: 'Animal not found.' }, { status: 404 });
    }
    console.error('DELETE /api/cows/[id] error:', err);
    return NextResponse.json({ error: 'Failed to delete animal.' }, { status: 500 });
  }
}
