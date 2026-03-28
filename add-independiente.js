const tracker = require('./NOTIFICATION_TRACKER');

console.log('🇦🇷 Adaug INDEPENDIENTE vs VELEZ SARSFIELD în monitorizare...');
console.log('');

const today = new Date().toLocaleDateString('ro-RO');

// Adaugă meciul direct în tracker
const notification = {
    id: 'ARG_INDEPENDIENTE_' + Date.now(),
    match: 'Independiente vs Velez Sarsfield',
    homeTeam: 'Independiente',
    awayTeam: 'Velez Sarsfield',
    league: 'Argentina Primera Division',
    date: today,
    time: new Date().toLocaleTimeString('ro-RO'),
    event: 'UN GOL în repriza 2',
    pattern: { name: 'MONITORIZARE LIVE ARGENTINA' },
    probability: 'LIVE TEST',
    status: 'MONITORING',
    skipMinuteFilter: true,
    oddsMonitoringFailed: false,
    minute_odd_1_50: null,
    minute_odd_2_00: null
};

tracker.addNotification(notification);

console.log('✅ Meci adăugat în MONITORING:');
console.log('   ID:', notification.id);
console.log('   Match:', notification.match);
console.log('   Home:', notification.homeTeam);
console.log('   Away:', notification.awayTeam);
console.log('   Status:', notification.status);
console.log('   Date:', notification.date);
console.log('');

// Verifică că a fost adăugat
const active = tracker.getActiveMonitoring();
const independiente = active.find(m =>
    m.homeTeam === 'Independiente' ||
    m.match.includes('Independiente')
);

if (independiente) {
    console.log('🎯 CONFIRMARE - Meci în monitorizare:');
    console.log('   Total meciuri active:', active.length);
    console.log('   Match:', independiente.match);
    console.log('   Status:', independiente.status);
    console.log('');
    console.log('⏰ SIMPLE_ODDS_MONITOR va verifica cotele la următorul ciclu (max 2 min)');
    console.log('📧 Vei primi email automat când cota >= 1.5 și >= 2.0');
} else {
    console.log('❌ EROARE: Meciul nu a fost adăugat!');
}
