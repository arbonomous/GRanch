import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request, 'session_only');
  if (!auth.ok) return auth.response;

  try {
    const logs = await prisma.aiAuditLog.findMany({
      orderBy: { created_at: 'desc' },
      take: 50,
    });

    return NextResponse.json(
      {
        audit_logs: logs.map((entry) => ({
          ...entry,
          parsed_actions: (() => {
            try {
              return JSON.parse(entry.parsed_actions);
            } catch {
              return [];
            }
          })(),
        })),
        count: logs.length,
      },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (err) {
    console.error('GET /api/admin/audit error:', err);
    return NextResponse.json({ error: 'Failed to load AI audit logs.' }, { status: 500 });
  }
}
