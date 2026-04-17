/**
 * SUBSCRIBER_MANAGER.js — Gestiune abonați din JSON local
 *
 * Fără baze de date externe — un simplu JSON cu 100 abonați.
 * Adminul (Florian) gestionează din dashboard sau direct din JSON.
 *
 * USAGE:
 *   const subs = require('./SUBSCRIBER_MANAGER');
 *   const eligible = subs.getEligible('ht', { probability: 85, league: 'ENGLAND: Premier League', pattern: 'PATTERN_3.3' });
 *   await subs.notifyAll('ht', notification);
 */

const fs = require('fs');
const path = require('path');
const logger = require('./LOG_MANAGER');
const emailService = require('./EMAIL_SERVICE');

const SUBSCRIBERS_FILE = path.join(__dirname, 'data', 'subscribers', 'subscribers.json');

/**
 * Citește lista de abonați
 */
function readSubscribers() {
    try {
        return JSON.parse(fs.readFileSync(SUBSCRIBERS_FILE, 'utf8'));
    } catch {
        return { subscribers: [] };
    }
}

/**
 * Salvează lista de abonați
 */
function saveSubscribers(data) {
    const dir = path.dirname(SUBSCRIBERS_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(SUBSCRIBERS_FILE, JSON.stringify(data, null, 2), 'utf8');
}

/**
 * Returnează abonații eligibili pentru o notificare
 */
function getEligible(type, notification) {
    const data = readSubscribers();
    const { probability, league, pattern } = notification;

    return data.subscribers.filter(sub => {
        if (!sub.active) return false;

        const pref = sub.preferences || {};

        // Tip notificare activat?
        if (type === 'ht' && !pref.notify_ht) return false;
        if (type === 'prematch' && !pref.notify_prematch) return false;
        if (type === 'result' && !pref.notify_results) return false;

        // Probabilitate peste pragul clientului?
        if (type === 'ht' && probability < (pref.min_prob_ht || 75)) return false;
        if (type === 'prematch' && probability < (pref.min_prob_prematch || 80)) return false;

        // Liga în preferințe? (gol = toate)
        if (pref.leagues && pref.leagues.length > 0 && league) {
            if (!pref.leagues.some(l => league.includes(l))) return false;
        }

        // Pattern în preferințe? (gol = toate)
        if (pref.patterns && pref.patterns.length > 0 && pattern) {
            const family = pattern.replace(/\.\d+.*$/, '').replace(/\+$/, '');
            if (!pref.patterns.includes(pattern) && !pref.patterns.includes(family)) return false;
        }

        // Plan free = max 1/zi
        if (sub.plan === 'free') {
            const today = new Date().toISOString().split('T')[0];
            if (sub._lastNotification === today) return false;
        }

        return true;
    });
}

/**
 * Trimite notificarea la toți abonații eligibili
 */
async function notifyAll(type, notification) {
    const eligible = getEligible(type, notification);
    if (eligible.length === 0) return { sent: 0, total: 0 };

    const data = readSubscribers();
    let sent = 0;
    const today = new Date().toISOString().split('T')[0];

    for (const sub of eligible) {
        if (!sub.email) continue;

        try {
            const subject = formatSubject(type, notification);
            const html = formatEmail(type, notification, sub.name);

            await emailService.send({ to: sub.email, subject, html });
            sent++;

            // Marchează ultima notificare (pentru limita free)
            const idx = data.subscribers.findIndex(s => s.id === sub.id);
            if (idx !== -1) data.subscribers[idx]._lastNotification = today;

            logger.info(`   📤 Abonat notificat: ${sub.email} (${sub.plan})`);
        } catch (e) {
            logger.error(`   ❌ Eroare email ${sub.email}: ${e.message}`);
        }
    }

    // Salvăm _lastNotification
    saveSubscribers(data);

    if (sent > 0) {
        logger.info(`   📤 Total: ${sent}/${eligible.length} abonați notificați`);
    }

    return { sent, total: eligible.length };
}

function formatSubject(type, n) {
    const match = `${n.homeTeam} vs ${n.awayTeam}`;
    if (type === 'ht') return `⚽ ${n.probability}% | ${match} | ${n.pattern}`;
    if (type === 'prematch') return `📊 Prematch ${n.probability || n.rate}% | ${match}`;
    if (type === 'result') return `${n.validationResult === 'won' ? '✅' : '❌'} ${match}`;
    return `Smart Predictions | ${match}`;
}

function formatEmail(type, n, name) {
    const greeting = name ? `Salut ${name}` : 'Salut';
    const match = `${n.homeTeam} vs ${n.awayTeam}`;
    const league = n.league || n.liga || '';

    if (type === 'ht') {
        return `<div style="font-family:Arial;max-width:500px;margin:0 auto;">
            <h2 style="color:#059669;">⚽ Predicție Detectată</h2>
            <p>${greeting},</p>
            <div style="background:#f0fdf4;border:1px solid #059669;border-radius:8px;padding:16px;margin:16px 0;">
                <h3 style="margin:0;">${match}</h3>
                <p style="color:#666;margin:4px 0;">${league}</p>
                <p><strong>Pattern:</strong> ${n.pattern}</p>
                <p><strong>Probabilitate:</strong> <span style="color:#059669;font-size:24px;font-weight:bold;">${n.probability}%</span></p>
            </div>
            <p style="color:#999;font-size:12px;">Smart Predictions — smart.frust.ro</p>
        </div>`;
    }

    if (type === 'prematch') {
        return `<div style="font-family:Arial;max-width:500px;margin:0 auto;">
            <h2 style="color:#2563eb;">📊 Predicție Pre-Meci</h2>
            <p>${greeting},</p>
            <div style="background:#eff6ff;border:1px solid #2563eb;border-radius:8px;padding:16px;margin:16px 0;">
                <h3 style="margin:0;">${match}</h3>
                <p style="color:#666;margin:4px 0;">${league}</p>
                <p><strong>Pronostic:</strong> ${n.label || n.pattern}</p>
                <p><strong>Rată:</strong> <span style="color:#2563eb;font-size:24px;font-weight:bold;">${n.probability || n.rate}%</span></p>
            </div>
            <p style="color:#999;font-size:12px;">Smart Predictions — smart.frust.ro</p>
        </div>`;
    }

    if (type === 'result') {
        const won = n.validationResult === 'won';
        return `<div style="font-family:Arial;max-width:500px;margin:0 auto;">
            <h2 style="color:${won ? '#059669' : '#dc2626'};">${won ? '✅ Câștigat' : '❌ Pierdut'}</h2>
            <p>${greeting},</p>
            <div style="background:${won ? '#f0fdf4' : '#fef2f2'};border:1px solid ${won ? '#059669' : '#dc2626'};border-radius:8px;padding:16px;margin:16px 0;">
                <h3 style="margin:0;">${match}</h3>
                <p><strong>Scor:</strong> ${n.score || 'N/A'}</p>
                <p><strong>Pattern:</strong> ${n.pattern}</p>
            </div>
            <p style="color:#999;font-size:12px;">Smart Predictions — smart.frust.ro</p>
        </div>`;
    }

    return '';
}

// ═══════════════════════════════════════
// ADMIN — gestiune abonați
// ═══════════════════════════════════════

function addSubscriber({ email, name, plan = 'free', preferences = {} }) {
    const data = readSubscribers();
    const id = email.split('@')[0].replace(/[^a-z0-9]/gi, '_') + '_' + Date.now();

    if (data.subscribers.find(s => s.email === email)) {
        return { success: false, reason: 'Email deja înregistrat' };
    }

    data.subscribers.push({
        id,
        email,
        name: name || null,
        role: 'user',
        plan,
        active: true,
        preferences: {
            notify_ht: true,
            notify_prematch: true,
            notify_results: true,
            min_prob_ht: 75,
            min_prob_prematch: 80,
            leagues: [],
            patterns: [],
            ...preferences
        },
        created_at: new Date().toISOString().split('T')[0],
        notes: ''
    });

    saveSubscribers(data);
    return { success: true, id };
}

function removeSubscriber(email) {
    const data = readSubscribers();
    data.subscribers = data.subscribers.filter(s => s.email !== email);
    saveSubscribers(data);
}

function updateSubscriber(email, updates) {
    const data = readSubscribers();
    const idx = data.subscribers.findIndex(s => s.email === email);
    if (idx === -1) return false;
    data.subscribers[idx] = { ...data.subscribers[idx], ...updates };
    saveSubscribers(data);
    return true;
}

function changePlan(email, newPlan) {
    return updateSubscriber(email, { plan: newPlan });
}

function listSubscribers() {
    return readSubscribers().subscribers;
}

function getStats() {
    const subs = readSubscribers().subscribers;
    return {
        total: subs.length,
        active: subs.filter(s => s.active).length,
        free: subs.filter(s => s.plan === 'free').length,
        basic: subs.filter(s => s.plan === 'basic').length,
        premium: subs.filter(s => s.plan === 'premium').length,
        gift: subs.filter(s => s.plan === 'gift').length,
    };
}

module.exports = {
    getEligible,
    notifyAll,
    addSubscriber,
    removeSubscriber,
    updateSubscriber,
    changePlan,
    listSubscribers,
    getStats,
};
