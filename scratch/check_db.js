require('dotenv').config();
const prisma = require('../src/config/prisma');

async function check() {
  try {
    const vendors = await prisma.user.count({ where: { role: 'vendor' } });
    const orders = await prisma.order.count();
    console.log(JSON.stringify({ vendors, orders }, null, 2));
  } catch (e) {
    console.error("Diagnostic Script Error:", e);
  } finally {
    await prisma.$disconnect();
  }
}

check();
