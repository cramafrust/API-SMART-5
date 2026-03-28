/**
 * 📊 DAILY_REPORT_GENERATOR.js
 *
 * Generează raport zilnic cu toate notificările din ziua anterioară
 * Include: pattern-uri, pronosticuri, cote, validări, success rate
 *
 * USAGE:
 *   node DAILY_REPORT_GENERATOR.js              # Raport pentru ieri
 *   node DAILY_REPORT_GENERATOR.js 2026-01-25   # Raport pentru dată specifică
 */

const fs = require('fs');
const path = require('path');
const PatternDescriptor = require('./PATTERN_DESCRIPTOR');

/**
 * Obține data de ieri în format YYYY-MM-DD
 */
function getYesterdayDate() {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    return yesterday.toISOString().split('T')[0];
}

/**
 * Verifică dacă o notificare este din data specificată
 */
function isFromDate(notification, targetDate) {
    const notifDate = new Date(notification.timestamp);
    const notifDateStr = notifDate.toISOString().split('T')[0];
    return notifDateStr === targetDate;
}

/**
 * Generează raport HTML pentru notificările din ziua specificată
 */
function generateDailyReport(targetDate) {
    console.log(`\n📊 GENERARE RAPORT ZILNIC pentru ${targetDate}\n`);
    console.log('='.repeat(60));

    // Încarcă notificările din tracker-ul ACTIV
    const activeTrackingFile = path.join(__dirname, 'notifications_tracking.json');
    const legacyTrackingFile = path.join(__dirname, 'archive', 'notifications-tracking-LEGACY-20260130.json');

    let notifications = [];

    // ÎNCarcă din fișierul ACTIV
    if (fs.existsSync(activeTrackingFile)) {
        try {
            const activeData = JSON.parse(fs.readFileSync(activeTrackingFile, 'utf8'));
            notifications = activeData.notifications || [];
            console.log(`✅ Notificări active încărcate: ${notifications.length}`);
        } catch (err) {
            console.error(`⚠️  Eroare la citire fișier activ: ${err.message}`);
        }
    }

    // ADAUGĂ și notificările din arhiva LEGACY (pentru rapoarte istorice)
    if (fs.existsSync(legacyTrackingFile)) {
        try {
            const legacyData = JSON.parse(fs.readFileSync(legacyTrackingFile, 'utf8'));
            const legacyNotifications = legacyData.notifications || [];
            console.log(`✅ Notificări legacy încărcate: ${legacyNotifications.length}`);

            // Merge ambele liste
            notifications = [...notifications, ...legacyNotifications];
            console.log(`📊 Total notificări disponibile: ${notifications.length}`);
        } catch (err) {
            console.error(`⚠️  Eroare la citire fișier legacy: ${err.message}`);
        }
    }

    // Filtrează notificările din ziua specificată
    const dailyNotifications = notifications.filter(n => isFromDate(n, targetDate));

    console.log(`📋 Notificări găsite pentru ${targetDate}: ${dailyNotifications.length}`);

    if (dailyNotifications.length === 0) {
        return {
            html: generateEmptyReport(targetDate),
            stats: {
                total: 0,
                validated: 0,
                won: 0,
                lost: 0,
                unknown: 0,
                successRate: 0
            }
        };
    }

    // Calculează statistici
    const stats = {
        total: 0,
        validated: 0,
        won: 0,
        lost: 0,
        unknown: 0,
        pending: 0
    };

    const matches = [];

    dailyNotifications.forEach(notification => {
        const match = notification.match;

        // COMPATIBILITATE: Suport pentru AMBELE formate
        // Format NOU: pattern (singular, obiect)
        // Format VECHI: patterns (plural, array)
        let patterns = [];
        if (notification.patterns && Array.isArray(notification.patterns)) {
            // Format VECHI - array de patterns
            patterns = notification.patterns;
        } else if (notification.pattern && typeof notification.pattern === 'object') {
            // Format NOU - un singur pattern ca obiect
            // Convertim la format array pentru procesare uniformă

            // Skip notificări de test sau incomplete (fără pattern.team)
            if (!notification.pattern.team) {
                console.log(`⚠️  Skip notificare test/incompletă: ${notification.match || notification.id}`);
                return; // Skip această notificare
            }

            // Traduce "team" din "gazda"/"oaspete" în homeTeam/awayTeam
            let teamName = notification.pattern.team;
            if (teamName === 'gazda' || teamName === 'home') {
                teamName = notification.homeTeam;
            } else if (teamName === 'oaspete' || teamName === 'away') {
                teamName = notification.awayTeam;
            }

            patterns = [{
                patternName: notification.pattern.name,
                teamName: teamName,
                probability: notification.probability,
                odds: {
                    superbet: {},
                    netbet: {}
                }
            }];
        }

        patterns.forEach(pattern => {
            stats.total++;

            // Găsește rezultatul validării pentru acest pattern
            let validationResult = null;
            if (notification.validationDetails?.patterns) {
                // Caută în validationDetails.patterns - match pe pattern name
                // Suportă ambele: team ca "gazda"/"oaspete" sau ca nume echipă
                validationResult = notification.validationDetails.patterns.find(
                    vp => vp.pattern === pattern.patternName
                );
            }

            let status = 'PENDING';
            let statusClass = 'pending';
            let statusIcon = '⏳';
            let validationReason = 'În așteptare validare';

            // PRIORITATE 1: validation_result (câmpul setat de RESULTS_VALIDATOR)
            if (notification.validation_result === 'won') {
                stats.validated++;
                status = 'CÂȘTIGAT';
                statusClass = 'won';
                statusIcon = '✅';
                stats.won++;
                validationReason = validationResult?.reason || 'Pronostic câștigat';
            } else if (notification.validation_result === 'lost') {
                stats.validated++;
                status = 'PIERDUT';
                statusClass = 'lost';
                statusIcon = '❌';
                stats.lost++;
                validationReason = validationResult?.reason || 'Pronostic pierdut';
            } else if (notification.validation_result === 'unknown') {
                stats.validated++;
                status = 'NECUNOSCUT';
                statusClass = 'unknown';
                statusIcon = '⚠️';
                stats.unknown++;
                validationReason = validationResult?.reason || 'Date insuficiente pentru validare';
            }
            // PRIORITATE 2: validationDetails.patterns (format vechi)
            else if (validationResult) {
                stats.validated++;
                if (validationResult.success === true) {
                    status = 'CÂȘTIGAT';
                    statusClass = 'won';
                    statusIcon = '✅';
                    stats.won++;
                } else if (validationResult.success === false) {
                    status = 'PIERDUT';
                    statusClass = 'lost';
                    statusIcon = '❌';
                    stats.lost++;
                } else {
                    status = 'NECUNOSCUT';
                    statusClass = 'unknown';
                    statusIcon = '⚠️';
                    stats.unknown++;
                }
                validationReason = validationResult.reason || 'Validat';
            }
            // PRIORITATE 3: notification.validated === true dar fără validation_result
            else if (notification.validated === true) {
                stats.validated++;
                status = 'NECUNOSCUT';
                statusClass = 'unknown';
                statusIcon = '⚠️';
                stats.unknown++;
                validationReason = 'Validat dar rezultat nedeterminat';
            } else {
                stats.pending++;
            }

            // Extrage cotele relevante
            let oddsSuperbet = null;
            let oddsNetbet = null;

            if (validationResult?.odds) {
                // Format VECHI - cote din validationResult
                oddsSuperbet = validationResult.odds.superbet;
                oddsNetbet = validationResult.odds.netbet;
            } else if (notification.initial_odd) {
                // Format NOU - cotă inițială direct în notificare
                oddsSuperbet = notification.initial_odd;
                // Pentru format nou, folosim minute_odd_X_XX dacă există
                if (notification.minute_odd_1_50) oddsSuperbet = notification.minute_odd_1_50;
                if (notification.minute_odd_2_00) oddsSuperbet = notification.minute_odd_2_00;
            } else if (pattern.odds) {
                // Fallback la cotele din pattern (format vechi)
                if (pattern.patternName.match(/PATTERN_[1248]\./) || pattern.patternName.match(/PATTERN_7\./)) {
                    oddsSuperbet = pattern.odds.superbet?.team_to_score_2h;
                    oddsNetbet = pattern.odds.netbet?.team_to_score_2h;
                } else if (pattern.patternName.match(/PATTERN_3\./)) {
                    oddsSuperbet = pattern.odds.superbet?.match_over_2_5;
                    oddsNetbet = pattern.odds.netbet?.match_over_2_5;
                } else if (pattern.patternName.match(/PATTERN_[56]\./)) {
                    oddsSuperbet = pattern.odds.superbet?.team_corners_2h_over_2;
                    oddsNetbet = pattern.odds.netbet?.team_corners_2h_over_2;
                }
            }

            // Generează descriere clară pentru pattern
            const patternDescription = PatternDescriptor.formatExplicitMessage(
                pattern.patternName,
                pattern.teamName,
                pattern.probability,
                notification.statistics || {}
            );

            matches.push({
                date: notification.date || new Date(notification.timestamp).toLocaleDateString('ro-RO'),
                time: new Date(notification.timestamp).toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' }),
                homeTeam: notification.homeTeam || match?.homeTeam || 'N/A',
                awayTeam: notification.awayTeam || match?.awayTeam || 'N/A',
                league: notification.league || match?.league || 'N/A',
                htScore: notification.htScore || match?.htScore ||
                    notification.validationDetails?.htScore ||
                    (notification.result?.halftime?.score ? `${notification.result.halftime.score.home}-${notification.result.halftime.score.away}` : '-'),
                ftScore: notification.validationDetails?.finalScore ||
                    (notification.result?.fulltime?.score ? `${notification.result.fulltime.score.home}-${notification.result.fulltime.score.away}` : '-'),
                pattern: pattern.patternName,
                patternDescription: patternDescription,
                team: pattern.teamName,
                probability: pattern.probability,
                oddsSuperbet: oddsSuperbet || '-',
                oddsNetbet: oddsNetbet || '-',
                status: status,
                statusClass: statusClass,
                statusIcon: statusIcon,
                reason: validationReason
            });
        });
    });

    // Calculează success rate
    const validatedCount = stats.won + stats.lost;
    stats.successRate = validatedCount > 0 ? ((stats.won / validatedCount) * 100).toFixed(1) : 0;

    // Generează HTML
    const html = generateHTMLReport(targetDate, matches, stats);

    console.log('\n📊 STATISTICI:');
    console.log(`   Total pronosticuri: ${stats.total}`);
    console.log(`   Validate: ${stats.validated}`);
    console.log(`   ✅ Câștigate: ${stats.won}`);
    console.log(`   ❌ Pierdute: ${stats.lost}`);
    console.log(`   ⚠️  Necunoscute: ${stats.unknown}`);
    console.log(`   ⏳ În așteptare: ${stats.pending}`);
    console.log(`   📈 Success rate: ${stats.successRate}%`);
    console.log('='.repeat(60));

    return { html, stats, matches };
}

/**
 * Generează raport HTML gol (când nu sunt notificări)
 */
function generateEmptyReport(targetDate) {
    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Raport Zilnic - ${targetDate}</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; background: #f5f5f5; }
        .container { max-width: 800px; margin: 0 auto; background: white; padding: 20px; border-radius: 8px; }
        h1 { color: #2c3e50; text-align: center; }
        .empty { text-align: center; padding: 40px; color: #7f8c8d; }
    </style>
</head>
<body>
    <div class="container">
        <h1>📊 Raport Zilnic - ${targetDate}</h1>
        <div class="empty">
            <h2>😴 Nu sunt notificări pentru această zi</h2>
            <p>Nu au fost trimise notificări în data de ${targetDate}</p>
        </div>
    </div>
</body>
</html>`;
}

/**
 * Generează raport HTML complet
 */
function generateHTMLReport(targetDate, matches, stats) {
    const successRateColor = stats.successRate >= 70 ? '#27ae60' : stats.successRate >= 50 ? '#f39c12' : '#e74c3c';

    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Raport Zilnic - ${targetDate}</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            margin: 0;
            padding: 20px;
            background: #f5f5f5;
        }
        .container {
            max-width: 1200px;
            margin: 0 auto;
            background: white;
            padding: 20px;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        h1 {
            color: #2c3e50;
            text-align: center;
            margin-bottom: 10px;
        }
        .date {
            text-align: center;
            color: #7f8c8d;
            font-size: 18px;
            margin-bottom: 30px;
        }
        .stats {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
            gap: 15px;
            margin-bottom: 30px;
        }
        .stat-card {
            background: #ecf0f1;
            padding: 15px;
            border-radius: 6px;
            text-align: center;
        }
        .stat-card.success {
            background: #d5f4e6;
            border: 2px solid #27ae60;
        }
        .stat-value {
            font-size: 32px;
            font-weight: bold;
            color: #2c3e50;
        }
        .stat-label {
            font-size: 14px;
            color: #7f8c8d;
            margin-top: 5px;
        }
        table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 20px;
        }
        th {
            background: #34495e;
            color: white;
            padding: 12px;
            text-align: left;
            font-weight: normal;
        }
        td {
            padding: 10px;
            border-bottom: 1px solid #ecf0f1;
        }
        tr:hover {
            background: #f8f9fa;
        }
        .status {
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 12px;
            font-weight: bold;
            display: inline-block;
        }
        .status.won {
            background: #d5f4e6;
            color: #27ae60;
        }
        .status.lost {
            background: #fadbd8;
            color: #e74c3c;
        }
        .status.unknown {
            background: #fef5e7;
            color: #f39c12;
        }
        .status.pending {
            background: #e8f8f5;
            color: #16a085;
        }
        .odds {
            font-weight: bold;
            color: #e67e22;
        }
        .probability {
            color: #3498db;
            font-weight: bold;
        }
        .footer {
            text-align: center;
            margin-top: 30px;
            padding-top: 20px;
            border-top: 2px solid #ecf0f1;
            color: #7f8c8d;
            font-size: 12px;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>📊 Raport Zilnic Pronosticuri</h1>
        <div class="date">${targetDate}</div>

        <div class="stats">
            <div class="stat-card">
                <div class="stat-value">${stats.total}</div>
                <div class="stat-label">Total Pronosticuri</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">${stats.validated}</div>
                <div class="stat-label">Validate</div>
            </div>
            <div class="stat-card">
                <div class="stat-value" style="color: #27ae60;">✅ ${stats.won}</div>
                <div class="stat-label">Câștigate</div>
            </div>
            <div class="stat-card">
                <div class="stat-value" style="color: #e74c3c;">❌ ${stats.lost}</div>
                <div class="stat-label">Pierdute</div>
            </div>
            <div class="stat-card">
                <div class="stat-value" style="color: #f39c12;">⚠️ ${stats.unknown}</div>
                <div class="stat-label">Necunoscute</div>
            </div>
            <div class="stat-card success">
                <div class="stat-value" style="color: ${successRateColor};">${stats.successRate}%</div>
                <div class="stat-label">Success Rate</div>
            </div>
        </div>

        <table>
            <thead>
                <tr>
                    <th>Oră</th>
                    <th>Meci</th>
                    <th>Liga</th>
                    <th>HT</th>
                    <th>FT</th>
                    <th>Eveniment Sugerat</th>
                    <th>Prob.</th>
                    <th>Cotă SB</th>
                    <th>Cotă NB</th>
                    <th>Status</th>
                </tr>
            </thead>
            <tbody>
                ${matches.map(m => `
                <tr>
                    <td>${m.time}</td>
                    <td><strong>${m.homeTeam}</strong> vs ${m.awayTeam}</td>
                    <td style="font-size: 11px;">${m.league}</td>
                    <td>${m.htScore}</td>
                    <td>${m.ftScore}</td>
                    <td style="font-size: 10px; max-width: 400px;">
                        <strong>${m.patternDescription}</strong><br>
                        <span style="color: #7f8c8d; font-size: 9px;">${m.pattern} | ${m.team}</span>
                    </td>
                    <td class="probability">${m.probability}%</td>
                    <td class="odds">${m.oddsSuperbet}</td>
                    <td class="odds">${m.oddsNetbet}</td>
                    <td><span class="status ${m.statusClass}">${m.statusIcon} ${m.status}</span></td>
                </tr>
                `).join('')}
            </tbody>
        </table>

        <div class="footer">
            <p style="margin: 10px 0; color: #7f8c8d; font-size: 11px;">
                <strong>Notă despre cote:</strong> Cotele afișate (SB = Superbet, NB = Netbet) sunt cele de la momentul
                notificării (pauză/HT). Acestea pot varia în repriza a 2-a în funcție de evoluția meciului.
            </p>
            <p style="margin: 10px 0; color: #7f8c8d; font-size: 11px;">
                <strong>Status:</strong> ✅ CÂȘTIGAT = pronosticul s-a îndeplinit | ❌ PIERDUT = pronosticul nu s-a îndeplinit |
                ⚠️ NECUNOSCUT = lipsesc date pentru validare | ⏳ PENDING = în așteptarea validării
            </p>
            <hr style="border: none; border-top: 1px solid #ecf0f1; margin: 15px 0;">
            🤖 Generat automat de API SMART 5 - Auto-Validation System<br>
            ${new Date().toLocaleString('ro-RO')}
        </div>
    </div>
</body>
</html>`;
}

/**
 * Salvează raportul în fișier HTML
 */
function saveReport(html, targetDate) {
    const reportsDir = path.join(__dirname, 'reports');
    if (!fs.existsSync(reportsDir)) {
        fs.mkdirSync(reportsDir, { recursive: true });
    }

    const filename = `daily-report-${targetDate}.html`;
    const filepath = path.join(reportsDir, filename);

    fs.writeFileSync(filepath, html, 'utf8');
    console.log(`\n✅ Raport salvat: ${filepath}`);

    return filepath;
}

// Export
module.exports = {
    generateDailyReport,
    saveReport,
    getYesterdayDate
};

// CLI usage
if (require.main === module) {
    const targetDate = process.argv[2] || getYesterdayDate();

    console.log(`\n📊 DAILY REPORT GENERATOR\n`);
    console.log('='.repeat(60));

    const { html, stats } = generateDailyReport(targetDate);
    const filepath = saveReport(html, targetDate);

    console.log(`\n📁 Raport generat: ${filepath}`);
    console.log(`\n💡 Deschide în browser pentru a vizualiza raportul\n`);
}
