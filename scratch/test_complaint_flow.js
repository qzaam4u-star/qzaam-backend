require('dotenv').config();
const axios = require('axios');
const prisma = require('../src/config/prisma');

async function runTest() {
  console.log("=== STARTING COMPLAINT FLOW INTEGRATION TEST ===");
  const baseURL = 'http://localhost:5000/api';

  try {
    // 1. Admin Login
    console.log("\n[Step 1] Logging in as Admin...");
    const loginRes = await axios.post(`${baseURL}/admin/login`, {
      password: 'admin@123'
    });
    
    if (!loginRes.data.success) {
      throw new Error("Admin login failed");
    }
    
    const adminToken = loginRes.data.data.token;
    console.log("Admin login successful. JWT retrieved.");

    // 2. Retrieve a Customer and Order
    console.log("\n[Step 2] Finding a sample customer and order...");
    const customer = await prisma.customer.findFirst();
    if (!customer) {
      throw new Error("No customer found in the database. Please create one first.");
    }
    console.log(`Found Customer: Name=${customer.name}, Phone=${customer.phone}`);

    const order = await prisma.order.findFirst({
      where: { customerPhone: customer.phone }
    });
    if (!order) {
      throw new Error(`No order found for customer phone ${customer.phone}. Please create an order first.`);
    }
    console.log(`Found Order: ID=${order.id}, Amount=₹${order.totalAmount}`);

    // 3. Create a Complaint
    console.log("\n[Step 3] Raising a new complaint as Customer...");
    const complaintSubject = "Delayed food delivery";
    const complaintDesc = "The food was supposed to arrive in 15 minutes, but took 45 minutes.";
    
    const createRes = await axios.post(`${baseURL}/complaints`, {
      orderId: order.id,
      customerPhone: customer.phone,
      subject: complaintSubject,
      description: complaintDesc,
      priority: 'high'
    });

    if (!createRes.data.success) {
      throw new Error("Failed to create complaint");
    }

    const complaintId = createRes.data.data.id;
    console.log(`Complaint registered successfully. ID: ${complaintId}`);

    // 4. Retrieve Complaints as Admin
    console.log("\n[Step 4] Retrieving all complaints as Admin...");
    const adminComplaintsRes = await axios.get(`${baseURL}/admin/complaints`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });

    const adminComplaints = adminComplaintsRes.data.data;
    const foundComplaint = adminComplaints.find(c => c.id === complaintId);
    
    if (!foundComplaint) {
      throw new Error("Created complaint not found in admin complaints list");
    }
    console.log("Complaint successfully retrieved in Admin list.");
    console.log(`Customer details inside Admin response: Phone=${foundComplaint.customer?.phone}, Email=${foundComplaint.customer?.email || 'None'}`);

    // 5. Admin updates Status and Admin Response Notes
    console.log("\n[Step 5] Admin updating complaint status to RESOLVED with notes...");
    const updateRes = await axios.patch(
      `${baseURL}/complaints/${complaintId}/status`,
      {
        status: 'resolved',
        adminResponse: 'Refund of ₹250 initiated.'
      },
      {
        headers: { Authorization: `Bearer ${adminToken}` }
      }
    );

    if (!updateRes.data.success) {
      throw new Error("Failed to update complaint status as admin");
    }
    console.log("Status update successful!");

    // 6. Fetch Customer complaints & Validate live updates
    console.log("\n[Step 6] Fetching customer complaints & validating live updates...");
    const customerComplaintsRes = await axios.get(`${baseURL}/complaints?phone=${customer.phone}`);
    const customerComplaints = customerComplaintsRes.data.data;
    const finalComplaint = customerComplaints.find(c => c.id === complaintId);

    if (!finalComplaint) {
      throw new Error("Updated complaint not found in customer list");
    }

    console.log("\n=== VALIDATION RESULTS ===");
    console.log(`- Complaint Subject: ${finalComplaint.subject}`);
    console.log(`- Expected Status: resolved | Actual Status: ${finalComplaint.status}`);
    console.log(`- Expected Admin Response: Refund of ₹250 initiated. | Actual: "${finalComplaint.adminResponse}"`);
    console.log(`- Updated Timestamp Present: ${!!finalComplaint.updatedAt} (${finalComplaint.updatedAt})`);

    if (finalComplaint.status === 'resolved' && finalComplaint.adminResponse === 'Refund of ₹250 initiated.') {
      console.log("\n✅ INTEGRATION TEST PASSED SUCCESSFULLY!");
    } else {
      console.log("\n❌ INTEGRATION TEST FAILED: Field values did not match expected outcomes.");
    }

  } catch (error) {
    console.error("\n❌ INTEGRATION TEST ERROR:", error.message);
    if (error.response) {
      console.error("Response status:", error.response.status);
      console.error("Response data:", error.response.data);
    }
  } finally {
    await prisma.$disconnect();
  }
}

runTest();
