import { connection, NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getDashboardData } from '@/lib/ranch-queries';

export async function GET(request: NextRequest) {
  await connection();
  const auth = await requireAuth(request, 'dual');
  if (!auth.ok) return auth.response;

  try {
    const data = await getDashboardData();
    return NextResponse.json(data, {
      headers: {
        'Cache-Control': 'no-store',
      },
    });
  } catch (err) {
    console.error('Dashboard error:', err);
    return NextResponse.json(
      { error: 'Failed to load dashboard data.' },
      { status: 500 }
    );
  }
}
