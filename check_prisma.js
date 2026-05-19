require('dotenv').config();
const prisma = require('./src/config/prisma');

async function check() {
  try {
    // Try to update with the new fields
    const updated = await prisma.order.update({
      where: { id: 'dummy-id' },
      data: {
        customerDelayMinutes: 5,
        customerDelayUpdatedAt: new Date()
      }
    });
    console.log('Update check passed (but expected not found)');
  } catch (e) {
    if (e.message.includes('Unknown argument')) {
      console.error('Validation Error: Unknown argument detected!');
    } else {
      console.log('Update check failed as expected (not found), but validation passed.');
      console.log('Error was:', e.message.split('\n')[0]);
    }
  } finally {
    await prisma.$disconnect();
  }
}

check();
