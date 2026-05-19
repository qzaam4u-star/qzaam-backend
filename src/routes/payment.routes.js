const express = require('express');
const Razorpay = require('razorpay');
const crypto = require('crypto');
const prisma = require('../config/prisma');
const { generateVendorToken } = require('../services/token.service');
const { calculateOrderTotals } = require('../utils/orderCalculator');

const router = express.Router();
const { protect } = require('../middlewares/auth.middleware');


const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID || 'rzp_test_SkrpjWAPFjMaX5',
  key_secret: process.env.RAZORPAY_KEY_SECRET || 'I0WqwO5V20ZJnBvm9VfyKMcG'
});

// 🔹 Create Razorpay Order (Only for platformFee)
router.post('/create-order', async (req, res, next) => {
  try {
    const { amount } = req.body;
    if (!amount) {
      return res.status(400).json({ message: 'Amount is required' });
    }

    const order = await razorpay.orders.create({
      amount: Math.round(amount * 100), // convert to paisa
      currency: 'INR'
    });

    res.json(order);
  } catch (err) {
    console.error('Razorpay order creation failed:', err);
    res.status(500).json({ message: 'Payment order creation failed', error: err.message });
  }
});

// 🔹 Verify Payment and Create DB Order
router.post('/verify', async (req, res, next) => {
  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      orderData
    } = req.body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature || !orderData) {
      return res.status(400).json({ message: 'Missing parameters' });
    }

    const body = razorpay_order_id + '|' + razorpay_payment_id;
    const keySecret = process.env.RAZORPAY_KEY_SECRET || 'I0WqwO5V20ZJnBvm9VfyKMcG';

    const expectedSignature = crypto
      .createHmac('sha256', keySecret)
      .update(body)
      .digest('hex');

    if (expectedSignature !== razorpay_signature) {
      return res.status(400).json({ message: 'Payment verification failed' });
    }

    // Check if Vendor ID is missing
    if (!orderData.vendorId) {
      return res.status(400).json({ message: 'Vendor ID missing' });
    }

    const { customerName, customerPhone, vendorId, totalAmount } = orderData;
    
    // RE-CALCULATE totals on backend for security and consistency
    const vendorForTotals = await prisma.user.findUnique({
      where: { id: vendorId },
      select: { hasGst: true, vendorType: true }
    });

    const totals = calculateOrderTotals({
      subtotal: totalAmount,
      hasGst: vendorForTotals?.hasGst || false,
      vendorType: vendorForTotals?.vendorType || orderData.type || 'food'
    });

    console.log('[DEBUG] Payment Verify - Calculated Totals:', totals);

    // Check if phone belongs to a vendor
    const existingVendor = await prisma.user.findFirst({
      where: { mobile: customerPhone, role: 'vendor' }
    });
    if (existingVendor) {
      return res.status(400).json({
        success: false,
        message: 'This number is already registered as a vendor. Please login as vendor.'
      });
    }

    // Find or create customer by phone
    let customer = await prisma.customer.findUnique({ where: { phone: customerPhone } });
    if (!customer) {
      const { generateReferralCode } = require('../utils/referral');
      customer = await prisma.customer.create({
        data: { 
          name: customerName, 
          phone: customerPhone, 
          referralCode: generateReferralCode(),
          wallet: { create: { balance: 0.0 } }
        }
      });
    } else if (customer.name !== customerName) {
      customer = await prisma.customer.update({
        where: { phone: customerPhone },
        data: { name: customerName }
      });
    }

    // const token = await generateVendorToken(vendorId); // REMOVED: Manual token assignment now


    // 🔀 Branch: Salon Booking vs Food Order
    if (orderData.type === 'salon') {
      const { services, slotTime, stylistId, stylistPreference } = orderData;
      const slotDateTime = new Date(slotTime);

      // Calculate total service duration
      const totalDuration = (services || []).reduce((sum, s) => sum + (s.duration || 30), 0);
      const slotEndTime = new Date(slotDateTime.getTime() + totalDuration * 60000);

      // Validate: no overlapping bookings in the required time range for this vendor slot
      const overlapCount = await prisma.booking.count({
        where: {
          vendorId,
          status: { not: 'cancelled' },
          slotTime: { lt: slotEndTime },
          OR: [
            { slotEndTime: null, slotTime: { gte: slotDateTime } },
            { slotEndTime: { gt: slotDateTime } }
          ]
        }
      });

      if (overlapCount > 0) {
        return res.status(409).json({ success: false, message: 'One or more required time slots are already taken. Please choose a different time.' });
      }

      // Stylist-specific overlap check
      if (stylistPreference === 'specific' && stylistId) {
        const stylistOverlap = await prisma.booking.count({
          where: {
            vendorId,
            stylistId,
            status: { not: 'cancelled' },
            slotTime: { lt: slotEndTime },
            OR: [
              { slotEndTime: null, slotTime: { gte: slotDateTime } },
              { slotEndTime: { gt: slotDateTime } }
            ]
          }
        });

        if (stylistOverlap >= 1) {
          return res.status(409).json({ success: false, message: 'This stylist is not available for the full duration. Please choose another stylist or time.' });
        }
      }

      const booking = await prisma.booking.create({
        data: {
          customerName,
          customerPhone,
          customerId: customer.id,
          vendorId,
          services,
          totalAmount: totals.subtotal,
          platformFee: totals.platformFee,
          finalAmount: totals.finalTotal,
          slotTime: slotDateTime,
          slotEndTime,
          totalDuration,
          status: 'placed',
          paymentMethod: 'razorpay',
          paymentStatus: 'paid',
          tokenNumber: null,
          tokenIndex: null,
          stylistId: stylistPreference === 'anyone' ? null : stylistId,
          stylistPreference: stylistPreference || 'specific',
          type: 'salon'
        }
      });

      return res.json({ success: true, booking, type: 'salon' });
    }


    // 🍔 Food Order (existing logic)
    const { items, deliveryTime, scheduledDate, scheduledSlot, slotDateTime } = orderData;
    
    // Fetch vendor for prep time
    const vendor = await prisma.user.findUnique({
      where: { id: vendorId },
      select: { averagePrepTime: true }
    });

    const isScheduled = !!slotDateTime;
    const now = new Date();
    let status = 'live';
    let isActivated = true;
    let activationTime = null;
    let activatedAt = now;
    let expiresAt = new Date(now.getTime() + 5 * 60 * 1000);

    if (isScheduled) {
      const scheduledTime = new Date(slotDateTime);
      const prepTime = vendor?.averagePrepTime || 10;
      const cutOffTime = new Date(scheduledTime.getTime() - prepTime * 60 * 1000);

      if (now > cutOffTime) {
        return res.status(400).json({ success: false, message: 'This slot is no longer available. Please choose a later time.' });
      }

      activationTime = new Date(scheduledTime.getTime() - prepTime * 60 * 1000);
      
      // If activation time is in the past, activate immediately
      if (activationTime <= now) {
        status = 'live';
        isActivated = true;
        activatedAt = now;
      } else {
        status = 'upcoming';
        isActivated = false;
        activatedAt = null;
        expiresAt = null; // Auto-cancel starts only after activation
      }
    }

    const createdOrder = await prisma.order.create({
      data: {
        customerName,
        customerPhone,
        customerId: customer.id,
        vendorId,
        items,
        totalAmount: totals.subtotal,
        platformFee: totals.platformFee,
        finalAmount: totals.finalTotal,
        status,
        paymentMethod: 'razorpay',
        paymentStatus: 'paid',
        deliveryTime: deliveryTime || 'ASAP',
        expiresAt,
        tokenNumber: null,
        tokenIndex: null,
        scheduledDate,
        scheduledSlot,
        slotDateTime: slotDateTime ? new Date(slotDateTime) : null,
        scheduledTime: slotDateTime ? new Date(slotDateTime) : null,
        activationTime,
        isActivated,
        activatedAt
      }
    });


    res.json({
      success: true,
      order: createdOrder
    });
  } catch (error) {
    console.error('Payment verification or order creation failed:', error);
    next(error);
  }
});

// 🔹 Get Wallet Balance
router.get('/wallet-balance', async (req, res, next) => {
  try {
    const { phone } = req.query;
    if (!phone) {
      return res.status(400).json({ message: 'Phone number is required' });
    }
    // Also check the user table to see if a vendor has that phone/mobile number
    let vendor = await prisma.user.findFirst({
      where: { mobile: phone },
      include: { wallet: true }
    });

    if (vendor) {
      if (!vendor.wallet) {
        const wallet = await prisma.wallet.create({
          data: {
            userId: vendor.id,
            balance: 500.0
          }
        });
        return res.json({ balance: wallet.balance, customerId: vendor.id, referralCode: vendor.referralCode });
      }
      return res.json({ balance: vendor.wallet.balance, customerId: vendor.id, referralCode: vendor.referralCode });
    }

    let customer = await prisma.customer.findUnique({
      where: { phone },
      include: { wallet: true }
    });

    // If customer doesn't exist, create it on demand so they have a wallet!
    if (!customer) {
      const { generateReferralCode } = require('../utils/referral');
      customer = await prisma.customer.create({
        data: { name: 'Guest', phone, referralCode: generateReferralCode() },
        include: { wallet: true }
      });
    }

    // If customer exists but no referral code, create one on the fly!
    if (customer && !customer.referralCode) {
      const { generateReferralCode } = require('../utils/referral');
      customer = await prisma.customer.update({
        where: { id: customer.id },
        data: { referralCode: generateReferralCode() },
        include: { wallet: true }
      });
    }

    // If customer exists but no wallet, create on the fly with 500 default balance!
    if (!customer.wallet) {
      const wallet = await prisma.wallet.create({
        data: {
          customerId: customer.id,
          balance: 500.0
        }
      });
      return res.json({ balance: wallet.balance, customerId: customer.id, referralCode: customer.referralCode });
    }

    res.json({ balance: customer.wallet.balance, customerId: customer.id, referralCode: customer.referralCode });
  } catch (err) {
    next(err);
  }
});

// 🔹 Pay With Wallet
const clientOrderIdCache = new Map();

router.post('/wallet-pay', async (req, res, next) => {
  try {
    const { userId, amount, commissionAmount, orderData } = req.body;
    const { vendorId } = orderData;

    // RE-CALCULATE totals on backend
    const vendorForTotals = await prisma.user.findUnique({
      where: { id: vendorId },
      select: { hasGst: true, vendorType: true }
    });

    const totals = calculateOrderTotals({
      subtotal: parseFloat(orderData.totalAmount),
      hasGst: vendorForTotals?.hasGst || false,
      vendorType: vendorForTotals?.vendorType || orderData.type || 'food'
    });

    console.log('[DEBUG] Wallet Pay - Calculated Totals:', totals);
    const finalCommission = totals.platformFee; 

    let wallet = await prisma.wallet.findUnique({
      where: { customerId: userId }
    });

    if (!wallet) {
      wallet = await prisma.wallet.findUnique({
        where: { userId: userId }
      });
    }

    if (!wallet) {
      return res.status(400).json({ message: 'Wallet not found' });
    }

    if (wallet.balance < finalCommission) {
      return res.status(400).json({ message: 'Insufficient wallet balance' });
    }

    // 🔒 Prevent duplicate requests
    if (orderData?.clientOrderId) {
      if (clientOrderIdCache.has(orderData.clientOrderId)) {
        return res.json({ success: true, order: clientOrderIdCache.get(orderData.clientOrderId) });
      }
    }
    const recentOrder = await prisma.order.findFirst({
      where: {
        customerId: userId,
        vendorId: orderData.vendorId,
        createdAt: {
          gte: new Date(Date.now() - 3000)
        }
      }
    });
    if (recentOrder) {
      return res.json({ success: true, order: recentOrder });
    }

    // 🍔 Pre-validation for Slots/Stylists before wallet deduction
    const vendor = await prisma.user.findUnique({
      where: { id: vendorId },
      select: { averagePrepTime: true, vendorType: true }
    });

    if (orderData.type === 'salon') {
      const { services, slotTime, stylistId, stylistPreference } = orderData;
      const slotDateTime = new Date(slotTime);
      const totalDuration = (services || []).reduce((sum, s) => sum + (s.duration || 30), 0);
      const slotEndTime = new Date(slotDateTime.getTime() + totalDuration * 60000);

      // Overlap check for entire duration range
      const overlapCount = await prisma.booking.count({
        where: {
          vendorId,
          status: { not: 'cancelled' },
          slotTime: { lt: slotEndTime },
          OR: [
            { slotEndTime: null, slotTime: { gte: slotDateTime } },
            { slotEndTime: { gt: slotDateTime } }
          ]
        }
      });
      if (overlapCount > 0) {
        return res.status(409).json({ success: false, message: 'One or more required time slots are already taken. Please choose a different time.' });
      }

      if (stylistPreference === 'specific' && stylistId) {
        const stylistOverlap = await prisma.booking.count({
          where: {
            vendorId,
            stylistId,
            status: { not: 'cancelled' },
            slotTime: { lt: slotEndTime },
            OR: [
              { slotEndTime: null, slotTime: { gte: slotDateTime } },
              { slotEndTime: { gt: slotDateTime } }
            ]
          }
        });
        if (stylistOverlap >= 1) {
          return res.status(409).json({ success: false, message: 'This stylist is not available for the full duration. Please choose another stylist or time.' });
        }
      }
    } else {
      // Food Order Validation
      const { slotDateTime } = orderData;
      if (slotDateTime) {
        const now = new Date();
        const scheduledTime = new Date(slotDateTime);
        const prepTime = vendor?.averagePrepTime || 10;
        const cutOffTime = new Date(scheduledTime.getTime() - prepTime * 60 * 1000);
        if (now > cutOffTime) {
          return res.status(400).json({ success: false, message: 'This slot is no longer available. Please choose a later time.' });
        }
      }
    }

    // Deduct wallet balance
    await prisma.wallet.update({
      where: { id: wallet.id },
      data: { balance: { decrement: finalCommission } }
    });

    await prisma.walletTransaction.create({
      data: {
        walletId: wallet.id,
        amount: finalCommission,
        type: 'debit',
        source: 'order'
      }
    });

    const { customerName, customerPhone, totalAmount, platformFee, finalAmount } = orderData;
    // const token = await generateVendorToken(vendorId); // REMOVED


    // 🔀 Branch: Salon Booking vs Food Order
    if (orderData.type === 'salon') {
      const { services, slotTime, stylistId, stylistPreference } = orderData;
      const slotDateTime = new Date(slotTime);
      const totalDuration = (services || []).reduce((sum, s) => sum + (s.duration || 30), 0);
      const slotEndTime = new Date(slotDateTime.getTime() + totalDuration * 60000);

      const booking = await prisma.booking.create({
        data: {
          customerName, customerPhone, customerId: userId, vendorId,
          services, totalAmount: totals.subtotal,
          platformFee: totals.platformFee,
          finalAmount: totals.finalTotal,
          slotTime: slotDateTime, slotEndTime, totalDuration,
          status: 'placed',
          paymentMethod: 'wallet', paymentStatus: 'paid',
          tokenNumber: null, tokenIndex: null,
          stylistId: stylistPreference === 'anyone' ? null : stylistId,
          stylistPreference: stylistPreference || 'specific',
          type: 'salon'
        }
      });

      return res.json({ success: true, booking, type: 'salon' });
    }

    // 🍔 Food Order
    const { items, deliveryTime, scheduledDate, scheduledSlot, slotDateTime } = orderData;
    
    const isScheduled = !!slotDateTime;
    const now = new Date();
    let status = 'live';
    let isActivated = true;
    let activationTime = null;
    let activatedAt = now;
    let expiresAt = new Date(now.getTime() + 5 * 60 * 1000);

    if (isScheduled) {
      const scheduledTime = new Date(slotDateTime);
      const prepTime = vendor?.averagePrepTime || 10;
      activationTime = new Date(scheduledTime.getTime() - prepTime * 60 * 1000);
      
      if (activationTime <= now) {
        status = 'live';
        isActivated = true;
        activatedAt = now;
      } else {
        status = 'upcoming';
        isActivated = false;
        activatedAt = null;
        expiresAt = null;
      }
    }

    const createdOrder = await prisma.order.create({
      data: {
        customerName, customerPhone, customerId: userId, vendorId,
        items, totalAmount: totals.subtotal,
        platformFee: totals.platformFee,
        finalAmount: totals.finalTotal,
        status, paymentMethod: 'wallet', paymentStatus: 'paid',
        deliveryTime: deliveryTime || 'ASAP', expiresAt,
        tokenNumber: null, tokenIndex: null,
        scheduledDate,
        scheduledSlot,
        slotDateTime: slotDateTime ? new Date(slotDateTime) : null,
        scheduledTime: slotDateTime ? new Date(slotDateTime) : null,
        activationTime,
        isActivated,
        activatedAt
      }
    });


    if (orderData?.clientOrderId) {
      clientOrderIdCache.set(orderData.clientOrderId, createdOrder);
      if (clientOrderIdCache.size > 1000) {
        const keys = Array.from(clientOrderIdCache.keys());
        clientOrderIdCache.delete(keys[0]);
      }
    }

    res.json({ success: true, order: createdOrder });
  } catch (error) {
    console.error('Wallet payment failed:', error);
    res.status(500).json({ message: 'Wallet payment failed' });
  }
});


// 🔹 Secure Wallet Top-up (Razorpay)
router.post('/topup/create-order', async (req, res) => {
  try {
    const { amount } = req.body;
    if (!amount || amount <= 0) {
      return res.status(400).json({ message: 'Invalid amount' });
    }

    const order = await razorpay.orders.create({
      amount: Math.round(amount * 100), // paisa
      currency: 'INR'
    });

    res.json(order);
  } catch (err) {
    console.error('Top-up order creation failed:', err);
    res.status(500).json({ message: 'Top-up order creation failed' });
  }
});

router.post('/topup/verify', async (req, res) => {
  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      amount,
      phone
    } = req.body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature || !amount || !phone) {
      return res.status(400).json({ message: 'Missing parameters' });
    }

    const body = razorpay_order_id + "|" + razorpay_payment_id;
    const keySecret = process.env.RAZORPAY_KEY_SECRET || 'I0WqwO5V20ZJnBvm9VfyKMcG';

    const expectedSignature = crypto
      .createHmac('sha256', keySecret)
      .update(body)
      .digest('hex');

    if (expectedSignature !== razorpay_signature) {
      return res.status(400).json({ message: 'Payment verification failed' });
    }

    // ✅ WALLET UPDATE
    // Check if it's a vendor first
    const vendor = await prisma.user.findFirst({
      where: { mobile: phone },
      include: { wallet: true }
    });

    let wallet;
    if (vendor) {
      if (!vendor.wallet) {
        wallet = await prisma.wallet.create({
          data: { userId: vendor.id, balance: 500.0 + parseFloat(amount) }
        });
      } else {
        wallet = await prisma.wallet.update({
          where: { userId: vendor.id },
          data: { balance: { increment: parseFloat(amount) } }
        });
      }
    } else {
      // It's a customer
      let customer = await prisma.customer.findUnique({
        where: { phone },
        include: { wallet: true }
      });

      if (!customer) {
        const { generateReferralCode } = require('../utils/referral');
        customer = await prisma.customer.create({
          data: { name: 'Guest', phone, referralCode: generateReferralCode() },
          include: { wallet: true }
        });
      }

      if (!customer.wallet) {
        wallet = await prisma.wallet.create({
          data: { customerId: customer.id, balance: 500.0 + parseFloat(amount) }
        });
      } else {
        wallet = await prisma.wallet.update({
          where: { customerId: customer.id },
          data: { balance: { increment: parseFloat(amount) } }
        });
      }
    }

    await prisma.walletTransaction.create({
      data: {
        walletId: wallet.id,
        amount: parseFloat(amount),
        type: 'credit',
        source: 'topup'
      }
    });

    res.json({ success: true, balance: wallet.balance });

  } catch (err) {
    console.error('Top-up verification failed:', err);
    res.status(500).json({ message: 'Top-up failed' });
  }
});

// 🔹 Old Wallet Top-up (keeping for fallback if needed, but not used by new frontend)
router.post('/wallet-topup', async (req, res, next) => {

  try {
    const { phone, amount } = req.body;
    if (!phone || !amount) {
      return res.status(400).json({ message: 'Missing parameters' });
    }

    let customer = await prisma.customer.findUnique({
      where: { phone },
      include: { wallet: true }
    });

    if (!customer) {
      const { generateReferralCode } = require('../utils/referral');
      customer = await prisma.customer.create({
        data: { name: 'Guest', phone, referralCode: generateReferralCode() },
        include: { wallet: true }
      });
    }

    let wallet = customer.wallet;
    if (!wallet) {
      wallet = await prisma.wallet.create({
        data: {
          customerId: customer.id,
          balance: 500.0 + parseFloat(amount)
        }
      });
    } else {
      wallet = await prisma.wallet.update({
        where: { customerId: customer.id },
        data: {
          balance: {
            increment: parseFloat(amount)
          }
        }
      });
    }

    res.json({ success: true, balance: wallet.balance });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
