const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function test() {
  const vendorId = 'a9ee17f5-0e86-41d5-9554-706c85de9afc'; // rohit food
  const prepTime = 15;
  
  // Update vendor prep time for test
  await prisma.user.update({
    where: { id: vendorId },
    data: { averagePrepTime: prepTime, slotEnabled: true, openingTime: '09:00', closingTime: '21:00' }
  });

  const now = new Date();
  // Set current time to a specific point for comparison in logic
  // Since we can't easily mock Date.now() in the running server without libraries, 
  // we'll just check what the API returns based on REAL time.
  
  console.log(`Current Time: ${now.toLocaleTimeString('en-IN')}`);
  console.log(`Cut-off logic: Slot must be > ${new Date(now.getTime() + prepTime * 60000).toLocaleTimeString('en-IN')}`);

  // We can't easily call the route handler here without starting the app, 
  // but we can check the logic itself.
}

test();
