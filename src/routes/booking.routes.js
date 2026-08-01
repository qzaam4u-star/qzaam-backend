const express = require('express');
const prisma = require('../config/prisma');
const { protect, restrictTo } = require('../middlewares/auth.middleware');
const { getISTDayBounds, formatTimeInIndia } = require('../utils/timezone');

const router = express.Router();

// GET /bookings/vendor/:vendorId/booked-slots — fetch taken slot ranges for a date
router.get('/vendor/:vendorId/booked-slots', async (req, res, next) => {
  try {
    const { date } = req.query;
    if (!date) return res.status(400).json({ success: false, message: 'Date required' });

    const { startOfDay: startDate, endOfDay: endDate } = getISTDayBounds(date);

    const bookings = await prisma.booking.findMany({
      where: {
        vendorId: req.params.vendorId,
        slotTime: {
          gte: startDate,
          lte: endDate
        },
        status: { not: 'cancelled' }
      },
      select: { slotTime: true, slotEndTime: true, stylistId: true }
    });

    // Return full ranges so frontend can compute which intermediate slots are blocked
    const bookedRanges = bookings.map(b => {
      const start = new Date(b.slotTime);
      const end = b.slotEndTime ? new Date(b.slotEndTime) : new Date(b.slotTime.getTime() + 30 * 60000);
      return {
        startTime: formatTimeInIndia(start),
        endTime: formatTimeInIndia(end),
        stylistId: b.stylistId || null
      };
    });

    res.json({ success: true, data: bookedRanges });
  } catch (error) {
    next(error);
  }
});


// GET /bookings/vendor — vendor's bookings (protected)
router.get('/vendor', protect, restrictTo('vendor'), async (req, res, next) => {
  try {
    const bookings = await prisma.booking.findMany({
      where: { vendorId: req.user.id },
      include: { stylist: true },
      orderBy: { slotTime: 'asc' }
    });
    res.json({ success: true, data: bookings });
  } catch (error) {
    next(error);
  }
});

// GET /bookings/:id — public tracking
router.get('/:id', async (req, res, next) => {
  try {
    const booking = await prisma.booking.findUnique({
      where: { id: req.params.id },
      include: {
        vendor: {
          select: { mobile: true, outletName: true, name: true }
        },
        stylist: true
      }
    });
    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }
    res.json({ success: true, data: booking });
  } catch (error) {
    next(error);
  }
});

// POST /bookings/customer-action — customer notifies vendor (public)
router.post('/customer-action', async (req, res, next) => {
  try {
    const { bookingId, action, delayMinutes } = req.body;
    const validActions = ['coming', 'delayed', 'contact'];
    if (!validActions.includes(action)) {
      return res.status(400).json({ success: false, message: 'Invalid action' });
    }
    const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }

    const updateData = { customerAction: action };
    
    if (action === 'delayed') {
      updateData.customerDelayMinutes = delayMinutes ? parseInt(delayMinutes) : 5;
      updateData.customerDelayUpdatedAt = new Date();
    } else {
      updateData.customerDelayMinutes = null;
      updateData.customerDelayUpdatedAt = null;
    }

    const updated = await prisma.booking.update({
      where: { id: bookingId },
      data: updateData
    });
    res.json({ success: true, data: updated });
  } catch (error) {
    next(error);
  }
});

// PATCH /bookings/:id/cancel — customer cancel (before slot time)
router.patch('/:id/cancel', async (req, res, next) => {
  try {
    const booking = await prisma.booking.findUnique({ where: { id: req.params.id } });
    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }
    if (booking.status !== 'placed') {
      return res.status(400).json({ success: false, message: 'Cannot cancel after booking is accepted or processed' });
    }
    if (new Date() >= new Date(booking.slotTime)) {
      return res.status(400).json({ success: false, message: 'Cannot cancel after service time' });
    }
    const updated = await prisma.booking.update({
      where: { id: req.params.id },
      data: { status: 'cancelled' }
    });
    res.json({ success: true, data: updated });
  } catch (error) {
    next(error);
  }
});

// PATCH /bookings/:id/arrived — customer marking arrival
router.patch('/:id/arrived', async (req, res, next) => {
  try {
    const updated = await prisma.booking.update({
      where: { id: req.params.id },
      data: { hasArrived: true }
    });
    res.json({ success: true, data: updated });
  } catch (error) {
    next(error);
  }
});

// PATCH /bookings/:id/pay — vendor marking payment at salon
router.patch('/:id/pay', protect, restrictTo('vendor'), async (req, res, next) => {
  try {
    const updated = await prisma.booking.update({
      where: { id: req.params.id },
      data: { paymentStatus: 'paid' }
    });
    res.json({ success: true, data: updated });
  } catch (error) {
    next(error);
  }
});

// PATCH /bookings/:id — vendor updates booking status (protected)
router.patch('/:id', protect, restrictTo('vendor'), async (req, res, next) => {
  try {
    const { status } = req.body;
    const updateData = {};
    
    const booking = await prisma.booking.findUnique({ where: { id: req.params.id } });
    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });

    if (req.body.stylistId) {
      
      if (booking.stylistPreference === 'specific' && booking.stylistId && booking.stylistId !== req.body.stylistId) {
        return res.status(400).json({ success: false, message: 'Stylist cannot be changed for specific requests' });
      }

      // Conflict check for the manually assigned stylist
      const conflict = await prisma.booking.findFirst({
        where: {
          vendorId: req.user.id,
          stylistId: req.body.stylistId,
          slotTime: booking.slotTime,
          status: { not: 'cancelled' },
          id: { not: booking.id }
        }
      });

      if (conflict) {
        return res.status(400).json({ success: false, message: 'This stylist is already booked for this slot' });
      }

      updateData.stylistId = req.body.stylistId;
    }


    const validStatuses = ['accepted', 'in_service', 'completed', 'cancelled'];
    if (status && !validStatuses.includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status' });
    }

    if (status) updateData.status = status;

    
    if (status === 'accepted') {
      const { tokenNumber } = req.body;
      if (!tokenNumber || !/^\d{3}$/.test(tokenNumber)) {
        return res.status(400).json({ success: false, message: '3-digit numeric token is required' });
      }

      // Duplicate check (Active Orders)
      const duplicateOrder = await prisma.order.findFirst({
        where: {
          vendorId: req.user.id,
          tokenNumber,
          status: { notIn: ['completed', 'cancelled'] }
        }
      });

      // Duplicate check (Active Bookings)
      const duplicateBooking = await prisma.booking.findFirst({
        where: {
          vendorId: req.user.id,
          tokenNumber,
          status: { notIn: ['completed', 'cancelled'] }
        }
      });

      if (duplicateOrder || duplicateBooking) {
        return res.status(400).json({ success: false, message: 'Token already in use' });
      }

      updateData.tokenNumber = tokenNumber;
    } else if (status === 'in_service') {
      const now = new Date();
      if (now < new Date(booking.slotTime)) {
        return res.status(400).json({ success: false, message: 'Cannot start service before appointment time.' });
      }
      updateData.serviceStartTime = now;
    } else if (status === 'completed') {
      updateData.serviceEndTime = new Date();
    }

    // Clear customer actions when booking moves beyond accepted
    if (status === 'in_service' || status === 'completed') {
      updateData.customerAction = null;
      updateData.customerDelayMinutes = null;
      updateData.customerDelayUpdatedAt = null;
    }


    const updatedBooking = await prisma.booking.update({
      where: { id: req.params.id },
      data: updateData
    });

    if (updatedBooking.status === 'completed') {
      await processBookingCustomerReferralRewards(updatedBooking);
    }

    res.json({ success: true, data: updatedBooking });
  } catch (error) {
    next(error);
  }
});

async function processBookingCustomerReferralRewards(booking) {
  if (!booking.appliedReferralCode) return;
  
  // Prevent duplicate reward processing for this referred customer/booking
  const existingLog = await prisma.customerReferral.findFirst({
    where: {
      OR: [
        { bookingId: booking.id },
        { referredId: booking.customerId }
      ]
    }
  });

  if (existingLog) {
    console.log(`[CustomerReferral] Referral already processed for booking ${booking.id} or customer ${booking.customerId}`);
    return;
  }

  // Find the referrer customer (owner of the applied referral code)
  const referrer = await prisma.customer.findUnique({
    where: { referralCode: booking.appliedReferralCode }
  });

  if (!referrer) {
    console.log(`[CustomerReferral] Referrer with code ${booking.appliedReferralCode} not found.`);
    return;
  }

  // Create customer referral record
  await prisma.customerReferral.create({
    data: {
      referrerCode: booking.appliedReferralCode,
      referredId: booking.customerId,
      bookingId: booking.id,
      rewardAmount: 0.0
    }
  });

  console.log(`[CustomerReferral] Successful referral logged for referrer ${referrer.phone} referring ${booking.customerPhone}`);
}
// Handle appointment helps to book without razorpay
router.post("/", async (req, res, next) => {
  try {
    const {
      customerName,
      customerPhone,
      vendorId,
      services,
      slotTime,
      stylistId,
      stylistPreference,
      scheduledDate,
      scheduledSlot,
      appliedReferralCode
    } = req.body;

    if (
      !customerName ||
      !customerPhone ||
      !vendorId ||
      !services ||
      services.length === 0
    ) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields"
      });
    }

    // Find or create customer
    let customer = await prisma.customer.findUnique({
      where: { phone: customerPhone }
    });

    if (!customer) {
      customer = await prisma.customer.create({
        data: {
          name: customerName,
          phone: customerPhone
        }
      });
    } else if (customer.name !== customerName) {
      customer = await prisma.customer.update({
        where: { phone: customerPhone },
        data: { name: customerName }
      });
    }

    // Calculate totals
    const totalAmount = services.reduce(
      (sum, service) => sum + Number(service.price || 0),
      0
    );

    const totalDuration = services.reduce(
      (sum, service) => sum + Number(service.duration || 30),
      0
    );

    // Appointment time
    const slotDateTime = new Date(slotTime);

    const slotEndTime = new Date(
      slotDateTime.getTime() + totalDuration * 60000
    );

    // Create booking
    const booking = await prisma.booking.create({
      data: {
        customerName,
        customerPhone,
        customerId: customer.id,
        vendorId,

        services,

        totalAmount,
        platformFee: 0,
        finalAmount: totalAmount,

        slotTime: slotDateTime,
        slotEndTime,
        totalDuration,

        status: "placed",

        paymentMethod: "cash",
        paymentStatus: "pending",

        tokenNumber: null,
        tokenIndex: null,

        stylistId:
          stylistPreference === "anyone"
            ? null
            : stylistId || null,

        stylistPreference: stylistPreference || "specific",

        type: "salon",

        appliedReferralCode: appliedReferralCode || null
      }
    });

    res.json({
      success: true,
      booking
    });

  } catch (err) {
    next(err);
  }
});
module.exports = router;
