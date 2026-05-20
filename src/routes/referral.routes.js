const express = require('express');
const prisma = require('../config/prisma');
const { protect, restrictTo } = require('../middlewares/auth.middleware');

const router = express.Router();

// Create Referral (Public - Guest / Customer)
router.post('/', async (req, res, next) => {
  try {
    const { name, phone, location, referredByPhone } = req.body;
    if (!name || !phone || !location) {
      return res.status(400).json({ success: false, message: 'All fields are required.' });
    }

    const referral = await prisma.vendorReferral.create({
      data: {
        name,
        phone,
        location,
        referredByPhone: referredByPhone || 'guest',
        status: 'pending'
      }
    });

    res.status(201).json({ success: true, data: referral });
  } catch (error) {
    next(error);
  }
});

// Admin endpoint to get referrals
router.get('/', protect, restrictTo('admin'), async (req, res, next) => {
  try {
    const referrals = await prisma.vendorReferral.findMany({
      orderBy: { createdAt: 'desc' }
    });
    res.status(200).json({ success: true, data: referrals });
  } catch (error) {
    next(error);
  }
});

// Admin update status endpoint
router.patch('/:id', protect, restrictTo('admin'), async (req, res, next) => {
  try {
    const { status } = req.body;
    const referral = await prisma.vendorReferral.update({
      where: { id: req.params.id },
      data: { status }
    });
    res.status(200).json({ success: true, data: referral });
  } catch (error) {
    next(error);
  }
});

router.get('/my-referrals/:referralCodeOrUserId', async (req, res, next) => {
  try {
    const { referralCodeOrUserId } = req.params;

    let referralCode = null;

    const isUUID = (str) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);

    if (isUUID(referralCodeOrUserId)) {
      // Try finding by User ID
      const user = await prisma.user.findUnique({
        where: { id: referralCodeOrUserId }
      });
      if (user) {
        referralCode = user.referralCode;
      } else {
        // Try finding by Customer ID
        const customer = await prisma.customer.findUnique({
          where: { id: referralCodeOrUserId }
        });
        if (customer) {
          referralCode = customer.referralCode;
        }
      }
    }

    // If still not found, it might be a Referral Code or Phone Number
    if (!referralCode) {
      const codeOrPhone = referralCodeOrUserId.trim();
      
      // Try finding user by referral code (case-insensitive search would be better but let's try direct first)
      const userByCode = await prisma.user.findFirst({
        where: { referralCode: { equals: codeOrPhone, mode: 'insensitive' } }
      });
      
      if (userByCode) {
        referralCode = userByCode.referralCode;
      } else {
        const customerByCode = await prisma.customer.findFirst({
          where: { referralCode: { equals: codeOrPhone, mode: 'insensitive' } }
        });
        
        if (customerByCode) {
          referralCode = customerByCode.referralCode;
        } else {
          // Try finding by phone
          const userByPhone = await prisma.user.findFirst({
            where: { mobile: codeOrPhone }
          });
          if (userByPhone) {
            referralCode = userByPhone.referralCode;
          } else {
            const custByPhone = await prisma.customer.findFirst({
              where: { phone: codeOrPhone }
            });
            if (custByPhone) {
              referralCode = custByPhone.referralCode;
            }
          }
        }
      }
    }

    if (!referralCode) {
      console.log(`[Referral API] No referral code found for: ${referralCodeOrUserId}`);
      return res.json([]);
    }

    console.log(`[Referral API] Resolved code: ${referralCode} for input: ${referralCodeOrUserId}`);

    // Find all referred vendors
    const referrals = await prisma.referral.findMany({
      where: { referrerCode: referralCode }
    });

    console.log(`[Referral API] Found ${referrals.length} referrals for code: ${referralCode}`);


    const result = await Promise.all(
      referrals.map(async (ref) => {
        const vendor = await prisma.user.findUnique({
          where: { id: ref.referredUser }
        });

        if (!vendor) return null;

        const completedOrders = await prisma.order.count({
          where: {
            vendorId: vendor.id,
            status: "completed"
          }
        });

        return {
          vendorName: vendor.name || vendor.outletName || "N/A",
          phone: vendor.mobile || "N/A",
          completedOrders,
          remainingOrders: Math.max(0, 10 - completedOrders),
          rewardEarned: ref.rewardGiven
        };
      })
    );

    res.json(result.filter(Boolean));
  } catch (err) {
    console.error('Failed to fetch referrals:', err);
    res.status(500).json({ message: "Failed to fetch referrals" });
  }
});

// Validate Referral Code (Public)
router.post('/validate', async (req, res, next) => {
  try {
    const { code, phone } = req.body;
    if (!code) {
      return res.status(400).json({ success: false, message: 'Referral code is required.' });
    }

    const { validateAndCheckReferral } = require('../utils/referral');
    const checkResult = await validateAndCheckReferral(code, phone || '');

    if (checkResult.isValid) {
      return res.json({
        success: true,
        message: 'Valid referral code! Platform fee waived.',
        referrerName: checkResult.referrer.name
      });
    } else {
      return res.status(400).json({ success: false, message: checkResult.message });
    }
  } catch (error) {
    next(error);
  }
});

module.exports = router;
