const express = require('express');
const prisma = require('../config/prisma');
const { protect, restrictTo } = require('../middlewares/auth.middleware');

const router = express.Router();

// Apply admin protection to all routes
router.use(protect, restrictTo('admin'));

/**
 * @route   GET /api/admin/reviews
 * @desc    Get all reviews with filters, pagination, and stats
 */
router.get('/', async (req, res, next) => {
  try {
    const { vendorType, rating, sort, page = 1, limit = 10 } = req.query;

    const pageInt = parseInt(page, 10);
    const limitInt = parseInt(limit, 10);
    const skip = (pageInt - 1) * limitInt;

    // 1. Build filter query
    const where = {};

    if (vendorType && vendorType !== 'all') {
      where.vendor = {
        vendorType: vendorType
      };
    }

    if (rating && rating !== 'all') {
      where.rating = parseInt(rating, 10);
    }

    // 2. Build sorting logic
    let orderBy = { createdAt: 'desc' };
    if (sort === 'lowest') {
      orderBy = { rating: 'asc' };
    } else if (sort === 'highest') {
      orderBy = { rating: 'desc' };
    }

    // 3. Fetch paginated reviews
    const reviews = await prisma.review.findMany({
      where,
      orderBy,
      skip,
      take: limitInt,
      include: {
        customer: {
          select: { id: true, name: true, phone: true }
        },
        vendor: {
          select: { id: true, name: true, outletName: true, vendorType: true }
        }
      }
    });

    const totalFiltered = await prisma.review.count({ where });

    // 4. Fetch platform-wide summary statistics (for non-hidden reviews)
    const allActiveReviews = await prisma.review.findMany({
      where: { isHidden: false },
      select: { rating: true }
    });

    const totalReviews = allActiveReviews.length;
    const avgRating = totalReviews > 0
      ? (allActiveReviews.reduce((acc, r) => acc + r.rating, 0) / totalReviews).toFixed(1)
      : '0.0';

    const foodReviewsCount = await prisma.review.count({
      where: {
        isHidden: false,
        vendor: { vendorType: 'food' }
      }
    });

    const salonReviewsCount = await prisma.review.count({
      where: {
        isHidden: false,
        vendor: { vendorType: 'salon' }
      }
    });

    const flaggedReviewsCount = await prisma.review.count({
      where: { isHidden: true }
    });

    res.status(200).json({
      success: true,
      data: {
        reviews,
        pagination: {
          total: totalFiltered,
          page: pageInt,
          limit: limitInt,
          totalPages: Math.ceil(totalFiltered / limitInt)
        },
        stats: {
          avgRating,
          totalReviews,
          foodReviews: foodReviewsCount,
          salonReviews: salonReviewsCount,
          flaggedReviews: flaggedReviewsCount
        }
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   DELETE /api/admin/reviews/:id
 * @desc    Delete a review and reset reviewGiven status in booking/order
 */
router.delete('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    const review = await prisma.review.findUnique({
      where: { id }
    });

    if (!review) {
      return res.status(404).json({ success: false, message: 'Review not found' });
    }

    // Reset reviewGiven flag
    if (review.orderId) {
      await prisma.order.update({
        where: { id: review.orderId },
        data: { reviewGiven: false }
      }).catch(err => console.error('Failed to reset order reviewGiven flag:', err));
    } else if (review.bookingId) {
      await prisma.booking.update({
        where: { id: review.bookingId },
        data: { reviewGiven: false }
      }).catch(err => console.error('Failed to reset booking reviewGiven flag:', err));
    }

    await prisma.review.delete({
      where: { id }
    });

    res.status(200).json({
      success: true,
      message: 'Review successfully deleted'
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   PATCH /api/admin/reviews/:id/hide
 * @desc    Toggle isHidden field for a review (Hide/Unhide review)
 */
router.patch('/:id/hide', async (req, res, next) => {
  try {
    const { id } = req.params;

    const review = await prisma.review.findUnique({
      where: { id }
    });

    if (!review) {
      return res.status(404).json({ success: false, message: 'Review not found' });
    }

    const updatedReview = await prisma.review.update({
      where: { id },
      data: { isHidden: !review.isHidden },
      include: {
        customer: { select: { name: true } },
        vendor: { select: { name: true, outletName: true } }
      }
    });

    res.status(200).json({
      success: true,
      message: `Review successfully ${updatedReview.isHidden ? 'hidden' : 'unhidden'}`,
      data: updatedReview
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
