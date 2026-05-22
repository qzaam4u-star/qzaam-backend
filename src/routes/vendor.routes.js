const express = require('express');
const { protect, restrictTo } = require('../middlewares/auth.middleware');
const prisma = require('../config/prisma');

const router = express.Router();

router.get('/generate-qr', protect, restrictTo('vendor'), async (req, res) => {
  const vendorId = req.user.id;
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
  const menuUrl = `${frontendUrl}/menu?vendorId=${vendorId}`;
  const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(menuUrl)}`;
  
  res.status(200).json({
    success: true,
    data: {
      qrUrl: qrImageUrl,
      menuUrl: menuUrl
    }
  });
});

// GET /vendor/profile — returns full vendor profile including vendorType
router.get('/profile', protect, restrictTo('vendor'), async (req, res, next) => {
  try {
    const vendor = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        name: true,
        email: true,
        mobile: true,
        outletName: true,
        address: true,
        averagePrepTime: true,
        role: true,
        vendorType: true,
        slotDuration: true,
        maxOrdersPerSlot: true,
        openingTime: true,
        closingTime: true,
        slotEnabled: true,
        referralCode: true,
        isApproved: true,
        createdAt: true
      }
    });
    res.json({ success: true, data: vendor });
  } catch (error) {
    next(error);
  }
});

router.patch('/profile', protect, restrictTo('vendor'), async (req, res, next) => {
  try {
    const { 
      slotDuration, maxOrdersPerSlot, openingTime, closingTime, slotEnabled,
      outletName, mobile, email, address, city, state, pincode, gstNumber, storeDescription, averagePrepTime, profileImage,
      accountHolderName, bankName, accountNumber, ifscCode, upiId, branchName
    } = req.body;
    
    const updated = await prisma.user.update({
      where: { id: req.user.id },
      data: {
        slotDuration: slotDuration !== undefined ? parseInt(slotDuration) : undefined,
        maxOrdersPerSlot: maxOrdersPerSlot !== undefined ? parseInt(maxOrdersPerSlot) : undefined,
        openingTime,
        closingTime,
        slotEnabled,
        outletName, 
        mobile, 
        email, 
        address, 
        city, 
        state, 
        pincode, 
        gstNumber, 
        storeDescription, 
        averagePrepTime: averagePrepTime !== undefined ? parseInt(averagePrepTime) : undefined, 
        profileImage,
        accountHolderName, 
        bankName, 
        accountNumber, 
        ifscCode, 
        upiId, 
        branchName
      }
    });
    res.json({ success: true, data: updated });
  } catch (error) {
    next(error);
  }
});


// GET /vendor/stylists — returns all stylists for the vendor
router.get('/stylists', protect, restrictTo('vendor'), async (req, res, next) => {
  try {
    const stylists = await prisma.stylist.findMany({
      where: { vendorId: req.user.id }
    });
    res.json({ success: true, data: stylists });
  } catch (error) {
    next(error);
  }
});

// POST /vendor/stylists — add a new stylist
router.post('/stylists', protect, restrictTo('vendor'), async (req, res, next) => {
  try {
    const { name } = req.body;
    const stylist = await prisma.stylist.create({
      data: {
        name,
        vendorId: req.user.id
      }
    });
    res.json({ success: true, data: stylist });
  } catch (error) {
    next(error);
  }
});

// DELETE /vendor/stylists/:id — delete a stylist
router.delete('/stylists/:id', protect, restrictTo('vendor'), async (req, res, next) => {
  try {
    const { id } = req.params;
    
    // Check for active bookings assigned to this stylist
    const activeBookings = await prisma.booking.findFirst({
      where: {
        stylistId: id,
        status: { notIn: ['completed', 'cancelled'] }
      }
    });

    if (activeBookings) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete stylist with active bookings. Reassign or complete upcoming bookings first.'
      });
    }

    // Attempt to delete (ensuring vendorId match for security)
    const deleted = await prisma.stylist.deleteMany({
      where: {
        id,
        vendorId: req.user.id
      }
    });

    if (deleted.count === 0) {
      return res.status(404).json({
        success: false,
        message: 'Stylist not found or unauthorized'
      });
    }

    res.json({ success: true, message: 'Stylist deleted successfully' });
  } catch (error) {
    next(error);
  }
});



/**
 * @route   GET /api/vendor/reviews
 * @desc    Get all reviews for the authenticated vendor with customer & order/booking details
 * @access  Vendor only (JWT required)
 */
router.get('/reviews', protect, restrictTo('vendor'), async (req, res, next) => {
  try {
    const vendorId = req.user.id;

    const reviews = await prisma.review.findMany({
      where: { vendorId, isHidden: false },
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: {
        customer: {
          select: { name: true, phone: true }
        },
        order: {
          select: {
            id: true,
            totalAmount: true,
            status: true,
            items: true,
            createdAt: true
          }
        },
        booking: {
          select: {
            id: true,
            totalAmount: true,
            status: true,
            services: true,
            slotTime: true,
            stylist: { select: { name: true } }
          }
        }
      }
    });

    // Compute summary stats
    const total = reviews.length;
    const avgRating = total > 0
      ? (reviews.reduce((acc, r) => acc + r.rating, 0) / total).toFixed(1)
      : '0.0';
    const positive = reviews.filter(r => r.rating >= 4).length;
    const positivePercent = total > 0 ? Math.round((positive / total) * 100) : 0;
    const ratedOrders = reviews.filter(r => !!r.orderId).length;
    const ratedBookings = reviews.filter(r => !!r.bookingId).length;

    res.json({
      success: true,
      data: {
        reviews,
        summary: {
          total,
          avgRating,
          positivePercent,
          ratedOrders,
          ratedBookings
        }
      }
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
