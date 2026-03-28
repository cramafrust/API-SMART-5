const fs = require('fs');
const XLSX = require('xlsx');

console.log('📊 Încărcare date din notifications-tracking.json...');

// Citește fișierul JSON
const fileData = JSON.parse(fs.readFileSync('./notifications-tracking.json', 'utf8'));
const data = fileData.notifications || [];

console.log(`✓ Încărcat ${data.length} notificări`);
console.log(`✓ Metadata: Created ${fileData.metadata?.createdAt || 'N/A'}, Version ${fileData.metadata?.version || 'N/A'}`);

// Pregătește datele pentru Excel
const excelData = [];

data.forEach((notification, index) => {
    const match = notification.match || {};
    const patterns = notification.patterns || [];

    // Dacă nu există pattern-uri, adaugă o linie cu datele de bază
    if (patterns.length === 0) {
        excelData.push({
            'Nr': index + 1,
            'ID': notification.id || '',
            'Data/Ora': notification.timestamp || '',
            'Meci': `${match.homeTeam || ''} vs ${match.awayTeam || ''}`,
            'Liga': match.league || '',
            'Scor HT': match.htScore || '',
            'Pattern': '',
            'Echipa': '',
            'Probabilitate': '',
            'Tier': '',
            'Piata': '',
            'Pronostic': '',
            'Cota Superbet': '',
            'Cota Netbet': '',
            'Rezultat': notification.result || 'PENDING',
            'Validat': notification.validated ? 'DA' : 'NU',
            'Data Validare': notification.validatedAt || ''
        });
    } else {
        // Adaugă o linie pentru fiecare pattern detectat
        patterns.forEach(pattern => {
            const prediction = pattern.prediction || {};
            const oddsSuperbet = pattern.odds?.superbet || {};
            const oddsNetbet = pattern.odds?.netbet || {};

            // Găsește rezultatul validării pentru acest pattern (dacă există)
            let validationResult = null;
            let relevantOddsSuperbet = '';
            let relevantOddsNetbet = '';

            if (notification.validationDetails?.patterns) {
                validationResult = notification.validationDetails.patterns.find(
                    vp => vp.pattern === pattern.patternName && vp.team === pattern.teamName
                );

                // Folosește cotele salvate din validare (cotele relevante pentru pronostic)
                if (validationResult?.odds) {
                    relevantOddsSuperbet = validationResult.odds.superbet || '';
                    relevantOddsNetbet = validationResult.odds.netbet || '';
                }
            }

            // Fallback: dacă nu avem cote din validare, încearcă să le găsești din pattern.odds
            if (!relevantOddsSuperbet && pattern.odds?.superbet) {
                // Determină cota relevantă
                if (pattern.patternName.match(/PATTERN_[1248]\./) || pattern.patternName.match(/PATTERN_7\./)) {
                    relevantOddsSuperbet = pattern.odds.superbet.team_to_score_2h || '';
                } else if (pattern.patternName.match(/PATTERN_3\./)) {
                    relevantOddsSuperbet = pattern.odds.superbet.match_over_2_5 || '';
                } else if (pattern.patternName.match(/PATTERN_[56]\./)) {
                    relevantOddsSuperbet = pattern.odds.superbet.team_corners_2h_over_2 || '';
                }
            }

            if (!relevantOddsNetbet && pattern.odds?.netbet) {
                if (pattern.patternName.match(/PATTERN_[1248]\./) || pattern.patternName.match(/PATTERN_7\./)) {
                    relevantOddsNetbet = pattern.odds.netbet.team_to_score_2h || '';
                } else if (pattern.patternName.match(/PATTERN_3\./)) {
                    relevantOddsNetbet = pattern.odds.netbet.match_over_2_5 || '';
                } else if (pattern.patternName.match(/PATTERN_[56]\./)) {
                    relevantOddsNetbet = pattern.odds.netbet.team_corners_2h_over_2 || '';
                }
            }

            // Status pronostic
            let statusPronostic = 'PENDING';
            if (validationResult) {
                if (validationResult.success === true) statusPronostic = 'CÂȘTIGAT';
                else if (validationResult.success === false) statusPronostic = 'PIERDUT';
                else statusPronostic = 'NECUNOSCUT';
            }

            excelData.push({
                'Nr': index + 1,
                'ID': notification.id || '',
                'Data/Ora': notification.timestamp || '',
                'Meci': `${match.homeTeam || ''} vs ${match.awayTeam || ''}`,
                'Liga': match.league || '',
                'Scor HT': match.htScore || '',
                'Scor FT': notification.validationDetails?.finalScore || '',
                'Pattern': pattern.patternName || '',
                'Echipa': pattern.teamName || '',
                'Probabilitate': pattern.probability ? `${pattern.probability}%` : '',
                'Tier': pattern.tier || '',
                'Piata': prediction.market || '',
                'Pronostic': prediction.bet || '',
                'Cota Superbet': relevantOddsSuperbet,
                'Cota Netbet': relevantOddsNetbet,
                'Status': statusPronostic,
                'Validat': notification.validated ? 'DA' : 'NU',
                'Data Validare': notification.validatedAt || ''
            });
        });
    }
});

console.log(`✓ Procesat ${excelData.length} linii pentru export`);

// Creează workbook și worksheet
const wb = XLSX.utils.book_new();
const ws = XLSX.utils.json_to_sheet(excelData);

// Setează width-ul coloanelor
const colWidths = [
    { wch: 5 },  // Nr
    { wch: 25 }, // ID
    { wch: 20 }, // Data/Ora
    { wch: 35 }, // Meci
    { wch: 30 }, // Liga
    { wch: 10 }, // Scor HT
    { wch: 30 }, // Pattern
    { wch: 20 }, // Echipa
    { wch: 12 }, // Probabilitate
    { wch: 10 }, // Tier
    { wch: 25 }, // Piata
    { wch: 15 }, // Pronostic
    { wch: 15 }, // Cota Superbet
    { wch: 15 }, // Cota Netbet
    { wch: 12 }, // Rezultat
    { wch: 10 }, // Validat
    { wch: 20 }  // Data Validare
];
ws['!cols'] = colWidths;

// Adaugă worksheet la workbook
XLSX.utils.book_append_sheet(wb, ws, 'Pronosticuri');

// Creează și un sheet cu statistici
const statsData = [];

// Calcul statistici generale
const totalNotifications = data.length;
const validated = data.filter(n => n.validated).length;
const pending = totalNotifications - validated;

const resultStats = {
    won: data.filter(n => n.result === 'WON').length,
    lost: data.filter(n => n.result === 'LOST').length,
    pending: data.filter(n => !n.result || n.result === 'PENDING').length
};

const successRate = validated > 0 ? ((resultStats.won / validated) * 100).toFixed(2) : '0.00';

statsData.push(
    { 'Statistică': 'Total Notificări', 'Valoare': totalNotifications },
    { 'Statistică': 'Validate', 'Valoare': validated },
    { 'Statistică': 'În Așteptare', 'Valoare': pending },
    { 'Statistică': '', 'Valoare': '' },
    { 'Statistică': 'Pronosticuri Câștigate', 'Valoare': resultStats.won },
    { 'Statistică': 'Pronosticuri Pierdute', 'Valoare': resultStats.lost },
    { 'Statistică': 'În Derulare', 'Valoare': resultStats.pending },
    { 'Statistică': '', 'Valoare': '' },
    { 'Statistică': 'Rată de Succes', 'Valoare': `${successRate}%` }
);

// Statistici pe pattern-uri
const patternStats = {};
data.forEach(notification => {
    (notification.patterns || []).forEach(pattern => {
        const name = pattern.patternName || 'Unknown';
        if (!patternStats[name]) {
            patternStats[name] = { total: 0, won: 0, lost: 0 };
        }
        patternStats[name].total++;
        if (notification.result === 'WON') patternStats[name].won++;
        if (notification.result === 'LOST') patternStats[name].lost++;
    });
});

statsData.push({ 'Statistică': '', 'Valoare': '' });
statsData.push({ 'Statistică': 'STATISTICI PE PATTERN-URI', 'Valoare': '' });
statsData.push({ 'Statistică': '', 'Valoare': '' });

Object.entries(patternStats).forEach(([pattern, stats]) => {
    const rate = (stats.won + stats.lost) > 0
        ? ((stats.won / (stats.won + stats.lost)) * 100).toFixed(2)
        : '0.00';

    statsData.push({
        'Statistică': pattern,
        'Valoare': `Total: ${stats.total} | Won: ${stats.won} | Lost: ${stats.lost} | Rate: ${rate}%`
    });
});

const wsStats = XLSX.utils.json_to_sheet(statsData);
wsStats['!cols'] = [{ wch: 40 }, { wch: 60 }];
XLSX.utils.book_append_sheet(wb, wsStats, 'Statistici');

// Salvează fișierul Excel
const fileName = `Pronosticuri_Export_${new Date().toISOString().split('T')[0]}.xlsx`;
XLSX.writeFile(wb, fileName);

console.log(`\n✅ Fișier Excel generat cu succes: ${fileName}`);
console.log(`\n📊 Rezumat:`);
console.log(`   • Total notificări: ${totalNotifications}`);
console.log(`   • Total linii în Excel: ${excelData.length}`);
console.log(`   • Validate: ${validated}`);
console.log(`   • Rată de succes: ${successRate}%`);
console.log(`   • Sheets: Pronosticuri (date complete) + Statistici`);
