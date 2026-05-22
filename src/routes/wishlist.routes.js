const express = require('express');
const prisma = require('../config/prisma');
const router = express.Router();

/**
 * Checks if the current time in IST is within a vendor's opening and closing hours.
 * Supports overnight hours (e.g. 10:00 PM to 2:00 AM).
 */
function isVendorOpen(openingTime, closingTime) {
  if (!openingTime || !closingTime) return true; // Default to open if no hours set
  
  const now = new Date();
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Kolkata',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });
  const currentStr = formatter.format(now); // "HH:MM"
  
  const [currH, currM] = currentStr.split(':').map(Number);
  const [openH, openM] = openingTime.split(':').map(Number);
  const [closeH, closeM] = closingTime.split(':').map(Number);
  
  const currMinutes = currH * 60 + currM;
  const openMinutes = openH * 60 + openM;
  const closeMinutes = closeH * 60 + closeM;
  
  if (openMinutes < closeMinutes) {
    // Standard same-day hours (e.g. 09:00 to 21:00)
    return currMinutes >= openMinutes && currMinutes < closeMinutes;
  } else {
    // Overnight hours (e.g. 22:00 to 02:00 next day)
    return currMinutes >= openMinutes || currMinutes < closeMinutes;
  }
}

// 1. Toggle wishlist item
router.post('/toggle', async (req, res, next) => {
  try {
    const { customerId, vendorId } = req.body;
    
    if (!customerId || !vendorId) {
      return res.status(400).json({ success: false, message: 'customerId and vendorId are required' });
    }
    
    // Validate customer exists
    const customer = await prisma.customer.findUnique({
      where: { id: customerId }
    });
    if (!customer) {
      return res.status(404).json({ success: false, message: 'Customer not found' });
    }
    
    // Validate vendor exists and role is vendor
    const vendor = await prisma.user.findFirst({
      where: { id: vendorId, role: 'vendor' }
    });
    if (!vendor) {
      return res.status(404).json({ success: false, message: 'Vendor not found' });
    }
    
    // Toggle logic
    const existing = await prisma.wishlist.findUnique({
      where: {
        customerId_vendorId: { customerId, vendorId }
      }
    });
    
    if (existing) {
      await prisma.wishlist.delete({
        where: {
          customerId_vendorId: { customerId, vendorId }
        }
      });
      return res.json({ success: true, isWishlisted: false, message: 'Removed from wishlist' });
    } else {
      await prisma.wishlist.create({
        data: { customerId, vendorId }
      });
      return res.json({ success: true, isWishlisted: true, message: 'Added to wishlist' });
    }
  } catch (error) {
    next(error);
  }
});

// 2. Fetch all saved vendors for customer (optimized single-query reviews fetch)
router.get('/', async (req, res, next) => {
  try {
    const { customerId } = req.query;
    if (!customerId) {
      return res.status(400).json({ success: false, message: 'customerId is required' });
    }
    
    // Validate customer exists
    const customer = await prisma.customer.findUnique({
      where: { id: customerId }
    });
    if (!customer) {
      return res.status(404).json({ success: false, message: 'Customer not found' });
    }
    
    // Fetch wishlisted vendors with reviews in a single query
    const wishlists = await prisma.wishlist.findMany({
      where: { customerId },
      include: {
        vendor: {
          select: {
            id: true,
            name: true,
            outletName: true,
            address: true,
            vendorType: true,
            profileImage: true,
            openingTime: true,
            closingTime: true,
            reviews: {
              select: {
                rating: true
              }
            }
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });
    
    const formattedVendors = wishlists.map(w => {
      const v = w.vendor;
      if (!v) return null;
      
      const ratings = v.reviews.map(r => r.rating);
      const totalReviews = ratings.length;
      const avgRating = totalReviews > 0 
        ? (ratings.reduce((sum, r) => sum + r, 0) / totalReviews).toFixed(1)
        : "0.0";
        
      const isOpen = isVendorOpen(v.openingTime, v.closingTime);
      
      return {
        id: v.id,
        name: v.outletName || v.name,
        address: v.address || '',
        vendorType: v.vendorType || 'food',
        profileImage: v.profileImage,
        rating: avgRating,
        reviewsCount: totalReviews,
        isOpen
      };
    }).filter(Boolean);
    
    res.json({ success: true, data: formattedVendors });
  } catch (error) {
    next(error);
  }
});

// 3. Check if vendor is already saved
router.get('/check/:vendorId', async (req, res, next) => {
  try {
    const { vendorId } = req.params;
    const { customerId } = req.query;
    
    if (!customerId) {
      return res.status(400).json({ success: false, message: 'customerId is required' });
    }
    
    const existing = await prisma.wishlist.findUnique({
      where: {
        customerId_vendorId: { customerId, vendorId }
      }
    });
    
    res.json({ success: true, isWishlisted: !!existing });
  } catch (error) {
    next(error);
  }
});

// 4. Lightweight count endpoint
router.get('/count', async (req, res, next) => {
  try {
    const { customerId } = req.query;
    if (!customerId) {
      return res.status(400).json({ success: false, message: 'customerId is required' });
    }
    
    const count = await prisma.wishlist.count({
      where: { customerId }
    });
    
    res.json({ success: true, count });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
