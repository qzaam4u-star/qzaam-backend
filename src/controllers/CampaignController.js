const prisma = require("../config/prisma");

// PUBLIC - Get approved campaigns
exports.getApprovedCampaigns = async (req, res, next) => {
  try {
    const campaigns = await prisma.campaign.findMany({
      where: {
        status: "APPROVED",
      },
      include: {
        vendor: {
          select: {
            id: true,
            name: true,
            outletName: true,
            tier: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    res.json({
      success: true,
      data: campaigns,
    });
  } catch (err) {
    next(err);
  }
};

// VENDOR - Create campaign
exports.createCampaign = async (req, res, next) => {
  try {
    const {
      title,
      description,
      salonTier,
      minFollowers,
      maxFollowers,
      videoLength,
      budget,
      location,
      campaignDate,
      preferredPlatform,
      imageUrl,
    } = req.body;

    if (!title || !salonTier) {
      return res.status(400).json({
        success: false,
        message: "Title and salon tier are required",
      });
    }

    const campaign = await prisma.campaign.create({
      data: {
        vendorId: req.user.id,
        title,
        description: description || null,
        salonTier,
        minFollowers:
          minFollowers !== undefined && minFollowers !== ""
            ? Number(minFollowers)
            : null,
        maxFollowers:
          maxFollowers !== undefined && maxFollowers !== ""
            ? Number(maxFollowers)
            : null,
        videoLength:
          videoLength !== undefined && videoLength !== ""
            ? Number(videoLength)
            : null,
        budget: budget || null,
        location: location || null,
        campaignDate: campaignDate ? new Date(campaignDate) : null,
        preferredPlatform: preferredPlatform || null,
        imageUrl: imageUrl || null,
        status: "PENDING",
      },
    });

    res.status(201).json({
      success: true,
      message: "Campaign created and sent for admin approval",
      data: campaign,
    });
  } catch (err) {
    next(err);
  }
};

// VENDOR - Get own campaigns
exports.getVendorCampaigns = async (req, res, next) => {
  try {
    const campaigns = await prisma.campaign.findMany({
      where: {
        vendorId: req.user.id,
      },
      include: {
        applications: {
          include: {
            influencer: true,
          },
          orderBy: {
            createdAt: "desc",
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    res.json({
      success: true,
      data: campaigns,
    });
  } catch (err) {
    next(err);
  }
};

// INFLUENCER - Apply to campaign
exports.applyToCampaign = async (req, res, next) => {
  try {
    const { id: campaignId } = req.params;

    const campaign = await prisma.campaign.findUnique({
      where: {
        id: campaignId,
      },
    });

    if (!campaign) {
      return res.status(404).json({
        success: false,
        message: "Campaign not found",
      });
    }

    if (campaign.status !== "APPROVED") {
      return res.status(400).json({
        success: false,
        message: "This campaign is not available for applications",
      });
    }

    const influencer = await prisma.influencer.findFirst({
      where: {
        email: req.user.email,
      },
    });

    if (!influencer) {
      return res.status(404).json({
        success: false,
        message: "Influencer profile not found",
      });
    }

    const existingApplication =
      await prisma.campaignApplication.findUnique({
        where: {
          campaignId_influencerId: {
            campaignId: campaignId,
            influencerId: influencer.id,
          },
        },
      });

    if (existingApplication) {
      return res.status(400).json({
        success: false,
        message: "You have already applied to this campaign",
      });
    }

    const application = await prisma.campaignApplication.create({
      data: {
        campaignId: campaignId,
        influencerId: influencer.id,
        status: "PENDING",
      },
    });

    res.status(201).json({
      success: true,
      message: "Application submitted successfully",
      data: application,
    });
  } catch (err) {
    next(err);
  }
};

// ADMIN - Get pending campaigns
exports.getPendingCampaigns = async (req, res, next) => {
  try {
    const campaigns = await prisma.campaign.findMany({
      where: {
        status: "PENDING",
      },
      include: {
        vendor: {
          select: {
            id: true,
            name: true,
            outletName: true,
            email: true,
            mobile: true,
            tier: true,
          },
        },
        applications: {
          include: {
            influencer: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    res.json({
      success: true,
      data: campaigns,
    });
  } catch (err) {
    next(err);
  }
};

// ADMIN - Approve campaign
exports.approveCampaign = async (req, res, next) => {
  try {
    const { id } = req.params;

    const campaign = await prisma.campaign.findUnique({
      where: {
        id: id,
      },
    });

    if (!campaign) {
      return res.status(404).json({
        success: false,
        message: "Campaign not found",
      });
    }

    if (campaign.status !== "PENDING") {
      return res.status(400).json({
        success: false,
        message: `Campaign is already ${campaign.status}`,
      });
    }

    const updatedCampaign = await prisma.campaign.update({
      where: {
        id: id,
      },
      data: {
        status: "APPROVED",
      },
    });

    res.json({
      success: true,
      message: "Campaign approved successfully",
      data: updatedCampaign,
    });
  } catch (err) {
    next(err);
  }
};

// ADMIN - Reject campaign
exports.rejectCampaign = async (req, res, next) => {
  try {
    const { id } = req.params;

    const campaign = await prisma.campaign.findUnique({
      where: {
        id: id,
      },
    });

    if (!campaign) {
      return res.status(404).json({
        success: false,
        message: "Campaign not found",
      });
    }

    if (campaign.status !== "PENDING") {
      return res.status(400).json({
        success: false,
        message: `Campaign is already ${campaign.status}`,
      });
    }

    const updatedCampaign = await prisma.campaign.update({
      where: {
        id: id,
      },
      data: {
        status: "REJECTED",
      },
    });

    res.json({
      success: true,
      message: "Campaign rejected successfully",
      data: updatedCampaign,
    });
  } catch (err) {
    next(err);
  }
};
