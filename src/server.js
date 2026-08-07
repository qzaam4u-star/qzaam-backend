require("dotenv").config();

const app = require("./app");

const { archiveexpiredoffers } = require("./utils/archiveexpiredoffers");
const { checkOrderTimeouts } = require("./utils/orderTimeoutChecker");

const PORT = process.env.PORT || 5000;

// Run once when server starts
archiveexpiredoffers();

// Archive expired offers every 15 minutes
setInterval(() => {
  archiveexpiredoffers();
}, 15 * 60 * 1000);

// Existing order timeout checker
setInterval(() => {
  checkOrderTimeouts();
}, 30000);

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
