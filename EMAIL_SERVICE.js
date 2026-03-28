/**
 * EMAIL SERVICE - Serviciu Centralizat pentru Email
 *
 * Gestionează TOATE trimiteri de email din API SMART 5
 *
 * AVANTAJE:
 * - Un singur transporter nodemailer
 * - Template-uri HTML centralizate
 * - Gestionare erori standardizată
 * - Ușor de testat și menținut
 *
 * FOLOSIT DE:
 * - email-notifier.js (pattern notifications)
 * - ODDS_CONTINUOUS_MONITOR.js (odds alerts)
 * - AUTO_CALIBRATE_PATTERNS.js (calibration reports)
 * - ODD_150_NOTIFIER.js (odds 1.50 & 2.00)
 * - SYSTEM_NOTIFIER.js (startup, heartbeat, crash)
 * - SEND_DAILY_REPORT.js (daily pronostics report)
 * - SEND_COLLECTED_MATCHES_REPORT.js (collected matches report)
 */

const nodemailer = require('nodemailer');

class EmailService {
    constructor() {
        this.transporter = null;
        this.config = null;
        this.initTransporter();
    }

    /**
     * Inițializează transporterul email
     */
    initTransporter() {
        try {
            this.config = require('./NOTIFICATION_CONFIG');

            if (!this.config || !this.config.email || !this.config.email.appPassword) {
                console.log('⚠️  Email SERVICE: configurație lipsă, email dezactivat');
                return;
            }

            this.transporter = nodemailer.createTransport({
                host: this.config.email.smtpHost,
                port: this.config.email.smtpPort,
                secure: this.config.email.secure,
                auth: {
                    user: this.config.email.user,
                    pass: this.config.email.appPassword
                }
            });

            console.log('✅ Email SERVICE inițializat');

        } catch (error) {
            console.error('❌ Email SERVICE: eroare la inițializare:', error.message);
        }
    }

    /**
     * Verifică dacă email-ul este configurat și activat
     */
    isAvailable() {
        return !!(
            this.transporter &&
            this.config &&
            this.config.notifications &&
            this.config.notifications.sendEmail
        );
    }

    /**
     * Trimite email generic
     *
     * @param {Object} options - Opțiuni email
     * @param {string} options.to - Destinatar (optional, folosește config default)
     * @param {string} options.subject - Subiect email
     * @param {string} options.html - Conținut HTML
     * @param {string} options.text - Conținut text (optional)
     * @param {string} options.from - Expeditor (optional)
     * @param {Array} options.attachments - Fișiere atașate (optional)
     *   Format: [{ filename: 'file.pdf', path: '/path/to/file.pdf' }, ...]
     * @returns {Promise<Object>} - { success: boolean, messageId?: string, error?: string }
     */
    async send({ to, subject, html, text = null, from = null, attachments = null }) {
        if (!this.isAvailable()) {
            return {
                success: false,
                error: 'Email service not available or disabled'
            };
        }

        try {
            const mailOptions = {
                from: from || `"API SMART 5" <${this.config.email.user}>`,
                to: to || this.config.email.receiverEmail || this.config.email.user,
                subject: subject,
                html: html
            };

            if (text) {
                mailOptions.text = text;
            }

            // Adaugă atașamente dacă există
            if (attachments && Array.isArray(attachments) && attachments.length > 0) {
                mailOptions.attachments = attachments;
            }

            const info = await this.transporter.sendMail(mailOptions);

            console.log(`✅ Email trimis: ${info.messageId}`);
            console.log(`   Subject: ${subject}`);

            return {
                success: true,
                messageId: info.messageId
            };

        } catch (error) {
            console.error(`❌ Eroare trimitere email: ${error.message}`);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Trimite email de test pentru verificare configurație
     */
    async sendTestEmail() {
        return await this.send({
            subject: '✅ Test Email - API SMART 5',
            html: `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
</head>
<body style="font-family: Arial, sans-serif; padding: 20px;">
    <h2 style="color: #4caf50;">✅ Email Service Funcțional</h2>
    <p>Configurația email funcționează corect!</p>
    <p><strong>Timestamp:</strong> ${new Date().toLocaleString('ro-RO')}</p>
    <hr>
    <p style="color: #999; font-size: 12px;">API SMART 5 - Email Service Test</p>
</body>
</html>
            `,
            text: `✅ Email Service Funcțional\n\nConfigurația email funcționează corect!\nTimestamp: ${new Date().toLocaleString('ro-RO')}`
        });
    }

    /**
     * Trimite notificare când cota atinge pragul (1.5 sau 2.0)
     */
    async sendOddsNotification({ match, homeTeam, awayTeam, event, threshold, currentOdd, minute, pattern, probability }) {
        const subject = `💰 COTA ${threshold} ATINSĂ - ${match}`;

        const htmlContent = `
            <div class="notification-box">
                <h2 style="color: #667eea; margin-top: 0;">💰 Cota ${threshold} Atinsă!</h2>

                <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; margin: 15px 0;">
                    <h3 style="margin: 0 0 10px 0; color: #333;">⚽ ${match}</h3>
                    <p style="margin: 5px 0;"><strong>Gazdă:</strong> ${homeTeam}</p>
                    <p style="margin: 5px 0;"><strong>Oaspete:</strong> ${awayTeam}</p>
                </div>

                <div style="background: #e3f2fd; padding: 15px; border-radius: 8px; margin: 15px 0; border-left: 4px solid #2196f3;">
                    <h4 style="margin: 0 0 10px 0; color: #1976d2;">📊 Detalii Eveniment</h4>
                    <p style="margin: 5px 0;"><strong>Eveniment:</strong> ${event}</p>
                    <p style="margin: 5px 0;"><strong>Pattern:</strong> ${pattern}</p>
                    <p style="margin: 5px 0;"><strong>Probabilitate:</strong> ${probability}</p>
                </div>

                <div style="background: #fff3cd; padding: 20px; border-radius: 8px; margin: 15px 0; text-align: center; border: 2px solid #ffc107;">
                    <h3 style="margin: 0 0 10px 0; color: #856404;">💰 Cotă Actuală</h3>
                    <p style="font-size: 32px; font-weight: bold; color: #e65100; margin: 10px 0;">${currentOdd}</p>
                    <p style="margin: 5px 0; color: #666;">Prag atins: ${threshold}</p>
                    <p style="margin: 5px 0; color: #666;">⏰ Minut: ${minute}</p>
                </div>

                <div style="background: #d1f2eb; padding: 15px; border-radius: 8px; margin: 15px 0;">
                    <p style="margin: 5px 0; color: #00695c;"><strong>✅ Acțiune recomandată:</strong></p>
                    <p style="margin: 5px 0; color: #00695c;">Verifică meciul LIVE pe Superbet și analizează evoluția cotei!</p>
                </div>
            </div>
        `;

        const html = this._wrapHTML(htmlContent, '#667eea', '💰', 'COTA MONITOR');

        const text = `
💰 COTA ${threshold} ATINSĂ!

⚽ MECI: ${match}
🏠 Gazdă: ${homeTeam}
✈️  Oaspete: ${awayTeam}

📊 EVENIMENT: ${event}
🎯 Pattern: ${pattern}
📈 Probabilitate: ${probability}

💰 COTĂ ACTUALĂ: ${currentOdd}
✅ Prag atins: ${threshold}
⏰ Minut: ${minute}

🔍 Verifică meciul LIVE pe Superbet!

---
⚡ API SMART 5 - Odds Monitor
🕐 ${new Date().toLocaleString('ro-RO')}
        `;

        return await this.send({
            subject,
            html,
            text
        });
    }

    /**
     * Template: Wrapper HTML standard pentru toate email-urile
     */
    _wrapHTML(content, headerColor = '#667eea', headerIcon = '🚨', headerTitle = 'API SMART 5') {
        return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        body {
            font-family: Arial, sans-serif;
            background-color: #f4f4f4;
            padding: 20px;
            margin: 0;
        }
        .container {
            background-color: white;
            border-radius: 10px;
            padding: 30px;
            max-width: 700px;
            margin: 0 auto;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        .header {
            background: ${headerColor};
            color: white;
            padding: 20px;
            border-radius: 10px 10px 0 0;
            margin: -30px -30px 20px -30px;
            text-align: center;
        }
        .header h1 {
            margin: 0;
            font-size: 24px;
        }
        .footer {
            text-align: center;
            color: #999;
            font-size: 12px;
            margin-top: 20px;
            padding-top: 20px;
            border-top: 1px solid #e0e0e0;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div style="font-size: 48px; margin-bottom: 10px;">${headerIcon}</div>
            <h1>${headerTitle}</h1>
        </div>
        ${content}
        <div class="footer">
            <p>⚡ API SMART 5 - Automated Football Pattern Analyzer</p>
            <p>🤖 Generated with Claude Code</p>
            <p>⏰ ${new Date().toLocaleString('ro-RO')}</p>
        </div>
    </div>
</body>
</html>
        `;
    }
}

// Export singleton
module.exports = new EmailService();
