require('dotenv').config();
const prisma = require('../src/config/prisma');

async function check() {
  try {
    const admins = await prisma.user.findMany({ where: { role: 'admin' } });
    console.log(JSON.stringify(admins, null, 2));
  } catch (e) {
    console.error("Diagnostic Script Error:", e);
  } finally {
    await prisma.$disconnect();
  }
}

check();
