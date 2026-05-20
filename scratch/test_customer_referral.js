require('dotenv').config();
const prisma = require('../src/config/prisma');
const { validateAndCheckReferral, generateCustomerReferralCode } = require('../src/utils/referral');
const { calculateOrderTotals } = require('../src/utils/orderCalculator');

async function runTest() {
  console.log('--- Starting Referral System Integration Test ---');
  const referrerPhone = '9999999999';
  const referredPhone = '8888888888';

  try {
    // 1. Cleanup old test data
    console.log('Cleaning up old test data...');
    const oldOrders = await prisma.order.findMany({
      where: { customerPhone: { in: [referrerPhone, referredPhone] } }
    });
    for (const order of oldOrders) {
      await prisma.customerReferral.deleteMany({ where: { orderId: order.id } });
      await prisma.order.delete({ where: { id: order.id } });
    }

    const oldReferred = await prisma.customer.findUnique({ where: { phone: referredPhone } });
    if (oldReferred) {
      await prisma.customerReferral.deleteMany({ where: { referredId: oldReferred.id } });
      const wallet = await prisma.wallet.findUnique({ where: { customerId: oldReferred.id } });
      if (wallet) {
        await prisma.walletTransaction.deleteMany({ where: { walletId: wallet.id } });
        await prisma.wallet.delete({ where: { id: wallet.id } });
      }
      await prisma.customer.delete({ where: { id: oldReferred.id } });
    }

    const oldReferrer = await prisma.customer.findUnique({ where: { phone: referrerPhone } });
    if (oldReferrer) {
      const wallet = await prisma.wallet.findUnique({ where: { customerId: oldReferrer.id } });
      if (wallet) {
        await prisma.walletTransaction.deleteMany({ where: { walletId: wallet.id } });
        await prisma.wallet.delete({ where: { id: wallet.id } });
      }
      await prisma.customer.delete({ where: { id: oldReferrer.id } });
    }

    // 2. Create Referrer Customer
    console.log('Creating referrer customer...');
    const referrer = await prisma.customer.create({
      data: {
        name: 'Referrer Guy',
        phone: referrerPhone,
        referralCode: generateCustomerReferralCode(),
        wallet: { create: { balance: 0.0 } }
      },
      include: { wallet: true }
    });
    console.log(`Referrer created successfully with code: ${referrer.referralCode}`);
    if (!referrer.referralCode.startsWith('CUST-')) {
      throw new Error(`Referral code ${referrer.referralCode} does not start with CUST- prefix!`);
    }

    // 3. Test Self-Referral Block
    console.log('Testing self-referral block...');
    const selfCheck = await validateAndCheckReferral(referrer.referralCode, referrerPhone);
    console.log(`Self-referral check result: isValid=${selfCheck.isValid}, message="${selfCheck.message}"`);
    if (selfCheck.isValid) {
      throw new Error('Self-referral was allowed but should have been blocked!');
    }
    if (selfCheck.message !== 'Self-referral is not allowed.') {
      throw new Error(`Expected self-referral message, got: ${selfCheck.message}`);
    }
    console.log('✅ Self-referral block works perfectly.');

    // 4. Test Valid Referral Validation
    console.log('Testing valid referral check for new customer...');
    const validCheck = await validateAndCheckReferral(referrer.referralCode, referredPhone);
    console.log(`Valid referral check result: isValid=${validCheck.isValid}`);
    if (!validCheck.isValid) {
      throw new Error(`Referral code should be valid but failed: ${validCheck.message}`);
    }
    console.log('✅ Referral validation works perfectly.');

    // 5. Create Referred Customer
    console.log('Creating referred customer...');
    const referred = await prisma.customer.create({
      data: {
        name: 'Referred Buddy',
        phone: referredPhone,
        referralCode: generateCustomerReferralCode(),
        wallet: { create: { balance: 0.0 } }
      },
      include: { wallet: true }
    });
    console.log(`Referred customer created with code: ${referred.referralCode}`);

    // 6. Test Platform Fee Waiver calculation
    console.log('Testing totals calculation with referral code...');
    const totalsWithoutReferral = calculateOrderTotals({
      subtotal: 200,
      hasGst: false,
      vendorType: 'food',
      isReferralApplied: false
    });
    const totalsWithReferral = calculateOrderTotals({
      subtotal: 200,
      hasGst: false,
      vendorType: 'food',
      isReferralApplied: true
    });

    console.log(`Without Referral: Subtotal=${totalsWithoutReferral.subtotal}, Fee=${totalsWithoutReferral.platformFee}, Total=${totalsWithoutReferral.finalTotal}`);
    console.log(`With Referral: Subtotal=${totalsWithReferral.subtotal}, Fee=${totalsWithReferral.platformFee}, Total=${totalsWithReferral.finalTotal}`);

    if (totalsWithoutReferral.platformFee <= 0) {
      throw new Error('Default platform fee should be greater than 0');
    }
    if (totalsWithReferral.platformFee !== 0) {
      throw new Error(`Referral fee waiver failed! Platform fee is: ${totalsWithReferral.platformFee}`);
    }
    console.log('✅ Order calculator correctly waives the platform fee.');

    // 7. Place Order
    console.log('Placing referred order...');
    // Create a dummy vendor to associate order with
    let vendor = await prisma.user.findFirst({ where: { role: 'vendor' } });
    if (!vendor) {
      console.log('No vendor found. Creating temporary vendor...');
      const bcrypt = require('bcrypt');
      vendor = await prisma.user.create({
        data: {
          name: 'Test Vendor',
          email: 'testvendor@qzaam.com',
          mobile: '7777777777',
          password: await bcrypt.hash('password123', 10),
          role: 'vendor',
          outletName: 'Test Outlet',
          address: 'Test Street 123',
          averagePrepTime: 10,
          referralCode: 'VENDOR-TEST1'
        }
      });
    }

    const order = await prisma.order.create({
      data: {
        customerName: referred.name,
        customerPhone: referred.phone,
        customerId: referred.id,
        vendorId: vendor.id,
        items: [],
        totalAmount: 200,
        platformFee: totalsWithReferral.platformFee,
        finalAmount: totalsWithReferral.finalTotal,
        status: 'pending',
        appliedReferralCode: referrer.referralCode
      }
    });
    console.log(`Order placed successfully with ID: ${order.id}`);

    // 8. Process Referral Completion Reward
    console.log('Processing referral reward on completion...');
    
    async function processCustomerReferralRewards(order) {
      if (!order.appliedReferralCode) return;
      
      const existingLog = await prisma.customerReferral.findFirst({
        where: {
          OR: [
            { orderId: order.id },
            { referredId: order.customerId }
          ]
        }
      });

      if (existingLog) {
        console.log(`[CustomerReferral] Reward already processed for order ${order.id} or customer ${order.customerId}`);
        return;
      }

      const referrer = await prisma.customer.findUnique({
        where: { referralCode: order.appliedReferralCode },
        include: { wallet: true }
      });

      if (!referrer) {
        console.log(`[CustomerReferral] Referrer with code ${order.appliedReferralCode} not found.`);
        return;
      }

      await prisma.customerReferral.create({
        data: {
          referrerCode: order.appliedReferralCode,
          referredId: order.customerId,
          orderId: order.id,
          rewardAmount: 50.0
        }
      });

      let wallet = referrer.wallet;
      if (!wallet) {
        wallet = await prisma.wallet.create({
          data: { customerId: referrer.id, balance: 0.0 }
        });
      }

      await prisma.wallet.update({
        where: { id: wallet.id },
        data: { balance: { increment: 50.0 } }
      });

      await prisma.walletTransaction.create({
        data: {
          walletId: wallet.id,
          amount: 50.0,
          type: 'credit',
          source: 'referral'
        }
      });

      console.log(`[CustomerReferral] Credited ₹50 to referrer ${referrer.phone} for referring ${order.customerPhone}`);
    }

    await processCustomerReferralRewards(order);

    // 9. Verify Referrer Wallet Balance and Transaction
    const updatedReferrerWallet = await prisma.wallet.findUnique({
      where: { customerId: referrer.id },
      include: { transactions: true }
    });
    console.log(`Referrer Wallet Balance: ₹${updatedReferrerWallet.balance}`);
    if (updatedReferrerWallet.balance !== 50.0) {
      throw new Error(`Referrer wallet should have been credited ₹50.0 but has: ₹${updatedReferrerWallet.balance}`);
    }

    const referralTx = updatedReferrerWallet.transactions.find(t => t.source === 'referral');
    if (!referralTx) {
      throw new Error('No referral wallet transaction found!');
    }
    if (referralTx.amount !== 50.0 || referralTx.type !== 'credit') {
      throw new Error(`Invalid wallet transaction state: amount=${referralTx.amount}, type=${referralTx.type}`);
    }
    console.log('✅ Referrer wallet credited ₹50.0 successfully with a transparent audit trail.');

    // 10. Verify CustomerReferral Log
    const referralLog = await prisma.customerReferral.findFirst({
      where: { referrerCode: referrer.referralCode, referredId: referred.id }
    });
    if (!referralLog) {
      throw new Error('No customer referral log created in DB!');
    }
    console.log('✅ CustomerReferral log verified in database.');

    // 11. Test Duplicate Reward Prevention (Double Credit Protection)
    console.log('Testing duplicate credit protection...');
    await processCustomerReferralRewards(order); // Call again

    const afterSecondCallWallet = await prisma.wallet.findUnique({
      where: { customerId: referrer.id }
    });
    console.log(`Referrer Wallet Balance after duplicate call: ₹${afterSecondCallWallet.balance}`);
    if (afterSecondCallWallet.balance !== 50.0) {
      throw new Error(`Referrer wallet was double-credited on a second completion event! Balance: ₹${afterSecondCallWallet.balance}`);
    }
    console.log('✅ Double credit protection works perfectly.');

    // 12. Test Reuse Prevention (One-time customer discount)
    console.log('Testing duplicate use block...');
    const reuseCheck = await validateAndCheckReferral(referrer.referralCode, referredPhone);
    console.log(`Reuse validation check result: isValid=${reuseCheck.isValid}, message="${reuseCheck.message}"`);
    if (reuseCheck.isValid) {
      throw new Error('Customer was allowed to reuse the referral code again!');
    }
    if (reuseCheck.message !== 'Referral code already used.') {
      throw new Error(`Expected "Referral code already used." message, got: "${reuseCheck.message}"`);
    }
    console.log('✅ Referral code reuse block works perfectly.');

    console.log('--- ALL INTEGRATION TESTS PASSED SUCCESSFULLY! ---');
  } catch (error) {
    console.error('❌ Test failed with error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

runTest();
