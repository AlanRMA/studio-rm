import { NextResponse } from 'next/server';

const RECEIPT_API_URL = process.env.RECEIPT_API_URL ?? 'http://localhost:4000';
const RECEIPT_API_KEY = process.env.RECEIPT_API_KEY ?? '';

export async function POST(request: Request) {
  if (!RECEIPT_API_KEY) {
    return NextResponse.json(
      { error: 'RECEIPT_API_KEY não configurada no servidor' },
      { status: 503 }
    );
  }

  const idempotencyKey = request.headers.get('x-idempotency-key');
  const body = await request.text();

  try {
    const response = await fetch(`${RECEIPT_API_URL}/api/v1/ingest/rosania/receipt`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${RECEIPT_API_KEY}`,
        ...(idempotencyKey ? { 'X-Idempotency-Key': idempotencyKey } : {}),
      },
      body,
    });

    const responseBody = await response.text();
    return new NextResponse(responseBody, {
      status: response.status,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[api/ingest/receipt] Proxy error:', error);
    return NextResponse.json(
      { error: 'Backend de recibos indisponível' },
      { status: 502 }
    );
  }
}