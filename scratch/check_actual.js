require('dotenv').config();
const prisma = require('../src/config/prisma');
const bcrypt = require('bcrypt');

async function test() {
  try {
    const admin = await prisma.user.findFirst({
      where: { role: 'admin' }
    });
    if (!admin) {
      console.log("No admin found!");
      return;
    }
    const isMatch = await bcrypt.compare('admin@123', admin.password);
    console.log(`Database Admin Email: ${admin.email}`);
    console.log(`Bcrypt validation against 'admin@123': ${isMatch}`);
  } catch (e) {
    console.error("Test Error:", e);
  } finally {
    await prisma.$disconnect();
  }
}

test();
