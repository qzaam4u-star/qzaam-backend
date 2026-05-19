const fs = require('fs');
let content = fs.readFileSync('c:/Users/ASUS/queueless/frontend/src/pages/SalonBookingPage.jsx', 'utf8');

// Remove comments
content = content.replace(/\/\/.*$/gm, '');
content = content.replace(/\/\*[\s\S]*?\*\//g, '');

// Remove strings (simplified)
content = content.replace(/'[^']*'/g, '""');
content = content.replace(/"[^"]*"/g, '""');
content = content.replace(/`[^`]*`/g, '""');

let cur = 0;
for (let i = 0; i < content.length; i++) {
    if (content[i] === '{') cur++;
    if (content[i] === '}') cur--;
}
console.log('Balance:', cur);
