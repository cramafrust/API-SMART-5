const fs = require("fs");

const TRACKING_FILE = "./notifications_tracking.json";
const data = JSON.parse(fs.readFileSync(TRACKING_FILE, "utf8"));

console.log("📊 CLEANUP DUPLICATE NOTIFICATIONS\n");
console.log("Total notificări înainte:", data.notifications.length);

// Găsește duplicate (același matchId + pattern + timestamp în aceeași zi)
const seen = new Map();
const toKeep = [];
const duplicates = [];

data.notifications.forEach(notif => {
    // Key unic: matchId + pattern.name + zi
    const date = new Date(notif.timestamp).toISOString().split('T')[0];
    const key = `${notif.matchId}_${notif.pattern?.name}_${date}`;

    if (seen.has(key)) {
        // Duplicat găsit!
        duplicates.push(notif);
        console.log(`❌ DUPLICAT: ${notif.homeTeam} vs ${notif.awayTeam} | ${notif.pattern?.name} | ${notif.id}`);
    } else {
        seen.set(key, true);
        toKeep.push(notif);
    }
});

// Șterge și Alverca test
const beforeAlverca = toKeep.length;
const cleaned = toKeep.filter(n => {
    // Sterge meciurile de test Alverca
    if (n.matchId === "CYKIqhRb" || n.pattern?.name === "MANUAL_ADD") {
        console.log(`🗑️  ȘTERS TEST: ${n.homeTeam} vs ${n.awayTeam} | ${n.id}`);
        return false;
    }
    return true;
});

console.log(`\n📊 REZULTATE:`);
console.log(`   Duplicate șterse: ${duplicates.length}`);
console.log(`   Meciuri test șterse: ${beforeAlverca - cleaned.length}`);
console.log(`   Total înainte: ${data.notifications.length}`);
console.log(`   Total după: ${cleaned.length}`);

// Backup
const backup = TRACKING_FILE + `.backup-cleanup-${Date.now()}`;
fs.writeFileSync(backup, JSON.stringify(data, null, 2));
console.log(`\n✅ Backup: ${backup}`);

// Salvează
data.notifications = cleaned;
fs.writeFileSync(TRACKING_FILE, JSON.stringify(data, null, 2));
console.log(`✅ Salvat: ${TRACKING_FILE}\n`);
