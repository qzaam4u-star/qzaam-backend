require('dotenv').config();
const prisma = require('../src/config/prisma');

async function check() {
  try {
    const allUsers = await prisma.user.findMany({ 
      select: { email: true, role: true }
    });
    console.log(JSON.stringify(allUsers, null, 2));
  } catch (e) {
    console.error("Diagnostic Error:", e);
  } finally {
    await prisma.$disconnect();
  }
}

check();
