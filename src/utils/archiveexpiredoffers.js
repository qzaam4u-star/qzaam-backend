const prisma = require('../config/prisma');

const archiveexpiredoffers = async () => {
  try {
    const result = await prisma.offer.updateMany({
      where: {
        status: 'APPROVED',
        endDate: {
          lt: new Date(),
        },
      },
      data: {
        status: 'ARCHIVED',
      },
    });

    if (result.count > 0) {
      console.log(`${result.count} expired offers archived.`);
    }
  } catch (error) {
    console.error('Error archiving offers:', error);
  }
};

module.exports = { archiveexpiredoffers };
