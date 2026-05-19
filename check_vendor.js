const prisma = require('./src/config/prisma');

async function main() {
  try {
    const vendor = await prisma.user.findUnique({
      where: { id: 'a9ee17f5-0e86-41d5-9554-706c85de9afc' },
      select: { slotEnabled: true, vendorType: true, outletName: true }
    });
    console.log('Vendor Status:', JSON.stringify(vendor, null, 2));
  } catch (e) {
    console.error('Error:', e.message);
  } finally {
    await prisma.$disconnect();
  }
}

main();
