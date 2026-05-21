const express = require('express');
const prisma = require('../config/prisma');
const { parseISTDateTime, getTodayInIndia, formatTimeInIndia, getISTDayBounds } = require('../utils/timezone');

const router = express.Router();

router.get('/:id', async (req, res, next) => {
  try {
    const vendor = await prisma.user.findUnique({
      where: { id: req.params.id },
      select: {
        id: true,
        name: true,
        outletName: true,
        address: true,
        averagePrepTime: true,
        mobile: true,
        vendorType: true,
        role: true,
        stylists: true,
        slotDuration: true,
        maxOrdersPerSlot: true,
        openingTime: true,
        closingTime: true,
        slotEnabled: true
      }
    });

    if (!vendor || vendor.role !== 'vendor') {
      return res.status(404).json({ success: false, message: 'Vendor not found' });
    }

    res.status(200).json({ success: true, data: vendor });
  } catch (error) {
    next(error);
  }
});

router.get('/:id/available-stylists', async (req, res, next) => {
  try {
    const { id: vendorId } = req.params;
    const { slotTime, duration } = req.query; // duration in minutes

    if (!slotTime) return res.status(400).json({ success: false, message: 'slotTime required' });

    const startTime = new Date(slotTime);
    const durationMins = parseInt(duration) || 30;
    const endTime = new Date(startTime.getTime() + durationMins * 60000);

    const stylists = await prisma.stylist.findMany({
      where: { vendorId }
    });

    // A stylist is booked if any of their bookings overlaps with [startTime, endTime)
    const overlappingBookings = await prisma.booking.findMany({
      where: {
        vendorId,
        status: { not: 'cancelled' },
        stylistId: { not: null },
        // Overlap condition: existing booking starts before our end AND ends after our start
        slotTime: { lt: endTime },
        OR: [
          { slotEndTime: null, slotTime: { gte: startTime } }, // old bookings without endTime — block exact slot
          { slotEndTime: { gt: startTime } }                   // new bookings with endTime
        ]
      },
      select: { stylistId: true }
    });

    const bookedIds = overlappingBookings.map(b => b.stylistId).filter(Boolean);
    const available = stylists.map(s => ({
      ...s,
      isBooked: bookedIds.includes(s.id)
    }));

    res.json({ success: true, data: available });
  } catch (error) {
    next(error);
  }
});


router.get('/:id/available-food-slots', async (req, res, next) => {
  try {
    const { id: vendorId } = req.params;
    const { date } = req.query; // Expects 'YYYY-MM-DD'

    if (!date) return res.status(400).json({ success: false, message: 'Date required' });

    const vendor = await prisma.user.findUnique({
      where: { id: vendorId },
      select: {
        slotDuration: true,
        maxOrdersPerSlot: true,
        openingTime: true,
        closingTime: true,
        slotEnabled: true,
        vendorType: true,
        averagePrepTime: true
      }
    });

    if (!vendor || vendor.vendorType !== 'food' || !vendor.slotEnabled) {
      return res.status(400).json({ success: false, message: 'Vendor does not support slot booking' });
    }

    const openingTime = vendor.openingTime || '09:00';
    const closingTime = vendor.closingTime || '21:00';
    const slotDuration = vendor.slotDuration || 30;
    const maxOrdersPerSlot = vendor.maxOrdersPerSlot || 5;

    const slots = [];

    // Safely construct start and end dates using IST-safe helpers
    let current = parseISTDateTime(date, openingTime);
    const end = parseISTDateTime(date, closingTime);
    const { startOfDay, endOfDay } = getISTDayBounds(date);

    const orders = await prisma.order.findMany({
      where: {
        vendorId,
        slotDateTime: {
          gte: startOfDay,
          lte: endOfDay
        },
        status: { notIn: ['cancelled'] }
      },
      select: { slotDateTime: true }
    });

    // Check if current slot is in the past (only for today) using IST-safe helpers
    const now = new Date();
    const isToday = date === getTodayInIndia();

    // Limit loop to prevent infinite runs if data is corrupted
    let iterations = 0;
    while (current < end && iterations < 100) {
      iterations++;
      const slotTimeStr = formatTimeInIndia(current);
      const ordersInSlot = orders.filter(o => o.slotDateTime && o.slotDateTime.getTime() === current.getTime()).length;

      const prepTimeMs = (vendor.averagePrepTime || 15) * 60000;
      const isPast = isToday && (now.getTime() >= (current.getTime() - prepTimeMs));
      let status = 'available';

      if (isPast) {
        status = 'unavailable';
      } else if (ordersInSlot >= maxOrdersPerSlot) {
        status = 'full';
      } else if (ordersInSlot >= maxOrdersPerSlot * 0.8) {
        status = 'limited';
      }

      slots.push({
        time: slotTimeStr,
        dateTime: new Date(current),
        ordersCount: ordersInSlot,
        capacity: maxOrdersPerSlot,
        status
      });

      current = new Date(current.getTime() + slotDuration * 60000);
    }


    res.json({ success: true, data: slots });
  } catch (error) {
    next(error);
  }
});

module.exports = router;

