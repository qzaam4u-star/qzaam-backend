require('dotenv').config();
const prisma = require('../src/config/prisma');
const { parseISTDateTime, formatTimeInIndia } = require('../src/utils/timezone');
const { checkOrderTimeouts } = require('../src/utils/orderTimeoutChecker');

async function test() {
  console.log('--- STARTING FOOD SLOT BOOKING INTEGRATION TESTS ---');

  // 1. Find or create a food vendor
  let vendor = await prisma.user.findFirst({
    where: { role: 'vendor', vendorType: 'food' }
  });
  if (!vendor) {
    console.log('No food vendor found, creating mock food vendor...');
    vendor = await prisma.user.create({
      data: {
        name: 'Mock Food Vendor',
        email: 'mockvendor@test.com',
        mobile: '9999999999',
        password: 'password_hash_placeholder',
        role: 'vendor',
        vendorType: 'food',
        averagePrepTime: 15,
        slotEnabled: true
      }
    });
  } else {
    // Ensure averagePrepTime is set to 15 for consistent test expectations
    vendor = await prisma.user.update({
      where: { id: vendor.id },
      data: { averagePrepTime: 15 }
    });
  }

  // 2. Find or create a customer
  let customer = await prisma.customer.findFirst();
  if (!customer) {
    console.log('No customer found, creating mock customer...');
    customer = await prisma.customer.create({
      data: {
        name: 'Mock Customer',
        phone: '8888888888',
        referralCode: 'MOCKREF123',
        wallet: { create: { balance: 1000.0 } }
      }
    });
  }

  console.log(`Using Vendor: ${vendor.name} (ID: ${vendor.id}, Prep Time: ${vendor.averagePrepTime} mins)`);
  console.log(`Using Customer: ${customer.name} (ID: ${customer.id})`);

  // Test slot inputs:
  const testSlots = [
    { date: '2026-05-25', slot: '09:00', expectedUTC: '2026-05-25T03:30:00.000Z', expectedActivationUTC: '2026-05-25T03:15:00.000Z' },
    { date: '2026-05-25', slot: '12:30', expectedUTC: '2026-05-25T07:00:00.000Z', expectedActivationUTC: '2026-05-25T06:45:00.000Z' },
    { date: '2026-05-25', slot: '18:00', expectedUTC: '2026-05-25T12:30:00.000Z', expectedActivationUTC: '2026-05-25T12:15:00.000Z' }
  ];

  const createdOrderIds = [];

  for (const t of testSlots) {
    console.log(`\nTesting slot: ${t.date} ${t.slot}`);

    // Parse using timezone utility
    const parsedTime = parseISTDateTime(t.date, t.slot);
    const calculatedActivation = new Date(parsedTime.getTime() - vendor.averagePrepTime * 60 * 1000);

    console.log(`  parseISTDateTime Result:    ${parsedTime.toISOString()}`);
    console.log(`  Expected UTC:               ${t.expectedUTC}`);
    console.log(`  Activation Time (Prep-15):  ${calculatedActivation.toISOString()}`);
    console.log(`  Expected Activation UTC:    ${t.expectedActivationUTC}`);

    if (parsedTime.toISOString() !== t.expectedUTC) {
      throw new Error(`Time mismatch! Expected ${t.expectedUTC} but got ${parsedTime.toISOString()}`);
    }
    if (calculatedActivation.toISOString() !== t.expectedActivationUTC) {
      throw new Error(`Activation mismatch! Expected ${t.expectedActivationUTC} but got ${calculatedActivation.toISOString()}`);
    }

    // Insert order to db
    const order = await prisma.order.create({
      data: {
        customerName: customer.name,
        customerPhone: customer.phone,
        customerId: customer.id,
        vendorId: vendor.id,
        items: [{ id: 'item1', name: 'Samosa', quantity: 2, price: 20 }],
        totalAmount: 40.0,
        platformFee: 2.0,
        finalAmount: 42.0,
        status: 'upcoming',
        isActivated: false,
        scheduledDate: t.date,
        scheduledSlot: t.slot,
        scheduledTime: parsedTime,
        slotDateTime: parsedTime,
        activationTime: calculatedActivation
      }
    });

    createdOrderIds.push(order.id);
    console.log(`  Stored order successfully! ID: ${order.id}`);
    console.log(`  DB Stored scheduledTime: ${order.scheduledTime.toISOString()}`);
    console.log(`  DB Stored activationTime: ${order.activationTime.toISOString()}`);
  }

  // Test automatic activation mechanism
  console.log('\n--- TESTING AUTO ACTIVATION IN ORDERTIMEOUTCHECKER ---');
  
  // Create an upcoming order that is ready to be activated (activation time <= now)
  const pastActivationTime = new Date(Date.now() - 5000); // 5 seconds ago
  const futureSlotTime = new Date(pastActivationTime.getTime() + vendor.averagePrepTime * 60 * 1000);

  const activationTestOrder = await prisma.order.create({
    data: {
      customerName: customer.name,
      customerPhone: customer.phone,
      customerId: customer.id,
      vendorId: vendor.id,
      items: [{ id: 'item1', name: 'Tea', quantity: 1, price: 10 }],
      totalAmount: 10.0,
      platformFee: 1.0,
      finalAmount: 11.0,
      status: 'upcoming',
      isActivated: false,
      scheduledDate: '2026-05-25',
      scheduledSlot: '15:00',
      scheduledTime: futureSlotTime,
      slotDateTime: futureSlotTime,
      activationTime: pastActivationTime
    }
  });
  createdOrderIds.push(activationTestOrder.id);
  console.log(`Created test order for activation: ID = ${activationTestOrder.id}`);
  console.log(`  Initial status: ${activationTestOrder.status}, isActivated: ${activationTestOrder.isActivated}`);

  // Run timeout checker logic
  console.log('Running checkOrderTimeouts()...');
  await checkOrderTimeouts();

  // Retrieve order state
  const updatedOrder = await prisma.order.findUnique({
    where: { id: activationTestOrder.id }
  });
  console.log(`After checkOrderTimeouts status: ${updatedOrder.status}, isActivated: ${updatedOrder.isActivated}`);

  if (updatedOrder.status !== 'live' || !updatedOrder.isActivated) {
    throw new Error('Order auto-activation failed!');
  }
  console.log('Order auto-activation succeeded!');

  // Cleanup
  console.log('\nCleaning up created test orders...');
  await prisma.order.deleteMany({
    where: {
      id: { in: createdOrderIds }
    }
  });

  console.log('--- ALL TESTS COMPLETED SUCCESSFULLY! ---');
}

test()
  .catch(err => {
    console.error('TEST FAILED:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
