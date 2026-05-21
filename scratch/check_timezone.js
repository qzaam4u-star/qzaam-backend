process.env.TZ = 'UTC'; // Simulate UTC environment

const date = '2026-05-21';
const [year, month, dayNum] = date.split('-').map(Number);
const openingTime = '12:30';
const [startH, startM] = openingTime.split(':').map(Number);

// Method A: original way
let currentA = new Date(year, month - 1, dayNum);
currentA.setHours(startH, startM, 0, 0);
console.log('Original current (in UTC TZ):', currentA.toISOString());
console.log('Original time string (in UTC TZ):', currentA.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false }));

// Method B: timezone adjusted way
let currentB = new Date(Date.UTC(year, month - 1, dayNum, startH, startM, 0, 0));
currentB.setTime(currentB.getTime() - 5.5 * 60 * 60 * 1000);
console.log('Adjusted current (in UTC TZ):', currentB.toISOString());
console.log('Adjusted time string (Kolkata) (in UTC TZ):', currentB.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Kolkata' }));
