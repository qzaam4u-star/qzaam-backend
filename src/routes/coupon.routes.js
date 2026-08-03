const express=require("express");
const router=express.Router();

const controller=require("../controllers/couponController");

router.get("/",controller.getCoupons);

module.exports=router;
