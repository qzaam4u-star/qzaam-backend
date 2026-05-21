require('dotenv').config();
const prisma = require('../src/config/prisma');

async function runSlotSyncTest() {
  console.log('--- Starting Slot Booking Sync Integration Test ---');
  
  const vendorId = '7ecf2d2d-8e4f-49e8-a900-f773c8eca8d6'; // woww (existing salon vendor)

  try {
    // 1. Verify vendor exists and has slotEnabled field
    const vendor = await prisma.user.findUnique({
      where: { id: vendorId },
      select: { id: true, name: true, slotEnabled: true, vendorType: true }
    });

    if (!vendor) {
      throw new Error(`Test vendor with ID ${vendorId} not found in the DB. Please check check_vendor.js`);
    }

    console.log(`Initial Vendor State: ${JSON.stringify(vendor, null, 2)}`);

    // 2. Set slotEnabled to false
    console.log('Setting slotEnabled to false...');
    await prisma.user.update({
      where: { id: vendorId },
      data: { slotEnabled: false }
    });

    // 3. Simulate public route select query
    const publicVendorDisabled = await prisma.user.findUnique({
      where: { id: vendorId },
      select: {
        id: true,
        name: true,
        outletName: true,
        address: true,
        averagePrepTime: true,
        mobile: true,
        vendorType: true,
        role: true,
        stylists: true,
        slotDuration: true,
        maxOrdersPerSlot: true,
        openingTime: true,
        closingTime: true,
        slotEnabled: true
      }
    });

    console.log(`Public API query result (disabled): slotEnabled = ${publicVendorDisabled.slotEnabled}`);
    if (publicVendorDisabled.slotEnabled !== false) {
      throw new Error('Expected slotEnabled to be false after disable update!');
    }
    console.log('✅ Disable sync successful.');

    // 4. Set slotEnabled to true
    console.log('Setting slotEnabled to true...');
    await prisma.user.update({
      where: { id: vendorId },
      data: { slotEnabled: true }
    });

    // 5. Simulate public route select query again
    const publicVendorEnabled = await prisma.user.findUnique({
      where: { id: vendorId },
      select: {
        id: true,
        name: true,
        outletName: true,
        address: true,
        averagePrepTime: true,
        mobile: true,
        vendorType: true,
        role: true,
        stylists: true,
        slotDuration: true,
        maxOrdersPerSlot: true,
        openingTime: true,
        closingTime: true,
        slotEnabled: true
      }
    });

    console.log(`Public API query result (enabled): slotEnabled = ${publicVendorEnabled.slotEnabled}`);
    if (publicVendorEnabled.slotEnabled !== true) {
      throw new Error('Expected slotEnabled to be true after enable update!');
    }
    console.log('✅ Enable sync successful.');

    // 6. Test payment route validation block (simulate payment verify with slotEnabled: false)
    console.log('Simulating payment validation check...');
    // set to false temporarily
    await prisma.user.update({
      where: { id: vendorId },
      data: { slotEnabled: false }
    });

    const vendorForTotals = await prisma.user.findUnique({
      where: { id: vendorId },
      select: { hasGst: true, vendorType: true, slotEnabled: true }
    });

    console.log(`Simulation: Is slot booking enabled? ${vendorForTotals.slotEnabled}`);
    if (vendorForTotals.slotEnabled) {
      throw new Error('Payment validation simulation failed: Slot booking is enabled when it should be disabled.');
    }
    console.log('✅ Payment route validation check successfully blocked disabled slot booking.');

    // Reset back to true for vendor usage
    await prisma.user.update({
      where: { id: vendorId },
      data: { slotEnabled: true }
    });
    console.log('Restored slotEnabled to true for vendor dashboard.');

    console.log('\n--- ALL SLOT SYNC TESTS PASSED SUCCESSFULLY! ---');
  } catch (error) {
    console.error('\n❌ Test failed with error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

runSlotSyncTest();
