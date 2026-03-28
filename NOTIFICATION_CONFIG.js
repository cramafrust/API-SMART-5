/**
 * 🔐 CONFIGURAȚIE NOTIFICĂRI
 *
 * Fișier separat pentru credențiale și setări notificări
 * IMPORTANT: Nu partaja acest fișier public (adaugă în .gitignore)
 */

module.exports = {
    // ==========================
    // EMAIL CONFIGURATION
    // ==========================
    email: {
        // Adresa de email pentru TRIMITERE notificări
        // RECOMANDAT: Creează un Gmail nou dedicat (ex: footballalerts.ro@gmail.com)
        // Alternativ: Folosește Yahoo Mail actual
        user: 'smartyield365@gmail.com', // Gmail dedicat pentru notificări

        // App Password (NU parola normală!)
        //
        // Pentru GMAIL nou:
        //   1. Creează Gmail: https://accounts.google.com/signup
        //   2. Activează 2-Step Verification: https://myaccount.google.com/security
        //   3. Generează App Password: https://myaccount.google.com/apppasswords
        //   4. Alege "Mail" și "Windows Computer"
        //   5. Copiază parola generată (16 caractere)
        //
        // Pentru YAHOO:
        //   1. Accesează: https://login.yahoo.com/account/security
        //   2. "Generate app password"
        //   3. Alege "Other App" → "Football Alerts"
        //   4. Copiază parola generată
        appPassword: 'axwejagggaqecosp', // <-- App Password Gmail (16 caractere)

        // Adresa de email pentru PRIMIRE notificări
        // (contul tău personal unde vrei să primești alertele)
        receiverEmail: 'mihai.florian@yahoo.com', // Contul tău personal

        // SMTP Settings
        // Pentru Gmail: smtp.gmail.com, port 587
        // Pentru Yahoo: smtp.mail.yahoo.com, port 465
        smtpHost: 'smtp.gmail.com', // Gmail SMTP
        smtpPort: 587, // Gmail port
        secure: false, // false pentru port 587
    },

    // ==========================
    // DAILY REPORTS EMAIL CONFIGURATION
    // ==========================
    dailyReports: {
        // Adrese email care primesc rapoartele zilnice
        recipients: [
            'mihai.florian@yahoo.com',
            'smartyield365@gmail.com'
        ],
        // SMTP Configuration (folosește același Gmail ca mai sus)
        smtp: {
            host: 'smtp.gmail.com',
            port: 587,
            secure: false, // false pentru port 587 (TLS)
            auth: {
                user: 'smartyield365@gmail.com',
                pass: 'axwejagggaqecosp' // App Password Gmail
            }
        }
    },

    // ==========================
    // WHATSAPP CONFIGURATION
    // ==========================
    whatsapp: {
        // Număr de telefon în format internațional (fără +)
        phoneNumber: '40767802528', // +40 767 802 528

        // WhatsApp Business Cloud API (Meta)
        // Setup: https://developers.facebook.com/docs/whatsapp/cloud-api/get-started
        //
        // Pași setup:
        //   1. Creează Meta Business Account: https://business.facebook.com/
        //   2. Creează App în Meta for Developers: https://developers.facebook.com/apps/
        //   3. Adaugă WhatsApp Product la app
        //   4. Obține Phone Number ID din WhatsApp > API Setup
        //   5. Generează Access Token (permanent) din WhatsApp > API Setup
        //   6. Verifică numărul de telefon (va primi cod pe WhatsApp)
        phoneNumberId: '', // <-- ID-ul Phone Number din WhatsApp API Setup
        accessToken: '', // <-- Access Token generat din Meta for Developers

        apiVersion: 'v18.0', // Versiune API WhatsApp (actualizează periodic)
    },

    // ==========================
    // NOTIFICATION SETTINGS
    // ==========================
    notifications: {
        // Activare/Dezactivare canale
        sendEmail: true, // Trimite notificări prin email
        sendWhatsApp: false, // Trimite prin WhatsApp (activează după configurare Cloud API)

        // Setări mesaj
        includeExamples: true, // Include exemple statistici în mesaj
        maxExamples: 2, // Număr maxim exemple

        // Limită notificări
        maxPerHour: 10, // Maxim notificări per oră (anti-spam)
        minProbability: 70, // Trimite doar pattern-uri cu probabilitate ≥ 70%

        // Filtrare pattern-uri
        enabledPatterns: 'ALL', // 'ALL' sau array cu ID-uri specifice: ['pattern_1', 'pattern_3']
        enabledLeagues: ['Premier League', 'La Liga', 'Serie A', 'Bundesliga', 'Ligue 1', 'Primeira Liga'],
        enabledTiers: ['TOP', 'MID', 'BOTTOM'], // Tier-uri de echipe monitorizate
    },

    // ==========================
    // LOGGING & DEBUGGING
    // ==========================
    logging: {
        saveNotifications: true, // Salvează log-uri notificări
        logFile: './notifications-log.json',
        debugMode: false, // Afișează detalii tehnice în consolă
    }
};
