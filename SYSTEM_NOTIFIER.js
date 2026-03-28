/**
 * API SMART 5 - System Notifier
 *
 * Trimite notificări sistem:
 * 1. 🚀 START - când pornește sistemul
 * 2. 💓 HEARTBEAT - la fiecare oră (13:00-23:00)
 * 3. 🚨 CRASH/STOP - când se oprește accidental (cu cauză)
 */

const emailService = require('./EMAIL_SERVICE');
const fs = require('fs');
const path = require('path');

// Încarcă configurație
let CONFIG;
try {
    CONFIG = require('./NOTIFICATION_CONFIG.js');
} catch (error) {
    console.error('❌ Eroare la încărcare configurație:', error.message);
    CONFIG = null;
}

class SystemNotifier {
    constructor() {
        // Email service este deja inițializat centralizat
    }

    /**
     * 🚀 Trimite notificare STARTUP
     */
    async sendStartupNotification(pid) {
        if (!CONFIG || !CONFIG.notifications.sendEmail) {
            return { success: false, reason: 'disabled' };
        }

        try {
            const now = new Date();
            const htmlMessage = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        body { font-family: Arial, sans-serif; background-color: #f4f4f4; padding: 20px; margin: 0; }
        .container { background-color: white; border-radius: 10px; padding: 30px; max-width: 600px; margin: 0 auto; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .header { background: linear-gradient(135deg, #4caf50 0%, #45a049 100%); color: white; padding: 25px; border-radius: 10px 10px 0 0; margin: -30px -30px 20px -30px; text-align: center; }
        .icon { font-size: 48px; margin-bottom: 10px; }
        .content { padding: 20px 0; text-align: center; }
        .status-box { background-color: #e8f5e9; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #4caf50; }
        .info-row { margin: 8px 0; color: #666; }
        .footer { text-align: center; color: #999; font-size: 12px; margin-top: 20px; padding-top: 20px; border-top: 1px solid #e0e0e0; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="icon">🚀</div>
            <h1 style="margin: 0;">API SMART 5 - STARTED</h1>
            <p style="margin: 10px 0 0 0; opacity: 0.9;">Pattern Analyzer is now LIVE</p>
        </div>

        <div class="content">
            <div class="status-box">
                <h2 style="color: #4caf50; margin: 0 0 15px 0;">✅ Pattern Analyzer Pornit cu Succes</h2>
                <div class="info-row"><strong>Timestamp:</strong> ${now.toLocaleString('ro-RO')}</div>
                <div class="info-row"><strong>PID:</strong> ${pid || 'N/A'}</div>
                <div class="info-row"><strong>Status:</strong> ✅ OPERATIONAL</div>
                <div class="info-row"><strong>Watchdog:</strong> ACTIVE</div>
            </div>

            <p style="color: #666; margin: 20px 0;">Sistemul scanează meciuri live la fiecare 2 minute și detectează pattern-uri la halftime.</p>
            <p style="color: #666; margin: 20px 0;">📊 Verifică 71 pattern-uri pentru fiecare meci la pauză</p>
            <p style="color: #666; margin: 20px 0;">📧 Primești email doar când probabilitate >70%</p>
            <p style="color: #999; margin: 20px 0; font-size: 13px;">💓 Vei primi heartbeat la fiecare 2 ore între 13:00-23:00</p>
        </div>

        <div class="footer">
            <p>⚡ API SMART 5 - Pattern Analyzer</p>
            <p style="margin-top: 5px; font-size: 11px; color: #bbb;">Monitorizare automată 24/7</p>
        </div>
    </div>
</body>
</html>`;

            const textMessage = `🚀 API SMART 5 - PATTERN ANALYZER PORNIT

✅ Sistem pornit cu succes!

⏰ Timestamp: ${now.toLocaleString('ro-RO')}
🔧 PID: ${pid || 'N/A'}
🔄 Status: ✅ OPERATIONAL
👁️  Watchdog: ACTIVE

Pattern Analyzer scanează meciuri live la fiecare 2 minute.
Vei primi notificări doar pentru pattern-uri cu >70% probabilitate.

────────────────────────
API SMART 5 - Pattern Analyzer`;

            const mailOptions = {
                from: `"API SMART 5" <${CONFIG.email.user}>`,
                to: CONFIG.email.receiverEmail || CONFIG.email.user,
                subject: `🚀 API SMART 5 - SYSTEM STARTED`,
                text: textMessage,
                html: htmlMessage
            };

            const result = await emailService.send({
                from: mailOptions.from,
                to: mailOptions.to,
                subject: mailOptions.subject,
                html: mailOptions.html,
                text: mailOptions.text
            });

            if (!result.success) {
                throw new Error(result.error || 'Email service unavailable');
            }

            const info = { messageId: result.messageId };
            console.log('✅ Startup notification trimisă');
            return { success: true, messageId: info.messageId };

        } catch (error) {
            console.error('❌ Eroare la trimitere startup notification:', error.message);
            return { success: false, error: error.message };
        }
    }

    /**
     * 💓 Trimite notificare HEARTBEAT
     */
    async sendHeartbeatNotification(uptime, restartCount = 0, pid = null, memoryInfo = null) {
        if (!CONFIG || !CONFIG.notifications.sendEmail) {
            return { success: false, reason: 'disabled' };
        }

        try {
            const now = new Date();
            const memDisplay = memoryInfo ? memoryInfo.display : 'N/A';
            const memPercent = memoryInfo ? memoryInfo.usedPercent : 0;
            const memColor = memPercent >= 85 ? '#f44336' : memPercent >= 70 ? '#ff9800' : '#4caf50';
            const memBarWidth = Math.min(memPercent, 100);

            const htmlMessage = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        body { font-family: Arial, sans-serif; background-color: #f4f4f4; padding: 20px; margin: 0; }
        .container { background-color: white; border-radius: 10px; padding: 30px; max-width: 600px; margin: 0 auto; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .header { background: linear-gradient(135deg, #2196f3 0%, #1976d2 100%); color: white; padding: 25px; border-radius: 10px 10px 0 0; margin: -30px -30px 20px -30px; text-align: center; }
        .icon { font-size: 48px; margin-bottom: 10px; }
        .content { padding: 20px 0; text-align: center; }
        .status-box { background-color: #e3f2fd; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #2196f3; }
        .info-row { margin: 8px 0; color: #666; }
        .memory-bar { background-color: #e0e0e0; border-radius: 10px; height: 20px; margin: 10px 0; overflow: hidden; }
        .memory-fill { height: 100%; border-radius: 10px; transition: width 0.3s; }
        .footer { text-align: center; color: #999; font-size: 12px; margin-top: 20px; padding-top: 20px; border-top: 1px solid #e0e0e0; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="icon">💓</div>
            <h1 style="margin: 0;">SYSTEM HEARTBEAT</h1>
            <p style="margin: 10px 0 0 0; opacity: 0.9;">API SMART 5 is running normally</p>
        </div>

        <div class="content">
            <div class="status-box">
                <h2 style="color: #2196f3; margin: 0 0 15px 0;">✅ Sistem Activ</h2>
                <div class="info-row"><strong>Timestamp:</strong> ${now.toLocaleString('ro-RO')}</div>
                <div class="info-row"><strong>PID:</strong> ${pid || 'N/A'}</div>
                <div class="info-row"><strong>Uptime:</strong> ${uptime}</div>
                <div class="info-row"><strong>Total restart-uri:</strong> ${restartCount}</div>
            </div>

            <div style="background-color: #f5f5f5; padding: 15px; border-radius: 8px; margin: 15px 0;">
                <div class="info-row"><strong>🧠 Memorie:</strong> <span style="color: ${memColor}; font-weight: bold;">${memDisplay}</span></div>
                <div class="memory-bar">
                    <div class="memory-fill" style="width: ${memBarWidth}%; background-color: ${memColor};"></div>
                </div>
            </div>

            <p style="color: #666; margin: 20px 0;">Pattern Analyzer rulează normal și monitorizează meciuri live.</p>
        </div>

        <div class="footer">
            <p>💓 API SMART 5 - Heartbeat Monitor</p>
            <p style="margin-top: 5px; font-size: 11px; color: #bbb;">Trimis automat la fiecare 3 ore (8:00-1:00)</p>
        </div>
    </div>
</body>
</html>`;

            const textMessage = `💓 API SMART 5 - SYSTEM HEARTBEAT

✅ Sistem activ

⏰ Timestamp: ${now.toLocaleString('ro-RO')}
🔧 PID: ${pid || 'N/A'}
⏱️  Uptime: ${uptime}
🔄 Total restart-uri: ${restartCount}
🧠 Memorie: ${memDisplay}

Pattern Analyzer rulează normal.

────────────────────────
API SMART 5 - Heartbeat Monitor`;

            const mailOptions = {
                from: `"API SMART 5" <${CONFIG.email.user}>`,
                to: CONFIG.email.receiverEmail || CONFIG.email.user,
                subject: `💓 API SMART 5 - HEARTBEAT`,
                text: textMessage,
                html: htmlMessage
            };

            const result = await emailService.send({
                from: mailOptions.from,
                to: mailOptions.to,
                subject: mailOptions.subject,
                html: mailOptions.html,
                text: mailOptions.text
            });

            if (!result.success) {
                throw new Error(result.error || 'Email service unavailable');
            }

            const info = { messageId: result.messageId };
            console.log('💓 Heartbeat notification trimisă');
            return { success: true, messageId: info.messageId };

        } catch (error) {
            console.error('❌ Eroare la trimitere heartbeat:', error.message);
            return { success: false, error: error.message };
        }
    }

    /**
     * 🚨 Trimite notificare CRASH/RESTART
     */
    async sendCrashNotification(crashInfo) {
        if (!CONFIG || !CONFIG.notifications.sendEmail) {
            return { success: false, reason: 'disabled' };
        }

        try {
            const now = new Date();
            const { reason, exitCode, signal, restartCount, pid } = crashInfo;

            // Determină cauza crash-ului
            let crashReason = reason || 'Unknown';
            if (exitCode !== undefined && exitCode !== 0) {
                crashReason = `Exit code: ${exitCode}`;
            } else if (signal) {
                crashReason = `Terminated by signal: ${signal}`;
            }

            const htmlMessage = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        body { font-family: Arial, sans-serif; background-color: #f4f4f4; padding: 20px; margin: 0; }
        .container { background-color: white; border-radius: 10px; padding: 30px; max-width: 600px; margin: 0 auto; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .header { background: linear-gradient(135deg, #ff9800 0%, #f57c00 100%); color: white; padding: 25px; border-radius: 10px 10px 0 0; margin: -30px -30px 20px -30px; text-align: center; }
        .icon { font-size: 48px; margin-bottom: 10px; }
        .content { padding: 20px 0; text-align: center; }
        .status-box { background-color: #fff3e0; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #ff9800; }
        .info-row { margin: 8px 0; color: #666; }
        .crash-reason { background-color: #ffebee; color: #c62828; padding: 15px; border-radius: 6px; margin: 15px 0; font-weight: bold; }
        .footer { text-align: center; color: #999; font-size: 12px; margin-top: 20px; padding-top: 20px; border-top: 1px solid #e0e0e0; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="icon">🚨</div>
            <h1 style="margin: 0;">SYSTEM ALERT</h1>
            <p style="margin: 10px 0 0 0; opacity: 0.9;">Pattern Analyzer s-a oprit și a fost repornit</p>
        </div>

        <div class="content">
            <div class="status-box">
                <h2 style="color: #ff9800; margin: 0 0 15px 0;">⚠️ Script Oprit + Repornit Automat</h2>
                <div class="info-row"><strong>Timestamp:</strong> ${now.toLocaleString('ro-RO')}</div>
                <div class="info-row"><strong>PID:</strong> ${pid || 'N/A'}</div>
                <div class="info-row"><strong>Total restart-uri:</strong> ${restartCount || 0}</div>
            </div>

            <div class="crash-reason">
                🔍 Cauză: ${crashReason}
            </div>

            <p style="color: #666; margin: 20px 0;">Watchdog-ul a detectat că scriptul s-a oprit și l-a repornit automat.</p>
            <p style="color: #999; margin: 20px 0; font-size: 13px;">Dacă vezi acest mesaj des, verifică log-urile pentru detalii:</p>
            <p style="color: #999; font-size: 12px; font-family: monospace;">tail -f "/home/florian/API SMART 5/logs/pattern-analyzer.log"</p>
        </div>

        <div class="footer">
            <p>🚨 API SMART 5 - Crash Monitor</p>
            <p style="margin-top: 5px; font-size: 11px; color: #bbb;">Watchdog automat</p>
        </div>
    </div>
</body>
</html>`;

            const textMessage = `🚨 API SMART 5 - SYSTEM ALERT

⚠️  Pattern Analyzer s-a oprit și a fost repornit automat

⏰ Timestamp: ${now.toLocaleString('ro-RO')}
🔧 PID: ${pid || 'N/A'}
🔄 Total restart-uri: ${restartCount || 0}
🔍 Cauză: ${crashReason}

Watchdog-ul a repornit automat scriptul.

Verifică log-urile:
tail -f "/home/florian/API SMART 5/logs/pattern-analyzer.log"

────────────────────────
API SMART 5 - Crash Monitor`;

            const mailOptions = {
                from: `"API SMART 5" <${CONFIG.email.user}>`,
                to: CONFIG.email.receiverEmail || CONFIG.email.user,
                subject: `🚨 API SMART 5 - SYSTEM ALERT`,
                text: textMessage,
                html: htmlMessage
            };

            const result = await emailService.send({
                from: mailOptions.from,
                to: mailOptions.to,
                subject: mailOptions.subject,
                html: mailOptions.html,
                text: mailOptions.text
            });

            if (!result.success) {
                throw new Error(result.error || 'Email service unavailable');
            }

            const info = { messageId: result.messageId };
            console.log('🚨 Crash notification trimisă');
            return { success: true, messageId: info.messageId };

        } catch (error) {
            console.error('❌ Eroare la trimitere crash notification:', error.message);
            return { success: false, error: error.message };
        }
    }

    /**
     * 😴 Trimite notificare NU SUNT MECIURI
     */
    async sendNoMatchesNotification(reason = 'Pauză în campionate') {
        if (!CONFIG || !CONFIG.notifications.sendEmail) {
            return { success: false, reason: 'disabled' };
        }

        try {
            const now = new Date();
            const htmlMessage = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        body { font-family: Arial, sans-serif; background-color: #f4f4f4; padding: 20px; margin: 0; }
        .container { background-color: white; border-radius: 10px; padding: 30px; max-width: 600px; margin: 0 auto; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .header { background: linear-gradient(135deg, #ffb74d 0%, #ffa726 100%); color: white; padding: 25px; border-radius: 10px 10px 0 0; margin: -30px -30px 20px -30px; text-align: center; }
        .icon { font-size: 48px; margin-bottom: 10px; }
        .content { padding: 20px 0; text-align: center; }
        .info-box { background-color: #fff8e1; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #ffb74d; }
        .info-row { margin: 8px 0; color: #666; }
        .footer { text-align: center; color: #999; font-size: 12px; margin-top: 20px; padding-top: 20px; border-top: 1px solid #e0e0e0; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="icon">😴</div>
            <h1 style="margin: 0;">ASTĂZI NU AVEM MECIURI</h1>
            <p style="margin: 10px 0 0 0; opacity: 0.9;">Ne vedem mâine!</p>
        </div>

        <div class="content">
            <div class="info-box">
                <h2 style="color: #f57c00; margin: 0 0 15px 0;">⚽ Nici un meci din TOP 30 Ligi</h2>
                <div class="info-row"><strong>Data:</strong> ${now.toLocaleDateString('ro-RO')}</div>
                <div class="info-row"><strong>Motiv:</strong> ${reason}</div>
            </div>

            <p style="color: #666; margin: 20px 0; font-size: 16px;">🏖️ Relaxează-te astăzi!</p>
            <p style="color: #666; margin: 20px 0;">API SMART 5 a verificat FlashScore și nu a găsit meciuri din ligile majore (Premier League, La Liga, Serie A, etc.)</p>
            <p style="color: #999; margin: 20px 0; font-size: 14px;">📅 Sistemul va verifica automat mâine la 08:00</p>
            <p style="color: #999; margin: 20px 0; font-size: 14px;">🔄 Când revin meciurile, monitorizarea va porni automat</p>
        </div>

        <div class="footer">
            <p>⚽ API SMART 5 - Match Monitor</p>
            <p style="margin-top: 5px; font-size: 11px; color: #bbb;">Verificare automată zilnică</p>
        </div>
    </div>
</body>
</html>`;

            const textMessage = `😴 API SMART 5 - ASTĂZI NU AVEM MECIURI

⚽ Nici un meci din TOP 30 Ligi

📅 Data: ${now.toLocaleDateString('ro-RO')}
📋 Motiv: ${reason}

🏖️ Relaxează-te astăzi!

API SMART 5 a verificat FlashScore și nu a găsit meciuri
din ligile majore (Premier League, La Liga, Serie A, etc.)

📅 Sistemul va verifica automat mâine la 08:00
🔄 Când revin meciurile, monitorizarea va porni automat

────────────────────────
API SMART 5 - Ne vedem mâine!`;

            const mailOptions = {
                from: `"API SMART 5" <${CONFIG.email.user}>`,
                to: CONFIG.email.receiverEmail || CONFIG.email.user,
                subject: `😴 API SMART 5 - ASTĂZI NU AVEM MECIURI - Ne vedem mâine!`,
                text: textMessage,
                html: htmlMessage
            };

            const result = await emailService.send({
                from: mailOptions.from,
                to: mailOptions.to,
                subject: mailOptions.subject,
                html: mailOptions.html,
                text: mailOptions.text
            });

            if (!result.success) {
                throw new Error(result.error || 'Email service unavailable');
            }

            const info = { messageId: result.messageId };
            console.log('😴 No matches notification trimisă');
            return { success: true, messageId: info.messageId };

        } catch (error) {
            console.error('❌ Eroare la trimitere no matches notification:', error.message);
            return { success: false, error: error.message };
        }
    }

    /**
     * ⚠️ Trimite notificare CRITICAL (prea multe restart-uri)
     */
    async sendCriticalNotification(restartCount) {
        if (!CONFIG || !CONFIG.notifications.sendEmail) {
            return { success: false, reason: 'disabled' };
        }

        try {
            const now = new Date();
            const htmlMessage = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        body { font-family: Arial, sans-serif; background-color: #f4f4f4; padding: 20px; margin: 0; }
        .container { background-color: white; border-radius: 10px; padding: 30px; max-width: 600px; margin: 0 auto; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .header { background: linear-gradient(135deg, #f44336 0%, #d32f2f 100%); color: white; padding: 25px; border-radius: 10px 10px 0 0; margin: -30px -30px 20px -30px; text-align: center; }
        .icon { font-size: 48px; margin-bottom: 10px; }
        .content { padding: 20px 0; text-align: center; }
        .critical-box { background-color: #ffebee; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #f44336; }
        .footer { text-align: center; color: #999; font-size: 12px; margin-top: 20px; padding-top: 20px; border-top: 1px solid #e0e0e0; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="icon">⚠️</div>
            <h1 style="margin: 0;">CRITICAL ALERT</h1>
            <p style="margin: 10px 0 0 0; opacity: 0.9;">PREA MULTE RESTART-URI!</p>
        </div>

        <div class="content">
            <div class="critical-box">
                <h2 style="color: #f44336; margin: 0 0 15px 0;">⚠️ VERIFICARE MANUALĂ NECESARĂ!</h2>
                <p style="margin: 10px 0; color: #666;"><strong>Timestamp:</strong> ${now.toLocaleString('ro-RO')}</p>
                <p style="margin: 10px 0; color: #c62828; font-size: 20px; font-weight: bold;">
                    ${restartCount} restart-uri în ultima oră
                </p>
            </div>

            <p style="color: #666; margin: 20px 0;">⚠️ Pattern Analyzer se oprește repetat.</p>
            <p style="color: #666; margin: 20px 0;"><strong>Acțiuni recomandate:</strong></p>
            <ul style="text-align: left; color: #666; margin: 0 auto; max-width: 400px;">
                <li>Verifică log-urile pentru erori</li>
                <li>Verifică disponibilitatea API-ului Flashscore</li>
                <li>Verifică memorie/CPU</li>
                <li>Repornește manual sistemul</li>
            </ul>
            <p style="color: #999; margin: 20px 0; font-size: 12px; font-family: monospace;">tail -100 "/home/florian/API SMART 5/logs/pattern-analyzer.log"</p>
        </div>

        <div class="footer">
            <p>⚠️ API SMART 5 - Critical Alert</p>
        </div>
    </div>
</body>
</html>`;

            const textMessage = `⚠️ API SMART 5 - CRITICAL ALERT

⚠️  PREA MULTE RESTART-URI!

⏰ Timestamp: ${now.toLocaleString('ro-RO')}
🔄 ${restartCount} restart-uri în ultima oră

⚠️  VERIFICARE MANUALĂ NECESARĂ!

Pattern Analyzer se oprește repetat.
Verifică log-urile:

tail -100 "/home/florian/API SMART 5/logs/pattern-analyzer.log"

────────────────────────
API SMART 5 - Critical Alert`;

            const mailOptions = {
                from: `"API SMART 5" <${CONFIG.email.user}>`,
                to: CONFIG.email.receiverEmail || CONFIG.email.user,
                subject: `⚠️ API SMART 5 - CRITICAL ALERT`,
                text: textMessage,
                html: htmlMessage
            };

            const result = await emailService.send({
                from: mailOptions.from,
                to: mailOptions.to,
                subject: mailOptions.subject,
                html: mailOptions.html,
                text: mailOptions.text
            });

            if (!result.success) {
                throw new Error(result.error || 'Email service unavailable');
            }

            const info = { messageId: result.messageId };
            console.log('⚠️  Critical notification trimisă');
            return { success: true, messageId: info.messageId };

        } catch (error) {
            console.error('❌ Eroare la trimitere critical notification:', error.message);
            return { success: false, error: error.message };
        }
    }
}

module.exports = SystemNotifier;
