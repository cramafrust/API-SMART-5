const fs = require('fs');

const data = JSON.parse(fs.readFileSync('notifications_tracking.json', 'utf8'));
const notifs = data.notifications || [];

console.log('Total notificări:', notifs.length);
console.log('\nPrimele 3 notificări (structură):');

notifs.slice(0, 3).forEach((n, i) => {
    console.log(`\n${i+1}. Keys:`, Object.keys(n));
    console.log('   timestamp:', n.timestamp);
    console.log('   notificationTime:', n.notificationTime);
    console.log('   match keys:', n.match ? Object.keys(n.match) : 'N/A');
});

// Caută notificări din 29 ianuarie
const jan29 = notifs.filter(n => {
    const ts = n.timestamp || n.notificationTime;
    if (!ts) return false;

    // Convertește timestamp numeric la dată
    const date = new Date(ts).toISOString().split('T')[0];
    return date === '2026-01-29';
});

console.log('\n\nNotificări din 2026-01-29:', jan29.length);
jan29.forEach((n, i) => {
    const dateStr = new Date(n.timestamp).toISOString();
    console.log(`${i+1}. ${n.match?.homeTeam || n.homeTeam || '?'} vs ${n.match?.awayTeam || n.awayTeam || '?'} - ${dateStr}`);
});

// Verifică și ultimele 10 notificări (cele mai recente)
console.log('\n\nUltimele 10 notificări (cele mai recente):');
notifs.slice(-10).forEach((n, i) => {
    const ts = n.timestamp || n.notificationTime;
    const dateStr = ts ? new Date(ts).toISOString() : 'NO TIMESTAMP';
    console.log(`${i+1}. ${dateStr} - ${n.homeTeam || '?'} vs ${n.awayTeam || '?'}`);
});

// Verifică dacă există câmp "date" (string)
console.log('\n\nVerificare câmp "date" (string):');
notifs.slice(0, 5).forEach((n, i) => {
    console.log(`${i+1}. date field: "${n.date}" | timestamp: ${n.timestamp} | converted: ${new Date(n.timestamp).toISOString().split('T')[0]}`);
});
