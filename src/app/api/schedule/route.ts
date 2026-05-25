import { NextResponse } from 'next/server';
import { getTrainSchedule } from '@/services/irctcService';

export async function POST(request: Request) {
  try {
    const { trainNo } = await request.json();
    if (!trainNo) {
      return NextResponse.json({ error: 'Missing trainNo' }, { status: 400 });
    }
    const data = await getTrainSchedule(trainNo);
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
