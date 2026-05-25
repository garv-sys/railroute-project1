import { NextResponse } from 'next/server';
import { checkSeatAvailability, getFare } from '@/services/irctcService';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { trainNo, source, destination, date, classType = "3A" } = body;

    if (!trainNo || !source || !destination || !date) {
      return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
    }

    const availData = await checkSeatAvailability(trainNo, source, destination, date, classType);

    let fare = availData?.data?.fare?.totalFare || availData?.data?.fare || null;
    let fareEnquiry = null;

    if (!fare) {
      fareEnquiry = await getFare(trainNo, source, destination, classType);
      fare = fareEnquiry?.data?.fare?.Fare || null;
    }

    return NextResponse.json({ success: true, fare, availability: availData, fareEnquiry });
  } catch (error: any) {
    console.error('Fare API Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
