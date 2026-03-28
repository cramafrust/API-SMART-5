# 📧 NOTIFICĂRI AUTOMATE COTE - DOCUMENTAȚIE

## 📌 DESCRIERE

Sistem automat pentru trimiterea notificărilor email când cotele ating pragurile de 1.50 și 2.00.

---

## 🎯 FUNCȚIONALITATE

### Când cota ajunge la **1.50**:

✅ Salvează minutul în `notifications_tracking.json`
✅ **TRIMITE EMAIL AUTOMAT** (întotdeauna)

**Format Subject:**
```
⚡ MANCHESTER CITY - LIVERPOOL, CITY MARCHEAZĂ 1.50
```

**Conținut Email:**
- Meciul
- Evenimentul pronosticat
- Cota 1.50 (evidențiată)
- Minutul când s-a atins
- Cota inițială
- Probabilitatea pattern-ului
- Data

---

### Când cota ajunge la **2.00**:

✅ Salvează minutul în `notifications_tracking.json`
✅ **TRIMITE EMAIL AUTOMAT** - **DOAR dacă minutul ≤ 75**
⏭️ Dacă minutul > 75 → **NU trimite email** (dar salvează în JSON)

**Format Subject:**
```
🚀 MANCHESTER CITY - LIVERPOOL, CITY MARCHEAZĂ 2.00
```

**Conținut Email:**
- Meciul
- Evenimentul pronosticat
- Cota 2.00 (evidențiată)
- Minutul când s-a atins
- Cota inițială
- Probabilitatea pattern-ului
- Data

---

## 📁 FIȘIERE COMPONENTE

### **ODD_150_NOTIFIER.js**
- Modul pentru trimiterea notificărilor
- Folosește nodemailer + configurația din NOTIFICATION_CONFIG.js
- Funcții:
  - `sendOdd150Notification(notification, minute)` - Trimite email cota 1.50
  - `sendOdd200Notification(notification, minute)` - Trimite email cota 2.00
  - `generateShortDescription(notification)` - Generează descriere scurtă pentru subject

### **NOTIFICATION_MONITOR.js** (modificat)
- Integrare automată cu ODD_150_NOTIFIER
- La detectarea cotei ≥ 1.50 → trimite email
- La detectarea cotei ≥ 2.00 + minut ≤ 75 → trimite email

---

## 🔄 WORKFLOW

```
NOTIFICATION_MONITOR (verificare la 60s)
  ↓
Extrage cota actuală Superbet
  ↓
Cota ≥ 1.50?
  ├─ DA → Salvează minut în JSON
  │       ↓
  │       Trimite EMAIL ⚡
  │
Cota ≥ 2.00?
  ├─ DA → Salvează minut în JSON
          ↓
          Minut ≤ 75?
            ├─ DA → Trimite EMAIL 🚀
            └─ NU → Skip email (doar salvează)
```

---

## 📧 CONFIGURARE EMAIL

Configurația se face în **NOTIFICATION_CONFIG.js**:

```javascript
email: {
    user: 'smartyield365@gmail.com',
    appPassword: 'axwejagggaqecosp',
    receiverEmail: 'mihai.florian@yahoo.com',
    smtpHost: 'smtp.gmail.com',
    smtpPort: 587,
    secure: false
},
notifications: {
    sendEmail: true,  // Activează/Dezactivează notificări
}
```

---

## 🧪 TESTARE

### Test manual notificări:

```bash
cd "/home/florian/API SMART 5"
node test-odd-notifications.js
```

Acest test trimite 2 email-uri de probă:
1. Notificare COTA 1.50 (minut 58)
2. Notificare COTA 2.00 (minut 68)

---

## 📊 EXEMPLE EMAIL

### Email COTA 1.50:

**Subject:**
```
⚡ MANCHESTER CITY - LIVERPOOL, CITY MARCHEAZĂ 1.50
```

**Body (HTML stilizat):**
```
╔═══════════════════════════════════════╗
║    ⚡ COTĂ 1.50 ATINSĂ!               ║
╚═══════════════════════════════════════╝

Manchester City - Liverpool

📊 Eveniment: Echipa gazdă va marca în repriza 2

         1.50

🕐 Minut: 58'
💰 Cotă inițială: 1.35
📈 Probabilitate: 85%
📅 Data: 03.12.2025

🤖 API SMART 5 - Notificare automată
```

### Email COTA 2.00:

**Subject:**
```
🚀 MANCHESTER CITY - LIVERPOOL, CITY MARCHEAZĂ 2.00
```

**Body (HTML stilizat - culori diferite):**
```
╔═══════════════════════════════════════╗
║    🚀 COTĂ 2.00 ATINSĂ!               ║
╚═══════════════════════════════════════╝

Manchester City - Liverpool

📊 Eveniment: Echipa gazdă va marca în repriza 2

         2.00

🕐 Minut: 68'
💰 Cotă inițială: 1.35
📈 Probabilitate: 85%
📅 Data: 03.12.2025

🤖 API SMART 5 - Notificare automată
```

---

## 🎨 STILIZARE EMAIL

### Email COTA 1.50:
- Gradient header: **Violet (#667eea → #764ba2)**
- Cotă evidențiată: **Verde (#28a745)**
- Border: **Violet (#667eea)**

### Email COTA 2.00:
- Gradient header: **Roz-Roșu (#f093fb → #f5576c)**
- Cotă evidențiată: **Roșu (#dc3545)**
- Border: **Roșu (#f5576c)**

---

## ⚙️ REGULI IMPORTANTE

### COTA 1.50:
✅ Se trimite **ÎNTOTDEAUNA**
✅ Fără restricții de timp

### COTA 2.00:
✅ Se trimite **DOAR dacă minutul ≤ 75**
⏭️ Dacă > 75 → Skip email (dar salvează minutul în JSON)

**Motivul:** După minutul 75, cotele mari sunt mai puțin relevante pentru pariuri.

---

## 🔮 ÎMBUNĂTĂȚIRI VIITOARE

1. **Notificări push mobile** (Firebase Cloud Messaging)
2. **WhatsApp notifications** (WhatsApp Business API)
3. **Telegram notifications** (Telegram Bot API)
4. **SMS notifications** (Twilio)
5. **Customizare praguri** (1.50, 2.00, 2.50, etc.)
6. **Notificare când se îndeplinește pronosticul**

---

## ✅ STATUS IMPLEMENTARE

- [x] Modul ODD_150_NOTIFIER.js
- [x] Integrare în NOTIFICATION_MONITOR.js
- [x] Email cota 1.50 (întotdeauna)
- [x] Email cota 2.00 (doar dacă min ≤ 75)
- [x] HTML stilizat pentru email-uri
- [x] Subject format scurt
- [x] Test script
- [x] Documentație completă
- [x] Pornire automată cu API SMART 5
- [ ] Notificări push mobile
- [ ] WhatsApp integration
- [ ] Telegram integration

---

**© 2025 - API SMART 5 Odd Notifications System**
**Versiune:** 1.0
**Data:** 3 Decembrie 2025
