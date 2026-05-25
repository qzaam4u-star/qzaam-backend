const axios = require('axios');

async function test() {
  try {
    const res = await axios.post('http://localhost:5000/api/admin/login', {
      password: 'admin@123'
    });
    console.log("Response:", res.data);
  } catch (e) {
    console.error("Error Message:", e.message);
    if (e.response) {
      console.error("Response data:", e.response.data);
    } else {
      console.error("No response received. Is the server running?");
    }
  }
}

test();
