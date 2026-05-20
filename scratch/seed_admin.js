require('dotenv').config();
const prisma = require('../src/config/prisma');
const bcrypt = require('bcrypt');

async function seed() {
  try {
    const hashedPassword = await bcrypt.hash('admin@123', 10);
    const admin = await prisma.user.upsert({
      where: { email: 'admin@qzaam.com' },
      update: {},
      create: {
        name: 'Super Admin',
        email: 'admin@qzaam.com',
        mobile: '0000000000',
        password: hashedPassword,
        role: 'admin',
        isApproved: true
      }
    });
    console.log("Admin seeded:", admin.email);
  } catch (e) {
    console.error("Seed Error:", e);
  } finally {
    await prisma.$disconnect();
  }
}

seed();
