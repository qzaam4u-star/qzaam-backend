const express = require('express');
const prisma = require('../config/prisma');
const { protect, restrictTo } = require('../middlewares/auth.middleware');
const { calculateOrderTotals } = require('../utils/orderCalculator');
const { validateAndCheckReferral } = require('../utils/referral');
const { parseISTDateTime, formatTimeInIndia } = require('../utils/timezone');

const router = express.Router();

/**
 * Helper to process referral rewards when an order is completed
 */
async function processReferralRewards(vendorId) {
  const completedOrders = await prisma.order.count({
    where: {
      vendorId,
      status: 'completed'
    }
  });

  if (completedOrders === 10) {
    const referral = await prisma.referral.findFirst({
      where: {
        referredUser: vendorId,
        rewardGiven: false
      }
    });

    if (referral) {
      const referrerUser = await prisma.user.findFirst({
        where: { referralCode: referral.referrerCode }
      });

      if (referrerUser) {
        const wallet = await prisma.wallet.update({
          where: { userId: referrerUser.id },
          data: { balance: { increment: 100 } }
        });
        await prisma.walletTransaction.create({
          data: {
            walletId: wallet.id,
            amount: 100,
            type: 'credit',
            source: 'referral'
          }
        });
      } else {
        const referrerCust = await prisma.customer.findFirst({
          where: { referralCode: referral.referrerCode }
        });

        if (referrerCust) {
          const wallet = await prisma.wallet.update({
            where: { customerId: referrerCust.id },
            data: { balance: { increment: 100 } }
          });
          await prisma.walletTransaction.create({
            data: {
              walletId: wallet.id,
              amount: 100,
              type: 'credit',
              source: 'referral'
            }
          });
        }
      }

      await prisma.referral.update({
        where: { id: referral.id },
        data: { rewardGiven: true }
      });
    }
  }
}

async function processCustomerReferralRewards(order) {
  if (!order.appliedReferralCode) return;
  
  // Prevent duplicate reward processing for this referred customer/order
  const existingLog = await prisma.customerReferral.findFirst({
    where: {
      OR: [
        { orderId: order.id },
        { referredId: order.customerId }
      ]
    }
  });

  if (existingLog) {
    console.log(`[CustomerReferral] Referral already processed for order ${order.id} or customer ${order.customerId}`);
    return;
  }

  // Find the referrer customer (owner of the applied referral code)
  const referrer = await prisma.customer.findUnique({
    where: { referralCode: order.appliedReferralCode }
  });

  if (!referrer) {
    console.log(`[CustomerReferral] Referrer with code ${order.appliedReferralCode} not found.`);
    return;
  }

  // Create customer referral record
  await prisma.customerReferral.create({
    data: {
      referrerCode: order.appliedReferralCode,
      referredId: order.customerId,
      orderId: order.id,
      rewardAmount: 0.0
    }
  });

  console.log(`[CustomerReferral] Successful referral logged for referrer ${referrer.phone} referring ${order.customerPhone}`);
}

// Calculate Total (Public)
router.post('/calculate-total', async (req, res, next) => {
  try {
    const { subtotal, vendorId, referralCode, phone } = req.body;
    
    // Fetch vendor to check for GST
    const vendor = await prisma.user.findUnique({
      where: { id: vendorId },
      select: { hasGst: true, vendorType: true }
    });

    let isReferralApplied = false;
    if (referralCode) {
      const referralCheck = await validateAndCheckReferral(referralCode, phone || '');
      if (referralCheck.isValid) {
        isReferralApplied = true;
      } else {
        return res.status(400).json({ success: false, message: referralCheck.message });
      }
    }

    const totals = calculateOrderTotals({ 
      subtotal, 
      hasGst: vendor?.hasGst || false,
      vendorType: vendor?.vendorType || 'food',
      isReferralApplied
    });

    res.json({ 
      success: true, 
      data: {
        ...totals,
        referralApplied: isReferralApplied
      } 
    });
  } catch (error) {
    next(error);
  }
});

// Create Order (Public — Guest Checkout)
router.post('/', async (req, res, next) => {
  try {
    const { customerName, customerPhone, vendorId, items, totalAmount, deliveryTime, appliedReferralCode, scheduledDate, scheduledSlot, slotDateTime } = req.body;

    const existingVendor = await prisma.user.findFirst({
      where: { mobile: customerPhone, role: 'vendor' }
    });
    if (existingVendor) {
      return res.status(400).json({
        success: false,
        message: "This number is already registered as a vendor. Please login as vendor."
      });
    }

    // Validate referral code if provided
    let isReferralApplied = false;
    let validReferralCode = null;
    if (appliedReferralCode) {
      const referralCheck = await validateAndCheckReferral(appliedReferralCode, customerPhone);
      if (referralCheck.isValid) {
        isReferralApplied = true;
        validReferralCode = referralCheck.trimmedCode;
      } else {
        return res.status(400).json({ success: false, message: referralCheck.message });
      }
    }

    // Find or create customer by phone (persistent guest tracking)
    let customer = await prisma.customer.findUnique({ where: { phone: customerPhone } });
    if (!customer) {
      const { generateCustomerReferralCode } = require('../utils/referral');
      customer = await prisma.customer.create({
        data: { 
          name: customerName, 
          phone: customerPhone, 
          referralCode: generateCustomerReferralCode(),
          wallet: { create: { balance: 0.0 } }
        }
      });
    } else if (customer.name !== customerName) {
      // Update name if customer is placing order with a different name
      customer = await prisma.customer.update({
        where: { phone: customerPhone },
        data: { name: customerName }
      });
    }

    const vendor = await prisma.user.findUnique({
      where: { id: vendorId },
      select: { hasGst: true, vendorType: true, averagePrepTime: true }
    });

    const totals = calculateOrderTotals({ 
      subtotal: totalAmount, 
      hasGst: vendor?.hasGst || false,
      vendorType: vendor?.vendorType || 'food',
      isReferralApplied
    });

    const isScheduled = !!(scheduledDate && scheduledSlot) || !!slotDateTime;
    const now = new Date();
    let status = 'pending';
    let isActivated = true;
    let activationTime = null;
    let activatedAt = now;
    let expiresAt = new Date(now.getTime() + 5 * 60 * 1000);
    let scheduledTime = null;

    if (isScheduled) {
      scheduledTime = (scheduledDate && scheduledSlot)
        ? parseISTDateTime(scheduledDate, scheduledSlot)
        : new Date(slotDateTime);
      const prepTime = vendor?.averagePrepTime || 10;
      activationTime = new Date(scheduledTime.getTime() - prepTime * 60 * 1000);
      
      if (activationTime <= now) {
        status = 'pending';
        isActivated = true;
        activatedAt = now;
      } else {
        status = 'upcoming';
        isActivated = false;
        activatedAt = null;
        expiresAt = null; // Auto-cancel starts only after activation
      }
    }

    const order = await prisma.order.create({
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
        deliveryTime: deliveryTime || 'ASAP',
        expiresAt,
        tokenNumber: null,
        appliedReferralCode: validReferralCode,
        scheduledDate: scheduledDate || (scheduledTime ? scheduledTime.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }) : null),
        scheduledSlot: scheduledSlot || (scheduledTime ? formatTimeInIndia(scheduledTime) : null),
        slotDateTime: scheduledTime,
        scheduledTime: scheduledTime,
        activationTime,
        isActivated,
        activatedAt
      }
    });

    res.status(201).json({ success: true, data: order });
  } catch (error) {
    next(error);
  }
});

// Get Vendor Orders (Protected)
router.get('/vendor', protect, restrictTo('vendor'), async (req, res, next) => {
  try {
    const orders = await prisma.order.findMany({
      where: { vendorId: req.user.id },
      orderBy: { createdAt: 'desc' }
    });

    const now = new Date();
    // Auto-timeout check
    for (const order of orders) {
      if (order.status === 'pending' && order.expiresAt && now > new Date(order.expiresAt)) {
        await prisma.order.update({
          where: { id: order.id },
          data: { status: 'cancelled' }
        });
        order.status = 'cancelled';
      }
    }

    res.status(200).json({ success: true, data: orders });
  } catch (error) {
    next(error);
  }
});

// Get Order by ID (Public for tracking)
router.get('/:id', async (req, res, next) => {
  try {
    let order = await prisma.order.findUnique({
      where: { id: req.params.id },
      include: {
        vendor: {
          select: {
            mobile: true,
            outletName: true,
            name: true
          }
        }
      }
    });

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    const now = new Date();
    // Auto-timeout check
    if (order.status === 'pending' && order.expiresAt && now > new Date(order.expiresAt)) {
      order = await prisma.order.update({
        where: { id: order.id },
        data: { status: 'cancelled' }
      });
    }

    res.status(200).json({ success: true, data: order });
  } catch (error) {
    next(error);
  }
});

// Customer Cancel Order
router.patch('/:id/cancel', async (req, res, next) => {
  try {
    const { id } = req.params;

    const order = await prisma.order.findUnique({
      where: { id }
    });

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    // Allow if status is placed, pending, live or upcoming
    if (order.status !== 'placed' && order.status !== 'pending' && order.status !== 'live' && order.status !== 'upcoming') {
      return res.status(400).json({
        success: false,
        message: 'Order cannot be cancelled after preparation starts'
      });
    }

    const updatedOrder = await prisma.order.update({
      where: { id },
      data: { status: 'cancelled' }
    });

    res.json({ success: true, data: updatedOrder });
  } catch (error) {
    next(error);
  }
});

// Update Order Status (Protected)
router.patch('/:id', protect, restrictTo('vendor'), async (req, res, next) => {
  try {
    const { status } = req.body;
    const dataToUpdate = { status };

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

      dataToUpdate.tokenNumber = tokenNumber;
      dataToUpdate.acceptedAt = new Date();
    } else if (status === 'preparing') {
      dataToUpdate.preparingAt = new Date();
    } else if (status === 'ready') {
      dataToUpdate.readyAt = new Date();
    }


    // Find existing order to check vendor type
    const existingOrder = await prisma.order.findUnique({
      where: { id: req.params.id },
      include: { vendor: { select: { vendorType: true } } }
    });

    if (!existingOrder) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    const isFood = existingOrder.vendor.vendorType === 'food' || !existingOrder.vendor.vendorType;

    // 🍟 Logic for Food Handover Confirmation
    if (status === 'completed' && isFood) {
      // If customer already confirmed, we can complete now
      if (existingOrder.pickupConfirmedByCustomer) {
        dataToUpdate.status = 'completed';
      } else {
        dataToUpdate.status = 'handover_pending';
      }
      dataToUpdate.handoverCompletedByVendor = true;
      dataToUpdate.handoverCompletedAt = new Date();
    }

    // Clear customer actions when order moves beyond ready
    if (status === 'completed' || status === 'handover_pending') {
      dataToUpdate.customerAction = null;
      dataToUpdate.customerDelayMinutes = null;
      dataToUpdate.customerDelayUpdatedAt = null;
    }

    const order = await prisma.order.update({
      where: { id: req.params.id },
      data: dataToUpdate
    });

    if (order.status === 'completed') {
      await processReferralRewards(order.vendorId);
      await processCustomerReferralRewards(order);
    }

    res.status(200).json({ success: true, data: order });
  } catch (error) {
    next(error);
  }
});

// Update Customer Action (Public — for 'ready' orders)
router.post('/customer-action', async (req, res, next) => {
  try {
    const { orderId, action, delayMinutes } = req.body;
    const validActions = ['coming', 'delayed', 'contact'];

    if (!validActions.includes(action)) {
      return res.status(400).json({ success: false, message: 'Invalid action' });
    }

    const order = await prisma.order.findUnique({
      where: { id: orderId }
    });

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    if (order.status !== 'ready') {
      return res.status(400).json({
        success: false,
        message: 'Action allowed only when order is ready'
      });
    }

    const updateData = { customerAction: action };
    
    if (action === 'delayed') {
      updateData.customerDelayMinutes = delayMinutes ? parseInt(delayMinutes) : 5;
      updateData.customerDelayUpdatedAt = new Date();
    } else {
      // Clear delay if customer says they are coming or contacting
      updateData.customerDelayMinutes = null;
      updateData.customerDelayUpdatedAt = null;
    }

    const updated = await prisma.order.update({
      where: { id: orderId },
      data: updateData
    });

    res.json({ success: true, data: updated });
  } catch (error) {
    next(error);
  }
});

// Customer Confirm Pickup (Public for tracking page)
router.post('/:id/confirm-pickup', async (req, res, next) => {
  try {
    const { id } = req.params;

    const order = await prisma.order.findUnique({
      where: { id }
    });

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    // Allow confirmation from ready or handover_pending
    if (order.status !== 'handover_pending' && order.status !== 'ready') {
      return res.status(400).json({
        success: false,
        message: 'Confirmation allowed only when order is ready or handover initiated'
      });
    }

    const dataToUpdate = {
      pickupConfirmedByCustomer: true,
      pickupConfirmedAt: new Date()
    };

    // If vendor already completed handover, we can complete now
    if (order.handoverCompletedByVendor) {
      dataToUpdate.status = 'completed';
    } else {
      // If customer clicks first, stay in 'ready' or keep current, but track confirmation
      // We don't have a 'customer_confirmed_pending_vendor' status, so we stay in 'ready'
      // but the field 'pickupConfirmedByCustomer' will be true.
    }

    const updated = await prisma.order.update({
      where: { id },
      data: dataToUpdate
    });

    if (updated.status === 'completed') {
      await processReferralRewards(updated.vendorId);
      await processCustomerReferralRewards(updated);
    }

    res.json({ success: true, data: updated });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
