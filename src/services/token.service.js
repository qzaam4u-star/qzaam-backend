const prisma = require('../config/prisma');

/**
 * Generates a sequential token for a specific vendor using atomic increment.
 * @param {string} vendorId 
 * @returns {Promise<{tokenNumber: string, tokenIndex: number}>}
 */
const generateVendorToken = async (vendorId) => {
  try {
    // 🔥 Atomic increment to prevent race conditions
    const vendor = await prisma.user.update({
      where: { id: vendorId },
      data: {
        vendorTokenIndex: {
          increment: 1
        }
      },
      select: {
        name: true,
        vendorTokenIndex: true
      }
    });

    // Start from 101
    const nextIndex = 100 + vendor.vendorTokenIndex;
    
    // Dynamic prefix based on vendor name or default to 'A'
    const prefix = vendor.name?.charAt(0)?.toUpperCase() || 'A';
    const tokenNumber = `${prefix}${nextIndex}`;

    return {
      tokenNumber,
      tokenIndex: nextIndex
    };
  } catch (error) {
    console.error('Error generating vendor token:', error);
    // Fallback if update fails
    return {
      tokenNumber: 'A101',
      tokenIndex: 101
    };
  }
};

module.exports = {
  generateVendorToken
};
