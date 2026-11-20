import { connection, NextResponse } from 'next/server';
import { getDashboardData } from '@/lib/ranch-queries';

export async function GET() {
  await connection();
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
