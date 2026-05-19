require('dotenv').config();
const app = require('./app');

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});

const { checkOrderTimeouts } = require('./utils/orderTimeoutChecker');
setInterval(() => {
  checkOrderTimeouts();
}, 30000); // every 30 seconds
