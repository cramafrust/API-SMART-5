const fs = require('fs');
const data = JSON.parse(fs.readFileSync('notifications_tracking.json', 'utf8'));
const total = data.notifications.length;
const validated = data.notifications.filter(n => n.validated).length;
const pending = data.notifications.filter(n => !n.validated).length;
const legacy = data.notifications.filter(n => n.legacyStructure).length;

console.log('📊 STATUS NOTIFICATIONS_TRACKING.JSON:');
console.log('');
console.log('Total notificări:', total);
console.log('✅ Validate:', validated);
console.log('⏳ Pending:', pending);
console.log('🏴 Legacy:', legacy);
console.log('');

if (pending > 0) {
    console.log('⚠️ NOTIFICĂRI PENDING GĂSITE:');
    data.notifications.filter(n => !n.validated).slice(0, 5).forEach(n => {
        console.log('  -', n.homeTeam, 'vs', n.awayTeam, '|', new Date(n.timestamp).toLocaleString());
    });
}
