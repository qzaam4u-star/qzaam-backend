const prisma = require("../config/prisma");
const { ApiError } = require("../utils/errors");

// CREATE INFLUENCER PROFILE
exports.createProfile = async (req, res, next) => {
  try {
    const {
      name,
      instagramId,
      phone,
      email,
      followers,
      ratePer30Sec,
      preferredPlatform,
      location,
    } = req.body;

    const existing = await prisma.influencer.findFirst({
      where: {
        email,
      },
    });

    if (existing) {
      return next(
        new ApiError(
          400,
          "Influencer profile already exists"
        )
      );
    }

    const influencer = await prisma.influencer.create({
      data: {
        name,
        instagramId,
        phone,
        email,
        followers:
          followers !== undefined &&
          followers !== ""
            ? Number(followers)
            : null,
        ratePer30Sec:
          ratePer30Sec !== undefined &&
          ratePer30Sec !== ""
            ? Number(ratePer30Sec)
            : null,
        preferredPlatform,
        location,
        status: "PENDING",
      },
    });

    res.status(201).json({
      success: true,
      message: "Profile submitted for verification",
      data: influencer,
    });
  } catch (err) {
    next(err);
  }
};

// GET MY PROFILE
exports.getMyProfile = async (req, res, next) => {
  try {
    const email = req.user.email;

    const influencer = await prisma.influencer.findFirst({
      where: {
        email,
      },
    });

    if (!influencer) {
      return next(
        new ApiError(
          404,
          "Influencer profile not found"
        )
      );
    }

    res.json({
      success: true,
      data: influencer,
    });
  } catch (err) {
    next(err);
  }
};

// UPDATE MY PROFILE
exports.updateMyProfile = async (req, res, next) => {
  try {
    const email = req.user.email;

    const influencer = await prisma.influencer.findFirst({
      where: {
        email,
      },
    });

    if (!influencer) {
      return next(
        new ApiError(
          404,
          "Influencer profile not found"
        )
      );
    }

    const {
      name,
      instagramId,
      phone,
      followers,
      ratePer30Sec,
      preferredPlatform,
      location,
      aadhaarUrl,
      panUrl,
    } = req.body;

    const updatedInfluencer =
      await prisma.influencer.update({
        where: {
          id: influencer.id,
        },
        data: {
          name:
            name !== undefined
              ? name
              : influencer.name,

          instagramId:
            instagramId !== undefined
              ? instagramId
              : influencer.instagramId,

          phone:
            phone !== undefined
              ? phone
              : influencer.phone,

          followers:
            followers !== undefined &&
            followers !== ""
              ? Number(followers)
              : influencer.followers,

          ratePer30Sec:
            ratePer30Sec !== undefined &&
            ratePer30Sec !== ""
              ? Number(ratePer30Sec)
              : influencer.ratePer30Sec,

          preferredPlatform:
            preferredPlatform !== undefined
              ? preferredPlatform
              : influencer.preferredPlatform,

          location:
            location !== undefined
              ? location
              : influencer.location,

          aadhaarUrl:
            aadhaarUrl !== undefined
              ? aadhaarUrl
              : influencer.aadhaarUrl,

          panUrl:
            panUrl !== undefined
              ? panUrl
              : influencer.panUrl,
        },
      });

    res.json({
      success: true,
      message: "Profile updated successfully",
      data: updatedInfluencer,
    });
  } catch (err) {
    next(err);
  }
};

// ADMIN - GET ALL INFLUENCERS
exports.getAllInfluencers = async (req, res, next) => {
  try {
    const influencers =
      await prisma.influencer.findMany({
        orderBy: {
          createdAt: "desc",
        },
      });

    res.json({
      success: true,
      data: influencers,
    });
  } catch (err) {
    next(err);
  }
};

// ADMIN - GET INFLUENCER BY ID
exports.getInfluencerById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const influencer =
      await prisma.influencer.findUnique({
        where: {
          id,
        },
        include: {
          applications: {
            include: {
              campaign: true,
            },
            orderBy: {
              createdAt: "desc",
            },
          },
        },
      });

    if (!influencer) {
      return next(
        new ApiError(
          404,
          "Influencer not found"
        )
      );
    }

    res.json({
      success: true,
      data: influencer,
    });
  } catch (err) {
    next(err);
  }
};
