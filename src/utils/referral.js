const prisma = require('../config/prisma');

const generateRandomCode = () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 5; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
};

const generateVendorReferralCode = () => {
  return 'VENDOR-' + generateRandomCode();
};

const generateCustomerReferralCode = () => {
  return 'CUST-' + generateRandomCode();
};

// Backwards compatibility alias
const generateReferralCode = () => {
  return generateVendorReferralCode();
};

async function validateAndCheckReferral(code, customerPhone) {
  if (!code) return { isValid: false, message: 'Referral code is required.' };
  
  const trimmedCode = code.trim().toUpperCase();
  if (!trimmedCode.startsWith('CUST-')) {
    return { isValid: false, message: 'Invalid customer referral code (must start with CUST-).' };
  }

  const referrer = await prisma.customer.findUnique({
    where: { referralCode: trimmedCode }
  });

  if (!referrer) {
    return { isValid: false, message: 'Referral code does not exist.' };
  }

  if (customerPhone && referrer.phone === customerPhone.trim()) {
    return { isValid: false, message: 'Self-referral is not allowed.' };
  }

  if (customerPhone) {
    const customer = await prisma.customer.findUnique({
      where: { phone: customerPhone.trim() }
    });

    if (customer) {
      const existingOrder = await prisma.order.findFirst({
        where: {
          customerId: customer.id,
          appliedReferralCode: { not: null }
        }
      });
      const existingBooking = await prisma.booking.findFirst({
        where: {
          customerId: customer.id,
          appliedReferralCode: { not: null }
        }
      });

      if (existingOrder || existingBooking) {
        return { isValid: false, message: 'Referral code already used.' };
      }
    }
  }

  return { isValid: true, referrer, trimmedCode };
}

module.exports = {
  generateReferralCode,
  generateVendorReferralCode,
  generateCustomerReferralCode,
  validateAndCheckReferral
};

