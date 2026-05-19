require('dotenv').config();
const prisma = require('../src/config/prisma');

async function cleanup() {
  try {
    const deleted = await prisma.user.deleteMany({
      where: { role: 'customer' }
    });
    console.log(`Deleted ${deleted.count} legacy customers.`);
  } catch (e) {
    console.error("Cleanup Error:", e);
  } finally {
    await prisma.$disconnect();
  }
}

cleanup();
