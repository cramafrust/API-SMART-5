/**
 * TEST ODD NOTIFICATIONS
 *
 * Testează trimiterea notificărilor când cota ajunge la 1.50 și 2.00
 */

const Odd150Notifier = require('./ODD_150_NOTIFIER');

console.log('\n' + '='.repeat(80));
console.log('🧪 TEST NOTIFICĂRI COTE 1.50 ȘI 2.00');
console.log('='.repeat(80) + '\n');

// Notificare de test
const testNotification = {
    id: 'TEST_MATCH_123_1733234567890',
    date: '03.12.2025',
    match: 'Manchester City vs Liverpool',
    matchId: 'TEST_MATCH_123',
    homeTeam: 'Manchester City',
    awayTeam: 'Liverpool',
    event: 'Echipa gazdă va marca în repriza 2',
    initial_odd: 1.35,
    probability: 85,
    minute_odd_1_50: null,
    minute_odd_2_00: null,
    minute_fulfilled: null,
    status: 'MONITORING',
    pattern: {
        name: 'GOL_GAZDA_REPRIZA_2',
        team: 'gazda',
        half: 2,
        probability: 85
    }
};

async function testOddNotifications() {
    console.log('📧 TEST 1: Notificare COTA 1.50\n');

    const result150 = await Odd150Notifier.sendOdd150Notification(testNotification, 58);

    if (result150.success) {
        console.log('✅ Email COTA 1.50 trimis cu succes!');
        console.log(`   Message ID: ${result150.messageId}`);
        console.log(`   Subject: ${result150.subject}\n`);
    } else {
        console.log('❌ Eroare trimitere email COTA 1.50');
        console.log(`   Motiv: ${result150.reason || result150.error}\n`);
    }

    // Așteaptă 2 secunde între email-uri
    await new Promise(resolve => setTimeout(resolve, 2000));

    console.log('📧 TEST 2: Notificare COTA 2.00 (minut 68 ≤ 75)\n');

    const result200 = await Odd150Notifier.sendOdd200Notification(testNotification, 68);

    if (result200.success) {
        console.log('✅ Email COTA 2.00 trimis cu succes!');
        console.log(`   Message ID: ${result200.messageId}`);
        console.log(`   Subject: ${result200.subject}\n`);
    } else {
        console.log('❌ Eroare trimitere email COTA 2.00');
        console.log(`   Motiv: ${result200.reason || result200.error}\n`);
    }

    console.log('='.repeat(80));
    console.log('\n✅ TEST COMPLET!\n');
    console.log('📬 Verifică inbox-ul: mihai.florian@yahoo.com\n');
    console.log('📋 Ar trebui să ai 2 email-uri:');
    console.log('   1. ⚡ Notificare COTA 1.50');
    console.log('   2. 🚀 Notificare COTA 2.00\n');
    console.log('='.repeat(80) + '\n');
}

// Rulează testul
testOddNotifications().catch(error => {
    console.error('❌ Eroare în test:', error);
    process.exit(1);
});
