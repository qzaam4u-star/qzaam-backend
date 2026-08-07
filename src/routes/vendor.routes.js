const express = require('express');
const multer = require('multer');
const crypto = require('crypto');
const { protect, restrictTo } = require('../middlewares/auth.middleware');
const { ApiError } = require('../utils/errors');
const { uploadBuffer, deleteObject } = require('../cloudflareR2');
const prisma = require('../config/prisma');

const router = express.Router();

{/*const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
const EXTENSION_BY_MIME_TYPE = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};
const MAX_IMAGE_SIZE_BYTES = Number(process.env.VENDOR_UPLOAD_MAX_SIZE_MB || 2) * 1024 * 1024;
 */}
const {
  imageUpload,
  EXTENSION_BY_MIME_TYPE,
} = require('../middlewares/imageUpload.middleware');
const MAX_IMAGE_FILES = Number(process.env.VENDOR_UPLOAD_MAX_FILES || 4);
const MAX_TOTAL_IMAGES = Number(process.env.VENDOR_UPLOAD_MAX_TOTAL_IMAGES || 20);
{/*
const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_IMAGE_SIZE_BYTES, files: MAX_IMAGE_FILES },
  fileFilter: (req, file, cb) => {
    if (!ALLOWED_IMAGE_TYPES.includes(file.mimetype)) {
      return cb(new ApiError(400, `Unsupported file type: ${file.mimetype}`));
    }
    cb(null, true);
  },
});*/}

router.get('/generate-qr', protect, restrictTo('vendor'), async (req, res) => {
  const vendorId = req.user.id;
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
  const menuUrl = `${frontendUrl}/menu?vendorId=${vendorId}`;
  const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(menuUrl)}`;
  
  res.status(200).json({
    success: true,
    data: {
      qrUrl: qrImageUrl,
      menuUrl: menuUrl
    }
  });
});

// GET /vendor/profile — returns full vendor profile including vendorType
router.get('/profile', protect, restrictTo('vendor'), async (req, res, next) => {
  try {
    const vendor = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        name: true,
        email: true,
        mobile: true,
        outletName: true,
        address: true,
        averagePrepTime: true,
        profileImage: true,
        role: true,
        vendorType: true,
        slotDuration: true,
        maxOrdersPerSlot: true,
        openingTime: true,
        closingTime: true,
        slotEnabled: true,
        referralCode: true,
        isApproved: true,
        createdAt: true
      }
    });
    res.json({ success: true, data: vendor });
  } catch (error) {
    next(error);
  }
});

router.patch('/profile', protect, restrictTo('vendor'), async (req, res, next) => {
  try {
    const { 
      slotDuration, maxOrdersPerSlot, openingTime, closingTime, slotEnabled,
      outletName, mobile, email, address, city, state, pincode, gstNumber, storeDescription, averagePrepTime, profileImage,
      accountHolderName, bankName, accountNumber, ifscCode, upiId, branchName
    } = req.body;
    
    const updated = await prisma.user.update({
      where: { id: req.user.id },
      data: {
        slotDuration: slotDuration !== undefined ? parseInt(slotDuration) : undefined,
        maxOrdersPerSlot: maxOrdersPerSlot !== undefined ? parseInt(maxOrdersPerSlot) : undefined,
        openingTime,
        closingTime,
        slotEnabled,
        outletName, 
        mobile, 
        email, 
        address, 
        city, 
        state, 
        pincode, 
        gstNumber, 
        storeDescription, 
        averagePrepTime: averagePrepTime !== undefined ? parseInt(averagePrepTime) : undefined, 
        profileImage,
        accountHolderName, 
        bankName, 
        accountNumber, 
        ifscCode, 
        upiId, 
        branchName
      }
    });
    res.json({ success: true, data: updated });
  } catch (error) {
    next(error);
  }
});


// GET /vendor/stylists — returns all stylists for the vendor
router.get('/stylists', protect, restrictTo('vendor'), async (req, res, next) => {
  try {
    const stylists = await prisma.stylist.findMany({
      where: { vendorId: req.user.id }
    });
    res.json({ success: true, data: stylists });
  } catch (error) {
    next(error);
  }
});

// POST /vendor/stylists — add a new stylist
router.post('/stylists', protect, restrictTo('vendor'), async (req, res, next) => {
  try {
    const { name } = req.body;
    const stylist = await prisma.stylist.create({
      data: {
        name,
        vendorId: req.user.id
      }
    });
    res.json({ success: true, data: stylist });
  } catch (error) {
    next(error);
  }
});

// DELETE /vendor/stylists/:id — delete a stylist
router.delete('/stylists/:id', protect, restrictTo('vendor'), async (req, res, next) => {
  try {
    const { id } = req.params;
    
    // Check for active bookings assigned to this stylist
    const activeBookings = await prisma.booking.findFirst({
      where: {
        stylistId: id,
        status: { notIn: ['completed', 'cancelled'] }
      }
    });

    if (activeBookings) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete stylist with active bookings. Reassign or complete upcoming bookings first.'
      });
    }

    // Attempt to delete (ensuring vendorId match for security)
    const deleted = await prisma.stylist.deleteMany({
      where: {
        id,
        vendorId: req.user.id
      }
    });

    if (deleted.count === 0) {
      return res.status(404).json({
        success: false,
        message: 'Stylist not found or unauthorized'
      });
    }

    res.json({ success: true, message: 'Stylist deleted successfully' });
  } catch (error) {
    next(error);
  }
});



/**
 * @route   GET /api/vendor/reviews
 * @desc    Get all reviews for the authenticated vendor with customer & order/booking details
 * @access  Vendor only (JWT required)
 */
router.get('/reviews', protect, restrictTo('vendor'), async (req, res, next) => {
  try {
    const vendorId = req.user.id;

    const reviews = await prisma.review.findMany({
      where: { vendorId, isHidden: false },
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: {
        customer: {
          select: { name: true, phone: true }
        },
        order: {
          select: {
            id: true,
            totalAmount: true,
            status: true,
            items: true,
            createdAt: true
          }
        },
        booking: {
          select: {
            id: true,
            totalAmount: true,
            status: true,
            services: true,
            slotTime: true,
            stylist: { select: { name: true } }
          }
        }
      }
    });

    // Compute summary stats
    const total = reviews.length;
    const avgRating = total > 0
      ? (reviews.reduce((acc, r) => acc + r.rating, 0) / total).toFixed(1)
      : '0.0';
    const positive = reviews.filter(r => r.rating >= 4).length;
    const positivePercent = total > 0 ? Math.round((positive / total) * 100) : 0;
    const ratedOrders = reviews.filter(r => !!r.orderId).length;
    const ratedBookings = reviews.filter(r => !!r.bookingId).length;

    res.json({
      success: true,
      data: {
        reviews,
        summary: {
          total,
          avgRating,
          positivePercent,
          ratedOrders,
          ratedBookings
        }
      }
    });
  } catch (error) {
    next(error);
  }
});

// GET /vendor/images — list all images uploaded by this vendor, plus the count/limit
router.get('/images', protect, restrictTo('vendor'), async (req, res, next) => {
  try {
    const images = await prisma.vendorImages.findMany({
      where: { createdBy: req.user.id },
      orderBy: { createdAt: 'desc' },
    });
    res.json({
      success: true,
      data: { images, count: images.length, max: MAX_TOTAL_IMAGES },
    });
  } catch (error) {
    next(error);
  }
});

// DELETE /vendor/images/:id — remove one of the vendor's own images from R2 and the DB
router.delete('/images/:id', protect, restrictTo('vendor'), async (req, res, next) => {
  try {
    const { id } = req.params;
    const image = await prisma.vendorImages.findUnique({ where: { id } });

    if (!image || image.createdBy !== req.user.id) {
      return next(new ApiError(404, 'Image not found'));
    }

    const key = new URL(image.imageUrl).pathname.replace(/^\//, '');
    await deleteObject(key);
    await prisma.vendorImages.delete({ where: { id } });

    res.json({ success: true, message: 'Image deleted successfully' });
  } catch (error) {
    next(error);
  }
});
// POST /vendor/upload-profile-image
router.post(
  '/upload-profile-image',
  protect,
  restrictTo('vendor'),
  imageUpload.single('profileImage'),
  async (req, res, next) => {
    console.log("Content-Type:", req.headers["content-type"]);
    console.log("req.file:", req.file);
    console.log("req.body:", req.body);
    try {
      if (!req.file) {
        return next(new ApiError(400, 'No profile image provided'));
      }

      const vendorId = req.user.id;

      const ext =
        EXTENSION_BY_MIME_TYPE[req.file.mimetype] || 'jpg';

      const key = `vendor-profile/${vendorId}.${ext}`;

      const imageUrl = await uploadBuffer(
        req.file.buffer,
        key,
        req.file.mimetype
      );

      await prisma.user.update({
        where: { id: vendorId },
        data: {
          profileImage: imageUrl,
        },
      });

      res.json({
        success: true,
        imageUrl,
      });
    } catch (err) {
      next(err);
    }
  }
);
// POST /vendor/upload-images — vendor uploads up to MAX_IMAGE_FILES images (max MAX_IMAGE_SIZE_BYTES each) to R2
router.post('/upload-images', protect, restrictTo('vendor'), (req, res, next) => {
  imageUpload.array('images', MAX_IMAGE_FILES)(req, res, (err) => {
    if (!err) return next();

    if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
      return next(new ApiError(400, `Each image must be ${MAX_IMAGE_SIZE_BYTES / (1024 * 1024)}MB or smaller`));
    }
    if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_COUNT') {
      return next(new ApiError(400, `You can upload a maximum of ${MAX_IMAGE_FILES} images at once`));
    }
    next(err instanceof ApiError ? err : new ApiError(400, err.message));
  });
}, async (req, res, next) => {
  try {
    const vendorId = req.user.id;

    if (!req.files || req.files.length === 0) {
      return next(new ApiError(400, 'No images provided'));
    }

    const existingCount = await prisma.vendorImages.count({ where: { createdBy: vendorId } });
    if (existingCount + req.files.length > MAX_TOTAL_IMAGES) {
      return next(new ApiError(
        400,
        `You can upload a maximum of ${MAX_TOTAL_IMAGES} images in total. You have ${existingCount} already and are trying to add ${req.files.length} more.`,
      ));
    }

    const created = await Promise.all(
      req.files.map(async (file) => {
        const ext = EXTENSION_BY_MIME_TYPE[file.mimetype] || 'jpg';
        const key = `vendor-images/${vendorId}/${crypto.randomUUID()}.${ext}`;
        const imageUrl = await uploadBuffer(file.buffer, key, file.mimetype);
        return prisma.vendorImages.create({
          data: { imageUrl, createdBy: vendorId },
        });
      }),
    );

    res.status(201).json({ success: true, data: created });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
