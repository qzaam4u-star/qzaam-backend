const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const vendors = await prisma.user.findMany({
    where: { role: 'vendor' },
    select: {
      id: true,
      name: true,
      outletName: true,
      vendorType: true
    }
  });
  console.log(JSON.stringify(vendors, null, 2));
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });
