const prisma = require("../config/prisma");

exports.getCoupons = async (req, res) => {

    const { vendorId } = req.query;

    const coupons = await prisma.coupon.findMany({

        where:{
            active:true,
            OR:[
                {vendorId:null},
                {vendorId}
            ]
        },

        orderBy:{
            createdAt:"desc"
        }

    });

    res.json({
        success:true,
        data:coupons
    });

};
