const fs = require('fs');

const file = '/home/florian/API SMART 5/notifications_tracking.json';
const data = JSON.parse(fs.readFileSync(file, 'utf8'));

console.log('\n📊 CLEANUP DUPLICATE TORINO-LECCE NOTIFICATIONS\n');
console.log('='.repeat(60));

// Găsește notificările Torino-Lecce
const torinoNotifications = data.notifications.filter(n =>
    n.homeTeam === 'Torino' && n.awayTeam === 'Lecce'
);

console.log(`\nTotal notificări Torino-Lecce: ${torinoNotifications.length}\n`);

torinoNotifications.forEach((n, i) => {
    console.log(`[${i + 1}] ${n.pattern.name}`);
    console.log(`    ID: ${n.id}`);
    console.log(`    Cota 1.5: ${n.minute_odd_1_50}`);
    console.log(`    Cota 2.0: ${n.minute_odd_2_00}`);
    console.log(`    Status: ${n.status}\n`);
});

if (torinoNotifications.length <= 1) {
    console.log('✅ Nu sunt duplicate - skip cleanup\n');
    process.exit(0);
}

// Păstrează doar prima (PATTERN_2.1)
const toKeep = torinoNotifications[0];
const toDelete = torinoNotifications.slice(1);

console.log(`✅ PĂSTREZ: ${toKeep.pattern.name} (${toKeep.id})`);
console.log(`❌ ȘTERG: ${toDelete.map(n => n.pattern.name).join(', ')}\n`);

// Backup
const backup = file + `.backup-torino-cleanup-${Date.now()}`;
fs.writeFileSync(backup, JSON.stringify(data, null, 2));
console.log(`💾 Backup: ${backup}\n`);

// Elimină duplicate - păstrează doar PATTERN_2.1
const idsToDelete = toDelete.map(n => n.id);
data.notifications = data.notifications.filter(n => !idsToDelete.includes(n.id));

// Salvează
fs.writeFileSync(file, JSON.stringify(data, null, 2));

console.log('='.repeat(60));
console.log(`\n✅ Cleanup complet!`);
console.log(`   Înainte: ${torinoNotifications.length} notificări`);
console.log(`   După: ${data.notifications.filter(n => n.homeTeam === 'Torino').length} notificări\n`);
