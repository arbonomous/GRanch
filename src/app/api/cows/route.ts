import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { createCowSchema } from '@/lib/validation';
import {
  addDays,
  calculateExpectedDueDate,
  parseDateInput,
  startOfDay,
} from '@/lib/dates';
import { ACTIVE_COW_STATUSES } from '@/lib/constants';

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request, 'dual');
  if (!auth.ok) return auth.response;

  try {
    const { searchParams } = new URL(request.url);
    const q = searchParams.get('q')?.trim().toLowerCase() ?? '';
    const filter = searchParams.get('filter')?.trim().toLowerCase() ?? 'all';
    const category = searchParams.get('category')?.trim().toUpperCase();
    const status = searchParams.get('status')?.trim().toUpperCase();
    const tagNumber = searchParams.get('tag_number')?.trim();

    const todayStart = startOfDay(new Date());
    const in30Days = addDays(todayStart, 30);

    const cows = await prisma.cow.findMany({
      where: {
        ...(category ? { category } : {}),
        ...(status ? { status } : {}),
      },
      include: {
        dam: { select: { id: true, tag_number: true, name: true } },
        sire: { select: { id: true, tag_number: true, name: true } },
        health_records: {
          where: {
            safe_to_sell_date: { gt: todayStart },
          },
          orderBy: { safe_to_sell_date: 'desc' },
          take: 1,
        },
        _count: {
          select: { calves_as_dam: true, health_records: true },
        },
      },
      orderBy: [{ status: 'asc' }, { tag_number: 'asc' }],
    });

    const filtered = cows.filter((cow) => {
      if (tagNumber && cow.tag_number.toLowerCase() !== tagNumber.toLowerCase()) {
        return false;
      }

      if (q) {
        const hay = `${cow.tag_number} ${cow.name ?? ''} ${cow.breed ?? ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }

      const isActive = ACTIVE_COW_STATUSES.includes(
        cow.status as (typeof ACTIVE_COW_STATUSES)[number]
      );
      const hasWithdrawal = cow.health_records.length > 0;

      switch (filter) {
        case 'all':
          return true;
        case 'active':
          return isActive;
        case 'cows':
          return isActive && (cow.category === 'COW' || cow.category === 'HEIFER');
        case 'bulls':
          return isActive && cow.category === 'BULL';
        case 'calves':
          return isActive && cow.category === 'CALF';
        case 'steers':
          return isActive && cow.category === 'STEER';
        case 'pregnant':
          return cow.status === 'PREGNANT';
        case 'due_soon':
          return (
            cow.status === 'PREGNANT' &&
            Boolean(cow.expected_due_date && cow.expected_due_date <= in30Days)
          );
        case 'sick':
          return cow.status === 'SICK';
        case 'withdrawal':
          return isActive && hasWithdrawal;
        case 'sick_or_withdrawal':
          return cow.status === 'SICK' || (isActive && hasWithdrawal);
        case 'sold':
          return cow.status === 'SOLD';
        default:
          return true;
      }
    });

    const enriched = filtered.map((cow) => ({
      ...cow,
      active_withdrawal: cow.health_records[0] ?? null,
    }));

    return NextResponse.json({ cows: enriched, count: enriched.length });
  } catch (err) {
    console.error('GET /api/cows error:', err);
    return NextResponse.json({ error: 'Failed to load herd.' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request, 'dual');
  if (!auth.ok) return auth.response;

  try {
    const body = await request.json();
    const parsed = createCowSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid animal data.', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const data = parsed.data;
    const birthDate = parseDateInput(data.birth_date);
    const breedingDate = parseDateInput(data.breeding_date);
    const explicitDue = parseDateInput(data.expected_due_date);
    const expectedDueDate = explicitDue ?? calculateExpectedDueDate(breedingDate);

    const cow = await prisma.cow.create({
      data: {
        tag_number: data.tag_number,
        name: data.name || null,
        category: data.category,
        status: data.status,
        breed: data.breed || null,
        birth_date: birthDate,
        breeding_date: breedingDate,
        expected_due_date: expectedDueDate,
        dam_id: data.dam_id || null,
        sire_id: data.sire_id || null,
        notes: data.notes ?? '',
      },
    });

    return NextResponse.json({ cow }, { status: 201 });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      return NextResponse.json(
        { error: 'An animal with that tag number already exists.' },
        { status: 409 }
      );
    }
    console.error('POST /api/cows error:', err);
    return NextResponse.json({ error: 'Failed to create animal.' }, { status: 500 });
  }
}
