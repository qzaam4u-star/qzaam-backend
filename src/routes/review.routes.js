const express = require('express');
const prisma = require('../config/prisma');

const router = express.Router();

// 1. Create a review
router.post('/', async (req, res, next) => {
  try {
    const { orderId, rating, comment, customerPhone } = req.body;

    if (!orderId || !rating || !customerPhone) {
      return res.status(400).json({ success: false, message: 'All required review fields must be provided.' });
    }

    const customer = await prisma.customer.findUnique({
      where: { phone: customerPhone }
    });

    if (!customer) {
      return res.status(404).json({ success: false, message: 'Customer not found.' });
    }

    const order = await prisma.order.findUnique({
      where: { id: orderId }
    });

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found.' });
    }

    // Prevent duplicate reviews
    const existing = await prisma.review.findFirst({
      where: { orderId }
    });

    if (existing) {
      return res.status(400).json({ success: false, message: 'Already reviewed' });
    }

    const review = await prisma.review.create({
      data: {
        rating: parseInt(rating, 10),
        comment,
        customerId: customer.id,
        vendorId: order.vendorId,
        orderId
      }
    });

    // Update order to indicate review has been given
    await prisma.order.update({
      where: { id: orderId },
      data: { reviewGiven: true }
    });

    res.status(201).json({ success: true, data: review });
  } catch (error) {
    next(error);
  }
});

// 1.5 Create a review for a booking
router.post('/booking', async (req, res, next) => {
  try {
    const { bookingId, rating, comment, customerPhone } = req.body;

    if (!bookingId || !rating || !customerPhone) {
      return res.status(400).json({ success: false, message: 'All required review fields must be provided.' });
    }

    const customer = await prisma.customer.findUnique({
      where: { phone: customerPhone }
    });

    if (!customer) {
      return res.status(404).json({ success: false, message: 'Customer not found.' });
    }

    const booking = await prisma.booking.findUnique({
      where: { id: bookingId }
    });

    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found.' });
    }

    // Prevent duplicate reviews
    const existing = await prisma.review.findFirst({
      where: { bookingId }
    });

    if (existing) {
      return res.status(400).json({ success: false, message: 'Already reviewed' });
    }

    const review = await prisma.review.create({
      data: {
        rating: parseInt(rating, 10),
        comment,
        customerId: customer.id,
        vendorId: booking.vendorId,
        bookingId
      }
    });

    // Update booking to indicate review has been given
    await prisma.booking.update({
      where: { id: bookingId },
      data: { reviewGiven: true }
    });

    res.status(201).json({ success: true, data: review });
  } catch (error) {
    next(error);
  }
});

// 2. Get vendor average rating
router.get('/vendor/:vendorId', async (req, res, next) => {
  try {
    const { vendorId } = req.params;

    const reviews = await prisma.review.findMany({
      where: { vendorId }
    });

    const avg =
      reviews.reduce((acc, r) => acc + r.rating, 0) /
      (reviews.length || 1);

    res.status(200).json({
      success: true,
      avgRating: reviews.length ? avg.toFixed(1) : "0.0",
      totalReviews: reviews.length
    });
  } catch (error) {
    next(error);
  }
});

// 3. Get vendor reviews list (for display)
router.get('/list/:vendorId', async (req, res, next) => {
  try {
    const { vendorId } = req.params;
    const reviews = await prisma.review.findMany({
      where: { vendorId },
      orderBy: { createdAt: 'desc' },
      take: 10,
      include: {
        customer: { select: { name: true } }
      }
    });
    res.json({ success: true, data: reviews });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
