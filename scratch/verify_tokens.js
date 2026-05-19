require('dotenv').config();
const { generateVendorToken } = require('../src/services/token.service');
const prisma = require('../src/config/prisma');

async function testTokens() {
  const vendor = await prisma.user.findFirst({ where: { role: 'vendor' } });
  if (!vendor) {
    console.log('No vendor found to test.');
    return;
  }

  console.log(`Testing tokens for vendor: ${vendor.name} (${vendor.id})`);
  
  const t1 = await generateVendorToken(vendor.id);
  console.log('Token 1:', t1);

  const t2 = await generateVendorToken(vendor.id);
  console.log('Token 2:', t2);

  const t3 = await generateVendorToken(vendor.id);
  console.log('Token 3:', t3);
}

testTokens()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
