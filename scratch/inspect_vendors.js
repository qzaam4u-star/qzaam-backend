require('dotenv').config();
const prisma = require('../src/config/prisma');

async function check() {
  try {
    const vendors = await prisma.user.findMany({ 
      where: { role: 'vendor' },
      select: { id: true, name: true, outletName: true, role: true }
    });
    console.log("Count:", vendors.length);
    console.log("Sample:", JSON.stringify(vendors.slice(0, 2), null, 2));
  } catch (e) {
    console.error("Diagnostic Error:", e);
  } finally {
    await prisma.$disconnect();
  }
}

check();
