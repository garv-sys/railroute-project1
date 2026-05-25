require('dotenv').config({ path: '.env.local' });

// We use native fetch in Next.js, but since this is a plain Node script, 
// fetch is available natively in Node 18+.

async function test() {
  console.log("Using API Key:", process.env.IRCTC_API_KEY ? "Yes" : "No");
  
  const from = "PNBE";
  const to = "NDLS";
  const dateOfJourney = "2026-05-28";
  
  let date = dateOfJourney;
  if (date.includes('-') && date.split('-')[0].length === 4) {
    const parts = date.split('-');
    date = `${parts[2]}-${parts[1]}-${parts[0]}`;
  }
  console.log("Formatted Date:", date);

  const url = `https://${process.env.IRCTC_API_HOST}/api/v3/trainBetweenStations?fromStationCode=${from}&toStationCode=${to}&dateOfJourney=${date}`;
  console.log("URL:", url);

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'X-RapidAPI-Key': process.env.IRCTC_API_KEY,
        'X-RapidAPI-Host': process.env.IRCTC_API_HOST,
      }
    });
    
    console.log("Response Status:", response.status);
    const data = await response.json();
    console.log("Data success?", data.status);
    console.log("Number of trains:", data.data ? data.data.length : 0);
  } catch (e) {
    console.error(e);
  }
}
test();
