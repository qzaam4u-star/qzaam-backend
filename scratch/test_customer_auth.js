require('dotenv').config();
const prisma = require('../src/config/prisma');
const router = require('../src/routes/customer.routes.js');

// Find the login route handler
const loginRoute = router.stack.find(s => s.route && s.route.path === '/login');
const loginHandler = loginRoute.route.stack[0].handle;

async function runTest() {
  let status, json;

  console.log('--- TEST 1: Login with empty phone ---');
  const req1 = { body: { name: 'Test User' } };
  const res1 = {
    status: (code) => { status = code; return res1; },
    json: (data) => { json = data; return res1; }
  };
  await loginHandler(req1, res1, (err) => console.error('Next called with:', err));
  console.log('Result:', { status, json });

  console.log('--- TEST 2: Login with invalid 10-digit phone ---');
  const req2 = { body: { name: 'Test User', phone: '12345' } };
  const res2 = {
    status: (code) => { status = code; return res2; },
    json: (data) => { json = data; return res2; }
  };
  await loginHandler(req2, res2, (err) => console.error('Next called with:', err));
  console.log('Result:', { status, json });

  console.log('--- TEST 3: Login with vendor phone (Should block) ---');
  // First, find a vendor to test with
  const vendor = await prisma.user.findFirst({ where: { role: 'vendor' } });
  if (vendor) {
    const req3 = { body: { name: 'Fake Customer', phone: vendor.mobile } };
    const res3 = {
      status: (code) => { status = code; return res3; },
      json: (data) => { json = data; return res3; }
    };
    await loginHandler(req3, res3, (err) => console.error('Next called with:', err));
    console.log('Result:', { status, json });
  } else {
    console.log('No vendor found to test this case.');
  }

  console.log('--- TEST 4: Direct Login/Create New Customer ---');
  // Clean up any test customer first
  await prisma.customer.deleteMany({ where: { phone: '9999999999' } });

  const req4 = { body: { name: 'John Doe', phone: '9999999999' } };
  const res4 = {
    status: (code) => { status = code; return res4; },
    json: (data) => { json = data; return res4; }
  };
  await loginHandler(req4, res4, (err) => console.error('Next called with:', err));
  console.log('Result:', { status, json });

  console.log('--- TEST 5: Direct Login/Update Existing Customer Name ---');
  const req5 = { body: { name: 'John Updated', phone: '9999999999' } };
  const res5 = {
    status: (code) => { status = code; return res5; },
    json: (data) => { json = data; return res5; }
  };
  await loginHandler(req5, res5, (err) => console.error('Next called with:', err));
  console.log('Result:', { status, json });

  // Verify that it updated in DB
  const verifyDb = await prisma.customer.findUnique({ where: { phone: '9999999999' } });
  console.log('DB record name:', verifyDb.name);

  // Clean up test customer
  await prisma.customer.deleteMany({ where: { phone: '9999999999' } });

  await prisma.$disconnect();
}

runTest().catch(console.error);
