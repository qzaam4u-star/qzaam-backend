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
      location
    } = req.body;

    const existing =
      await prisma.influencer.findFirst({
        where: {
          email
        }
      });

    if (existing) {
      return next(
        new ApiError(
          400,
          "Influencer profile already exists"
        )
      );
    }

    const influencer =
      await prisma.influencer.create({

        data: {

          name,
          instagramId,
          phone,
          email,

          followers: followers
            ? Number(followers)
            : null,

          ratePer30Sec:
            ratePer30Sec
              ? Number(ratePer30Sec)
              : null,

          preferredPlatform,
          location,

          status: "PENDING"

        }

      });

    res.status(201).json({
      success: true,
      message:
        "Profile submitted for verification",
      data: influencer
    });

  } catch (err) {
    next(err);
  }

};
