require('dotenv').config();
const prisma = require('../src/config/prisma');
const router = require('../src/routes/admin.routes.js');

// Find the login route handler
const loginRoute = router.stack.find(s => s.route && s.route.path === '/login');
const loginHandler = loginRoute.route.stack[0].handle;

async function runTest() {
  let status, json;

  console.log('--- TEST 1: Login with empty password ---');
  const req1 = { body: {} };
  const res1 = {
    status: (code) => { status = code; return res1; },
    json: (data) => { json = data; return res1; }
  };
  await loginHandler(req1, res1, (err) => console.error('Next called with:', err));
  console.log('Result:', { status, json });

  console.log('--- TEST 2: Login with incorrect password ---');
  const req2 = { body: { password: 'wrongpassword' } };
  const res2 = {
    status: (code) => { status = code; return res2; },
    json: (data) => { json = data; return res2; }
  };
  await loginHandler(req2, res2, (err) => console.error('Next called with:', err));
  console.log('Result:', { status, json });

  console.log('--- TEST 3: Login with correct password admin@123 (Triggers auto-seed) ---');
  // Clean up any existing admin user to test auto-seeding
  await prisma.user.deleteMany({ where: { role: 'admin' } });
  
  const req3 = { body: { password: 'admin@123' } };
  const res3 = {
    status: (code) => { status = code; return res3; },
    json: (data) => { json = data; return res3; }
  };
  await loginHandler(req3, res3, (err) => console.error('Next called with:', err));
  console.log('Result:', { status, json });

  console.log('--- TEST 4: Login with correct password again (Verifies standard login, no duplicate) ---');
  const req4 = { body: { password: 'admin@123' } };
  const res4 = {
    status: (code) => { status = code; return res4; },
    json: (data) => { json = data; return res4; }
  };
  await loginHandler(req4, res4, (err) => console.error('Next called with:', err));
  console.log('Result:', { status, json });

  await prisma.$disconnect();
}

runTest().catch(console.error);
