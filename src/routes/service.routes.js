const express = require('express');
const prisma = require('../config/prisma');
const { protect, restrictTo } = require('../middlewares/auth.middleware');

const router = express.Router();

// GET /services/:vendorId — public
router.get('/:vendorId', async (req, res, next) => {
  try {
    const services = await prisma.service.findMany({
      where: { vendorId: req.params.vendorId },
      orderBy: { createdAt: 'asc' }
    });
    res.json({ success: true, data: services });
  } catch (error) {
    next(error);
  }
});

// POST /services — vendor only
router.post('/', protect, restrictTo('vendor'), async (req, res, next) => {
  try {
    const { name, price, duration, category } = req.body;
    if (!name || !price) {
      return res.status(400).json({ success: false, message: 'Name and price are required' });
    }
    const service = await prisma.service.create({
      data: {
        vendorId: req.user.id,
        name,
        price: parseFloat(price),
        duration: parseInt(duration) || 30,
        category: category || 'General'
      }
    });
    res.status(201).json({ success: true, data: service });
  } catch (error) {
    next(error);
  }
});

// PUT /services/:id — vendor only
router.put('/:id', protect, restrictTo('vendor'), async (req, res, next) => {
  try {
    const { name, price, duration, category } = req.body;
    const service = await prisma.service.findUnique({ where: { id: req.params.id } });
    if (!service || service.vendorId !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Not authorised' });
    }
    const updated = await prisma.service.update({
      where: { id: req.params.id },
      data: {
        name: name || service.name,
        price: price ? parseFloat(price) : service.price,
        duration: duration ? parseInt(duration) : service.duration,
        category: category || service.category
      }
    });
    res.json({ success: true, data: updated });
  } catch (error) {
    next(error);
  }
});

// DELETE /services/:id — vendor only
router.delete('/:id', protect, restrictTo('vendor'), async (req, res, next) => {
  try {
    const service = await prisma.service.findUnique({ where: { id: req.params.id } });
    if (!service || service.vendorId !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Not authorised' });
    }
    await prisma.service.delete({ where: { id: req.params.id } });
    res.json({ success: true, message: 'Service deleted' });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
