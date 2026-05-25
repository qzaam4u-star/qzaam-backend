const bcrypt = require('bcrypt');

const hash = "$2b$10$a9kiE2EKPstGlsg1ylbhKu1GFvW08kpdLe/FwOTgqEvCTy2jEvqHi";

async function run() {
  const isMatch = await bcrypt.compare('admin@123', hash);
  console.log("Does 'admin@123' match the hash?", isMatch);
}

run();
