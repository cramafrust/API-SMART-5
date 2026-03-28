/**
 * ODD 1.50 NOTIFIER
 *
 * Trimite notificare email când cota ajunge la 1.50
 * Format scurt: "MANCHESTER CITY - LIVERPOOL, CITY MARCHEAZĂ 1.50"
 */

const emailService = require('./EMAIL_SERVICE');
const config = require('./NOTIFICATION_CONFIG');

class Odd150Notifier {
    constructor() {
        // Email service este deja inițializat centralizat
    }

    /**
     * Generează descrierea scurtă a evenimentului
     */
    generateShortDescription(notification) {
        // FIX: notification.event poate fi string SAU obiect {description, context}
        let eventText = '';
        if (typeof notification.event === 'object' && notification.event.description) {
            eventText = notification.event.description.toUpperCase();
        } else if (typeof notification.event === 'string') {
            eventText = notification.event.toUpperCase();
        } else {
            eventText = String(notification.event).toUpperCase();
        }

        const event = eventText;

        // Extrage echipa din eveniment
        let team = '';

        if (event.includes('ECHIPA GAZDĂ') || event.includes('ECHIPA 1')) {
            team = notification.homeTeam.toUpperCase();
        } else if (event.includes('ECHIPA OASPETE') || event.includes('ECHIPA 2')) {
            team = notification.awayTeam.toUpperCase();
        } else {
            // Pentru alte tipuri (cornere, cartonașe, etc.)
            team = 'MECI';
        }

        // Extrage acțiunea
        let action = '';
        if (event.includes('MARCĂ') || event.includes('GOL')) {
            action = 'MARCHEAZĂ';
        } else if (event.includes('CORNER')) {
            action = 'CORNER';
        } else if (event.includes('CARTONAȘ')) {
            action = 'CARTONAȘ';
        } else {
            action = 'EVENIMENT';
        }

        return `${team} ${action}`;
    }

    /**
     * Trimite notificare când cota ajunge la 1.50
     * @param {Object} notification - Notificarea
     * @param {Number} minute - Minutul curent
     * @param {Number|null} odd - Cota (null pentru pattern-uri CARTONAȘE fără cotă)
     */
    async sendOdd150Notification(notification, minute, odd = null) {
        console.log(`   [DEBUG] sendOdd150Notification called`);
        console.log(`   [DEBUG] config.notifications.sendEmail = ${config.notifications.sendEmail}`);

        if (!config.notifications.sendEmail) {
            console.log('   📧 Email notifications disabled');
            return { success: false, reason: 'Email disabled' };
        }

        try {
            // Generează descrierea scurtă
            const shortDescription = this.generateShortDescription(notification);

            // Subject: format scurt (cu sau fără cotă)
            const oddText = odd !== null ? ` ${odd.toFixed(2)}` : ' (fără cotă Superbet)';
            const subject = `⚡ ${notification.homeTeam.toUpperCase()} - ${notification.awayTeam.toUpperCase()}, ${shortDescription}${oddText}`;

            // Body: mai detaliat
            const htmlBody = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        body {
            font-family: Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
            background: #f5f5f5;
        }
        .container {
            background: white;
            border-radius: 15px;
            overflow: hidden;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
        }
        .header {
            background: linear-gradient(135deg, #28a745 0%, #20c997 100%);
            color: white;
            padding: 30px 20px;
            text-align: center;
            position: relative;
        }
        .odd-badge {
            background: rgba(255,255,255,0.3);
            border: 3px solid white;
            border-radius: 50%;
            width: 120px;
            height: 120px;
            margin: 0 auto 15px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 48px;
            font-weight: bold;
            color: white;
            box-shadow: 0 4px 10px rgba(0,0,0,0.2);
        }
        .header-title {
            font-size: 28px;
            font-weight: bold;
            margin: 10px 0;
            text-shadow: 2px 2px 4px rgba(0,0,0,0.2);
        }
        .header-subtitle {
            font-size: 16px;
            opacity: 0.95;
            margin-top: 5px;
        }
        .content {
            padding: 30px 20px;
        }
        .match-title {
            font-size: 26px;
            font-weight: bold;
            color: #28a745;
            margin-bottom: 20px;
            text-align: center;
            padding: 15px;
            background: linear-gradient(135deg, #d4edda 0%, #c3e6cb 100%);
            border-radius: 10px;
            border-left: 5px solid #28a745;
        }
        .event-box {
            background: #f8f9fa;
            padding: 20px;
            border-left: 5px solid #28a745;
            margin: 25px 0;
            border-radius: 5px;
            font-size: 16px;
        }
        .event-box strong {
            color: #28a745;
            font-size: 18px;
        }
        .info-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 15px;
            margin: 20px 0;
        }
        .info-card {
            background: #f8f9fa;
            padding: 15px;
            border-radius: 8px;
            text-align: center;
            border: 2px solid #e9ecef;
        }
        .info-label {
            font-size: 14px;
            color: #666;
            margin-bottom: 5px;
        }
        .info-value {
            font-size: 20px;
            font-weight: bold;
            color: #28a745;
        }
        .alert-box {
            background: linear-gradient(135deg, #fff3cd 0%, #ffeaa7 100%);
            border-left: 5px solid #ffc107;
            padding: 15px;
            margin: 20px 0;
            border-radius: 5px;
        }
        .footer {
            text-align: center;
            margin-top: 30px;
            padding-top: 20px;
            border-top: 2px solid #e9ecef;
            color: #666;
            font-size: 13px;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="odd-badge">1.50</div>
            <div class="header-title">⚡ REVENIRE COTĂ!</div>
            <div class="header-subtitle">Oportunitate de intrare</div>
        </div>

        <div class="content">
            <div class="match-title">
                ${notification.homeTeam.toUpperCase()}<br>vs<br>${notification.awayTeam.toUpperCase()}
            </div>

            <div class="event-box">
                <strong>📊 Eveniment:</strong><br>
                ${typeof notification.event === 'object' && notification.event.description ? notification.event.description : notification.event}
            </div>

            <div class="alert-box">
                ⚡ <strong>Cota a revenit la 1.50!</strong> Moment bun pentru intrare după scăderea de la ${notification.initial_odd.toFixed(2)}.
            </div>

            <div class="info-grid">
                <div class="info-card">
                    <div class="info-label">🕐 Minut</div>
                    <div class="info-value">${minute}'</div>
                </div>
                <div class="info-card">
                    <div class="info-label">💰 Cotă Inițială</div>
                    <div class="info-value">${notification.initial_odd.toFixed(2)}</div>
                </div>
                <div class="info-card">
                    <div class="info-label">📈 Probabilitate</div>
                    <div class="info-value">${notification.probability}%</div>
                </div>
                <div class="info-card">
                    <div class="info-label">📅 Data</div>
                    <div class="info-value">${notification.date}</div>
                </div>
            </div>

            <div class="footer">
                🤖 <strong>API SMART 5</strong> - Notificare automată<br>
                Trimis la ${new Date().toLocaleString('ro-RO')}
            </div>
        </div>
    </div>
</body>
</html>
            `;

            // Trimite email folosind serviciul centralizat
            const result = await emailService.send({
                from: '"⚡ API SMART 5 - Odd 1.50" <smartyield365@gmail.com>',
                subject: subject,
                html: htmlBody
            });

            if (result.success) {
                console.log(`   ✅ Email COTA 1.50 trimis: ${result.messageId}`);
                console.log(`   📧 Subject: ${subject}`);
            }

            return {
                success: result.success,
                messageId: result.messageId,
                subject: subject,
                error: result.error
            };

        } catch (error) {
            console.error(`   ❌ Eroare trimitere email COTA 1.50: ${error.message}`);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Trimite notificare când cota ajunge la 2.00
     * @param {Object} notification - Notificarea
     * @param {Number} minute - Minutul curent
     * @param {Number|null} odd - Cota (null pentru pattern-uri CARTONAȘE fără cotă)
     */
    async sendOdd200Notification(notification, minute, odd = null) {
        console.log(`   [DEBUG] sendOdd200Notification called`);
        console.log(`   [DEBUG] config.notifications.sendEmail = ${config.notifications.sendEmail}`);

        if (!config.notifications.sendEmail) {
            console.log('   📧 Email notifications disabled');
            return { success: false, reason: 'Email disabled' };
        }

        try {
            // Generează descrierea scurtă
            const shortDescription = this.generateShortDescription(notification);

            // Subject: format scurt
            const subject = `🚀 ${notification.homeTeam.toUpperCase()} - ${notification.awayTeam.toUpperCase()}, ${shortDescription} 2.00`;

            // Body: mai detaliat
            const htmlBody = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        body {
            font-family: Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
            background: #fff0f0;
        }
        .container {
            background: white;
            border-radius: 15px;
            overflow: hidden;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
        }
        .header {
            background: linear-gradient(135deg, #dc3545 0%, #ff6b6b 100%);
            color: white;
            padding: 30px 20px;
            text-align: center;
            position: relative;
        }
        .odd-badge {
            background: rgba(255,255,255,0.3);
            border: 3px solid white;
            border-radius: 50%;
            width: 130px;
            height: 130px;
            margin: 0 auto 15px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 52px;
            font-weight: bold;
            color: white;
            box-shadow: 0 4px 10px rgba(0,0,0,0.3);
            animation: pulse 2s infinite;
        }
        @keyframes pulse {
            0%, 100% { transform: scale(1); }
            50% { transform: scale(1.05); }
        }
        .header-title {
            font-size: 32px;
            font-weight: bold;
            margin: 10px 0;
            text-shadow: 2px 2px 4px rgba(0,0,0,0.2);
        }
        .header-subtitle {
            font-size: 18px;
            opacity: 0.95;
            margin-top: 5px;
        }
        .content {
            padding: 30px 20px;
        }
        .match-title {
            font-size: 28px;
            font-weight: bold;
            color: #dc3545;
            margin-bottom: 20px;
            text-align: center;
            padding: 15px;
            background: linear-gradient(135deg, #f8d7da 0%, #f5c6cb 100%);
            border-radius: 10px;
            border-left: 5px solid #dc3545;
        }
        .event-box {
            background: #fff5f5;
            padding: 20px;
            border-left: 5px solid #dc3545;
            margin: 25px 0;
            border-radius: 5px;
            font-size: 16px;
        }
        .event-box strong {
            color: #dc3545;
            font-size: 18px;
        }
        .info-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 15px;
            margin: 20px 0;
        }
        .info-card {
            background: #fff5f5;
            padding: 15px;
            border-radius: 8px;
            text-align: center;
            border: 2px solid #f5c6cb;
        }
        .info-label {
            font-size: 14px;
            color: #666;
            margin-bottom: 5px;
        }
        .info-value {
            font-size: 20px;
            font-weight: bold;
            color: #dc3545;
        }
        .alert-box {
            background: linear-gradient(135deg, #ffe0e0 0%, #ffcccc 100%);
            border-left: 5px solid #dc3545;
            padding: 15px;
            margin: 20px 0;
            border-radius: 5px;
            font-weight: bold;
        }
        .footer {
            text-align: center;
            margin-top: 30px;
            padding-top: 20px;
            border-top: 2px solid #f5c6cb;
            color: #666;
            font-size: 13px;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="odd-badge">2.00</div>
            <div class="header-title">🚀 COTĂ DUBLATĂ!</div>
            <div class="header-subtitle">Profit maxim disponibil</div>
        </div>

        <div class="content">
            <div class="match-title">
                ${notification.homeTeam.toUpperCase()}<br>vs<br>${notification.awayTeam.toUpperCase()}
            </div>

            <div class="event-box">
                <strong>📊 Eveniment:</strong><br>
                ${typeof notification.event === 'object' && notification.event.description ? notification.event.description : notification.event}
            </div>

            <div class="alert-box">
                🚀 <strong>Cotă 2.00 atinsă!</strong> Profitul potențial s-a dublat față de cota inițială ${notification.initial_odd.toFixed(2)}. Momentul ideal pentru mizare maximă!
            </div>

            <div class="info-grid">
                <div class="info-card">
                    <div class="info-label">🕐 Minut</div>
                    <div class="info-value">${minute}'</div>
                </div>
                <div class="info-card">
                    <div class="info-label">💰 Cotă Inițială</div>
                    <div class="info-value">${notification.initial_odd.toFixed(2)}</div>
                </div>
                <div class="info-card">
                    <div class="info-label">📈 Probabilitate</div>
                    <div class="info-value">${notification.probability}%</div>
                </div>
                <div class="info-card">
                    <div class="info-label">📅 Data</div>
                    <div class="info-value">${notification.date}</div>
                </div>
            </div>

            <div class="footer">
                🤖 <strong>API SMART 5</strong> - Notificare automată<br>
                Trimis la ${new Date().toLocaleString('ro-RO')}
            </div>
        </div>
    </div>
</body>
</html>
            `;

            // Trimite email folosind serviciul centralizat
            const result = await emailService.send({
                from: '"🚀 API SMART 5 - Odd 2.00" <smartyield365@gmail.com>',
                subject: subject,
                html: htmlBody
            });

            if (result.success) {
                console.log(`   ✅ Email COTA 2.00 trimis: ${result.messageId}`);
                console.log(`   📧 Subject: ${subject}`);
            }

            return {
                success: result.success,
                messageId: result.messageId,
                subject: subject,
                error: result.error
            };

        } catch (error) {
            console.error(`   ❌ Eroare trimitere email COTA 2.00: ${error.message}`);
            return {
                success: false,
                error: error.message
            };
        }
    }
}

// Export singleton
module.exports = new Odd150Notifier();
