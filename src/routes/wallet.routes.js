const express = require('express');
const prisma = require('../config/prisma');

const router = express.Router();

router.get('/', async (req, res, next) => {
  try {
    const { id, phone } = req.query;

    let wallet;
    let referralCode = null;

    if (id) {
      wallet = await prisma.wallet.findUnique({ where: { userId: id }, include: { user: true } });
      if (wallet && wallet.user) referralCode = wallet.user.referralCode;
      
      if (!wallet) {
        wallet = await prisma.wallet.findUnique({ where: { customerId: id }, include: { customer: true } });
        if (wallet && wallet.customer) referralCode = wallet.customer.referralCode;
      }
    } else if (phone) {
      const user = await prisma.user.findFirst({ where: { mobile: phone } });
      if (user) {
        wallet = await prisma.wallet.findUnique({ where: { userId: user.id } });
        referralCode = user.referralCode;
      } else {
        const cust = await prisma.customer.findUnique({ where: { phone } });
        if (cust) {
          wallet = await prisma.wallet.findUnique({ where: { customerId: cust.id } });
          referralCode = cust.referralCode;
        }
      }
    }

    if (!wallet) {
      return res.status(404).json({ success: false, message: 'Wallet not found' });
    }

    const transactions = await prisma.walletTransaction.findMany({
      where: { walletId: wallet.id },
      orderBy: { createdAt: 'desc' }
    });

    let totalSuccessfulReferrals = 0;
    let referralsRemaining = 5;
    let giftHamperEligible = false;
    let referralsHistory = [];

    if (wallet.customerId && referralCode) {
      // Find all CustomerReferral entries where the referrer code is this customer's referralCode
      const referrals = await prisma.customerReferral.findMany({
        where: { referrerCode: referralCode },
        orderBy: { createdAt: 'desc' }
      });

      totalSuccessfulReferrals = referrals.length;
      referralsRemaining = Math.max(0, 5 - totalSuccessfulReferrals);
      giftHamperEligible = totalSuccessfulReferrals >= 5;

      // Fetch the referred customer names and registration dates
      referralsHistory = await Promise.all(
        referrals.map(async (ref) => {
          const referredCust = await prisma.customer.findUnique({
            where: { id: ref.referredId },
            select: { name: true, phone: true, createdAt: true }
          });
          
          let status = 'completed'; // Reward is logged when they complete an order/booking
          
          return {
            id: ref.id,
            name: referredCust?.name || 'Friend',
            phone: referredCust?.phone || 'N/A',
            joinedAt: referredCust?.createdAt || ref.createdAt,
            status
          };
        })
      );
    }

    res.status(200).json({ 
      success: true, 
      wallet, 
      transactions, 
      referralCode,
      totalSuccessfulReferrals,
      referralsRemaining,
      giftHamperEligible,
      referralsHistory
    });
  } catch (error) {
    next(error);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    let wallet = await prisma.wallet.findUnique({
      where: { userId: id }
    });

    if (!wallet) {
      wallet = await prisma.wallet.findUnique({
        where: { customerId: id }
      });
    }

    if (!wallet) {
      return res.json({ balance: 0 });
    }

    res.json({ balance: wallet.balance });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
