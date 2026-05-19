const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    const order = await prisma.order.findFirst({
      where: { isActivated: true }
    });
    console.log('Success! Client can see isActivated field.');
  } catch (e) {
    console.error('Error:', e.message);
  } finally {
    await prisma.$disconnect();
  }
}

main();
