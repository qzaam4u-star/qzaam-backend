const prisma = require('../config/prisma');
const { ApiError } = require('../utils/errors');
const crypto = require("crypto");
const { uploadBuffer, deleteObject } = require("../cloudflareR2");


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
        imageUrl: req.imageUrl || null,
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
{/*exports.createOffer = async (req, res, next) => {
  try {
    const {
      title,
      description,
      category,
      serviceId,
      startDate,
      endDate
    } = req.body;

    if (!title || !category || !serviceId || !startDate || !endDate) {
      return next(new ApiError(400, 'Required fields are missing'));
    }
    let imageUrl = null;

if (req.file) {
  const ext = req.file.mimetype.split("/")[1];
  const key = `offers/${req.user.id}/${crypto.randomUUID()}.${ext}`;

  imageUrl = await uploadBuffer(
    req.file.buffer,
    key,
    req.file.mimetype
  );
}
    const service = await prisma.service.findFirst({
  where: {
    id: serviceId,
    vendorId: req.user.id
  }
});

if (!service) {
  return next(new ApiError(400, 'Invalid service selected'));
}
    const offer = await prisma.offer.create({
      data: {
        vendorId: req.user.id,
        serviceId,
        title,
        description,
        category,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        imageUrl,
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
}; */}
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
exports.getHomeOffers = async (req, res, next) => {
  try {
    const now = new Date();

    const offers = await prisma.offer.findMany({
      where: {
        status: 'APPROVED',
        startDate: {
          lte: now
        },
        endDate: {
          gte: now
        }
      },
      include: {
        vendor: {
          select: {
            id: true,
            outletName: true,
            profileImage: true
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
    console.error('GET HOME OFFERS ERROR:', err);
    next(err);
  }
};
exports.getAllOffers = async (req, res, next) => {
  try {
    const offers = await prisma.offer.findMany({
      where: {
        status: 'APPROVED'
      },
      include: {
        vendor: {
          select: {
            id: true,
            outletName: true,
            profileImage: true
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
    console.error('GET ALL OFFERS ERROR:', err);
    next(err);
  }
};
{/*
exports.getAllOffers = async (req, res, next) => {
  try {
    const now = new Date();

    const offers = await prisma.offer.findMany({
      where: {
        status: 'APPROVED',
        startDate: {
          lte: now
        },
        endDate: {
          gte: now
        }
      },
      include: {
        vendor: {
          select: {
            id: true,
            outletName: true,
            profileImage: true
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
    console.error('GET ALL OFFERS ERROR:', err);
    next(err);
  }
};
*/}
exports.getVendorOffers = async (req, res, next) => {
  try {
    const offers = await prisma.offer.findMany({
      where: {
        vendorId: req.user.id
      },
      orderBy: {
        createdAt: "desc"
      }
    });

    res.json({
      success: true,
      data: offers
    });
  } catch (err) {
    next(err);
  }
};

exports.deleteVendorOffer = async (req, res, next) => {
  try {
    const offer = await prisma.offer.findFirst({
      where: {
        id: req.params.id,
        vendorId: req.user.id
      }
    });

    if (!offer) {
      return next(new ApiError(404, "offer not found"));
    }

    if (offer.imageUrl) {
      const key = new URL(offer.imageUrl).pathname.replace(/^\//, "");
      await deleteObject(key);
    }

    await prisma.offer.delete({
      where: {
        id: offer.id
      }
    });

    res.json({
      success: true,
      message: "offer deleted successfully"
    });
  } catch (err) {
    next(err);
  }
};
exports.getOfferById = async (req, res, next) => {
  try {
    const offer = await prisma.offer.findFirst({
      where: {
        id: req.params.id,
        status: 'APPROVED',
      },
      include: {
        vendor: {
          select: {
            id: true,
            outletName: true,
            profileImage: true,
          },
        },
      },
    });

    if (!offer) {
      return next(new ApiError(404, "Offer not found"));
    }

    res.status(200).json({
      success: true,
      data: offer,
    });
  } catch (err) {
    next(err);
  }
};
