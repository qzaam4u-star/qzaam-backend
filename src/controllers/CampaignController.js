exports.getApprovedCampaigns = async (req, res, next) => {
  try {

    const campaigns =
      await prisma.campaign.findMany({

        where: {
          status: "APPROVED"
        },

        include: {
          vendor: {
            select: {
              id: true,
              name: true,
              outletName: true,
              tier: true
            }
          }
        },

        orderBy: {
          createdAt: "desc"
        }

      });

    res.json({
      success: true,
      data: campaigns
    });

  } catch (err) {
    next(err);
  }
};
