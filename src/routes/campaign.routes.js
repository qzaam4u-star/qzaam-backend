const express = require("express");

const router = express.Router();

const {
  protect,
  restrictTo
} = require("../middlewares/auth.middleware");

const campaignController = require('../controllers/CampaignController');


/*
PUBLIC
Approved campaigns only
*/
router.get(
  "/",
  campaignController.getApprovedCampaigns
);


/*
VENDOR
Create campaign
*/
router.post(
  "/",
  protect,
  restrictTo("vendor"),
  campaignController.createCampaign
);


/*
VENDOR
Own campaigns
*/
router.get(
  "/vendor/my",
  protect,
  restrictTo("vendor"),
  campaignController.getVendorCampaigns
);


/*
INFLUENCER
Apply
*/
router.post(
  "/:id/apply",
  protect,
  restrictTo("influencer"),
  campaignController.applyToCampaign
);


/*
ADMIN
Pending campaigns
*/
router.get(
  "/admin/pending",
  protect,
  restrictTo("admin"),
  campaignController.getPendingCampaigns
);


/*
ADMIN
Approve
*/
router.patch(
  "/admin/:id/approve",
  protect,
  restrictTo("admin"),
  campaignController.approveCampaign
);


/*
ADMIN
Reject
*/
router.patch(
  "/admin/:id/reject",
  protect,
  restrictTo("admin"),
  campaignController.rejectCampaign
);

module.exports = router;
