/**
 * TEST TRACKING SYSTEM
 *
 * Testează sistemul de tracking:
 * 1. Adaugă notificare de test
 * 2. Verifică că a fost salvată în JSON
 * 3. Rulează un ciclu de monitor
 * 4. Verifică actualizările
 */

const NotificationTracker = require('./NOTIFICATION_TRACKER');
const NotificationMonitor = require('./NOTIFICATION_MONITOR');

console.log('\n' + '='.repeat(80));
console.log('🧪 TEST TRACKING SYSTEM');
console.log('='.repeat(80) + '\n');

// Test 1: Adaugă notificare de test
console.log('📝 TEST 1: Adăugare notificare de test\n');

const testNotification = NotificationTracker.addNotification({
    matchId: 'TEST_MATCH_123',
    homeTeam: 'Manchester City',
    awayTeam: 'Liverpool',
    event: 'Echipa gazdă va marca în repriza 2',
    initialOdd: 1.75,
    probability: 85,
    pattern: {
        name: 'GOL_GAZDA_REPRIZA_2',
        team: 'gazda',
        half: 2,
        probability: 85
    }
});

if (testNotification) {
    console.log('✅ Notificare adăugată cu succes!\n');
} else {
    console.log('❌ Eroare la adăugarea notificării!\n');
    process.exit(1);
}

// Test 2: Verifică notificările active
console.log('📊 TEST 2: Verificare notificări active\n');

const activeNotifications = NotificationTracker.getActiveNotifications();
console.log(`   Notificări active: ${activeNotifications.length}`);

if (activeNotifications.length === 0) {
    console.log('   ⚠️  Nu există notificări active!\n');
} else {
    console.log('   ✅ Notificări active găsite!\n');
    activeNotifications.forEach(n => {
        console.log(`   - ${n.match}`);
        console.log(`     Event: ${n.event}`);
        console.log(`     Status: ${n.status}`);
        console.log(`     Probability: ${n.probability}%`);
        console.log('');
    });
}

// Test 3: Verifică statistici
console.log('📈 TEST 3: Statistici\n');

const stats = NotificationTracker.generateStats();
console.log(`   Total: ${stats.total}`);
console.log(`   Monitoring: ${stats.monitoring}`);
console.log(`   Completed: ${stats.completed}`);
console.log(`   Failed: ${stats.failed}`);
console.log(`   Success rate: ${stats.successRate}%\n`);

// Test 4: Test actualizare minute
console.log('🔄 TEST 4: Test actualizare minute\n');

console.log('   Marchează cota 1.50 la minutul 55...');
const updateOdd150 = NotificationTracker.markOdd150(testNotification.id, 55);
if (updateOdd150) {
    console.log('   ✅ Actualizat cu succes!\n');
} else {
    console.log('   ❌ Eroare la actualizare!\n');
}

console.log('   Marchează cota 2.00 la minutul 68...');
const updateOdd200 = NotificationTracker.markOdd200(testNotification.id, 68);
if (updateOdd200) {
    console.log('   ✅ Actualizat cu succes!\n');
} else {
    console.log('   ❌ Eroare la actualizare!\n');
}

// Test 5: Verifică notificarea actualizată
console.log('🔍 TEST 5: Verificare notificare actualizată\n');

const allNotifications = NotificationTracker.getAllNotifications();
const updatedNotification = allNotifications.find(n => n.id === testNotification.id);

if (updatedNotification) {
    console.log('   Match:', updatedNotification.match);
    console.log('   Event:', updatedNotification.event);
    console.log('   Initial odd:', updatedNotification.initial_odd);
    console.log('   Minute odd 1.50:', updatedNotification.minute_odd_1_50);
    console.log('   Minute odd 2.00:', updatedNotification.minute_odd_2_00);
    console.log('   Minute fulfilled:', updatedNotification.minute_fulfilled);
    console.log('   Status:', updatedNotification.status);
    console.log('');
}

// Test 6: Test marcare ca îndeplinit
console.log('✅ TEST 6: Test marcare ca îndeplinit\n');

console.log('   Marchează ca îndeplinit la minutul 73...');
const markFulfilled = NotificationTracker.markFulfilled(testNotification.id, 73);
if (markFulfilled) {
    console.log('   ✅ Marcat ca COMPLETED!\n');
} else {
    console.log('   ❌ Eroare la marcare!\n');
}

// Test 7: Statistici finale
console.log('📈 TEST 7: Statistici finale\n');

const finalStats = NotificationTracker.generateStats();
console.log(`   Total: ${finalStats.total}`);
console.log(`   Monitoring: ${finalStats.monitoring}`);
console.log(`   Completed: ${finalStats.completed}`);
console.log(`   Failed: ${finalStats.failed}`);
console.log(`   Success rate: ${finalStats.successRate}%\n`);

// Test 8: Test monitor (opțional - doar un ciclu)
console.log('🔔 TEST 8: Test monitor (un singur ciclu)\n');
console.log('   ⚠️  NOTA: Monitorul va încerca să verifice meciul TEST_MATCH_123');
console.log('   Este normal să apară erori pentru că meciul nu există pe Flashscore\n');

console.log('   Apasă Ctrl+C pentru a opri după ce vezi verificarea...\n');

setTimeout(() => {
    NotificationMonitor.checkAll().then(() => {
        console.log('\n✅ TEST COMPLET!\n');
        console.log('💾 Verifică fișierul: notifications_tracking.json\n');
        console.log('='.repeat(80) + '\n');

        process.exit(0);
    }).catch(error => {
        console.error('❌ Eroare în monitor:', error.message);
        process.exit(1);
    });
}, 2000);
