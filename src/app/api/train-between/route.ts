import { NextResponse } from 'next/server';
import { checkDirectTrains } from '@/services/trainService';

export async function POST(request: Request) {
  try {
    const { source, destination, date, classType = 'Any' } = await request.json();

    if (!source || !destination || !date) {
      return NextResponse.json({ error: 'Missing source, destination, or date' }, { status: 400 });
    }

    const trains = await checkDirectTrains(
      String(source).toUpperCase().trim(),
      String(destination).toUpperCase().trim(),
      String(date),
      String(classType)
    );

    return NextResponse.json({ success: true, trains });
  } catch (error) {
    console.error('Train Between API Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
