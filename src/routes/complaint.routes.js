const express = require('express');
const prisma = require('../config/prisma');

// Dummy change to trigger nodemon restart after prisma generate
const router = express.Router();

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

module.exports = router;
