import { NextResponse } from 'next/server';
import { getLiveStatus } from '@/services/irctcService';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { trainNo, date } = body;

    if (!trainNo) {
      return NextResponse.json({ error: 'Missing trainNo parameter' }, { status: 400 });
    }

    const liveData = await getLiveStatus(trainNo, date);
    return NextResponse.json(liveData);
  } catch (error: any) {
    console.error('Live API Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
