const prisma = require('../config/prisma');

const FIVE_MIN = 5 * 60 * 1000;
const TEN_MIN = 10 * 60 * 1000;

const checkOrderTimeouts = async () => {
  try {
    // 1. Activate Upcoming Orders
    await activateUpcomingOrders();

    const orders = await prisma.order.findMany({
      where: {
        status: {
          in: ['placed', 'pending', 'accepted', 'preparing', 'ready', 'live']
        }
      }
    });

    const now = Date.now();

    for (const order of orders) {
      // 🔹 ACCEPT TIMER (Includes 'live' for activated slot orders)
      if (order.status === 'placed' || order.status === 'pending' || order.status === 'live') {
        const startTime = order.activatedAt ? new Date(order.activatedAt).getTime() : new Date(order.createdAt).getTime();
        if (now - startTime > FIVE_MIN) {
          await cancelOrder(order.id);
        }
      }

      // 🔹 PREPARING TIMER
      if (order.status === 'accepted' && order.acceptedAt) {
        if (now - new Date(order.acceptedAt).getTime() > TEN_MIN) {
          await cancelOrder(order.id);
        }
      }

      // 🔹 READY TIMER
      if (order.status === 'preparing' && order.preparingAt) {
        if (now - new Date(order.preparingAt).getTime() > FIVE_MIN) {
          await cancelOrder(order.id);
        }
      }
    }
  } catch (error) {
    console.error('Error checking order timeouts:', error);
  }
};

const activateUpcomingOrders = async () => {
  try {
    const now = new Date();
    const upcomingOrders = await prisma.order.findMany({
      where: {
        status: 'upcoming',
        isActivated: false,
        activationTime: { lte: now }
      }
    });

    for (const order of upcomingOrders) {
      await prisma.order.update({
        where: { id: order.id },
        data: {
          status: 'live',
          isActivated: true,
          activatedAt: now,
          expiresAt: new Date(now.getTime() + 5 * 60 * 1000) // Start 5 min auto-cancel window
        }
      });
      console.log(`Activated food order ${order.id} at ${now}`);
    }
  } catch (error) {
    console.error('Error activating upcoming orders:', error);
  }
};

const cancelOrder = async (orderId) => {
  try {
    await prisma.order.update({
      where: { id: orderId },
      data: {
        status: 'cancelled'
      }
    });
  } catch (error) {
    console.error(`Error cancelling order ${orderId}:`, error);
  }
};

module.exports = { checkOrderTimeouts };
