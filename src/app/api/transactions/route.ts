import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { createTransactionSchema } from '@/lib/validation';
import { formatCurrency, parseDateInput } from '@/lib/dates';
import { getFinancialSummary } from '@/lib/ranch-queries';
import { TRANSACTION_CATEGORY_LABELS } from '@/lib/constants';

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request, 'dual');
  if (!auth.ok) return auth.response;

  try {
    const { searchParams } = new URL(request.url);
    const timeframeParam = searchParams.get('timeframe')?.toLowerCase() ?? 'month';
    const timeframe =
      timeframeParam === 'year' || timeframeParam === 'all' ? timeframeParam : 'month';
    const category = searchParams.get('category')?.trim().toUpperCase() || undefined;
    const type = searchParams.get('type')?.trim().toUpperCase() || undefined;

    const summary = await getFinancialSummary(timeframe, category);
    const transactions = type
      ? summary.transactions.filter((t) => t.type === type)
      : summary.transactions;

    return NextResponse.json({
      ...summary,
      transactions,
      count: transactions.length,
    });
  } catch (err) {
    console.error('GET /api/transactions error:', err);
    return NextResponse.json(
      { error: 'Failed to load transactions.' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request, 'dual');
  if (!auth.ok) return auth.response;

  try {
    const body = await request.json();
    const parsed = createTransactionSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid transaction payload.', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const data = parsed.data;
    const txDate = parseDateInput(data.date) ?? new Date();

    const result = await prisma.$transaction(async (tx) => {
      const transaction = await tx.transaction.create({
        data: {
          date: txDate,
          type: data.type,
          category: data.category,
          amount: new Prisma.Decimal(data.amount.toFixed(2)),
          vendor_or_buyer: data.vendor_or_buyer || null,
          cow_id: data.cow_id || null,
          notes: data.notes ?? '',
        },
        include: {
          cow: { select: { id: true, tag_number: true, name: true } },
        },
      });

      let cowMarkedSold = false;
      if (data.category === 'CATTLE_SALE' && data.cow_id) {
        await tx.cow.update({
          where: { id: data.cow_id },
          data: { status: 'SOLD' },
        });
        cowMarkedSold = true;
      }

      if (data.create_log) {
        const catLabel = TRANSACTION_CATEGORY_LABELS[data.category];
        const vendorText = data.vendor_or_buyer ? ` — ${data.vendor_or_buyer}` : '';
        const cowText = transaction.cow ? ` (#${transaction.cow.tag_number})` : '';
        await tx.dailyLog.create({
          data: {
            timestamp: txDate,
            category:
              data.category === 'FEED_HAY'
                ? 'FEEDING'
                : data.category === 'VET_MEDS'
                ? 'HEALTH_VET'
                : data.category === 'FENCING_REPAIRS'
                ? 'FENCING_MAINTENANCE'
                : data.category === 'FUEL_EQUIPMENT'
                ? 'EQUIPMENT'
                : 'GENERAL',
            summary: `${data.type === 'INCOME' ? 'Income' : 'Expense'}: ${formatCurrency(data.amount)} (${catLabel}${vendorText})${cowText}.`,
            cow_id: data.cow_id || null,
            transaction_id: transaction.id,
          },
        });
      }

      return { transaction, cowMarkedSold };
    });

    return NextResponse.json(
      {
        transaction: {
          ...result.transaction,
          amount: Number(result.transaction.amount),
        },
        cow_marked_sold: result.cowMarkedSold,
      },
      { status: 201 }
    );
  } catch (err) {
    console.error('POST /api/transactions error:', err);
    return NextResponse.json(
      { error: 'Failed to create transaction.' },
      { status: 500 }
    );
  }
}
