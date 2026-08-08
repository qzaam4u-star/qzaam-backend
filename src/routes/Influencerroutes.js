const express = require("express");

const router = express.Router();

const {
  protect,
  restrictTo,
} = require("../middlewares/auth.middleware");

const InfluencerProfileController = require(
  "../controllers/InfluencerProfileController"
);

// Create influencer profile
router.post(
  "/profile",
  protect,
  restrictTo("influencer"),
  InfluencerProfileController.createProfile
);

// Get my influencer profile
router.get(
  "/me",
  protect,
  restrictTo("influencer"),
  InfluencerProfileController.getMyProfile
);

// Update my influencer profile
router.put(
  "/me",
  protect,
  restrictTo("influencer"),
  InfluencerProfileController.updateMyProfile
);

// Admin - Get all influencers
router.get(
  "/admin",
  protect,
  restrictTo("admin"),
  InfluencerProfileController.getAllInfluencers
);

// Admin - Get influencer by ID
router.get(
  "/admin/:id",
  protect,
  restrictTo("admin"),
  InfluencerProfileController.getInfluencerById
);

module.exports = router;
