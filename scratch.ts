import { configure, searchTrainBetweenStations, getAvailability } from 'irctc-connect';

configure('irctc_bb8a99b0f74374283472701da795f133d445ee5992bc8832');

async function test() {
  console.log('--- Search Direct ---');
  try {
    const searchRes = await searchTrainBetweenStations('PNBE', 'NDLS', '15-06-2025');
    console.log(JSON.stringify(searchRes?.data?.[0] || searchRes?.[0] || searchRes, null, 2));

    const trainNo = searchRes?.data?.[0]?.train_number || searchRes?.[0]?.train_number;
    if (trainNo) {
      console.log('\n--- Availability ---');
      const availRes = await getAvailability(trainNo, 'PNBE', 'NDLS', '15-06-2025', '3A', 'GN');
      console.log(JSON.stringify(availRes, null, 2));
    }
  } catch (e) {
    console.error(e);
  }
}

test();
