require('dotenv').config();
const prisma = require('../src/config/prisma');

async function main() {
  const vendors = await prisma.user.findMany({
    where: { role: 'vendor', vendorType: 'food' },
    select: {
      id: true,
      name: true,
      outletName: true,
      vendorType: true
    }
  });
  console.log('Registered Food Vendors:');
  console.log(JSON.stringify(vendors, null, 2));
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });
