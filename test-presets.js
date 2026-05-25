const { checkDirectTrains } = require('./src/services/trainService');

async function run() {
  try {
    process.env.IRCTC_API_KEY = "irctc_1ec116a5f2546df783b4c22c91144f7a84831f9bb17b75f4";
    const res = await checkDirectTrains('NDLS', 'PNBE', '19-05-2026', 'Any');
    console.log("TOTAL TRAINS:", res.length);
    res.forEach(t => {
      console.log(`- ${t.trainNo}: ${t.trainName} (${t.duration}) - Avail: ${t.availability} - Fare: ${t.fare}`);
    });
  } catch (e) {
    console.error(e);
  }
}
run();
