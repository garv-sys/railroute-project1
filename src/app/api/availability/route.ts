import { NextResponse } from 'next/server';
import { checkSeatAvailability } from '@/services/irctcService';

export async function POST(request: Request) {
  try {
    const { trainNo, source, destination, date, classType = '3A' } = await request.json();

    if (!trainNo || !source || !destination || !date) {
      return NextResponse.json({ error: 'Missing trainNo, source, destination, or date' }, { status: 400 });
    }

    if (!/^\d{5}$/.test(String(trainNo))) {
      return NextResponse.json({ error: 'Train number must be 5 digits' }, { status: 400 });
    }

    const availability = await checkSeatAvailability(
      String(trainNo),
      String(source).toUpperCase().trim(),
      String(destination).toUpperCase().trim(),
      String(date),
      String(classType).toUpperCase().trim()
    );

    return NextResponse.json(availability);
  } catch (error) {
    console.error('Availability API Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
