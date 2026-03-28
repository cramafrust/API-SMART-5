/**
 * 🧪 TEST REPORT SCHEDULER - Verificare funcționare scheduler
 *
 * Pornește scheduler-ul pentru 10 secunde și verifică status
 */

const reportScheduler = require('./REPORT_SCHEDULER');

console.log('');
console.log('='.repeat(60));
console.log('🧪 TEST REPORT SCHEDULER');
console.log('='.repeat(60));
console.log('');

// Pornește scheduler
console.log('📅 Pornire scheduler...');
reportScheduler.start();

// Afișează status după 2 secunde
setTimeout(() => {
    console.log('');
    console.log('📊 STATUS SCHEDULER:');
    const status = reportScheduler.getStatus();
    console.log(JSON.stringify(status, null, 2));
    console.log('');
}, 2000);

// Oprește după 10 secunde
setTimeout(() => {
    console.log('⏹️  Oprire scheduler...');
    reportScheduler.stop();

    console.log('');
    console.log('✅ Test complet!');
    console.log('='.repeat(60));
    console.log('');

    process.exit(0);
}, 10000);

console.log('⏰ Test va rula 10 secunde...');
console.log('');
