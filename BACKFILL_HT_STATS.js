/**
 * BACKFILL HT STATS
 *
 * Recolectează statistici HT pentru meciurile vechi unde xG, posesie sau cornere
 * au fost ratate de bug-ul case-sensitive din STATS_MAPPING.
 *
 * Scanează stats-*-HT.json existente, identifică pe cele cu date lipsă,
 * re-apelează Flashscore API și actualizează fișierul.
 *
 * Throttle: 1 request/sec pentru a nu fi blocat de Flashscore.
 *
 * USAGE:
 *   node BACKFILL_HT_STATS.js           — dry run, doar listează ce ar face
 *   node BACKFILL_HT_STATS.js --apply   — execută backfill-ul
 *   node BACKFILL_HT_STATS.js --apply --limit 50  — primele 50 doar
 */

const fs = require('fs');
const path = require('path');
const { fetchMatchDetails } = require('./flashscore-api');

const STATS_MAPPING = {
    'shots on target': 'suturi_pe_poarta',
    'total shots': 'total_suturi',
    'corner kicks': 'cornere',
    'yellow cards': 'cartonase_galbene',
    'red cards': 'cartonase_rosii',
    'goalkeeper saves': 'suturi_salvate',
    'fouls': 'faulturi',
    'offsides': 'ofsaiduri',
    'expected goals (xg)': 'xG',
    'ball possession': 'posesie',
};

function parseStatValue(value) {
    if (!value) return 0;
    const str = String(value).trim();
    const parenMatch = str.match(/\((\d+)\/\d+\)/);
    if (parenMatch) return parseInt(parenMatch[1]) || 0;
    const percentMatch = str.match(/^(\d+)%/);
    if (percentMatch) return parseInt(percentMatch[1]) || 0;
    const num = parseInt(str);
    return isNaN(num) ? 0 : num;
}

function needsBackfill(stats) {
    if (!stats) return true;
    const xg = stats.xG;
    const pos = stats.posesie;
    const corn = stats.cornere;
    // Considerăm că are nevoie de backfill dacă xG SAU posesie sunt null
    // (cornere 0 e plauzibil, dar xG+posesie null mereu = bug)
    return (xg && xg.pauza_gazda == null && xg.pauza_oaspete == null) ||
           (pos && pos.pauza_gazda == null && pos.pauza_oaspete == null);
}

function extractHtStats(statsData) {
    // Separă secțiunile (FT = primul "Top stats", HT = al doilea)
    let topStatsCount = 0;
    let current = null;
    const sections = { ft: [], ht: [] };
    for (const s of statsData) {
        if (s.SF === 'Top stats') {
            topStatsCount++;
            current = topStatsCount === 1 ? 'ft' : topStatsCount === 2 ? 'ht' : null;
            continue;
        }
        if (current && s.SG) sections[current].push(s);
    }

    const useSection = sections.ht.length > 0 ? sections.ht : sections.ft;
    if (useSection.length === 0) return null;

    const result = {
        suturi_pe_poarta: { pauza_gazda: 0, pauza_oaspete: 0 },
        total_suturi: { pauza_gazda: 0, pauza_oaspete: 0 },
        cornere: { repriza_1_gazda: 0, repriza_1_oaspete: 0 },
        cartonase_galbene: { pauza_gazda: 0, pauza_oaspete: 0 },
        cartonase_rosii: { pauza_gazda: 0, pauza_oaspete: 0 },
        suturi_salvate: { pauza_gazda: 0, pauza_oaspete: 0 },
        faulturi: { pauza_gazda: 0, pauza_oaspete: 0 },
        ofsaiduri: { pauza_gazda: 0, pauza_oaspete: 0 },
        xG: { pauza_gazda: null, pauza_oaspete: null },
        posesie: { pauza_gazda: null, pauza_oaspete: null },
    };

    for (const stat of useSection) {
        const key = stat.SG ? stat.SG.trim().toLowerCase() : null;
        const mapped = STATS_MAPPING[key];
        if (!mapped) continue;

        if (mapped === 'cornere') {
            result[mapped] = {
                repriza_1_gazda: parseStatValue(stat.SH),
                repriza_1_oaspete: parseStatValue(stat.SI),
            };
        } else if (mapped === 'xG') {
            result[mapped] = {
                pauza_gazda: parseFloat(stat.SH) || null,
                pauza_oaspete: parseFloat(stat.SI) || null,
            };
        } else if (mapped === 'posesie') {
            result[mapped] = {
                pauza_gazda: parseInt(String(stat.SH).replace('%', '')) || null,
                pauza_oaspete: parseInt(String(stat.SI).replace('%', '')) || null,
            };
        } else {
            result[mapped] = {
                pauza_gazda: parseStatValue(stat.SH),
                pauza_oaspete: parseStatValue(stat.SI),
            };
        }
    }
    return result;
}

async function processOne(filePath, apply) {
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    const matchId = data.id_meci || data.id_flashscore;
    if (!matchId) return { status: 'skip', reason: 'no matchId' };

    if (!needsBackfill(data.statistici)) {
        return { status: 'skip', reason: 'already complete' };
    }

    try {
        const details = await fetchMatchDetails(matchId);
        if (!details.statsData || details.statsData.length === 0) {
            return { status: 'fail', reason: 'no statsData from Flashscore' };
        }

        const newStats = extractHtStats(details.statsData);
        if (!newStats) return { status: 'fail', reason: 'no HT section extracted' };

        // Verificăm că xG SAU posesie au valori acum (altfel API-ul nu are date)
        const gotXg = newStats.xG.pauza_gazda != null || newStats.xG.pauza_oaspete != null;
        const gotPos = newStats.posesie.pauza_gazda != null || newStats.posesie.pauza_oaspete != null;
        if (!gotXg && !gotPos) {
            return { status: 'fail', reason: 'Flashscore nu are xG/posesie pentru acest meci' };
        }

        if (apply) {
            data.statistici = newStats;
            data.backfilledAt = new Date().toISOString();
            fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
        }
        return { status: 'ok', xg: gotXg, pos: gotPos, corn: newStats.cornere.repriza_1_gazda + newStats.cornere.repriza_1_oaspete };
    } catch (err) {
        return { status: 'fail', reason: err.message };
    }
}

async function main() {
    const apply = process.argv.includes('--apply');
    const limitArg = process.argv.indexOf('--limit');
    const limit = limitArg >= 0 ? parseInt(process.argv[limitArg + 1]) : Infinity;

    const baseDir = __dirname;
    const allFiles = fs.readdirSync(baseDir)
        .filter(f => /^stats-.+-HT\.json$/.test(f))
        .map(f => path.join(baseDir, f));

    console.log(`📦 BACKFILL HT STATS — ${apply ? 'APPLY MODE' : 'DRY RUN'}`);
    console.log(`   Total fișiere: ${allFiles.length}`);
    console.log(`   Limit: ${limit === Infinity ? 'fără' : limit}`);

    // Prima trecere: identifică pe cele care au nevoie de backfill
    const needsList = [];
    for (const f of allFiles) {
        try {
            const data = JSON.parse(fs.readFileSync(f, 'utf8'));
            if (needsBackfill(data.statistici)) needsList.push(f);
        } catch (e) { /* skip */ }
    }
    console.log(`   Necesită backfill: ${needsList.length}\n`);

    if (!apply) {
        console.log('🔬 DRY RUN — nu se modifică fișierele. Adaugă --apply pentru execuție.');
        console.log(`   Pentru test rapid: --apply --limit 10`);
        return;
    }

    const toProcess = needsList.slice(0, limit);
    console.log(`🚀 Procesez ${toProcess.length} fișiere (1 req/sec)...\n`);

    let ok = 0, skip = 0, fail = 0;
    for (let i = 0; i < toProcess.length; i++) {
        const f = toProcess[i];
        const matchId = path.basename(f).match(/^stats-(.+)-HT\.json$/)?.[1];
        const r = await processOne(f, true);

        const tag = r.status === 'ok' ? '✅' : r.status === 'skip' ? '⏭️ ' : '❌';
        const extra = r.status === 'ok' ? `xG:${r.xg?'✓':'-'} pos:${r.pos?'✓':'-'} corn:${r.corn}` : (r.reason || '');
        console.log(`${tag} [${i+1}/${toProcess.length}] ${matchId} — ${extra}`);

        if (r.status === 'ok') ok++;
        else if (r.status === 'skip') skip++;
        else fail++;

        // Throttle 1 req/sec (sau mai mult dacă failed = posibil rate limit)
        if (i < toProcess.length - 1) {
            await new Promise(r => setTimeout(r, r.status === 'fail' ? 3000 : 1100));
        }
    }

    console.log(`\n📊 REZULTAT FINAL:`);
    console.log(`   ✅ OK: ${ok}`);
    console.log(`   ⏭️  Skip: ${skip}`);
    console.log(`   ❌ Fail: ${fail}`);
}

if (require.main === module) {
    main().catch(err => {
        console.error('❌ Eroare fatală:', err);
        process.exit(1);
    });
}
