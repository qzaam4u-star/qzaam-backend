const cron = require('node-cron');
const prisma = require('../config/prisma');

const archiveExpiredOffers = async () => {
  try {
    const result = await prisma.offer.updateMany({
      where: {
        status: 'APPROVED',
        endDate: {
          lt: new Date()
        }
      },
      data: {
        status: 'ARCHIVED'
      }
    });

    if (result.count > 0) {
      console.log(`${result.count} expired offers archived.`);
    }
  } catch (error) {
    console.error('Error archiving offers:', error);
  }
};

// Every 15 minutes
cron.schedule('*/15 * * * *', archiveexpiredoffers);

// Run once when server starts
archiveexpiredoffers();

module.exports = archiveExpiredOffers;
