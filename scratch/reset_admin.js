require('dotenv').config();
const prisma = require('../src/config/prisma');
const bcrypt = require('bcrypt');

async function reset() {
  try {
    const hashedPassword = await bcrypt.hash('admin@123', 10);
    const updated = await prisma.user.updateMany({
      where: { role: 'admin' },
      data: {
        password: hashedPassword,
        email: 'admin@qzaam.com',
        isApproved: true
      }
    });
    console.log(`Reset ${updated.count} admin user(s) password to 'admin@123'`);
  } catch (e) {
    console.error("Reset Error:", e);
  } finally {
    await prisma.$disconnect();
  }
}

reset();
