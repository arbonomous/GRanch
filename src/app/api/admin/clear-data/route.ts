import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request, 'session_only');
  if (!auth.ok) return auth.response;

  try {
    const body = await request.json().catch(() => ({}));
    if (body?.confirm !== 'CLEAR RANCH DATA') {
      return NextResponse.json(
        {
          ok: false,
          error: 'Confirmation phrase mismatch. Send { "confirm": "CLEAR RANCH DATA" }.',
        },
        { status: 400 }
      );
    }

    await prisma.$transaction(async (tx) => {
      await tx.dailyLog.deleteMany();
      await tx.healthRecord.deleteMany();
      await tx.transaction.deleteMany();
      await tx.cow.updateMany({ data: { dam_id: null, sire_id: null } });
      await tx.cow.deleteMany();
      await tx.aiAuditLog.deleteMany();
    });

    return NextResponse.json({
      ok: true,
      message: 'All sample and ranch records cleared. Ready for live herd entry.',
    });
  } catch (err) {
    console.error('POST /api/admin/clear-data error:', err);
    return NextResponse.json({ ok: false, error: 'Failed to clear ranch data.' }, { status: 500 });
  }
}
