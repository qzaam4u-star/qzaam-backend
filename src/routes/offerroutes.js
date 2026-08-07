const express = require('express');
const crypto = require('crypto');

const router = express.Router();

const { protect, restrictTo } = require('../middlewares/auth.middleware');
const { ApiError } = require('../utils/errors');
const { uploadBuffer } = require('../cloudflareR2');
const {
  imageUpload,
  EXTENSION_BY_MIME_TYPE,
} = require('../middlewares/imageUpload.middleware');

const offerController = require('../controllers/offerController');

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

  offerController.createOffer
);

module.exports = router;
