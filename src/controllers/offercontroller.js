const prisma = require('../config/prisma');
const ApiError = require('../utils/ApiError');

exports.createOffer = async (req, res, next) => {
  try {
    const {
      title,
      description,
      category,
      startDate,
      endDate
    } = req.body;

    if (!title || !category || !startDate || !endDate) {
      return next(new ApiError(400, 'Required fields are missing'));
    }

    const offer = await prisma.offer.create({
      data: {
        vendorId: req.user.id,
        title,
        description,
        category,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        imageUrl: req.imageUrl,
        status: 'PENDING'
      }
    });

    res.status(201).json({
      success: true,
      message: 'Offer submitted successfully. Waiting for admin approval.',
      offer
    });

  } catch (err) {
    next(err);
  }
};
