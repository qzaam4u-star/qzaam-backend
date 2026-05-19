const express = require('express');
const prisma = require('../config/prisma');

const router = express.Router();

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
