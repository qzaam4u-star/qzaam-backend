const express = require('express');
const prisma = require('../config/prisma');
const { protect, restrictTo } = require('../middlewares/auth.middleware');

const router = express.Router();

// Apply admin protection to all routes
router.use(protect, restrictTo('admin'));

// Helper to calculate waived platform fee
const calculateWaivedFee = (subtotal) => {
  const parsed = parseFloat(subtotal || 0);
  if (parsed <= 0) return 0;
  if (parsed < 200) return 5;
  if (parsed <= 500) return 10;
  if (parsed <= 1000) return 15;
  return 20;
};

/**
 * @route   GET /api/admin/referrals
 * @desc    Get general referral analytics summary cards
 */
router.get('/', async (req, res, next) => {
  try {
    // 1. Total Customer Referrals
    const totalCustomerReferrals = await prisma.customerReferral.count();

    // 2. Total Vendor Referrals
    const totalVendorReferrals = await prisma.referral.count();

    // 3. Gift Hamper Eligible Users (Customers with >= 5 successful referrals)
    const customerReferralGroups = await prisma.customerReferral.groupBy({
      by: ['referrerCode'],
      _count: {
        id: true
      }
    });
    
    const eligibleReferrerCodes = customerReferralGroups
      .filter(g => g._count.id >= 5)
      .map(g => g.referrerCode);

    const giftHamperEligibleCount = await prisma.customer.count({
      where: {
        referralCode: { in: eligibleReferrerCodes }
      }
    });

    // 4. Platform Fees Waived
    const waivedOrders = await prisma.order.findMany({
      where: {
        appliedReferralCode: { not: null },
        status: { not: 'cancelled' }
      },
      select: { totalAmount: true }
    });

    const waivedBookings = await prisma.booking.findMany({
      where: {
        appliedReferralCode: { not: null },
        status: { not: 'cancelled' }
      },
      select: { totalAmount: true }
    });

    let platformFeesWaived = 0;
    waivedOrders.forEach(o => {
      platformFeesWaived += calculateWaivedFee(o.totalAmount);
    });
    waivedBookings.forEach(b => {
      platformFeesWaived += calculateWaivedFee(b.totalAmount);
    });

    // Optional top statistics: Top Referrer and Conversion %
    // Conversion %: (successful referrals / total clicks/visits). Since we don't track visits,
    // let's define conversion as percentage of referrals that resulted in orders (which all CustomerReferral records are)
    // Let's compute a simple Top Referrer Customer
    let topReferrer = null;
    if (customerReferralGroups.length > 0) {
      // sort by count desc
      customerReferralGroups.sort((a, b) => b._count.id - a._count.id);
      const topCode = customerReferralGroups[0].referrerCode;
      const topCust = await prisma.customer.findUnique({
        where: { referralCode: topCode },
        select: { name: true, phone: true }
      });
      if (topCust) {
        topReferrer = {
          name: topCust.name,
          phone: topCust.phone,
          count: customerReferralGroups[0]._count.id
        };
      }
    }

    res.status(200).json({
      success: true,
      data: {
        totalCustomerReferrals,
        totalVendorReferrals,
        giftHamperEligibleCount,
        platformFeesWaived,
        topReferrer
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   GET /api/admin/referrals/customer
 * @desc    Get customer referral table data
 */
router.get('/customer', async (req, res, next) => {
  try {
    const customers = await prisma.customer.findMany({
      orderBy: { createdAt: 'desc' }
    });

    const customerReferrals = await prisma.customerReferral.findMany();

    const referrerMap = {};
    customerReferrals.forEach(ref => {
      referrerMap[ref.referrerCode] = (referrerMap[ref.referrerCode] || 0) + 1;
    });

    const data = customers.map(c => {
      const totalRefs = referrerMap[c.referralCode] || 0;
      return {
        id: c.id,
        name: c.name,
        phone: c.phone,
        referralCode: c.referralCode || 'N/A',
        totalSuccessfulReferrals: totalRefs,
        giftHamperStatus: totalRefs >= 5 ? 'Eligible' : 'Not Eligible',
        createdAt: c.createdAt
      };
    });

    // Sort by total referrals descending so active referrers are shown first
    data.sort((a, b) => b.totalSuccessfulReferrals - a.totalSuccessfulReferrals);

    res.status(200).json({
      success: true,
      data
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   GET /api/admin/referrals/vendor
 * @desc    Get vendor referral table data
 */
router.get('/vendor', async (req, res, next) => {
  try {
    const vendors = await prisma.user.findMany({
      where: { role: 'vendor' },
      select: {
        id: true,
        name: true,
        outletName: true,
        referralCode: true,
        createdAt: true
      }
    });

    const allReferrals = await prisma.referral.findMany();

    const referredVendorIds = allReferrals.map(r => r.referredUser);
    const referredVendors = await prisma.user.findMany({
      where: { id: { in: referredVendorIds } },
      select: { id: true, name: true, outletName: true }
    });

    const referredVendorsMap = {};
    referredVendors.forEach(v => {
      referredVendorsMap[v.id] = v.outletName || v.name;
    });

    const referralsByCode = {};
    allReferrals.forEach(ref => {
      if (!referralsByCode[ref.referrerCode]) {
        referralsByCode[ref.referrerCode] = [];
      }
      const name = referredVendorsMap[ref.referredUser] || 'Unknown Vendor';
      referralsByCode[ref.referrerCode].push(name);
    });

    const data = vendors.map(v => {
      const code = v.referralCode || 'N/A';
      const referred = referralsByCode[code] || [];
      return {
        id: v.id,
        name: v.outletName || v.name,
        referralCode: code,
        vendorsReferred: referred,
        totalReferralCount: referred.length,
        createdAt: v.createdAt
      };
    });

    data.sort((a, b) => b.totalReferralCount - a.totalReferralCount);

    res.status(200).json({
      success: true,
      data
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   GET /api/admin/referrals/customer/:id/history
 * @desc    Get referral history detail for a customer
 */
router.get('/customer/:id/history', async (req, res, next) => {
  try {
    const { id } = req.params;
    const customer = await prisma.customer.findUnique({
      where: { id }
    });

    if (!customer) {
      return res.status(404).json({ success: false, message: 'Customer not found' });
    }

    if (!customer.referralCode) {
      return res.status(200).json({ success: true, data: [] });
    }

    const referrals = await prisma.customerReferral.findMany({
      where: { referrerCode: customer.referralCode },
      orderBy: { createdAt: 'desc' }
    });

    const history = await Promise.all(referrals.map(async (ref) => {
      const referredCust = await prisma.customer.findUnique({
        where: { id: ref.referredId },
        select: { name: true, phone: true, createdAt: true }
      });

      let orderDetails = null;
      let bookingDetails = null;
      let feeWaived = 0;

      if (ref.orderId) {
        const order = await prisma.order.findUnique({
          where: { id: ref.orderId },
          select: { id: true, totalAmount: true, status: true, createdAt: true }
        });
        if (order) {
          feeWaived = order.status !== 'cancelled' ? calculateWaivedFee(order.totalAmount) : 0;
          orderDetails = {
            id: order.id,
            amount: order.totalAmount,
            status: order.status,
            createdAt: order.createdAt
          };
        }
      } else if (ref.bookingId) {
        const booking = await prisma.booking.findUnique({
          where: { id: ref.bookingId },
          select: { id: true, totalAmount: true, status: true, createdAt: true }
        });
        if (booking) {
          feeWaived = booking.status !== 'cancelled' ? calculateWaivedFee(booking.totalAmount) : 0;
          bookingDetails = {
            id: booking.id,
            amount: booking.totalAmount,
            status: booking.status,
            createdAt: booking.createdAt
          };
        }
      }

      return {
        referredUser: referredCust ? {
          name: referredCust.name,
          phone: referredCust.phone,
          joinedDate: referredCust.createdAt
        } : { name: 'Unknown Customer', phone: 'N/A', joinedDate: ref.createdAt },
        usageDate: ref.createdAt,
        order: orderDetails,
        booking: bookingDetails,
        platformFeeWaived: feeWaived
      };
    }));

    res.status(200).json({
      success: true,
      data: history
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   GET /api/admin/referrals/customer/:id/orders
 * @desc    Get all orders and bookings for a customer
 */
router.get('/customer/:id/orders', async (req, res, next) => {
  try {
    const { id } = req.params;
    const customer = await prisma.customer.findUnique({
      where: { id }
    });

    if (!customer) {
      return res.status(404).json({ success: false, message: 'Customer not found' });
    }

    const orders = await prisma.order.findMany({
      where: { customerId: id },
      orderBy: { createdAt: 'desc' },
      include: { vendor: { select: { outletName: true, name: true } } }
    });

    const bookings = await prisma.booking.findMany({
      where: { customerId: id },
      orderBy: { createdAt: 'desc' },
      include: { vendor: { select: { outletName: true, name: true } } }
    });

    res.status(200).json({
      success: true,
      data: {
        orders: orders.map(o => ({
          id: o.id,
          type: 'food',
          vendorName: o.vendor?.outletName || o.vendor?.name || 'Unknown Vendor',
          amount: o.totalAmount,
          status: o.status,
          createdAt: o.createdAt
        })),
        bookings: bookings.map(b => ({
          id: b.id,
          type: 'salon',
          vendorName: b.vendor?.outletName || b.vendor?.name || 'Unknown Vendor',
          amount: b.totalAmount,
          status: b.status,
          createdAt: b.slotTime
        }))
      }
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
