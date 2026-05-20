const { PrismaClient } = require('@prisma/client');
const { Pool } = require('pg');
const { PrismaPg } = require('@prisma/adapter-pg');

const ssl = process.env.DATABASE_URL && (
  process.env.DATABASE_URL.includes('render.com') || 
  process.env.DATABASE_URL.includes('supabase.co') || 
  process.env.DATABASE_URL.includes('.db.') ||
  process.env.NODE_ENV === 'production'
) ? { rejectUnauthorized: false } : undefined;

const pool = new Pool({ 
  connectionString: process.env.DATABASE_URL,
  ssl
});
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

module.exports = prisma;
