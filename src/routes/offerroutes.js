const express = require('express');
const router = express.Router();

const offerController = require('../controllers/offercontroller');
const { protect, restrictTo } = require('../middleware/auth');
const imageUpload = require('../middleware/imageUpload');

router.post(
  '/',
  protect,
 restrictTo('vendor'),
  imageUpload.single('image'),
  offerController.createOffer
);

module.exports = router;
