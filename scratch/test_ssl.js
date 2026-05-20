require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const { Pool } = require('pg');
const { PrismaPg } = require('@prisma/adapter-pg');

async function main() {
  const pool = new Pool({ 
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  try {
    const admins = await prisma.user.findMany({ where: { role: 'admin' } });
    console.log('Successfully connected and queried!');
    console.log('Admins count:', admins.length);
    console.log('Admins:', JSON.stringify(admins, null, 2));
  } catch (error) {
    console.error('Error connecting/querying:', error);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main();
