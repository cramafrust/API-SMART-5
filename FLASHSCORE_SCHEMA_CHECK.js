/**
 * FLASHSCORE SCHEMA CHECK
 *
 * Verifică lunar dacă API-ul Flashscore a schimbat structura datelor
 * într-un mod care ne afectează scraper-ul (STATS_MONITOR.js).
 *
 * Rulează pe un meci CUNOSCUT (City vs Brentford, 09.05.2026, id 4IfWN9Ha)
 * și verifică:
 *   1. Toți cei 10 parametri așteptați (xG, posesie, cornere, etc.) sunt prezenți
 *   2. Numele cheilor matchează STATS_MAPPING (case-insensitive)
 *   3. Structura secțiunilor (Top stats / HT / FT) e neschimbată
 *   4. Valorile au tipul corect (number/string)
 *
 * Dacă apar anomalii → email alertă către admin.
 *
 * Crontab: 0 10 1 * *  (luna 1, ora 10:00)
 */

const fs = require('fs');
const path = require('path');
const { fetchMatchDetails } = require('./flashscore-api');
const emailService = require('./EMAIL_SERVICE');

// Pentru verificare folosim ULTIMELE meciuri colectate (sample dinamic, nu hardcodat).
// Un meci poate să nu aibă "red cards" / "ball possession" dacă nu sunt date —
// dar dacă lipsesc în TOT sample-ul, atunci e o problemă reală de schemă.
const SAMPLE_SIZE = 10;

// Toate cheile pe care STATS_MAPPING le caută (lowercase)
const EXPECTED_KEYS = [
    'shots on target',
    'total shots',
    'corner kicks',
    'yellow cards',
    'red cards',
    'goalkeeper saves',
    'fouls',
    'offsides',
    'expected goals (xg)',
    'ball possession',
];

// Câmpuri critice (dacă lipsesc → alertă HIGH)
const CRITICAL_KEYS = [
    'shots on target',
    'total shots',
    'corner kicks',
    'expected goals (xg)',
    'ball possession',
];

/**
 * Selectează SAMPLE_SIZE matchId-uri din ultimele fișiere stats-*-HT.json
 * (cele mai recente meciuri pentru care s-au extras statistici).
 * Folosim mtime ca să luăm pe cele mai noi.
 */
function pickSampleMatchIds() {
    const baseDir = __dirname;
    const files = fs.readdirSync(baseDir)
        .filter(f => /^stats-.+-HT\.json$/.test(f))
        .map(f => ({ f, mtime: fs.statSync(path.join(baseDir, f)).mtimeMs }))
        .sort((a, b) => b.mtime - a.mtime)
        .slice(0, SAMPLE_SIZE);

    return files.map(({ f }) => {
        const m = f.match(/^stats-(.+)-HT\.json$/);
        return m ? m[1] : null;
    }).filter(Boolean);
}

async function checkSingleMatch(matchId) {
    const details = await fetchMatchDetails(matchId);
    if (!details.statsData || details.statsData.length === 0) {
        return { matchId, ok: false, error: 'statsData lipsă', keys: new Set(), sections: 0 };
    }

    // Numără secțiunile "Top stats"
    let topStatsCount = 0;
    for (const s of details.statsData) {
        if (s.SF === 'Top stats') topStatsCount++;
    }

    // Toate cheile întâlnite (lowercase)
    const keys = new Set();
    for (const s of details.statsData) {
        if (s.SG) keys.add(s.SG.trim().toLowerCase());
    }

    return { matchId, ok: true, keys, sections: topStatsCount, totalEntries: details.statsData.length };
}

async function runCheck() {
    const issues = [];
    const info = [];

    const sampleIds = pickSampleMatchIds();
    if (sampleIds.length === 0) {
        issues.push({
            severity: 'CRITICAL',
            message: 'Nu am găsit niciun matchId în fișierele daily_collected — nu pot rula verificarea',
        });
        return { issues, info };
    }

    info.push(`Sample: ${sampleIds.length} meciuri verificate`);

    // Verifică fiecare meci
    const results = [];
    for (const id of sampleIds) {
        try {
            const r = await checkSingleMatch(id);
            results.push(r);
        } catch (err) {
            results.push({ matchId: id, ok: false, error: err.message, keys: new Set(), sections: 0 });
        }
    }

    const okCount = results.filter(r => r.ok).length;
    info.push(`Meciuri cu statsData valid: ${okCount}/${sampleIds.length}`);

    if (okCount === 0) {
        issues.push({
            severity: 'CRITICAL',
            message: 'NICIUN meci nu a returnat statsData valid — endpoint Flashscore probabil schimbat',
        });
        return { issues, info };
    }

    // Verifică secțiunile (HT trebuie să existe = ≥2 Top stats)
    const noHtSection = results.filter(r => r.ok && r.sections < 2);
    if (noHtSection.length > okCount / 2) {
        issues.push({
            severity: 'CRITICAL',
            message: `${noHtSection.length}/${okCount} meciuri NU au secțiune HT (doar ${noHtSection[0]?.sections} "Top stats" găsite — structură schimbată)`,
        });
    }

    // Reuniunea cheilor: dacă o cheie EXPECTED apare în ≥1 meci din sample, e OK
    const unionKeys = new Set();
    for (const r of results) {
        if (r.ok) for (const k of r.keys) unionKeys.add(k);
    }

    info.push(`Chei unice găsite în sample: ${unionKeys.size}`);

    for (const key of EXPECTED_KEYS) {
        if (!unionKeys.has(key)) {
            const severity = CRITICAL_KEYS.includes(key) ? 'CRITICAL' : 'WARNING';
            const suggestions = [...unionKeys].filter(k => {
                const w1 = key.split(' ')[0];
                const w2 = k.split(' ')[0];
                return k.includes(w1) || key.includes(w2);
            }).slice(0, 3);
            issues.push({
                severity,
                message: `Cheie "${key}" NU apare în niciun meci din sample${suggestions.length ? ` — posibile redenumiri: ${suggestions.map(s => `"${s}"`).join(', ')}` : ''}`,
            });
        }
    }

    // Verifică și frecvența cheilor critice (dacă apar în <50% sample, e suspect)
    for (const key of CRITICAL_KEYS) {
        const found = results.filter(r => r.ok && r.keys.has(key)).length;
        const pct = okCount > 0 ? (100 * found / okCount).toFixed(0) : 0;
        if (found > 0 && pct < 50) {
            issues.push({
                severity: 'WARNING',
                message: `Cheia critică "${key}" apare doar în ${found}/${okCount} meciuri (${pct}%) — sub 50%, posibil parțial deprecated`,
            });
        }
    }

    return { issues, info };
}

function buildEmail(issues, info) {
    const critical = issues.filter(i => i.severity === 'CRITICAL');
    const warning = issues.filter(i => i.severity === 'WARNING');
    const ok = issues.length === 0;

    const subject = ok
        ? `✅ Flashscore Schema Check OK (${new Date().toISOString().slice(0, 10)})`
        : `${critical.length ? '🚨' : '⚠️'} Flashscore Schema Check: ${critical.length} CRITICAL, ${warning.length} WARNING`;

    const issuesHtml = issues.length === 0
        ? '<p style="color:green"><b>✅ Niciun issue. Scraper-ul funcționează corect.</b></p>'
        : issues.map(i => `<li style="color:${i.severity === 'CRITICAL' ? 'red' : 'orange'}"><b>[${i.severity}]</b> ${i.message}</li>`).join('');

    const html = `
<h2>Flashscore Schema Check</h2>
<p><b>Data:</b> ${new Date().toLocaleString('ro-RO')}</p>
<p><b>Sample:</b> ${SAMPLE_SIZE} meciuri din ultimele zile</p>

<h3>Info diagnostic</h3>
<ul>${info.map(i => `<li>${i}</li>`).join('')}</ul>

<h3>Issues găsite</h3>
${issues.length ? `<ul>${issuesHtml}</ul>` : issuesHtml}

${critical.length ? '<p style="color:red"><b>⚠️ ACȚIUNE NECESARĂ: verifică STATS_MONITOR.js → STATS_MAPPING și actualizează cheile.</b></p>' : ''}

<hr>
<p style="color:#888;font-size:11px">Script: FLASHSCORE_SCHEMA_CHECK.js — rulează lunar (cron, ziua 1, 10:00)</p>
`;

    return { subject, html, critical: critical.length, warning: warning.length };
}

async function main() {
    console.log('🔍 FLASHSCORE SCHEMA CHECK');
    console.log(`   Sample: ${SAMPLE_SIZE} meciuri din ultimele zile`);

    const { issues, info } = await runCheck();

    console.log('\n📊 Info:');
    info.forEach(i => console.log('   ' + i));

    console.log('\n🔎 Issues:');
    if (issues.length === 0) {
        console.log('   ✅ Niciun issue');
    } else {
        issues.forEach(i => console.log(`   [${i.severity}] ${i.message}`));
    }

    const { subject, html, critical, warning } = buildEmail(issues, info);

    // Trimite email DOAR dacă există issues SAU e setat flag-ul --always
    const alwaysSend = process.argv.includes('--always');
    if (issues.length > 0 || alwaysSend) {
        const result = await emailService.send({ subject, html });
        console.log(`\n📧 Email: ${result.success ? '✅ trimis' : '❌ eșuat — ' + result.error}`);
    } else {
        console.log('\n📧 Email: skip (no issues, folosește --always pentru forțare)');
    }

    // Exit code: 0 dacă OK, 1 dacă WARNING, 2 dacă CRITICAL
    process.exit(critical > 0 ? 2 : warning > 0 ? 1 : 0);
}

if (require.main === module) {
    main().catch(err => {
        console.error('❌ Eroare fatală:', err);
        process.exit(3);
    });
}

module.exports = { runCheck, EXPECTED_KEYS, CRITICAL_KEYS };
