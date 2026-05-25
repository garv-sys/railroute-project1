import { NextResponse } from 'next/server';
import { checkDirectTrains } from '@/services/trainService';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { source, destination, date, classType = "Any" } = body;

    if (!source || !destination || !date) {
      return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
    }

    const directTrains = await checkDirectTrains(source, destination, date, classType);
    return NextResponse.json({ directTrains });
  } catch (error: any) {
    console.error('Search Direct API Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
