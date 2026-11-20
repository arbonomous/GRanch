import { NextRequest, NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import path from 'path';

export async function GET(request: NextRequest) {
  try {
    const filePath = path.join(process.cwd(), 'public', 'openapi.json');
    const content = await readFile(filePath, 'utf8');
    const spec = JSON.parse(content);

    const origin = request.nextUrl.origin;
    if (origin && Array.isArray(spec.servers)) {
      spec.servers = [
        {
          url: origin,
          description: 'Active GRanch deployment',
        },
      ];
    }

    return NextResponse.json(spec, {
      status: 200,
      headers: {
        'Cache-Control': 'no-store',
      },
    });
  } catch {
    return NextResponse.json({ error: 'OpenAPI spec not found.' }, { status: 404 });
  }
}
