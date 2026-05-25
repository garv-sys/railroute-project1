require('dotenv').config({ path: '.env.local' });
const irctc = require('irctc-connect');

irctc.configure(process.env.IRCTC_API_KEY);

async function test() {
  try {
    const res = await irctc.getAvailability('12393', 'PNBE', 'NDLS', '28-05-2026', '3A', 'GN');
    console.log("Full response:", JSON.stringify(res, null, 2));
  } catch(e) {
    console.error("Error thrown:", e);
  }
}
test();
