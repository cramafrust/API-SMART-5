/**
 * 📧 SEND_COLLECTED_MATCHES_REPORT.js
 *
 * Trimite raport cu meciurile colectate și salvate în JSON din ziua anterioară
 *
 * USAGE:
 *   node SEND_COLLECTED_MATCHES_REPORT.js              # Raport pentru ieri
 *   node SEND_COLLECTED_MATCHES_REPORT.js 2026-01-25   # Raport pentru dată specifică
 */

const fs = require('fs');
const path = require('path');
const emailService = require('./EMAIL_SERVICE');

/**
 * Obține data de ieri în format YYYY-MM-DD
 */
function getYesterdayDate() {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    return yesterday.toISOString().split('T')[0];
}

/**
 * Găsește toate fișierele JSON cu meciuri terminate (seasons data)
 */
function findSeasonFiles() {
    const files = [];
    const seasonsDir = path.join(__dirname, 'data', 'seasons');

    if (!fs.existsSync(seasonsDir)) {
        console.log(`⚠️  Directorul seasons nu există: ${seasonsDir}`);
        return files;
    }

    const dirFiles = fs.readdirSync(seasonsDir);

    // Caută fișiere cu meciuri complete din sezon
    dirFiles.forEach(file => {
        if (file.startsWith('complete_FULL_SEASON_') && file.endsWith('.json')) {
            files.push(path.join(seasonsDir, file));
        }
    });

    return files;
}

/**
 * Încarcă meciurile din fișierele JSON și filtrează după dată
 */
function loadMatchesFromFiles(files, targetDate) {
    const allMatches = [];

    // Convertește targetDate în timestamp pentru comparare
    const targetTimestamp = new Date(targetDate).getTime() / 1000;
    const nextDayTimestamp = targetTimestamp + (24 * 60 * 60);

    files.forEach(file => {
        try {
            const content = fs.readFileSync(file, 'utf8');
            const data = JSON.parse(content);

            // Poate fi un array sau un obiect cu array
            const matches = Array.isArray(data) ? data : (data.matches || data.meciuri || []);

            matches.forEach(match => {
                // Extrage timestamp din meci
                const matchTimestamp = match.match?.matchStartTime || match.matchStartTime || 0;

                // Verifică dacă meciul e din ziua targetDate
                if (matchTimestamp >= targetTimestamp && matchTimestamp < nextDayTimestamp) {
                    // Extrage liga din fișier
                    const filename = path.basename(file);
                    const leagueMatch = filename.match(/complete_FULL_SEASON_(.+)_2024-2025\.json/);
                    const leagueName = leagueMatch ? leagueMatch[1] : 'Unknown';

                    allMatches.push({
                        ...match,
                        sourceFile: path.basename(file),
                        leagueFromFile: leagueName
                    });
                }
            });
        } catch (err) {
            console.error(`⚠️  Eroare la citire ${path.basename(file)}: ${err.message}`);
        }
    });

    return allMatches;
}

/**
 * Generează raport HTML
 */
function generateHTML(targetDate, matches) {
    const totalMatches = matches.length;

    if (totalMatches === 0) {
        return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Meciuri Colectate - ${targetDate}</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; background: #f5f5f5; }
        .container { max-width: 900px; margin: 0 auto; background: white; padding: 20px; border-radius: 8px; }
        h1 { color: #2c3e50; text-align: center; }
        .empty { text-align: center; padding: 40px; color: #7f8c8d; }
    </style>
</head>
<body>
    <div class="container">
        <h1>📦 Meciuri Colectate - ${targetDate}</h1>
        <div class="empty">
            <h2>😴 Nu sunt meciuri colectate pentru această zi</h2>
            <p>Nu au fost salvate date finale pentru ${targetDate}</p>
        </div>
    </div>
</body>
</html>`;
    }

    // Grupare pe ligi
    const byLeague = {};
    matches.forEach(m => {
        const league = m.match?.league || m.league || 'Unknown';
        if (!byLeague[league]) byLeague[league] = [];
        byLeague[league].push(m);
    });

    const leaguesHTML = Object.keys(byLeague).sort().map(league => {
        const leagueMatches = byLeague[league];
        const matchesHTML = leagueMatches.map(m => {
            const homeTeam = m.match?.homeTeam || m.homeTeam || '?';
            const awayTeam = m.match?.awayTeam || m.awayTeam || '?';
            const htScore = m.halftime?.score ? `${m.halftime.score.home}-${m.halftime.score.away}` : (m.htScore || '-');
            const ftScore = m.fulltime?.score ? `${m.fulltime.score.home}-${m.fulltime.score.away}` : (m.ftScore || '-');
            const sourceFile = m.sourceFile || 'Unknown';

            return `
                <tr>
                    <td><strong>${homeTeam}</strong> vs ${awayTeam}</td>
                    <td style="text-align: center;">${htScore}</td>
                    <td style="text-align: center;"><strong>${ftScore}</strong></td>
                    <td style="font-size: 10px; color: #7f8c8d;">${sourceFile}</td>
                </tr>
            `;
        }).join('');

        return `
            <div class="league-section">
                <h3>🏆 ${league} <span style="color: #7f8c8d; font-size: 14px;">(${leagueMatches.length} meciuri)</span></h3>
                <table>
                    <thead>
                        <tr>
                            <th>Meci</th>
                            <th>HT</th>
                            <th>FT</th>
                            <th>Fișier Sursă</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${matchesHTML}
                    </tbody>
                </table>
            </div>
        `;
    }).join('');

    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Meciuri Colectate - ${targetDate}</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            margin: 0;
            padding: 20px;
            background: #f5f5f5;
        }
        .container {
            max-width: 1000px;
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
        .summary {
            text-align: center;
            padding: 20px;
            background: #e8f5e9;
            border-radius: 6px;
            margin-bottom: 30px;
        }
        .summary-value {
            font-size: 36px;
            font-weight: bold;
            color: #27ae60;
        }
        .league-section {
            margin-bottom: 30px;
        }
        h3 {
            color: #34495e;
            border-bottom: 2px solid #3498db;
            padding-bottom: 10px;
        }
        table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 15px;
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
        <h1>📦 Meciuri Colectate și Salvate în JSON</h1>
        <p style="text-align: center; color: #7f8c8d; margin-bottom: 30px;">${targetDate}</p>

        <div class="summary">
            <div class="summary-value">${totalMatches}</div>
            <div>Meciuri cu date complete finale</div>
        </div>

        ${leaguesHTML}

        <div class="footer">
            🤖 Generat automat de API SMART 5 - Data Collection System<br>
            ${new Date().toLocaleString('ro-RO')}
        </div>
    </div>
</body>
</html>`;
}

/**
 * Trimite raportul prin email
 */
async function sendCollectedMatchesReport(targetDate) {
    console.log(`\n📧 TRIMITERE RAPORT MECIURI COLECTATE pentru ${targetDate}\n`);
    console.log('='.repeat(60));

    try {
        // PRIORITATE 1: Caută fișier zilnic direct
        const dailyFilename = `daily_collected_${targetDate}.json`;
        const dailyFilepath = path.join(__dirname, dailyFilename);

        let matches = [];

        if (fs.existsSync(dailyFilepath)) {
            console.log(`📁 Fișier zilnic găsit: ${dailyFilename}`);

            const dailyData = JSON.parse(fs.readFileSync(dailyFilepath, 'utf8'));
            matches = dailyData.matches || [];

            console.log(`⚽ Meciuri în fișier zilnic: ${matches.length}`);

        } else {
            // FALLBACK: Caută în fișierele de sezon
            console.log(`⚠️  Fișier zilnic nu există: ${dailyFilename}`);
            console.log(`🔍 Caut în fișierele de sezon...`);

            const files = findSeasonFiles();
            console.log(`📁 Fișiere seasons găsite: ${files.length}`);

            matches = loadMatchesFromFiles(files, targetDate);
            console.log(`⚽ Meciuri găsite în seasons: ${matches.length}`);
        }

        // Generează HTML
        const html = generateHTML(targetDate, matches);

        // Subiect email
        const subject = matches.length > 0
            ? `📦 Meciuri Colectate ${targetDate} - ${matches.length} meciuri salvate în JSON`
            : `📦 Meciuri Colectate ${targetDate} - Niciun meci`;

        console.log(`📋 Subiect: ${subject}`);

        // Trimite email folosind serviciul centralizat
        const result = await emailService.send({
            from: '"API SMART 5 Data Collection" <smartyield365@gmail.com>',
            subject: subject,
            html: html
        });

        if (!result.success) {
            throw new Error(result.error || 'Email service unavailable');
        }

        console.log(`\n✅ Email trimis cu succes!`);
        console.log(`   Message ID: ${result.messageId}`);
        console.log('='.repeat(60));

        return {
            success: true,
            messageId: result.messageId,
            matchesCount: matches.length
        };

    } catch (error) {
        console.error(`\n❌ EROARE la trimitere email: ${error.message}`);
        console.error(error.stack);
        console.log('='.repeat(60));

        return {
            success: false,
            error: error.message
        };
    }
}

// Export
module.exports = {
    sendCollectedMatchesReport,
    getYesterdayDate
};

// CLI usage
if (require.main === module) {
    const targetDate = process.argv[2] || getYesterdayDate();

    (async () => {
        const result = await sendCollectedMatchesReport(targetDate);

        if (result.success) {
            console.log('\n✅ Raport trimis cu succes!\n');
            process.exit(0);
        } else {
            console.error('\n❌ Eroare la trimitere raport!\n');
            process.exit(1);
        }
    })();
}
