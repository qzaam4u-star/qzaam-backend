/**
 * Centralized timezone utility for Indian Standard Time (IST, UTC+5:30) calculations
 */

/**
 * Consistently parses date and time strings to a Date object in UTC representing India Standard Time (IST).
 * @param {string} dateStr - 'YYYY-MM-DD'
 * @param {string} timeStr - 'HH:MM'
 * @returns {Date}
 */
function parseISTDateTime(dateStr, timeStr) {
  const [year, month, dayNum] = dateStr.split('-').map(Number);
  const [hours, minutes] = timeStr.split(':').map(Number);
  // Construct UTC date for that exact hour/minute
  const utcDate = new Date(Date.UTC(year, month - 1, dayNum, hours, minutes, 0, 0));
  // Subtract 5.5 hours to convert from the constructed UTC representation to actual UTC representing IST time
  utcDate.setTime(utcDate.getTime() - 5.5 * 60 * 60 * 1000);
  return utcDate;
}

/**
 * Returns the current date in India (IST) as a 'YYYY-MM-DD' string.
 * @returns {string}
 */
function getTodayInIndia() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
}

/**
 * Formats a Date object as a 24h 'HH:MM' string in Asia/Kolkata timezone.
 * @param {Date} date
 * @returns {string}
 */
function formatTimeInIndia(date) {
  return date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'Asia/Kolkata'
  });
}

/**
 * Constructs start and end of day in India timezone (returns UTC Dates).
 * @param {string} dateStr - 'YYYY-MM-DD'
 * @returns {{ startOfDay: Date, endOfDay: Date }}
 */
function getISTDayBounds(dateStr) {
  const [year, month, dayNum] = dateStr.split('-').map(Number);
  const startOfDay = new Date(Date.UTC(year, month - 1, dayNum, 0, 0, 0, 0) - 5.5 * 60 * 60 * 1000);
  const endOfDay = new Date(Date.UTC(year, month - 1, dayNum, 23, 59, 59, 999) - 5.5 * 60 * 60 * 1000);
  return { startOfDay, endOfDay };
}

module.exports = {
  parseISTDateTime,
  getTodayInIndia,
  formatTimeInIndia,
  getISTDayBounds
};
