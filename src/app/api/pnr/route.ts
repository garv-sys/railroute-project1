import { NextResponse } from 'next/server';
import { getPNR } from '@/services/irctcService';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { pnr } = body;

    if (!pnr) {
      return NextResponse.json({ error: 'Missing PNR parameter' }, { status: 400 });
    }

    const pnrData = await getPNR(pnr);
    return NextResponse.json(pnrData);
  } catch (error: any) {
    console.error('PNR API Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
