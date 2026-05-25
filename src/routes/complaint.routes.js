const express = require('express');
const prisma = require('../config/prisma');
const { protect, restrictTo } = require('../middlewares/auth.middleware');

const router = express.Router();

// Get customer's complaints by phone number
router.get('/', async (req, res, next) => {
  try {
    const { phone } = req.query;
    if (!phone) {
      return res.status(400).json({ success: false, message: 'Phone number is required.' });
    }

    const complaints = await prisma.complaint.findMany({
      where: {
        customer: {
          phone: phone
        }
      },
      include: {
        vendor: {
          select: {
            id: true,
            name: true,
            outletName: true,
            mobile: true
          }
        },
        order: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    res.status(200).json({ success: true, data: complaints });
  } catch (error) {
    next(error);
  }
});

// Raise a new complaint
router.post('/', async (req, res, next) => {
  try {
    const { orderId, customerPhone, subject, description, priority } = req.body;

    if (!orderId || !customerPhone || !subject || !description || !priority) {
      return res.status(400).json({ success: false, message: 'All complaint fields are required.' });
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

    const complaint = await prisma.complaint.create({
      data: {
        orderId,
        customerId: customer.id,
        vendorId: order.vendorId,
        subject,
        description,
        priority,
        status: 'open'
      }
    });

    res.status(201).json({ success: true, data: complaint });
  } catch (error) {
    next(error);
  }
});

// Update complaint status (Admin only)
router.patch('/:id/status', protect, restrictTo('admin'), async (req, res, next) => {
  try {
    const { id } = req.params;
    let { status, adminResponse } = req.body;

    if (!status) {
      return res.status(400).json({ success: false, message: 'Status is required.' });
    }

    // Normalize status: "In Progress" -> "in_progress", "in-progress" -> "in_progress", etc.
    const normalized = status.toString().trim().toLowerCase().replace('-', '_').replace(' ', '_');

    const allowedStatuses = ['open', 'in_progress', 'resolved', 'rejected'];
    if (!allowedStatuses.includes(normalized)) {
      return res.status(400).json({
        success: false,
        message: `Invalid status. Allowed statuses are: ${allowedStatuses.join(', ')}`
      });
    }

    const complaint = await prisma.complaint.findUnique({
      where: { id }
    });

    if (!complaint) {
      return res.status(404).json({ success: false, message: 'Complaint not found.' });
    }

    const updated = await prisma.complaint.update({
      where: { id },
      data: {
        status: normalized,
        adminResponse: adminResponse !== undefined ? adminResponse : undefined
      },
      include: {
        customer: true,
        vendor: true,
        order: true
      }
    });

    res.status(200).json({
      success: true,
      message: 'Complaint status updated successfully',
      data: updated
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;

