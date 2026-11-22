import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';

function csvEscape(value: unknown): string {
  if (value === null || value === undefined) return '';
  const str = value instanceof Date ? value.toISOString() : String(value);
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function toCsv(headers: string[], rows: Array<Record<string, unknown>>): string {
  const lines = [headers.join(',')];
  for (const row of rows) {
    lines.push(headers.map((h) => csvEscape(row[h])).join(','));
  }
  return lines.join('\n') + '\n';
}

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request, 'session_only');
  if (!auth.ok) return auth.response;

  const { searchParams } = new URL(request.url);
  const format = (searchParams.get('format') || 'json').toLowerCase();
  const table = (searchParams.get('table') || 'cows').toLowerCase();
  const stamp = new Date().toISOString().slice(0, 10);

  try {
    if (format === 'csv') {
      if (table === 'cows') {
        const rows = await prisma.cow.findMany({ orderBy: { tag_number: 'asc' } });
        const csv = toCsv(
          ['id', 'tag_number', 'name', 'category', 'status', 'breed', 'birth_date', 'breeding_date', 'expected_due_date', 'dam_id', 'sire_id', 'notes', 'created_at'],
          rows
        );
        return new NextResponse(csv, {
          status: 200,
          headers: {
            'Content-Type': 'text/csv; charset=utf-8',
            'Content-Disposition': `attachment; filename="granch-herd-${stamp}.csv"`,
            'Cache-Control': 'no-store',
          },
        });
      }

      if (table === 'health') {
        const rows = await prisma.healthRecord.findMany({
          orderBy: { date: 'desc' },
          include: { cow: { select: { tag_number: true } } },
        });
        const flat = rows.map((r) => ({
          id: r.id,
          cow_tag: r.cow.tag_number,
          date: r.date,
          type: r.type,
          treatment_name: r.treatment_name,
          dosage: r.dosage,
          withdrawal_days: r.withdrawal_days,
          safe_to_sell_date: r.safe_to_sell_date,
          notes: r.notes,
        }));
        const csv = toCsv(
          ['id', 'cow_tag', 'date', 'type', 'treatment_name', 'dosage', 'withdrawal_days', 'safe_to_sell_date', 'notes'],
          flat
        );
        return new NextResponse(csv, {
          status: 200,
          headers: {
            'Content-Type': 'text/csv; charset=utf-8',
            'Content-Disposition': `attachment; filename="granch-health-${stamp}.csv"`,
            'Cache-Control': 'no-store',
          },
        });
      }

      if (table === 'logs') {
        const rows = await prisma.dailyLog.findMany({
          orderBy: { timestamp: 'desc' },
          include: { cow: { select: { tag_number: true } } },
        });
        const flat = rows.map((l) => ({
          id: l.id,
          timestamp: l.timestamp,
          category: l.category,
          summary: l.summary,
          raw_transcript: l.raw_transcript,
          cow_tag: l.cow?.tag_number ?? '',
          transaction_id: l.transaction_id ?? '',
        }));
        const csv = toCsv(
          ['id', 'timestamp', 'category', 'summary', 'raw_transcript', 'cow_tag', 'transaction_id'],
          flat
        );
        return new NextResponse(csv, {
          status: 200,
          headers: {
            'Content-Type': 'text/csv; charset=utf-8',
            'Content-Disposition': `attachment; filename="granch-logs-${stamp}.csv"`,
            'Cache-Control': 'no-store',
          },
        });
      }

      if (table === 'transactions') {
        const rows = await prisma.transaction.findMany({
          orderBy: { date: 'desc' },
          include: { cow: { select: { tag_number: true } } },
        });
        const flat = rows.map((t) => ({
          id: t.id,
          date: t.date,
          type: t.type,
          category: t.category,
          amount: Number(t.amount).toFixed(2),
          vendor_or_buyer: t.vendor_or_buyer,
          cow_tag: t.cow?.tag_number ?? '',
          notes: t.notes,
        }));
        const csv = toCsv(
          ['id', 'date', 'type', 'category', 'amount', 'vendor_or_buyer', 'cow_tag', 'notes'],
          flat
        );
        return new NextResponse(csv, {
          status: 200,
          headers: {
            'Content-Type': 'text/csv; charset=utf-8',
            'Content-Disposition': `attachment; filename="granch-finances-${stamp}.csv"`,
            'Cache-Control': 'no-store',
          },
        });
      }

      return NextResponse.json({ error: 'Unknown CSV table.' }, { status: 400 });
    }

    // Full JSON backup
    const [cows, health_records, daily_logs, transactions, ai_audit_logs] = await Promise.all([
      prisma.cow.findMany({ orderBy: { tag_number: 'asc' } }),
      prisma.healthRecord.findMany({ orderBy: { date: 'desc' } }),
      prisma.dailyLog.findMany({ orderBy: { timestamp: 'desc' } }),
      prisma.transaction.findMany({ orderBy: { date: 'desc' } }),
      prisma.aiAuditLog.findMany({ orderBy: { created_at: 'desc' }, take: 200 }),
    ]);

    const backup = {
      exported_at: new Date().toISOString(),
      app: 'GRanch Operations',
      counts: {
        cows: cows.length,
        health_records: health_records.length,
        daily_logs: daily_logs.length,
        transactions: transactions.length,
        ai_audit_logs: ai_audit_logs.length,
      },
      data: {
        cows,
        health_records,
        daily_logs,
        transactions: transactions.map((t) => ({ ...t, amount: Number(t.amount) })),
        ai_audit_logs,
      },
    };

    return new NextResponse(JSON.stringify(backup, null, 2), {
      status: 200,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': `attachment; filename="granch-backup-${stamp}.json"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (err) {
    console.error('GET /api/admin/export error:', err);
    return NextResponse.json({ error: 'Failed to export ranch data.' }, { status: 500 });
  }
}
