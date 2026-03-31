/**
 * 📊 MONTHLY REPORT GENERATOR
 *
 * Generează raport lunar COMPLET cu toate notificările:
 * - Data eveniment
 * - Echipe (GAZDĂ - OASPETE)
 * - Ligă
 * - Pattern detectat
 * - Probabilitate (%)
 * - Cotă inițială
 * - Cotă 1.50 (DA/NU + minut)
 * - Cotă 2.00 (DA/NU + minut)
 * - Rezultat (CÂȘTIGAT/PIERDUT/În așteptare)
 * - Scor final (dacă validat)
 *
 * USAGE:
 *   node MONTHLY_REPORT_GENERATOR.js              # Luna curentă
 *   node MONTHLY_REPORT_GENERATOR.js 2026-01      # Luna specifică
 */

const fs = require('fs');
const path = require('path');
const tracker = require('./NOTIFICATION_TRACKER');

/**
 * Obține anul și luna curentă în format YYYY-MM
 */
function getCurrentMonth() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}`;
}

/**
 * Obține numele lunii în română
 */
function getMonthName(yearMonth) {
    const monthNames = {
        '01': 'Ianuarie',
        '02': 'Februarie',
        '03': 'Martie',
        '04': 'Aprilie',
        '05': 'Mai',
        '06': 'Iunie',
        '07': 'Iulie',
        '08': 'August',
        '09': 'Septembrie',
        '10': 'Octombrie',
        '11': 'Noiembrie',
        '12': 'Decembrie'
    };

    const [year, month] = yearMonth.split('-');
    return `${monthNames[month]} ${year}`;
}

/**
 * Verifică dacă o notificare aparține lunii specificate
 */
function isInMonth(notification, targetMonth) {
    // timestamp format: "2026-01-30T21:45:00.000Z"
    // date format: "30.01.2026"

    // Încearcă să parsezi din timestamp
    if (notification.timestamp) {
        const notifDate = new Date(notification.timestamp);
        const notifMonth = `${notifDate.getFullYear()}-${String(notifDate.getMonth() + 1).padStart(2, '0')}`;
        return notifMonth === targetMonth;
    }

    // Fallback: parsează din date (DD.MM.YYYY)
    if (notification.date) {
        const [day, month, year] = notification.date.split('.');
        const notifMonth = `${year}-${month}`;
        return notifMonth === targetMonth;
    }

    return false;
}

/**
 * Formatează data în format DD.MM.YYYY
 */
function formatDate(notification) {
    if (notification.date) {
        return notification.date;
    }

    if (notification.timestamp) {
        const d = new Date(notification.timestamp);
        const day = String(d.getDate()).padStart(2, '0');
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const year = d.getFullYear();
        return `${day}.${month}.${year}`;
    }

    return 'N/A';
}

/**
 * Formatează ora în format HH:MM
 */
function formatTime(notification) {
    if (notification.timestamp) {
        const d = new Date(notification.timestamp);
        const hours = String(d.getHours()).padStart(2, '0');
        const minutes = String(d.getMinutes()).padStart(2, '0');
        return `${hours}:${minutes}`;
    }

    return 'N/A';
}

/**
 * Generează descrierea evenimentului (care echipă marchează)
 */
function generateEventDescription(notification) {
    const team = notification.team === 'gazda' ? notification.homeTeam : notification.awayTeam;

    // COMPATIBILITATE: pattern poate fi STRING (format vechi) SAU OBIECT (format nou)
    const patternName = typeof notification.pattern === 'string'
        ? notification.pattern
        : (notification.pattern?.name || '');

    // Pattern-uri echipă → Echipa marchează
    if (patternName.startsWith('PATTERN_1') ||
        patternName.startsWith('PATTERN_2') ||
        patternName.startsWith('PATTERN_3') ||
        patternName.startsWith('PATTERN_4') ||
        patternName.startsWith('PATTERN_5') ||
        patternName.startsWith('PATTERN_6')) {
        return `${team.toUpperCase()} MARCHEAZĂ`;
    }

    // Pattern-uri meci → Gol în meci
    if (patternName.startsWith('PATTERN_7') ||
        patternName.startsWith('PATTERN_8') ||
        patternName.startsWith('PATTERN_9')) {
        return 'GOL ÎN MECI';
    }

    // Pattern-uri cartonașe
    if (patternName.startsWith('PATTERN_10')) {
        return 'CARTONAȘ GALBEN';
    }

    return 'EVENIMENT';
}

/**
 * Generează raport lunar HTML
 */
function generateMonthlyReport(targetMonth) {
    console.log(`\n📊 GENERARE RAPORT LUNAR: ${getMonthName(targetMonth)}\n`);

    // Citește toate notificările
    const trackingData = tracker.readStorage();
    const allNotifications = trackingData.notifications || [];

    console.log(`   Total notificări în sistem: ${allNotifications.length}`);

    // Filtrează notificările din luna specificată
    const monthNotifications = allNotifications.filter(n => isInMonth(n, targetMonth));

    console.log(`   Notificări din ${getMonthName(targetMonth)}: ${monthNotifications.length}`);

    if (monthNotifications.length === 0) {
        console.log(`\n⚠️  Nu există notificări pentru ${getMonthName(targetMonth)}`);
        return null;
    }

    // Sortează după dată (cele mai vechi primele)
    monthNotifications.sort((a, b) => {
        const dateA = new Date(a.timestamp || a.date);
        const dateB = new Date(b.timestamp || b.date);
        return dateA - dateB;
    });

    // Calculează statistici
    const stats = {
        total: monthNotifications.length,
        validated: monthNotifications.filter(n => n.validated).length,
        won: monthNotifications.filter(n => n.validation_result === 'won').length,
        lost: monthNotifications.filter(n => n.validation_result === 'lost').length,
        pending: monthNotifications.filter(n => !n.validated).length,
        odd_150_reached: monthNotifications.filter(n => (n.odd_150_sent || n.minute_odd_1_50)).length,
        odd_200_reached: monthNotifications.filter(n => (n.odd_200_sent || n.minute_odd_2_00)).length,
        fulfilled: monthNotifications.filter(n => n.fulfilled).length
    };

    // Calculează rata de succes
    const successRate = stats.validated > 0
        ? ((stats.won / stats.validated) * 100).toFixed(1)
        : 0;

    console.log(`\n   📈 STATISTICI:`);
    console.log(`      Validate: ${stats.validated}`);
    console.log(`      CÂȘTIGAT: ${stats.won}`);
    console.log(`      PIERDUT: ${stats.lost}`);
    console.log(`      Rată succes: ${successRate}%`);
    console.log(`      Cotă 1.50: ${stats.odd_150_reached}`);
    console.log(`      Cotă 2.00: ${stats.odd_200_reached}`);

    // Generează HTML
    const html = generateHTML(targetMonth, monthNotifications, stats, successRate);

    return {
        html,
        stats,
        successRate,
        notifications: monthNotifications
    };
}

/**
 * Generează HTML pentru raportul lunar
 */
function generateHTML(targetMonth, notifications, stats, successRate) {
    const monthName = getMonthName(targetMonth);

    // Header HTML
    let html = `
<!DOCTYPE html>
<html lang="ro">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Raport Lunar ${monthName} - API SMART 5</title>
    <style>
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 1400px;
            margin: 0 auto;
            padding: 20px;
            background: #f5f5f5;
        }

        .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 40px;
            border-radius: 15px;
            text-align: center;
            margin-bottom: 30px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.2);
        }

        .header h1 {
            margin: 0 0 10px 0;
            font-size: 36px;
            font-weight: bold;
        }

        .header p {
            margin: 0;
            font-size: 18px;
            opacity: 0.9;
        }

        .stats-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 20px;
            margin-bottom: 30px;
        }

        .stat-card {
            background: white;
            padding: 25px;
            border-radius: 12px;
            text-align: center;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
            border-left: 5px solid #667eea;
        }

        .stat-card.success {
            border-left-color: #28a745;
        }

        .stat-card.danger {
            border-left-color: #dc3545;
        }

        .stat-card.warning {
            border-left-color: #ffc107;
        }

        .stat-card.info {
            border-left-color: #17a2b8;
        }

        .stat-label {
            font-size: 14px;
            color: #666;
            margin-bottom: 10px;
            text-transform: uppercase;
            letter-spacing: 1px;
        }

        .stat-value {
            font-size: 36px;
            font-weight: bold;
            color: #333;
        }

        .stat-subtext {
            font-size: 12px;
            color: #999;
            margin-top: 5px;
        }

        .table-container {
            background: white;
            border-radius: 12px;
            padding: 30px;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
            overflow-x: auto;
        }

        table {
            width: 100%;
            border-collapse: collapse;
            font-size: 14px;
        }

        th {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 15px 10px;
            text-align: left;
            font-weight: 600;
            text-transform: uppercase;
            font-size: 12px;
            letter-spacing: 0.5px;
            position: sticky;
            top: 0;
            z-index: 10;
        }

        td {
            padding: 12px 10px;
            border-bottom: 1px solid #e9ecef;
        }

        tr:hover {
            background: #f8f9fa;
        }

        .badge {
            display: inline-block;
            padding: 5px 12px;
            border-radius: 20px;
            font-size: 11px;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }

        .badge-success {
            background: #d4edda;
            color: #155724;
        }

        .badge-danger {
            background: #f8d7da;
            color: #721c24;
        }

        .badge-warning {
            background: #fff3cd;
            color: #856404;
        }

        .badge-info {
            background: #d1ecf1;
            color: #0c5460;
        }

        .badge-secondary {
            background: #e2e3e5;
            color: #383d41;
        }

        .team-name {
            font-weight: 600;
            color: #333;
        }

        .pattern {
            font-family: 'Courier New', monospace;
            background: #f8f9fa;
            padding: 3px 8px;
            border-radius: 4px;
            font-size: 12px;
        }

        .probability {
            font-weight: bold;
            font-size: 16px;
        }

        .probability.high {
            color: #28a745;
        }

        .probability.medium {
            color: #ffc107;
        }

        .probability.low {
            color: #dc3545;
        }

        .odd {
            font-weight: 600;
            color: #17a2b8;
        }

        .yes {
            color: #28a745;
            font-weight: bold;
        }

        .no {
            color: #999;
        }

        .minute {
            font-size: 11px;
            color: #666;
            font-style: italic;
        }

        .footer {
            text-align: center;
            margin-top: 30px;
            padding-top: 20px;
            border-top: 2px solid #e9ecef;
            color: #666;
            font-size: 13px;
        }

        .legend {
            background: #fff3cd;
            border-left: 5px solid #ffc107;
            padding: 15px;
            margin-bottom: 20px;
            border-radius: 8px;
        }

        .legend h3 {
            margin: 0 0 10px 0;
            font-size: 16px;
            color: #856404;
        }

        .legend ul {
            margin: 0;
            padding-left: 20px;
        }

        .legend li {
            font-size: 13px;
            color: #856404;
            margin-bottom: 5px;
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>📊 RAPORT LUNAR ${monthName}</h1>
        <p>API SMART 5 - Sistem Automat Detectare Pattern-uri</p>
    </div>

    <div class="stats-grid">
        <div class="stat-card">
            <div class="stat-label">Total Notificări</div>
            <div class="stat-value">${stats.total}</div>
            <div class="stat-subtext">Trimise în ${monthName}</div>
        </div>

        <div class="stat-card success">
            <div class="stat-label">Câștigat</div>
            <div class="stat-value">${stats.won}</div>
            <div class="stat-subtext">${successRate}% rată succes</div>
        </div>

        <div class="stat-card danger">
            <div class="stat-label">Pierdut</div>
            <div class="stat-value">${stats.lost}</div>
            <div class="stat-subtext">${stats.validated > 0 ? ((stats.lost / stats.validated) * 100).toFixed(1) : 0}% rată eșec</div>
        </div>

        <div class="stat-card warning">
            <div class="stat-label">În Așteptare</div>
            <div class="stat-value">${stats.pending}</div>
            <div class="stat-subtext">Nevalidate încă</div>
        </div>

        <div class="stat-card info">
            <div class="stat-label">Cotă 1.50</div>
            <div class="stat-value">${stats.odd_150_reached}</div>
            <div class="stat-subtext">${stats.total > 0 ? ((stats.odd_150_reached / stats.total) * 100).toFixed(1) : 0}% din total</div>
        </div>

        <div class="stat-card info">
            <div class="stat-label">Cotă 2.00</div>
            <div class="stat-value">${stats.odd_200_reached}</div>
            <div class="stat-subtext">${stats.total > 0 ? ((stats.odd_200_reached / stats.total) * 100).toFixed(1) : 0}% din total</div>
        </div>
    </div>

    <!-- STATISTICI PER LIGĂ -->
    <div class="legend" style="margin-bottom: 20px;">
        <h3>🏆 PERFORMANȚĂ PER LIGĂ</h3>
        <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
            <thead>
                <tr style="background: #667eea; color: white;">
                    <th style="padding: 8px; text-align: left;">Ligă</th>
                    <th style="padding: 8px; text-align: center; width: 60px;">W</th>
                    <th style="padding: 8px; text-align: center; width: 60px;">L</th>
                    <th style="padding: 8px; text-align: center; width: 80px;">Win Rate</th>
                </tr>
            </thead>
            <tbody>
                ${(() => {
                    const perLiga = {};
                    notifications.forEach(n => {
                        const liga = n.league || 'Unknown';
                        if (!perLiga[liga]) perLiga[liga] = { won: 0, lost: 0 };
                        if (n.validation_result === 'won') perLiga[liga].won++;
                        else if (n.validation_result === 'lost') perLiga[liga].lost++;
                    });
                    return Object.entries(perLiga)
                        .filter(([, s]) => s.won + s.lost > 0)
                        .sort((a, b) => (b[1].won + b[1].lost) - (a[1].won + a[1].lost))
                        .map(([liga, s]) => {
                            const total = s.won + s.lost;
                            const rate = Math.round((s.won / total) * 100);
                            const color = rate >= 70 ? '#27ae60' : rate >= 50 ? '#f39c12' : '#e74c3c';
                            return `<tr style="border-bottom: 1px solid #eee;">
                                <td style="padding: 6px 8px;">${liga}</td>
                                <td style="padding: 6px 8px; text-align: center; color: #27ae60; font-weight: bold;">${s.won}</td>
                                <td style="padding: 6px 8px; text-align: center; color: #e74c3c; font-weight: bold;">${s.lost}</td>
                                <td style="padding: 6px 8px; text-align: center; font-weight: bold; color: ${color};">${rate}%</td>
                            </tr>`;
                        }).join('');
                })()}
            </tbody>
        </table>
    </div>

    <!-- STATISTICI PER PATTERN -->
    <div class="legend" style="margin-bottom: 20px;">
        <h3>📊 PERFORMANȚĂ PER PATTERN</h3>
        <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
            <thead>
                <tr style="background: #764ba2; color: white;">
                    <th style="padding: 8px; text-align: left;">Pattern</th>
                    <th style="padding: 8px; text-align: left;">Descriere</th>
                    <th style="padding: 8px; text-align: center; width: 60px;">W</th>
                    <th style="padding: 8px; text-align: center; width: 60px;">L</th>
                    <th style="padding: 8px; text-align: center; width: 80px;">Win Rate</th>
                </tr>
            </thead>
            <tbody>
                ${(() => {
                    const desc = {
                        'PATTERN_1.0': '3+ șuturi poartă, 0 gol', 'PATTERN_1.1': '4+ șuturi poartă, 0 gol',
                        'PATTERN_1.2': '5+ șuturi poartă, 0 gol', 'PATTERN_1.3': '6+ șuturi poartă, 0 gol',
                        'PATTERN_1.4': '7+ șuturi poartă, 0 gol',
                        'PATTERN_2.1': '6+ total șuturi, 0 gol', 'PATTERN_2.2': '7+ total șuturi, 0 gol',
                        'PATTERN_2.3': '8+ total șuturi, 0 gol', 'PATTERN_2.4': '9+ total șuturi, 0 gol',
                        'PATTERN_2.5': '10+ total șuturi, 0 gol',
                        'PATTERN_3.3': '3 goluri total HT', 'PATTERN_3.4': '4 goluri total HT', 'PATTERN_3.5+': '5+ goluri total HT',
                        'PATTERN_5.5': '5+ (șuturi+cornere), 0 gol', 'PATTERN_5.6': '6+ (șuturi+cornere)',
                        'PATTERN_9.3': '3 cartonașe HT', 'PATTERN_9.4': '4 cartonașe HT',
                        'PATTERN_14': 'Conduce norocos', 'PATTERN_16': 'Ofsaiduri + presiune',
                        'PATTERN_19': 'Egal ≥1-1 & 6+ șuturi poartă',
                        'PATTERN_21': 'Egal ≥1-1 & 10+ șuturi poartă',
                        'PATTERN_22': '1 gol HT & 6+ șuturi poartă',
                        'PATTERN_23': '2+ goluri HT & 8+ șuturi poartă',
                        'PATTERN_24': '8+ cornere total', 'PATTERN_25': 'Scor 2-0/0-2',
                    };
                    const perPattern = {};
                    notifications.forEach(n => {
                        const p = typeof n.pattern === 'string' ? n.pattern : (n.pattern?.name || 'N/A');
                        if (!perPattern[p]) perPattern[p] = { won: 0, lost: 0 };
                        if (n.validation_result === 'won') perPattern[p].won++;
                        else if (n.validation_result === 'lost') perPattern[p].lost++;
                    });
                    return Object.entries(perPattern)
                        .filter(([, s]) => s.won + s.lost > 0)
                        .sort((a, b) => (b[1].won + b[1].lost) - (a[1].won + a[1].lost))
                        .map(([p, s]) => {
                            const total = s.won + s.lost;
                            const rate = Math.round((s.won / total) * 100);
                            const color = rate >= 70 ? '#27ae60' : rate >= 50 ? '#f39c12' : '#e74c3c';
                            return `<tr style="border-bottom: 1px solid #eee;">
                                <td style="padding: 6px 8px; font-family: monospace; font-weight: bold;">${p}</td>
                                <td style="padding: 6px 8px; font-size: 12px; color: #666;">${desc[p] || ''}</td>
                                <td style="padding: 6px 8px; text-align: center; color: #27ae60; font-weight: bold;">${s.won}</td>
                                <td style="padding: 6px 8px; text-align: center; color: #e74c3c; font-weight: bold;">${s.lost}</td>
                                <td style="padding: 6px 8px; text-align: center; font-weight: bold; color: ${color};">${rate}%</td>
                            </tr>`;
                        }).join('');
                })()}
            </tbody>
        </table>
    </div>

    <div class="legend">
        <h3>📖 LEGENDĂ</h3>
        <ul>
            <li><strong>Pattern:</strong> Tipul de pattern detectat (ex: PATTERN_1.6 = 9+ suturi pe poartă, 0 goluri HT)</li>
            <li><strong>Probabilitate:</strong> Probabilitate calculată bazată pe ligă + tier (TOP/MID/LOW/BOTTOM)</li>
            <li><strong>Cotă 1.50:</strong> Dacă cota a ajuns la ≥1.50 (DA/NU + minut când a ajuns)</li>
            <li><strong>Cotă 2.00:</strong> Dacă cota a ajuns la ≥2.00 (DA/NU + minut când a ajuns)</li>
            <li><strong>Rezultat:</strong> <span class="badge badge-success">CÂȘTIGAT</span> = pronosticul s-a îndeplinit | <span class="badge badge-danger">PIERDUT</span> = pronosticul NU s-a îndeplinit | <span class="badge badge-warning">În Așteptare</span> = nevalidat încă</li>
        </ul>
    </div>

    <div class="table-container">
        <table>
            <thead>
                <tr>
                    <th style="width: 80px;">Data</th>
                    <th style="width: 60px;">Ora</th>
                    <th>Meci</th>
                    <th style="width: 150px;">Ligă</th>
                    <th>Eveniment</th>
                    <th style="width: 100px;">Pattern</th>
                    <th style="width: 70px; text-align: center;">Prob.</th>
                    <th style="width: 70px; text-align: center;">Cotă Ini.</th>
                    <th style="width: 90px; text-align: center;">Cotă 1.50</th>
                    <th style="width: 90px; text-align: center;">Cotă 2.00</th>
                    <th style="width: 120px; text-align: center;">Rezultat</th>
                    <th style="width: 80px; text-align: center;">Scor Final</th>
                </tr>
            </thead>
            <tbody>
`;

    // Rânduri tabel
    for (const notif of notifications) {
        const date = formatDate(notif);
        const time = formatTime(notif);
        const homeTeam = notif.homeTeam || 'N/A';
        const awayTeam = notif.awayTeam || 'N/A';
        const league = notif.league || 'N/A';
        const event = generateEventDescription(notif);
        const pattern = notif.pattern || 'N/A';
        const probability = notif.probability || 0;
        const initialOdd = notif.initial_odd ? notif.initial_odd.toFixed(2) : 'N/A';

        // Cotă 1.50
        const odd150 = (notif.odd_150_sent || notif.minute_odd_1_50)
            ? `<span class="yes">DA</span>${notif.odd_150_minute ? `<br><span class="minute">(min ${notif.odd_150_minute}')</span>` : ''}`
            : '<span class="no">NU</span>';

        // Cotă 2.00
        const odd200 = (notif.odd_200_sent || notif.minute_odd_2_00)
            ? `<span class="yes">DA</span>${notif.odd_200_minute ? `<br><span class="minute">(min ${notif.odd_200_minute}')</span>` : ''}`
            : '<span class="no">NU</span>';

        // Rezultat
        let resultBadge = '';
        if (notif.validated) {
            if (notif.validation_result === 'won') {
                resultBadge = '<span class="badge badge-success">✅ CÂȘTIGAT</span>';
            } else if (notif.validation_result === 'lost') {
                resultBadge = '<span class="badge badge-danger">❌ PIERDUT</span>';
            } else {
                resultBadge = '<span class="badge badge-secondary">⚪ VALIDAT</span>';
            }
        } else {
            resultBadge = '<span class="badge badge-warning">⏳ În Așteptare</span>';
        }

        // Scor final
        const finalScore = notif.final_score || (notif.validated ? 'N/A' : '-');

        // Clasă probabilitate
        let probClass = 'low';
        if (probability >= 80) probClass = 'high';
        else if (probability >= 70) probClass = 'medium';

        html += `
                <tr>
                    <td>${date}</td>
                    <td>${time}</td>
                    <td><span class="team-name">${homeTeam}</span> - <span class="team-name">${awayTeam}</span></td>
                    <td>${league}</td>
                    <td>${event}</td>
                    <td><span class="pattern">${pattern}</span></td>
                    <td style="text-align: center;"><span class="probability ${probClass}">${probability}%</span></td>
                    <td style="text-align: center;"><span class="odd">${initialOdd}</span></td>
                    <td style="text-align: center;">${odd150}</td>
                    <td style="text-align: center;">${odd200}</td>
                    <td style="text-align: center;">${resultBadge}</td>
                    <td style="text-align: center;">${finalScore}</td>
                </tr>
`;
    }

    // Footer HTML
    html += `
            </tbody>
        </table>
    </div>

    <div class="footer">
        🤖 <strong>API SMART 5</strong> - Raport generat automat<br>
        Generat la ${new Date().toLocaleString('ro-RO')}<br>
        <br>
        📊 Total ${stats.total} notificări |
        ✅ ${stats.won} câștigat |
        ❌ ${stats.lost} pierdut |
        ⏳ ${stats.pending} în așteptare |
        📈 ${successRate}% rată succes
    </div>
</body>
</html>
`;

    return html;
}

/**
 * Salvează raportul HTML
 */
function saveReport(targetMonth, report) {
    if (!report) {
        console.log('\n⚠️  Nu există date pentru raport');
        return null;
    }

    const reportsDir = path.join(__dirname, 'reports');

    // Creează directorul reports dacă nu există
    if (!fs.existsSync(reportsDir)) {
        fs.mkdirSync(reportsDir, { recursive: true });
        console.log(`   📁 Creat director: ${reportsDir}`);
    }

    const filename = `monthly-report-${targetMonth}.html`;
    const filepath = path.join(reportsDir, filename);

    fs.writeFileSync(filepath, report.html, 'utf8');

    console.log(`\n💾 Raport salvat: ${filepath}`);
    console.log(`   Dimensiune: ${(fs.statSync(filepath).size / 1024).toFixed(1)} KB`);

    return filepath;
}

/**
 * Generează raport FILTRAT (doar notificări specifice)
 */
function generateFilteredReport(targetMonth, filterType, filterTitle) {
    console.log(`\n📊 GENERARE RAPORT: ${filterTitle}\n`);

    // Citește toate notificările
    const trackingData = tracker.readStorage();
    const allNotifications = trackingData.notifications || [];

    // Filtrează notificările din luna specificată
    let monthNotifications = allNotifications.filter(n => isInMonth(n, targetMonth));

    // Aplică filtru specific
    switch (filterType) {
        case 'odd_150':
            monthNotifications = monthNotifications.filter(n => (n.odd_150_sent || n.minute_odd_1_50) === true);
            break;
        case 'odd_200':
            monthNotifications = monthNotifications.filter(n => (n.odd_200_sent || n.minute_odd_2_00) === true);
            break;
        case 'lost':
            monthNotifications = monthNotifications.filter(n =>
                n.validated === true && n.validation_result === 'lost'
            );
            break;
        default:
            // ALL - fără filtru suplimentar
            break;
    }

    console.log(`   Notificări filtrate: ${monthNotifications.length}`);

    if (monthNotifications.length === 0) {
        console.log(`\n⚠️  Nu există notificări pentru acest filtru`);
        return null;
    }

    // Sortează după dată
    monthNotifications.sort((a, b) => {
        const dateA = new Date(a.timestamp || a.date);
        const dateB = new Date(b.timestamp || b.date);
        return dateA - dateB;
    });

    // Calculează statistici
    const stats = {
        total: monthNotifications.length,
        validated: monthNotifications.filter(n => n.validated).length,
        won: monthNotifications.filter(n => n.validation_result === 'won').length,
        lost: monthNotifications.filter(n => n.validation_result === 'lost').length,
        pending: monthNotifications.filter(n => !n.validated).length,
        odd_150_reached: monthNotifications.filter(n => (n.odd_150_sent || n.minute_odd_1_50)).length,
        odd_200_reached: monthNotifications.filter(n => (n.odd_200_sent || n.minute_odd_2_00)).length,
        fulfilled: monthNotifications.filter(n => n.fulfilled).length
    };

    const successRate = stats.validated > 0
        ? ((stats.won / stats.validated) * 100).toFixed(1)
        : 0;

    console.log(`\n   📈 STATISTICI:`);
    console.log(`      Total: ${stats.total}`);
    console.log(`      CÂȘTIGAT: ${stats.won}`);
    console.log(`      PIERDUT: ${stats.lost}`);
    console.log(`      Rată succes: ${successRate}%`);

    // Generează HTML cu titlu custom
    const html = generateHTMLWithCustomTitle(targetMonth, monthNotifications, stats, successRate, filterTitle);

    return {
        html,
        stats,
        successRate,
        notifications: monthNotifications,
        filterType
    };
}

/**
 * Generează HTML cu titlu custom
 */
function generateHTMLWithCustomTitle(targetMonth, notifications, stats, successRate, customTitle) {
    const monthName = getMonthName(targetMonth);

    // Folosim același template dar cu titlu personalizat
    const originalHTML = generateHTML(targetMonth, notifications, stats, successRate);

    // Înlocuim titlul cu cel custom
    return originalHTML.replace(
        `<h1>📊 RAPORT LUNAR ${monthName}</h1>`,
        `<h1>${customTitle}</h1>`
    );
}

/**
 * Salvează raport cu sufix
 */
function saveReportWithSuffix(targetMonth, report, suffix) {
    if (!report) {
        console.log(`\n⚠️  Nu există date pentru raport ${suffix}`);
        return null;
    }

    const reportsDir = path.join(__dirname, 'reports');

    if (!fs.existsSync(reportsDir)) {
        fs.mkdirSync(reportsDir, { recursive: true });
    }

    const filename = suffix
        ? `monthly-report-${targetMonth}-${suffix}.html`
        : `monthly-report-${targetMonth}.html`;
    const filepath = path.join(reportsDir, filename);

    fs.writeFileSync(filepath, report.html, 'utf8');

    console.log(`   💾 Salvat: ${filename} (${(fs.statSync(filepath).size / 1024).toFixed(1)} KB)`);

    return filepath;
}

/**
 * Main function - Generează TOATE cele 4 rapoarte
 */
function main() {
    const args = process.argv.slice(2);
    const targetMonth = args[0] || getCurrentMonth();

    console.log('='.repeat(60));
    console.log('📊 MONTHLY REPORT GENERATOR - API SMART 5');
    console.log('   GENERARE 4 RAPOARTE LUNARE');
    console.log('='.repeat(60));

    try {
        // Validează format lună (YYYY-MM)
        if (!/^\d{4}-\d{2}$/.test(targetMonth)) {
            console.error(`\n❌ Format invalid: ${targetMonth}`);
            console.error('   Format așteptat: YYYY-MM (ex: 2026-01)');
            process.exit(1);
        }

        const monthName = getMonthName(targetMonth);
        const generatedReports = [];

        // 1️⃣ RAPORT COMPLET - TOATE notificările
        console.log('\n' + '='.repeat(60));
        console.log('1️⃣  RAPORT COMPLET - TOATE NOTIFICĂRILE');
        console.log('='.repeat(60));
        const reportAll = generateMonthlyReport(targetMonth);
        const filepathAll = saveReportWithSuffix(targetMonth, reportAll, null);
        if (filepathAll) generatedReports.push({ type: 'ALL', path: filepathAll, count: reportAll.notifications.length });

        // 2️⃣ RAPORT COTĂ 1.50 - DOAR cele care au ajuns la cotă 1.50
        console.log('\n' + '='.repeat(60));
        console.log('2️⃣  RAPORT COTĂ 1.50 - DOAR EVENIMENTE CU COTĂ ≥1.50');
        console.log('='.repeat(60));
        const report150 = generateFilteredReport(
            targetMonth,
            'odd_150',
            `⚡ RAPORT COTĂ 1.50 - ${monthName}`
        );
        const filepath150 = saveReportWithSuffix(targetMonth, report150, 'cota-1.50');
        if (filepath150) generatedReports.push({ type: 'COTĂ 1.50', path: filepath150, count: report150.notifications.length });

        // 3️⃣ RAPORT COTĂ 2.00 - DOAR cele care au ajuns la cotă 2.00
        console.log('\n' + '='.repeat(60));
        console.log('3️⃣  RAPORT COTĂ 2.00 - DOAR EVENIMENTE CU COTĂ ≥2.00');
        console.log('='.repeat(60));
        const report200 = generateFilteredReport(
            targetMonth,
            'odd_200',
            `🚀 RAPORT COTĂ 2.00 - ${monthName}`
        );
        const filepath200 = saveReportWithSuffix(targetMonth, report200, 'cota-2.00');
        if (filepath200) generatedReports.push({ type: 'COTĂ 2.00', path: filepath200, count: report200.notifications.length });

        // 4️⃣ RAPORT PIERDUTE - DOAR cele care NU s-au îndeplinit
        console.log('\n' + '='.repeat(60));
        console.log('4️⃣  RAPORT PIERDUTE - DOAR EVENIMENTE CARE NU S-AU ÎNDEPLINIT');
        console.log('='.repeat(60));
        const reportLost = generateFilteredReport(
            targetMonth,
            'lost',
            `❌ RAPORT PIERDUTE - ${monthName}`
        );
        const filepathLost = saveReportWithSuffix(targetMonth, reportLost, 'pierdute');
        if (filepathLost) generatedReports.push({ type: 'PIERDUTE', path: filepathLost, count: reportLost.notifications.length });

        // SUMAR FINAL
        console.log('\n' + '='.repeat(60));
        console.log('✅ RAPOARTE GENERATE CU SUCCES!');
        console.log('='.repeat(60));

        if (generatedReports.length > 0) {
            console.log('\n📄 FIȘIERE GENERATE:\n');
            generatedReports.forEach((report, index) => {
                console.log(`   ${index + 1}. ${report.type.padEnd(15)} → ${path.basename(report.path)} (${report.count} notificări)`);
            });

            console.log('\n💡 DESCHIDE RAPOARTELE ÎN BROWSER:\n');
            generatedReports.forEach((report, index) => {
                console.log(`   ${index + 1}. file://${report.path}`);
            });
            console.log('');
        } else {
            console.log('\n⚠️  Nu s-au generat rapoarte (lipsă date)');
        }

        console.log('='.repeat(60));
        console.log('');

        return generatedReports;

    } catch (error) {
        console.error(`\n❌ EROARE: ${error.message}`);
        console.error(error.stack);
        process.exit(1);
    }
}

// Export pentru utilizare ca modul
module.exports = {
    generateMonthlyReport,
    generateHTML,
    saveReport,
    getCurrentMonth,
    getMonthName
};

// Rulează direct dacă e apelat ca script
if (require.main === module) {
    main();
}
