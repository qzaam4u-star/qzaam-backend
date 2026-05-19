const express = require('express');
const menuController = require('../controllers/menu.controller');

const router = express.Router();

// Public route for customers to fetch a vendor's menu
router.get('/:vendorId', menuController.getMenuByVendorId);

module.exports = router;
