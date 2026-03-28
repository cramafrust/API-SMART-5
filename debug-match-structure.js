const fs = require('fs');
const data = JSON.parse(fs.readFileSync('notifications_tracking.json', 'utf8'));
const notifs = data.notifications || [];

// Găsește o notificare din 29 ianuarie
const jan29 = notifs.find(n => {
    const ts = n.timestamp || n.notificationTime;
    if (!ts) return false;
    const date = new Date(ts).toISOString().split('T')[0];
    return date === '2026-01-29';
});

if (jan29) {
    console.log('Notificare din 2026-01-29:');
    console.log('homeTeam (direct):', jan29.homeTeam);
    console.log('awayTeam (direct):', jan29.awayTeam);
    console.log('date (direct):', jan29.date);
    console.log('timestamp:', jan29.timestamp);
    console.log('');
    console.log('match type:', typeof jan29.match, Array.isArray(jan29.match) ? 'ARRAY' : 'OBJECT');
    console.log('match keys:', Object.keys(jan29.match).slice(0, 10));
    console.log('match[0]:', jan29.match[0]);
    console.log('match.homeTeam:', jan29.match.homeTeam);
    console.log('match.awayTeam:', jan29.match.awayTeam);
    console.log('match.league:', jan29.match.league);
    console.log('match.htScore:', jan29.match.htScore);
} else {
    console.log('Nu s-a găsit notificare din 2026-01-29');
}
