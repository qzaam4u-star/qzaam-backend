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
  influencerController.createProfile
);


router.get(
  "/me",
  protect,
  restrictTo("influencer"),
  influencerController.getMyProfile
);


router.put(
  "/me",
  protect,
  restrictTo("influencer"),
  influencerController.updateMyProfile
);


/*
ADMIN ONLY
*/
router.get(
  "/admin",
  protect,
  restrictTo("admin"),
  influencerController.getAllInfluencers
);


router.get(
  "/admin/:id",
  protect,
  restrictTo("admin"),
  influencerController.getInfluencerById
);

module.exports = router;
