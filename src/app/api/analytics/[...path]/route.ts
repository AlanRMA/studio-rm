import { NextResponse } from 'next/server';

const RECEIPT_API_URL = process.env.RECEIPT_API_URL ?? 'http://localhost:4000';
const RECEIPT_API_KEY = process.env.RECEIPT_API_KEY ?? '';

export async function GET(
  request: Request,
  context: { params: Promise<{ path: string[] }> }
) {
  if (!RECEIPT_API_KEY) {
    return NextResponse.json(
      { error: 'RECEIPT_API_KEY não configurada no servidor' },
      { status: 503 }
    );
  }

  const { path } = await context.params;
  const endpoint = path.join('/');
  const query = new URL(request.url).search;

  try {
    const response = await fetch(
      `${RECEIPT_API_URL}/api/v1/analytics/rosania/${endpoint}${query}`,
      {
        headers: { Authorization: `Bearer ${RECEIPT_API_KEY}` },
        cache: 'no-store',
      }
    );

    const body = await response.text();
    return new NextResponse(body, {
      status: response.status,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[api/analytics] Proxy error:', error);
    return NextResponse.json(
      { error: 'Backend de analytics indisponível' },
      { status: 502 }
    );
  }
}