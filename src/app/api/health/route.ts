import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createHealthRecordSchema } from '@/lib/validation';
import { calculateSafeToSellDate, parseDateInput, startOfDay } from '@/lib/dates';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const cowId = searchParams.get('cow_id')?.trim();
    const activeWithdrawal = searchParams.get('active_withdrawal') === 'true';

    const records = await prisma.healthRecord.findMany({
      where: {
        ...(cowId ? { cow_id: cowId } : {}),
        ...(activeWithdrawal
          ? { safe_to_sell_date: { gt: startOfDay(new Date()) } }
          : {}),
      },
      include: {
        cow: { select: { id: true, tag_number: true, name: true, status: true } },
      },
      orderBy: { date: 'desc' },
    });

    return NextResponse.json({ health_records: records, count: records.length });
  } catch (err) {
    console.error('GET /api/health error:', err);
    return NextResponse.json(
      { error: 'Failed to load health records.' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = createHealthRecordSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid health record payload.', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const data = parsed.data;
    const cow = await prisma.cow.findUnique({ where: { id: data.cow_id } });
    if (!cow) {
      return NextResponse.json({ error: 'Referenced cow not found.' }, { status: 404 });
    }

    const recordDate = parseDateInput(data.date) ?? new Date();
    const safeToSellDate = calculateSafeToSellDate(recordDate, data.withdrawal_days);

    const result = await prisma.$transaction(async (tx) => {
      const record = await tx.healthRecord.create({
        data: {
          cow_id: data.cow_id,
          date: recordDate,
          type: data.type,
          treatment_name: data.treatment_name,
          dosage: data.dosage || null,
          withdrawal_days: data.withdrawal_days ?? null,
          safe_to_sell_date: safeToSellDate,
          notes: data.notes ?? '',
        },
      });

      if (data.mark_sick && cow.status !== 'SOLD' && cow.status !== 'DECEASED') {
        await tx.cow.update({
          where: { id: cow.id },
          data: { status: 'SICK' },
        });
      }

      if (data.create_log !== false) {
        const dosagePart = data.dosage ? ` (${data.dosage})` : '';
        const withdrawalPart =
          data.withdrawal_days && data.withdrawal_days > 0
            ? ` [${data.withdrawal_days}d withdrawal]`
            : '';
        await tx.dailyLog.create({
          data: {
            timestamp: recordDate,
            category: 'HEALTH_VET',
            summary: `${data.treatment_name}${dosagePart} logged for #${cow.tag_number}${withdrawalPart}.`,
            cow_id: cow.id,
          },
        });
      }

      return record;
    });

    return NextResponse.json({ health_record: result }, { status: 201 });
  } catch (err) {
    console.error('POST /api/health error:', err);
    return NextResponse.json(
      { error: 'Failed to create health record.' },
      { status: 500 }
    );
  }
}
