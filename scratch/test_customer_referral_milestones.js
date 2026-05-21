require('dotenv').config();
const prisma = require('../src/config/prisma');
const { validateAndCheckReferral, generateCustomerReferralCode } = require('../src/utils/referral');
const { calculateOrderTotals } = require('../src/utils/orderCalculator');

// Mock order structure and processCustomerReferralRewards function from order.routes.js
async function processCustomerReferralRewards(order) {
  if (!order.appliedReferralCode) return;
  
  // Prevent duplicate reward processing for this referred customer/order
  const existingLog = await prisma.customerReferral.findFirst({
    where: {
      OR: [
        { orderId: order.id },
        { referredId: order.customerId }
      ]
    }
  });

  if (existingLog) {
    console.log(`[CustomerReferral] Referral already processed for order ${order.id} or customer ${order.customerId}`);
    return;
  }

  // Find the referrer customer (owner of the applied referral code)
  const referrer = await prisma.customer.findUnique({
    where: { referralCode: order.appliedReferralCode }
  });

  if (!referrer) {
    console.log(`[CustomerReferral] Referrer with code ${order.appliedReferralCode} not found.`);
    return;
  }

  // Create customer referral record
  await prisma.customerReferral.create({
    data: {
      referrerCode: order.appliedReferralCode,
      referredId: order.customerId,
      orderId: order.id,
      rewardAmount: 0.0
    }
  });

  console.log(`[CustomerReferral] Successful referral logged for referrer ${referrer.phone} referring customer ID ${order.customerId}`);
}

// Function simulating the backend API response from wallet.routes.js
async function getReferralMilestones(referralCode) {
  const referrals = await prisma.customerReferral.findMany({
    where: { referrerCode: referralCode },
    orderBy: { createdAt: 'desc' }
  });

  const totalSuccessfulReferrals = referrals.length;
  const referralsRemaining = Math.max(0, 5 - totalSuccessfulReferrals);
  const giftHamperEligible = totalSuccessfulReferrals >= 5;

  return {
    totalSuccessfulReferrals,
    referralsRemaining,
    giftHamperEligible,
    referralsCount: referrals.length
  };
}

async function runMilestoneTest() {
  console.log('--- Starting Gift Hamper Referral Milestone Integration Test ---');
  
  const referrerPhone = '9999990000';
  const referredPhones = [
    '8888880001',
    '8888880002',
    '8888880003',
    '8888880004',
    '8888880005',
    '8888880006'
  ];

  try {
    // 1. Cleanup old test data
    console.log('Cleaning up old test data...');
    const allPhones = [referrerPhone, ...referredPhones];
    
    // Find all customers with these phones
    const customers = await prisma.customer.findMany({
      where: { phone: { in: allPhones } }
    });
    const customerIds = customers.map(c => c.id);

    // Delete customer referrals linked to these customers
    await prisma.customerReferral.deleteMany({
      where: {
        OR: [
          { referrerCode: { in: customers.map(c => c.referralCode) } },
          { referredId: { in: customerIds } }
        ]
      }
    });

    // Delete orders linked to these customers
    await prisma.order.deleteMany({
      where: { customerId: { in: customerIds } }
    });

    // Delete wallets and transactions linked to these customers
    const wallets = await prisma.wallet.findMany({
      where: { customerId: { in: customerIds } }
    });
    const walletIds = wallets.map(w => w.id);
    await prisma.walletTransaction.deleteMany({
      where: { walletId: { in: walletIds } }
    });
    await prisma.wallet.deleteMany({
      where: { customerId: { in: customerIds } }
    });

    // Delete customers
    await prisma.customer.deleteMany({
      where: { phone: { in: allPhones } }
    });

    console.log('Cleanup completed successfully.');

    // 2. Create Referrer Customer
    console.log('Creating referrer customer...');
    const referrer = await prisma.customer.create({
      data: {
        name: 'Super Referrer',
        phone: referrerPhone,
        referralCode: generateCustomerReferralCode(),
        wallet: { create: { balance: 0.0 } }
      },
      include: { wallet: true }
    });
    console.log(`Referrer created with code: ${referrer.referralCode}`);

    // Fetch vendor to associate orders
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

    // 3. Process 6 referrals and monitor milestones step-by-step
    for (let i = 0; i < referredPhones.length; i++) {
      const step = i + 1;
      const refPhone = referredPhones[i];
      console.log(`\n--- Step ${step}: Referring customer ${refPhone} ---`);

      // Create Referred Customer
      const referred = await prisma.customer.create({
        data: {
          name: `Referred Buddy ${step}`,
          phone: refPhone,
          referralCode: generateCustomerReferralCode(),
          wallet: { create: { balance: 0.0 } }
        }
      });

      // Place first order using referral code
      const order = await prisma.order.create({
        data: {
          customerName: referred.name,
          customerPhone: referred.phone,
          customerId: referred.id,
          vendorId: vendor.id,
          items: [],
          totalAmount: 200,
          platformFee: 0.0,
          finalAmount: 200,
          status: 'pending',
          appliedReferralCode: referrer.referralCode
        }
      });

      // Process Completion
      await processCustomerReferralRewards(order);

      // Verify referrer wallet balance remains exactly 0.0
      const referrerWallet = await prisma.wallet.findUnique({
        where: { customerId: referrer.id },
        include: { transactions: true }
      });
      console.log(`Referrer Wallet Balance: ₹${referrerWallet.balance}`);
      if (referrerWallet.balance !== 0.0) {
        throw new Error(`Referrer wallet balance was credited ₹${referrerWallet.balance} but MUST remain 0.0!`);
      }

      // Verify no WalletTransactions created for this referrer
      const referralTx = referrerWallet.transactions.find(t => t.source === 'referral');
      if (referralTx) {
        throw new Error('A referral wallet transaction was incorrectly created!');
      }
      console.log('✅ Referrer wallet balance remains exactly 0.0 and no transactions created.');

      // Query milestone calculator
      const milestones = await getReferralMilestones(referrer.referralCode);
      console.log(`Milestone Status:
        totalSuccessfulReferrals: ${milestones.totalSuccessfulReferrals}
        referralsRemaining: ${milestones.referralsRemaining}
        giftHamperEligible: ${milestones.giftHamperEligible}`);

      // Milestone assertions
      if (milestones.totalSuccessfulReferrals !== step) {
        throw new Error(`Expected totalSuccessfulReferrals to be ${step}, got ${milestones.totalSuccessfulReferrals}`);
      }

      if (step < 5) {
        if (milestones.giftHamperEligible !== false) {
          throw new Error(`Referrer should NOT be eligible for Gift Hamper yet at step ${step}!`);
        }
        if (milestones.referralsRemaining !== 5 - step) {
          throw new Error(`Expected referralsRemaining to be ${5 - step}, got ${milestones.referralsRemaining}`);
        }
      } else {
        // Step >= 5
        if (milestones.giftHamperEligible !== true) {
          throw new Error(`Referrer SHOULD be eligible for Gift Hamper at step ${step}!`);
        }
        if (milestones.referralsRemaining !== 0) {
          throw new Error(`Expected referralsRemaining to be 0 at step ${step}, got ${milestones.referralsRemaining}`);
        }
      }
      console.log(`✅ Milestone calculations are 100% correct for step ${step}.`);

      // 4. Test duplicate prevention on the same customer order
      if (step === 1) {
        console.log('Testing duplicate process protection on the same order...');
        await processCustomerReferralRewards(order); // Call again for same order
        const dupMilestones = await getReferralMilestones(referrer.referralCode);
        if (dupMilestones.totalSuccessfulReferrals !== 1) {
          throw new Error(`Double count protection failed! Referral count is: ${dupMilestones.totalSuccessfulReferrals}`);
        }
        console.log('✅ Double-processing block verified.');

        console.log('Testing duplicate customer ordering block...');
        // Place a second order for the same customer
        const secondOrder = await prisma.order.create({
          data: {
            customerName: referred.name,
            customerPhone: referred.phone,
            customerId: referred.id,
            vendorId: vendor.id,
            items: [],
            totalAmount: 300,
            platformFee: 0.0,
            finalAmount: 300,
            status: 'pending',
            appliedReferralCode: referrer.referralCode
          }
        });
        await processCustomerReferralRewards(secondOrder);
        const dupCustMilestones = await getReferralMilestones(referrer.referralCode);
        if (dupCustMilestones.totalSuccessfulReferrals !== 1) {
          throw new Error(`Duplicate referred customer protection failed! Referral count is: ${dupCustMilestones.totalSuccessfulReferrals}`);
        }
        console.log('✅ Duplicate referred customer protection verified.');
      }
    }

    console.log('\n--- ALL REFERRAL MILESTONE INTEGRATION TESTS PASSED SUCCESSFULLY! ---');
  } catch (error) {
    console.error('\n❌ Test failed with error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

runMilestoneTest();
