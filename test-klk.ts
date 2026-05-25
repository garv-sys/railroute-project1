import { config } from 'dotenv';
config({ path: '.env.local' });
import { searchTrainBetweenStations, configure } from 'irctc-connect';

if (process.env.IRCTC_API_KEY) {
  configure(process.env.IRCTC_API_KEY);
}

async function test() {
  console.log("Checking KLK to SML...");
  try {
    const p1 = await searchTrainBetweenStations('KLK', 'SML', '18-06-2026');
    console.log("KLK-SML:", JSON.stringify(p1).substring(0, 500));
  } catch (e) { console.error(e); }

  console.log("Checking PNBE to KLK...");
  try {
    const p2 = await searchTrainBetweenStations('PNBE', 'KLK', '18-06-2026');
    console.log("PNBE-KLK:", JSON.stringify(p2).substring(0, 500));
  } catch (e) { console.error(e); }
  
  console.log("Checking NDLS to KLK...");
  try {
    const p3 = await searchTrainBetweenStations('NDLS', 'KLK', '18-06-2026');
    console.log("NDLS-KLK:", p3.data?.length, "trains");
  } catch (e) { console.error(e); }
}

test();
