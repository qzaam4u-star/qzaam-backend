require('dotenv').config();
const prisma = require('../src/config/prisma');

// Mock isVendorOpen logic from routes
function isVendorOpen(openingTime, closingTime) {
  if (!openingTime || !closingTime) return true;
  
  const now = new Date();
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Kolkata',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });
  const currentStr = formatter.format(now);
  
  const [currH, currM] = currentStr.split(':').map(Number);
  const [openH, openM] = openingTime.split(':').map(Number);
  const [closeH, closeM] = closingTime.split(':').map(Number);
  
  const currMinutes = currH * 60 + currM;
  const openMinutes = openH * 60 + openM;
  const closeMinutes = closeH * 60 + closeM;
  
  if (openMinutes < closeMinutes) {
    return currMinutes >= openMinutes && currMinutes < closeMinutes;
  } else {
    return currMinutes >= openMinutes || currMinutes < closeMinutes;
  }
}

async function runTests() {
  console.log('🚀 Starting Wishlist Integration Tests...');
  let testCustomer = null;
  let testVendor = null;
  let cleanupPerformed = false;

  try {
    // 1. Create a mock customer
    const uniquePhone = '99999' + Math.floor(10000 + Math.random() * 90000);
    testCustomer = await prisma.customer.create({
      data: {
        name: 'Test Wishlist Customer',
        phone: uniquePhone
      }
    });
    console.log(`✅ Created test customer: ${testCustomer.id} (${testCustomer.phone})`);

    // 2. Create a mock vendor
    const uniqueEmail = `testvendor_${Date.now()}@example.com`;
    testVendor = await prisma.user.create({
      data: {
        name: 'Test Wishlist Vendor',
        email: uniqueEmail,
        mobile: uniquePhone,
        password: 'hashedpassword',
        outletName: 'Tasty Bites Test Outlet',
        address: '123 Test Street, Bangalore',
        role: 'vendor',
        vendorType: 'food',
        openingTime: '09:00',
        closingTime: '21:00'
      }
    });
    console.log(`✅ Created test vendor: ${testVendor.id} (${testVendor.email})`);

    // 3. Add mock review to test ratings aggregation
    await prisma.review.createMany({
      data: [
        { rating: 4, customerId: testCustomer.id, vendorId: testVendor.id, comment: 'Great!' },
        { rating: 5, customerId: testCustomer.id, vendorId: testVendor.id, comment: 'Superb!' }
      ]
    });
    console.log(`✅ Added 2 test reviews for the vendor`);

    // 4. Test Toggle: Add to Wishlist
    console.log('\n--- Test: Add to Wishlist ---');
    const addResult = await prisma.wishlist.create({
      data: {
        customerId: testCustomer.id,
        vendorId: testVendor.id
      }
    });
    console.log(`✅ Added wishlist item: ID ${addResult.id}`);

    // Verify unique constraint (should fail on double insert)
    try {
      await prisma.wishlist.create({
        data: {
          customerId: testCustomer.id,
          vendorId: testVendor.id
        }
      });
      console.error('❌ Error: Unique constraint failed to prevent duplicate wishlist item!');
      process.exit(1);
    } catch (err) {
      console.log('✅ Correctly blocked duplicate wishlist record (Unique constraint verified)');
    }

    // 5. Test Check API status logic
    console.log('\n--- Test: Check Wishlist Status ---');
    const checked = await prisma.wishlist.findUnique({
      where: {
        customerId_vendorId: {
          customerId: testCustomer.id,
          vendorId: testVendor.id
        }
      }
    });
    console.log(`✅ Wishlist item checked: ${!!checked ? 'FOUND (Correct)' : 'NOT FOUND (Incorrect)'}`);
    if (!checked) throw new Error('Wishlist item should have been found');

    // 6. Test Fetch All Saved Vendors logic
    console.log('\n--- Test: Fetch Saved Vendors Query & Aggregations ---');
    const wishlists = await prisma.wishlist.findMany({
      where: { customerId: testCustomer.id },
      include: {
        vendor: {
          select: {
            id: true,
            name: true,
            outletName: true,
            address: true,
            vendorType: true,
            profileImage: true,
            openingTime: true,
            closingTime: true,
            reviews: {
              select: {
                rating: true
              }
            }
          }
        }
      }
    });

    if (wishlists.length !== 1) {
      throw new Error(`Expected exactly 1 wishlist record, got ${wishlists.length}`);
    }

    const wItem = wishlists[0];
    const v = wItem.vendor;
    const ratings = v.reviews.map(r => r.rating);
    const avgRating = ratings.length > 0 
      ? (ratings.reduce((sum, r) => sum + r, 0) / ratings.length).toFixed(1)
      : "0.0";
    const isOpen = isVendorOpen(v.openingTime, v.closingTime);

    console.log(`✅ Fetched vendor successfully inside wishlist query`);
    console.log(`✅ Rating calculation: ${avgRating} (Expected: 4.5)`);
    console.log(`✅ Vendor Open Status: ${isOpen}`);

    if (avgRating !== '4.5') throw new Error('Incorrect average rating calculation');

    // 7. Test Lightweight Count
    console.log('\n--- Test: Count Wishlist Items ---');
    const count = await prisma.wishlist.count({
      where: { customerId: testCustomer.id }
    });
    console.log(`✅ Wishlist count: ${count} (Expected: 1)`);
    if (count !== 1) throw new Error('Incorrect count value');

    // 8. Test Cascade Delete - Customer Delete
    console.log('\n--- Test: Cascade Delete on Customer ---');
    // Delete referencing reviews first to satisfy RESTRICT constraint
    await prisma.review.deleteMany({
      where: { customerId: testCustomer.id }
    });
    console.log(`✅ Deleted referencing reviews for customer`);

    await prisma.customer.delete({
      where: { id: testCustomer.id }
    });
    console.log(`✅ Deleted customer ${testCustomer.id}`);

    const checkAfterCustomerDelete = await prisma.wishlist.findFirst({
      where: { vendorId: testVendor.id }
    });
    console.log(`✅ Wishlist record after customer deletion: ${checkAfterCustomerDelete ? 'STILL EXISTS (Incorrect)' : 'DELETED (Correct - Cascade works)'}`);
    if (checkAfterCustomerDelete) throw new Error('Cascade delete failed on Customer deletion');

    // Clean up vendor
    await prisma.user.delete({
      where: { id: testVendor.id }
    });
    console.log(`✅ Deleted vendor ${testVendor.id}`);
    cleanupPerformed = true;

    // 9. Test Cascade Delete - Vendor Delete
    console.log('\n--- Test: Cascade Delete on Vendor ---');
    // Re-create customer & vendor to test vendor cascade
    testCustomer = await prisma.customer.create({
      data: {
        name: 'Test Customer 2',
        phone: uniquePhone
      }
    });
    testVendor = await prisma.user.create({
      data: {
        name: 'Test Vendor 2',
        email: uniqueEmail,
        mobile: uniquePhone,
        password: 'hashedpassword',
        role: 'vendor',
        vendorType: 'salon'
      }
    });
    
    // Add wishlist relation
    await prisma.wishlist.create({
      data: {
        customerId: testCustomer.id,
        vendorId: testVendor.id
      }
    });

    // Delete vendor user
    await prisma.user.delete({
      where: { id: testVendor.id }
    });
    console.log(`✅ Deleted vendor user ${testVendor.id}`);

    const checkAfterVendorDelete = await prisma.wishlist.findFirst({
      where: { customerId: testCustomer.id }
    });
    console.log(`✅ Wishlist record after vendor deletion: ${checkAfterVendorDelete ? 'STILL EXISTS (Incorrect)' : 'DELETED (Correct - Cascade works)'}`);
    if (checkAfterVendorDelete) throw new Error('Cascade delete failed on Vendor user deletion');

    // Cleanup customer 2
    await prisma.customer.delete({
      where: { id: testCustomer.id }
    });
    console.log(`✅ Deleted customer ${testCustomer.id}`);

    console.log('\n🌟 ALL WISHLIST INTEGRATION TESTS PASSED SUCCESSFULLY! 🌟');
  } catch (error) {
    console.error('❌ Test failed with error:', error);
    // Attempt cleanup if not done
    if (!cleanupPerformed) {
      console.log('🧹 Attempting emergency cleanup of test records...');
      try {
        if (testCustomer) {
          await prisma.review.deleteMany({ where: { customerId: testCustomer.id } });
          await prisma.customer.deleteMany({ where: { phone: testCustomer.phone } });
        }
        if (testVendor) {
          await prisma.review.deleteMany({ where: { vendorId: testVendor.id } });
          await prisma.user.deleteMany({ where: { mobile: testVendor.mobile } });
        }
        console.log('✅ Cleanup successful');
      } catch (cleanupErr) {
        console.error('Failed to cleanup test data:', cleanupErr);
      }
    }
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runTests();
