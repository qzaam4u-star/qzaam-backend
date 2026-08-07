const prisma = require('../config/prisma');
const { ApiError } = require('../utils/errors');

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
{/* add admin approval announcement*/}
exports.getPendingOffers = async (req, res, next) => {
  try {
    const offers = await prisma.offer.findMany({
      where: {
        status: 'PENDING'
      },
      include: {
        vendor: {
          select: {
            id: true,
            name: true,
            outletName: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    res.status(200).json({
      success: true,
      data: offers
    });
  } catch (err) {
    next(err);
  }
};

exports.approveOffer = async (req, res, next) => {
  try {
    const offer = await prisma.offer.update({
      where: {
        id: req.params.id
      },
      data: {
        status: 'APPROVED'
      }
    });

    res.status(200).json({
      success: true,
      message: 'Offer approved successfully.',
      data: offer
    });
  } catch (err) {
    next(err);
  }
};

exports.rejectOffer = async (req, res, next) => {
  try {
    const offer = await prisma.offer.update({
      where: {
        id: req.params.id
      },
      data: {
        status: 'REJECTED'
      }
    });

    res.status(200).json({
      success: true,
      message: 'Offer rejected successfully.',
      data: offer
    });
  } catch (err) {
    next(err);
  }
};
