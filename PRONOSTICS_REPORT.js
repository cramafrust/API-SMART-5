#!/usr/bin/env node
/**
 * PRONOSTICS_REPORT.js
 *
 * Generează raport complet cu toate pronosticurile din notifications_tracking.json
 *
 * Output:
 *   - pronostics-history.json (date structurate)
 *   - pronostics-history.md   (tabel lizibil)
 *
 * USAGE:
 *   node PRONOSTICS_REPORT.js           # Generează ambele fișiere
 *   node PRONOSTICS_REPORT.js --json    # Doar JSON
 *   node PRONOSTICS_REPORT.js --md      # Doar Markdown
 */

const fs = require('fs');
const path = require('path');

const BASE_DIR = path.dirname(require.resolve('./notifications_tracking.json'));
const TRACKING_FILE = path.join(BASE_DIR, 'notifications_tracking.json');
const OUTPUT_JSON = path.join(BASE_DIR, 'pronostics-history.json');
const OUTPUT_MD = path.join(BASE_DIR, 'pronostics-history.md');

/**
 * Clasifică o notificare: won / lost / unknown / legacy / pending
 */
function classify(n) {
    // New format: validation_result field
    if (n.validation_result === 'won') return 'won';
    if (n.validation_result === 'lost') return 'lost';
    if (n.validation_result === 'unknown') return 'unknown';

    // Old format: result field as string (WON/LOST)
    if (typeof n.result === 'string') {
        if (n.result === 'WON') return 'won';
        if (n.result === 'LOST') return 'lost';
    }

    // Legacy notifications (old structure, no validation)
    if (n.legacyStructure && !n.validation_result) return 'legacy';

    // Pending: completed but not validated
    if (!n.validated && n.status === 'COMPLETED') return 'pending';

    return 'legacy';
}

/**
 * Extrage scorurile HT și FT
 */
function extractScores(n) {
    let htScore = 'N/A';
    let ftScore = 'N/A';

    // From validationDetails (new format)
    if (n.validationDetails) {
        if (n.validationDetails.htScore) htScore = n.validationDetails.htScore;
        if (n.validationDetails.finalScore) ftScore = n.validationDetails.finalScore;
    }

    // From result object (if validationDetails didn't have it)
    if (n.result && typeof n.result === 'object') {
        if (htScore === 'N/A' && n.result.halftime && n.result.halftime.score) {
            const s = n.result.halftime.score;
            htScore = `${s.home}-${s.away}`;
        }
        if (ftScore === 'N/A' && n.result.fulltime && n.result.fulltime.score) {
            const s = n.result.fulltime.score;
            ftScore = `${s.home}-${s.away}`;
        }
    }

    return { htScore, ftScore };
}

/**
 * Extrage numele pattern-ului
 */
function getPatternName(n) {
    if (n.pattern && typeof n.pattern === 'object' && n.pattern.name) return n.pattern.name;
    if (typeof n.pattern === 'string') return n.pattern;
    return 'N/A';
}

/**
 * Extrage descrierea evenimentului
 */
function getEventDescription(n) {
    if (typeof n.event === 'string') return n.event;
    if (n.event && n.event.description) return n.event.description;
    return 'N/A';
}

/**
 * Parsează data din format DD.MM.YYYY
 */
function parseDate(dateStr) {
    if (!dateStr) return null;
    const parts = dateStr.split('.');
    if (parts.length !== 3) return null;
    return new Date(parts[2], parts[1] - 1, parts[0]);
}

/**
 * Generează datele raportului
 */
function generateReportData() {
    const raw = JSON.parse(fs.readFileSync(TRACKING_FILE, 'utf-8'));
    const notifications = raw.notifications || [];

    // Clasificare și structurare
    const entries = notifications.map(n => {
        const category = classify(n);
        const scores = extractScores(n);
        const patternName = getPatternName(n);

        return {
            id: n.id,
            date: n.date,
            timestamp: n.timestamp,
            match: n.match,
            homeTeam: n.homeTeam,
            awayTeam: n.awayTeam,
            event: getEventDescription(n),
            pattern: patternName,
            category, // won, lost, unknown, legacy, pending
            htScore: scores.htScore,
            ftScore: scores.ftScore,
            odd: n.initial_odd || null,
            probability: n.probability || null,
            status: n.status || 'N/A'
        };
    });

    // Sortare: cel mai recent primul
    entries.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

    // Sumar
    const summary = { total: entries.length, won: 0, lost: 0, unknown: 0, legacy: 0, pending: 0 };
    entries.forEach(e => { if (summary[e.category] !== undefined) summary[e.category]++; });

    const validated = summary.won + summary.lost;
    summary.successRate = validated > 0 ? parseFloat(((summary.won / validated) * 100).toFixed(1)) : 0;

    // Per pattern
    const patternMap = {};
    entries.forEach(e => {
        if (e.pattern === 'N/A') return;
        if (!patternMap[e.pattern]) patternMap[e.pattern] = { pattern: e.pattern, won: 0, lost: 0, unknown: 0, total: 0 };
        patternMap[e.pattern].total++;
        if (e.category === 'won') patternMap[e.pattern].won++;
        if (e.category === 'lost') patternMap[e.pattern].lost++;
        if (e.category === 'unknown') patternMap[e.pattern].unknown++;
    });

    const byPattern = Object.values(patternMap).map(p => {
        const val = p.won + p.lost;
        p.rate = val > 0 ? parseFloat(((p.won / val) * 100).toFixed(1)) : 0;
        return p;
    }).sort((a, b) => b.rate - a.rate || b.won - a.won);

    // Per month
    const monthMap = {};
    entries.forEach(e => {
        const d = parseDate(e.date);
        if (!d) return;
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        if (!monthMap[key]) monthMap[key] = { month: key, won: 0, lost: 0, unknown: 0, legacy: 0, total: 0 };
        monthMap[key].total++;
        if (e.category === 'won') monthMap[key].won++;
        if (e.category === 'lost') monthMap[key].lost++;
        if (e.category === 'unknown') monthMap[key].unknown++;
        if (e.category === 'legacy') monthMap[key].legacy++;
    });

    const byMonth = Object.values(monthMap).map(m => {
        const val = m.won + m.lost;
        m.rate = val > 0 ? parseFloat(((m.won / val) * 100).toFixed(1)) : 0;
        return m;
    }).sort((a, b) => a.month.localeCompare(b.month));

    // Period
    const dates = entries.map(e => e.date).filter(Boolean);
    const period = {
        from: dates[dates.length - 1] || 'N/A',
        to: dates[0] || 'N/A'
    };

    return {
        generatedAt: new Date().toISOString(),
        period,
        summary,
        byPattern,
        byMonth,
        notifications: entries
    };
}

/**
 * Scrie JSON output
 */
function writeJSON(data) {
    fs.writeFileSync(OUTPUT_JSON, JSON.stringify(data, null, 2), 'utf-8');
    console.log(`  JSON salvat: ${OUTPUT_JSON}`);
}

/**
 * Generează și scrie Markdown output
 */
function writeMarkdown(data) {
    const lines = [];
    const s = data.summary;

    lines.push('# Raport Pronostice');
    lines.push('');
    lines.push(`> Generat: ${new Date(data.generatedAt).toLocaleString('ro-RO')}`);
    lines.push(`> Perioada: ${data.period.from} - ${data.period.to}`);
    lines.push('');

    // Sumar global
    lines.push('## Sumar Global');
    lines.push('');
    lines.push('| Metric | Valoare |');
    lines.push('|--------|---------|');
    lines.push(`| Total notificari | ${s.total} |`);
    lines.push(`| Castigate (WON) | ${s.won} |`);
    lines.push(`| Pierdute (LOST) | ${s.lost} |`);
    lines.push(`| Necunoscute (UNKNOWN) | ${s.unknown} |`);
    lines.push(`| Legacy (nevalidabile) | ${s.legacy} |`);
    lines.push(`| Pending | ${s.pending} |`);
    lines.push(`| **Success Rate** | **${s.successRate}%** |`);
    lines.push('');

    // Per pattern
    lines.push('## Performanta per Pattern');
    lines.push('');
    lines.push('| Pattern | WON | LOST | UNKNOWN | Total | Rate |');
    lines.push('|---------|-----|------|---------|-------|------|');
    data.byPattern.forEach(p => {
        lines.push(`| ${p.pattern} | ${p.won} | ${p.lost} | ${p.unknown} | ${p.total} | ${p.rate}% |`);
    });
    lines.push('');

    // Per month
    lines.push('## Performanta per Luna');
    lines.push('');
    lines.push('| Luna | WON | LOST | UNKNOWN | Legacy | Total | Rate |');
    lines.push('|------|-----|------|---------|--------|-------|------|');
    data.byMonth.forEach(m => {
        lines.push(`| ${m.month} | ${m.won} | ${m.lost} | ${m.unknown} | ${m.legacy} | ${m.total} | ${m.rate}% |`);
    });
    lines.push('');

    // Tabel complet
    lines.push('## Lista Completa Pronostice');
    lines.push('');
    lines.push('| # | Data | Meci | Pattern | Eveniment | HT | FT | Cota | Rezultat |');
    lines.push('|---|------|------|---------|-----------|----|----|------|----------|');
    data.notifications.forEach((n, i) => {
        const cat = n.category.toUpperCase();
        const evt = (n.event || 'N/A').substring(0, 50);
        lines.push(`| ${i + 1} | ${n.date} | ${n.match} | ${n.pattern} | ${evt} | ${n.htScore} | ${n.ftScore} | ${n.odd || '-'} | ${cat} |`);
    });
    lines.push('');

    fs.writeFileSync(OUTPUT_MD, lines.join('\n'), 'utf-8');
    console.log(`  Markdown salvat: ${OUTPUT_MD}`);
}

/**
 * Generează raportul complet
 */
function generate() {
    console.log('\n--- PRONOSTICS REPORT ---');
    console.log(`  Timestamp: ${new Date().toLocaleString('ro-RO')}`);

    const data = generateReportData();

    const args = process.argv.slice(2);
    const jsonOnly = args.includes('--json');
    const mdOnly = args.includes('--md');

    if (!jsonOnly && !mdOnly) {
        writeJSON(data);
        writeMarkdown(data);
    } else {
        if (jsonOnly) writeJSON(data);
        if (mdOnly) writeMarkdown(data);
    }

    const s = data.summary;
    console.log(`\n  Total: ${s.total} | WON: ${s.won} | LOST: ${s.lost} | UNKNOWN: ${s.unknown} | Legacy: ${s.legacy} | Pending: ${s.pending}`);
    console.log(`  Success Rate: ${s.successRate}% (din ${s.won + s.lost} validate)`);
    console.log(`  Patterns: ${data.byPattern.length} | Luni: ${data.byMonth.length}`);
    console.log('--- DONE ---\n');

    return data;
}

// Main
if (require.main === module) {
    generate();
}

module.exports = { generate, generateReportData };
