import { NextResponse } from 'next/server';
import { findMultiSplitRoutes, findSmartRoutes, generateAIRecommendation } from '@/services/trainService';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { source, destination, date, classType = "Any", directTrains = [], budget, preferredHub = "" } = body;

    if (!source || !destination || !date) {
      return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
    }

    const splitRoutes = await findSmartRoutes(source, destination, date, classType, directTrains, preferredHub);
    const multiSplitRoutes = splitRoutes.length < 2
      ? await findMultiSplitRoutes(source, destination, date, classType, preferredHub)
      : [];
    const aiRecommendation = await generateAIRecommendation(directTrains, splitRoutes, budget);

    return NextResponse.json({ splitRoutes, multiSplitRoutes, aiRecommendation });
  } catch (error: any) {
    console.error('Search Split API Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
