require('dotenv').config();
const prisma = require('../src/config/prisma');

async function main() {
  try {
    const orders = await prisma.order.findMany({ take: 1 });
    console.log('Success: prisma.order.findMany() works');
    console.log('Order columns:', Object.keys(orders[0] || {}));
  } catch (error) {
    console.error('Error message:', error.message);
    if (error.code) console.error('Error code:', error.code);
    if (error.meta) console.error('Error meta:', JSON.stringify(error.meta, null, 2));
  } finally {
    await prisma.$disconnect();
  }
}

main();
