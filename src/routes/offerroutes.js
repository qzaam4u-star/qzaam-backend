const express = require('express');
const crypto = require('crypto');

const router = express.Router();

const { protect, restrictTo } = require('../middlewares/auth.middleware');
const { ApiError } = require('../utils/errors');
const { uploadBuffer } = require('../cloudflareR2');
const {
  imageUpload,
  EXTENSION_BY_MIME_TYPE,
} = require('../middlewares/imageupload.middleware');

const offercontroller = require('../controllers/offercontroller');

router.post(
  '/',
  protect,
  restrictTo('vendor'),

  imageUpload.single('image'),

  async (req, res, next) => {
    try {
      if (!req.file) {
        return next(new ApiError(400, 'Offer image is required'));
      }

      const ext =
        EXTENSION_BY_MIME_TYPE[req.file.mimetype] || 'jpg';

      const key = `offers/${req.user.id}/${crypto.randomUUID()}.${ext}`;

      const imageUrl = await uploadBuffer(
        req.file.buffer,
        key,
        req.file.mimetype
      );

      req.imageUrl = imageUrl;

      next();
    } catch (err) {
      next(err);
    }
  },

  offercontroller.createOffer
);
// ===============================
// Vendor Offer Management
// ===============================

router.get(
  '/my',
  protect,
  restrictTo('vendor'),
  offercontroller.getVendorOffers
);

// ===============================
// Admin Offer Management
// ===============================

// Get all pending offers
router.get(
  '/pending',
  protect,
  restrictTo('admin'),
  offercontroller.getPendingOffers
);

router.get(
  '/:id',
  offercontroller.getOfferById
);

// Approve offer
router.patch(
  '/:id/approve',
  protect,
  restrictTo('admin'),
  offercontroller.approveOffer
);

// Reject offer
router.patch(
  '/:id/reject',
  protect,
  restrictTo('admin'),
  offercontroller.rejectOffer
);

// Customer routes
router.get('/home', offercontroller.getHomeOffers);
router.get('/', offercontroller.getAllOffers);
module.exports = router;
