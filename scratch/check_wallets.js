require('dotenv').config();
const prisma = require('../src/config/prisma');

async function main() {
  try {
    const wallets = await prisma.wallet.findMany({
      take: 5,
      include: {
        user: true,
        customer: true,
        transactions: true
      }
    });
    console.log(JSON.stringify(wallets, null, 2));
  } catch (err) {
    console.error(err);
  }
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
