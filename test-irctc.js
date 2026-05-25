const irctc = require('irctc-connect');

async function test() {
  try {
    const res = await irctc.searchTrainBetweenStations('PNBE', 'NDLS', '28-05-2026');
    console.log(JSON.stringify(res, null, 2));
  } catch(e) {
    console.error(e);
  }
}
test();
