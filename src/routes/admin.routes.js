const express = require('express');
const jwt = require('jsonwebtoken');
const prisma = require('../config/prisma');
const { protect, restrictTo } = require('../middlewares/auth.middleware');

const router = express.Router();

router.post('/login', async (req, res, next) => {
  try {
    const { password } = req.body;
    if (!password) {
      return res.status(400).json({ success: false, message: 'Password is required' });
    }

    const bcrypt = require('bcrypt');

    // Fetch the admin user from database
    let admin = await prisma.user.findFirst({
      where: { role: 'admin' }
    });

    // If admin does not exist, automatically seed it with default password 'admin@123'
    if (!admin) {
      const hashedPassword = await bcrypt.hash('admin@123', 10);
      admin = await prisma.user.create({
        data: {
          name: 'Super Admin',
          email: 'admin@qzaam.com',
          mobile: '0000000000',
          password: hashedPassword,
          role: 'admin',
          isApproved: true,
          wallet: {
            create: { balance: 0.0 }
          }
        }
      });
    }

    // Validate using bcrypt.compare()
    const isPasswordValid = await bcrypt.compare(password, admin.password);
    if (!isPasswordValid) {
      return res.status(401).json({ success: false, message: 'Invalid admin password' });
    }

    const token = jwt.sign(
      { id: admin.id, email: admin.email, role: admin.role },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.status(200).json({
      success: true,
      message: 'Admin login successful',
      data: {
        token,
        user: {
          id: admin.id,
          name: admin.name,
          email: admin.email,
          mobile: admin.mobile,
          role: admin.role,
          createdAt: admin.createdAt,
        }
      }
    });
  } catch (err) {
    next(err);
  }
});

// All routes here are protected and restricted to admin
router.use(protect, restrictTo('admin'));

/**
 * @route   PUT /api/admin/change-password
 * @desc    Securely change admin password
 * @access  Admin only (JWT required)
 */
router.put('/change-password', async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ success: false, message: 'Current and new password are required' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ success: false, message: 'New password must be at least 6 characters' });
    }

    const bcrypt = require('bcrypt');

    // Fetch admin record from DB using ID from JWT
    const admin = await prisma.user.findFirst({
      where: { id: req.user.id, role: 'admin' }
    });

    if (!admin) {
      return res.status(404).json({ success: false, message: 'Admin not found' });
    }

    // Verify current password
    const isMatch = await bcrypt.compare(currentPassword, admin.password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Current password is incorrect' });
    }

    // Hash new password securely
    const hashedNew = await bcrypt.hash(newPassword, 10);

    // Update in database
    await prisma.user.update({
      where: { id: admin.id },
      data: { password: hashedNew }
    });

    res.status(200).json({ success: true, message: 'Password updated successfully' });
  } catch (err) {
    next(err);
  }
});

router.get('/dashboard', async (req, res, next) => {
  try {
    const totalVendors = await prisma.user.count({
      where: { role: 'vendor' }
    });

    const verifiedVendors = await prisma.user.count({
      where: { role: 'vendor', isApproved: true }
    });

    const unverifiedVendors = await prisma.user.count({
      where: { role: 'vendor', isApproved: false }
    });

    // orders (food)
    const orders = await prisma.order.findMany({
      include: {
        vendor: true
      }
    });

    // bookings (salon)
    const bookings = await prisma.booking.findMany({
      include: {
        vendor: true
      }
    });

    // commission (10%)
    let commission = 0;
    const vendorMap = {};

    const processTransaction = (transaction, isBooking = false) => {
      if (!transaction.vendor) return;
      const vendorId = transaction.vendorId;

      if (!vendorMap[vendorId]) {
        vendorMap[vendorId] = {
          name: transaction.vendor.outletName || transaction.vendor.name,
          vendorType: transaction.vendor.vendorType === 'salon' || isBooking ? 'salon' : 'food',
          totalOrders: 0,
          cancelled: 0,
          revenue: 0,
          joinedAt: transaction.vendor.createdAt,
          status: transaction.vendor.isApproved ? 'verified' : 'unverified'
        };
      }

      vendorMap[vendorId].totalOrders += 1;
      vendorMap[vendorId].revenue += transaction.totalAmount;

      if (transaction.status === 'cancelled') {
        vendorMap[vendorId].cancelled += 1;
      }

      commission += transaction.platformFee || (transaction.totalAmount * 0.1);
    };

    orders.forEach(o => processTransaction(o));
    bookings.forEach(b => processTransaction(b, true));

    const allVendors = await prisma.user.findMany({
      where: { role: 'vendor' },
      include: {
        stylists: true
      }
    });

    allVendors.forEach(v => {
      if (!vendorMap[v.id]) {
        vendorMap[v.id] = {
          name: v.outletName || v.name,
          vendorType: (v.vendorType === 'salon' || v.stylists?.length > 0) ? 'salon' : 'food',
          totalOrders: 0,
          cancelled: 0,
          revenue: 0,
          joinedAt: v.createdAt,
          status: v.isApproved ? 'verified' : 'unverified',
          stylistsCount: v.stylists?.length || 0,
          prepTime: v.averagePrepTime || 0,
          slotDuration: v.slotDuration || 30
        };
      } else {
        // Ensure vendorType is updated if it was previously set to food but they have stylists
        if (vendorMap[v.id].vendorType === 'food' && (v.vendorType === 'salon' || v.stylists?.length > 0)) {
          vendorMap[v.id].vendorType = 'salon';
        }
        vendorMap[v.id].stylistsCount = v.stylists?.length || 0;
        vendorMap[v.id].prepTime = v.averagePrepTime || 0;
        vendorMap[v.id].slotDuration = v.slotDuration || 30;
      }
    });

    const vendors = Object.values(vendorMap);

    res.json({
      success: true,
      data: {
        commission,
        totalVendors,
        verifiedVendors,
        unverifiedVendors,
        vendors
      }
    });
  } catch (err) {
    next(err);
  }
});

/**
 * @route   GET /api/admin/vendors
 * @desc    Get all vendors
 */
router.get('/vendors', async (req, res, next) => {
  try {
    const vendors = await prisma.user.findMany({
      where: { role: 'vendor' },
      select: {
        id: true,
        name: true,
        email: true,
        mobile: true,
        outletName: true,
        address: true,
        isApproved: true,
        hasGst: true,
        gstNumber: true,
        createdAt: true,
        vendorType: true,
        averagePrepTime: true,
        slotDuration: true,
        accountHolderName: true,
        bankName: true,
        accountNumber: true,
        ifscCode: true,
        upiId: true,
        branchName: true,
        city: true,
        state: true,
        pincode: true,
        storeDescription: true,
        stylists: {
          select: { id: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    console.log(`[Admin API] Found ${vendors.length} vendors`);
    
    // Robust vendorType detection
    const hydratedVendors = vendors.map(v => ({
      ...v,
      vendorType: (v.vendorType === 'salon' || (v.stylists && v.stylists.length > 0)) ? 'salon' : 'food'
    }));

    res.status(200).json({ success: true, data: hydratedVendors });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   PATCH /api/admin/vendor/:id
 * @desc    Approve or update vendor status
 */
router.patch('/vendor/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { isApproved } = req.body;

    const vendor = await prisma.user.update({
      where: { id },
      data: { isApproved },
      select: { id: true, name: true, isApproved: true }
    });

    res.status(200).json({ 
      success: true, 
      message: `Vendor ${vendor.name} is now ${isApproved ? 'approved' : 'pending'}`,
      data: vendor 
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   GET /api/admin/orders
 * @desc    Get all orders across the platform
 */
router.get('/orders', async (req, res, next) => {
  try {
    const orders = await prisma.order.findMany({
      include: { vendor: true },
      orderBy: { createdAt: 'desc' }
    });
    //saloon bookings
    const salonBookings = await prisma.booking.findMany({
      include: { vendor: true },
      orderBy: { createdAt: 'desc' }
    });
    // Format Food Orders
    const formattedOrders = Orders.map(order => ({
      id: order.id,
      type: "food",
      customerName: order.customerName,
      customerPhone: order.customerPhone,
      services: order.items,
      vendor: order.vendor,
      totalAmount: order.totalAmount,
      status: order.status,
      slotTime: order.scheduledTime || order.slotDateTime,
      createdAt: order.createdAt
    }));
    // Format Salon Bookings
    const formattedSalonBookings = salonBookings.map(booking => ({
      id: booking.id,
      type: "salon",
      customerName: booking.customerName,
      customerPhone: booking.customerPhone,
      services: booking.services,
      vendor: booking.vendor,
      totalAmount: booking.totalAmount,
      status: booking.status,
      slotTime: booking.slotTime,
      createdAt: booking.createdAt
    }));
    // Merge & Sort
    const orders = [
      ...formattedOrders,
      ...formattedSalonBookings
    ].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    
    // In a real app, we'd use relations to get vendor names. 
    // Since we're using Prisma with JSON for items, let's also fetch vendor names manually if needed or just return raw.
    // For now, let's return raw orders.

    res.status(200).json({ success: true, data: orders });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   GET /api/admin/customers
 * @desc    Get all customers with their order stats
 */
router.get('/customers', async (req, res, next) => {
  try {
    const customers = await prisma.customer.findMany({
      include: {
        orders: true
      },
      orderBy: { createdAt: 'desc' }
    });

    const formatted = customers.map(c => ({
      id: c.id,
      name: c.name,
      phone: c.phone,
      totalOrders: c.orders.length,
      createdAt: c.createdAt
    }));

    res.status(200).json({ success: true, data: formatted });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   GET /api/admin/payments
 * @desc    Get all transactions (derived from orders)
 */
router.get('/payments', async (req, res, next) => {
  try {
    const orders = await prisma.order.findMany({
      include: {
        vendor: true
      },
      orderBy: { createdAt: 'desc' }
    });

    const formatted = orders.map(o => ({
      id: "PAY_" + o.id.slice(0, 6).toUpperCase(),
      orderId: o.id,
      vendorName: o.vendor?.name || o.vendor?.outletName || "Unknown",
      amount: o.totalAmount,
      status: o.status === "completed" ? "success" : (o.status === "cancelled" ? "failed" : "pending"),
      createdAt: o.createdAt
    }));

    res.status(200).json({ success: true, data: formatted });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   GET /api/admin/complaints
 * @desc    Get all complaints for the admin
 */
router.get('/complaints', async (req, res, next) => {
  try {
    const complaints = await prisma.complaint.findMany({
      include: {
        customer: true,
        vendor: true,
        order: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    res.status(200).json({ success: true, data: complaints });
  } catch (error) {
    next(error);
  }
});

router.get('/referrals', async (req, res, next) => {
  try {
    const referrals = await prisma.vendorReferral.findMany({
      orderBy: { createdAt: 'desc' }
    });
    res.status(200).json({ success: true, data: referrals });
  } catch (error) {
    next(error);
  }
});

router.get('/commission', async (req, res, next) => {
  try {
    const orders = await prisma.order.findMany({
      where: { status: "completed" },
      include: { vendor: true }
    });

    const bookings = await prisma.booking.findMany({
      where: { status: "completed" },
      include: { vendor: true }
    });

    let totalCommission = 0;
    let todayCommission = 0;
    let monthlyCommission = 0;

    const vendorMap = {};

    const today = new Date();
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();

    const processItem = (item, isBooking = false) => {
      const commission = item.platformFee || 0;

      totalCommission += commission;

      const orderDate = new Date(item.createdAt);

      if (orderDate.toDateString() === today.toDateString()) {
        todayCommission += commission;
      }

      if (orderDate.getMonth() === currentMonth && orderDate.getFullYear() === currentYear) {
        monthlyCommission += commission;
      }

      if (!vendorMap[item.vendorId]) {
        vendorMap[item.vendorId] = {
          vendorName: item.vendor?.outletName || item.vendor?.name || "Vendor",
          vendorType: item.vendor?.vendorType === 'salon' || isBooking ? "salon" : "food",
          totalSales: 0,
          commission: 0,
          orders: 0
        };
      }

      vendorMap[item.vendorId].totalSales += item.totalAmount;
      vendorMap[item.vendorId].commission += commission;
      vendorMap[item.vendorId].orders += 1;
    };

    orders.forEach(o => processItem(o, false));
    bookings.forEach(b => processItem(b, true));

    const vendorList = Object.values(vendorMap);

    res.json({
      success: true,
      data: {
        totalCommission,
        todayCommission,
        monthlyCommission,
        pending: 0, 
        vendors: vendorList
      }
    });
  } catch (err) {
    console.error("Commission Error:", err);
    res.status(500).json({ success: false, message: "Failed to fetch commission data" });
  }
});

router.get('/analytics', async (req, res, next) => {
  try {
    const orders = await prisma.order.findMany();
    const bookings = await prisma.booking.findMany();

    let totalRevenue = 0;
    let completed = 0;
    let pending = 0;
    let cancelled = 0;

    const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const revenueByDayMap = {};
    days.forEach(d => revenueByDayMap[d] = 0);

    const processItem = (item) => {
      const amount = item.totalAmount || 0;
      totalRevenue += amount;

      const date = new Date(item.createdAt);
      const dayName = days[date.getDay()];
      revenueByDayMap[dayName] += amount;

      if (item.status === "completed") completed++;
      else if (item.status === "cancelled") cancelled++;
      else pending++; // everything else is pending/placed
    };

    orders.forEach(processItem);
    bookings.forEach(processItem);

    const revenueChart = days.map(d => ({ name: d, value: revenueByDayMap[d] }));

    const totalTransactions = orders.length + bookings.length;
    const avgOrderValue = totalTransactions > 0 ? Math.round(totalRevenue / totalTransactions) : 0;

    const totalCustomers = await prisma.customer.count();

    res.json({
      success: true,
      data: {
        totalRevenue,
        totalOrders: totalTransactions,
        totalCustomers,
        avgOrderValue,
        revenueChart,
        orderStatus: [
          { name: "Completed", value: completed, fill: '#d4ff00' },
          { name: "Pending", value: pending, fill: '#a1a1aa' },
          { name: "Cancelled", value: cancelled, fill: '#ef4444' }
        ]
      }
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
