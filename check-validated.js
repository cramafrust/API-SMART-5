const fs = require('fs');

const data = JSON.parse(fs.readFileSync('./notifications-tracking.json', 'utf8'));
const notifications = data.notifications || [];

console.log('\n📊 ANALIZA VALIDARE\n');
console.log('='.repeat(60));

const validated = notifications.filter(n => n.validated);
const notValidated = notifications.filter(n => !n.validated);

console.log(`Total notificări: ${notifications.length}`);
console.log(`✅ Validate: ${validated.length}`);
console.log(`❌ Nevalidate: ${notValidated.length}`);
console.log('='.repeat(60));

// Verifică câteva notificări validate
if (validated.length > 0) {
    console.log('\n✅ EXEMPLE NOTIFICĂRI VALIDATE:\n');
    validated.slice(0, 5).forEach((n, idx) => {
        console.log(`${idx + 1}. ${n.match.homeTeam} vs ${n.match.awayTeam}`);
        console.log(`   Liga: ${n.match.league}`);
        console.log(`   Data: ${n.timestamp}`);
        console.log(`   Rezultat: ${n.result || 'N/A'}`);
        console.log(`   Validat la: ${n.validatedAt || 'N/A'}`);
        console.log();
    });
}

// Verifică notificări nevalidate - sortează după dată
console.log('\n❌ EXEMPLE NOTIFICĂRI NEVALIDATE (cele mai recente):\n');
const sortedNotValidated = notValidated.sort((a, b) =>
    new Date(b.timestamp) - new Date(a.timestamp)
);

sortedNotValidated.slice(0, 10).forEach((n, idx) => {
    const now = new Date();
    const notifDate = new Date(n.timestamp);
    const hoursPassed = Math.floor((now - notifDate) / (1000 * 60 * 60));

    console.log(`${idx + 1}. ${n.match.homeTeam} vs ${n.match.awayTeam}`);
    console.log(`   Liga: ${n.match.league}`);
    console.log(`   Data: ${n.timestamp} (${hoursPassed}h în urmă)`);
    console.log(`   Scor HT: ${n.match.htScore}`);
    console.log(`   Pattern-uri: ${n.patterns.length}`);
    console.log();
});

// Verifică distribuția pe timp
console.log('\n📅 DISTRIBUȚIE PE PERIOADA:\n');
const today = new Date();
const periods = {
    last24h: 0,
    last7days: 0,
    last30days: 0,
    older: 0
};

notValidated.forEach(n => {
    const notifDate = new Date(n.timestamp);
    const hoursDiff = (today - notifDate) / (1000 * 60 * 60);

    if (hoursDiff <= 24) periods.last24h++;
    else if (hoursDiff <= 24 * 7) periods.last7days++;
    else if (hoursDiff <= 24 * 30) periods.last30days++;
    else periods.older++;
});

console.log(`Ultimele 24h: ${periods.last24h}`);
console.log(`Ultimele 7 zile: ${periods.last7days}`);
console.log(`Ultimele 30 zile: ${periods.last30days}`);
console.log(`Mai vechi: ${periods.older}`);
console.log('='.repeat(60));
