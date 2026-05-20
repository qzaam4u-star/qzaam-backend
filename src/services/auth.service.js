const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const prisma = require('../config/prisma');
const { ApiError } = require('../utils/errors');

const registerUser = async (data) => {
  const { 
    name, email, mobile, password, role,
    outletName, address, averagePrepTime,
    accountNumber, ifscCode, accountHolderName,
    vendorType, hasGst, gstNumber
  } = data;

  if (role === 'vendor' && (
    !name || !outletName || !mobile || !password || !address || 
    averagePrepTime === undefined
  )) {
    throw new ApiError(400, 'All vendor fields are required');
  }

  if (!password || password.length < 6) {
    throw new ApiError(400, "Password must be at least 6 characters");
  }

  const existingUser = await prisma.user.findUnique({
    where: { email },
  });

  if (existingUser) {
    throw new ApiError(400, 'User already exists');
  }

  const hashedPassword = await bcrypt.hash(password, 10);
  const { generateVendorReferralCode } = require('../utils/referral');
  const userReferralCode = generateVendorReferralCode();

  let referredByCode = null;
  if (data.referralCode) {
    const inputCode = data.referralCode.trim().toUpperCase();
    if (inputCode.startsWith('VENDOR-')) {
      const referrerUser = await prisma.user.findFirst({
        where: { referralCode: { equals: inputCode, mode: 'insensitive' } }
      });
      if (referrerUser) {
        referredByCode = inputCode;
      }
    }
  }


  const user = await prisma.user.create({
    data: {
      name,
      email,
      mobile,
      password: hashedPassword,
      role,
      outletName,
      address,
      averagePrepTime,
      // Bank fields are optional — stored as null if not provided
      accountNumber: accountNumber || null,
      ifscCode: ifscCode || null,
      accountHolderName: accountHolderName || null,
      referralCode: userReferralCode,
      referredBy: referredByCode || null,
      vendorType: vendorType || 'food',
      wallet: {
        create: { balance: 0.0 }
      }
    },
    select: {
      id: true,
      name: true,
      email: true,
      mobile: true,
      outletName: true,
      address: true,
      averagePrepTime: true,
      role: true,
      vendorType: true,
      referralCode: true,
      createdAt: true,
    },
  });

  if (referredByCode) {
    await prisma.referral.create({
      data: {
        referrerCode: referredByCode,
        referredUser: user.id
      }
    });
  }

  return user;
};

const loginUser = async (data) => {
  const { email, password } = data;

  const user = await prisma.user.findUnique({
    where: { email },
  });

  if (!user) {
    throw new ApiError(404, 'User not found');
  }

  const isPasswordValid = await bcrypt.compare(password, user.password);
  
  if (!isPasswordValid) {
    throw new ApiError(401, 'Invalid password');
  }

  const token = jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );

  return {
    token,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      mobile: user.mobile,
      role: user.role,
      vendorType: user.vendorType,
      outletName: user.outletName,
      createdAt: user.createdAt,
    },
  };
};

module.exports = { registerUser, loginUser };
