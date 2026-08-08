const express = require("express");

const router = express.Router();

const {
  protect,
  restrictTo
} = require("../middlewares/auth.middleware");

const Influencerroutes =
  require("../routes/Influencerroutes");


router.post(
  "/profile",
  protect,
  restrictTo("influencer"),
  InfluencerProfileController.createProfile
);


router.get(
  "/me",
  protect,
  restrictTo("influencer"),
  InfluencerProfileController.getMyProfile
);


router.put(
  "/me",
  protect,
  restrictTo("influencer"),
  InfluencerProfileController.updateMyProfile
);


/*
ADMIN ONLY
*/
router.get(
  "/admin",
  protect,
  restrictTo("admin"),
  InfluencerProfileController.getAllInfluencers
);


router.get(
  "/admin/:id",
  protect,
  restrictTo("admin"),
  InfluencerProfileController.getInfluencerById
);

module.exports = router;
