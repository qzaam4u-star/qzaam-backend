require('dotenv').config();
const prisma = require('../src/config/prisma');

async function main() {
  console.log('--- Starting Vendor Type Data Fix ---');
  
  const keywords = ['saloon', 'salon', 'parlour', 'spa', 'beauty', 'hair', 'nails', 'stylist'];
  
  const vendors = await prisma.user.findMany({
    where: {
      role: 'vendor',
      vendorType: 'food' // Only check ones currently set to food
    }
  });

  console.log(`Found ${vendors.length} food vendors. Checking for salon keywords...`);

  let count = 0;
  for (const vendor of vendors) {
    const name = (vendor.name || '').toLowerCase();
    const outlet = (vendor.outletName || '').toLowerCase();
    
    const isSalon = keywords.some(k => name.includes(k) || outlet.includes(k));
    
    if (isSalon) {
      console.log(`Updating ${vendor.name} (${vendor.outletName}) to salon...`);
      await prisma.user.update({
        where: { id: vendor.id },
        data: { vendorType: 'salon' }
      });
      count++;
    }
  }

  console.log(`--- Finished. Updated ${count} vendors to salon type. ---`);
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });
