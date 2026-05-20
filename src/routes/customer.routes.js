const express = require('express');
const prisma = require('../config/prisma');

const router = express.Router();

router.post('/login', async (req, res, next) => {
  try {
    const { name, phone } = req.body;
    if (!phone) {
      return res.status(400).json({ success: false, message: 'Phone number is required' });
    }
    if (!/^\d{10}$/.test(phone)) {
      return res.status(400).json({ success: false, message: 'Invalid 10-digit phone number' });
    }

    // Check if the phone number belongs to a vendor
    const existingVendor = await prisma.user.findFirst({
      where: { mobile: phone, role: 'vendor' }
    });
    if (existingVendor) {
      return res.status(400).json({
        success: false,
        message: "This number is already registered as a vendor. Please login as vendor."
      });
    }

    let customer = await prisma.customer.findUnique({
      where: { phone },
      include: { wallet: true }
    });

    const finalName = name?.trim() || 'Guest';

    if (!customer) {
      const { generateCustomerReferralCode } = require('../utils/referral');
      customer = await prisma.customer.create({
        data: {
          name: finalName,
          phone,
          referralCode: generateCustomerReferralCode(),
          wallet: {
            create: { balance: 0.0 }
          }
        },
        include: { wallet: true }
      });
    } else {
      // If a name was provided and it differs from the existing name, update it
      if (name && name.trim() && customer.name !== finalName) {
        customer = await prisma.customer.update({
          where: { phone },
          data: { name: finalName },
          include: { wallet: true }
        });
      }
    }

    res.json({
      success: true,
      message: 'Customer logged in successfully',
      data: customer
    });
  } catch (error) {
    next(error);
  }
});

router.post('/orders', async (req, res, next) => {
  try {
    const { phone } = req.body;

    if (!phone) {
      return res.status(400).json({ success: false, message: 'Phone number is required' });
    }

    const existingVendor = await prisma.user.findFirst({
      where: { mobile: phone, role: 'vendor' }
    });
    if (existingVendor) {
      return res.status(400).json({
        success: false,
        message: "This number is already registered as a vendor. Please login as vendor."
      });
    }

    const orders = await prisma.order.findMany({
      where: { customerPhone: phone },
      orderBy: { createdAt: 'desc' }
    });

    res.json({ success: true, data: orders });
  } catch (error) {
    next(error);
  }
});

router.get('/orders', async (req, res, next) => {
  try {
    const { phone } = req.query;

    if (!phone) {
      return res.status(400).json({ success: false, message: 'Phone number is required' });
    }

    const existingVendor = await prisma.user.findFirst({
      where: { mobile: phone, role: 'vendor' }
    });
    if (existingVendor) {
      return res.status(400).json({
        success: false,
        message: "This number is already registered as a vendor. Please login as vendor."
      });
    }

    const orders = await prisma.order.findMany({
      where: { customerPhone: phone },
      orderBy: { createdAt: 'desc' }
    });

    res.json({ success: true, data: orders });
  } catch (error) {
    next(error);
  }
});

router.get('/profile', async (req, res, next) => {
  try {
    const { phone } = req.query;

    if (!phone) {
      return res.status(400).json({ success: false, message: 'Phone number is required' });
    }

    const existingVendor = await prisma.user.findFirst({
      where: { mobile: phone, role: 'vendor' }
    });
    if (existingVendor) {
      return res.status(400).json({
        success: false,
        message: "This number is already registered as a vendor. Please login as vendor."
      });
    }

    const customer = await prisma.customer.findUnique({
      where: { phone }
    });

    res.json({ success: true, data: customer });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
