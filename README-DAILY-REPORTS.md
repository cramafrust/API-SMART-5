# 📊 DAILY REPORTS SYSTEM

## 📋 Descriere

Sistem automat pentru trimiterea unui raport zilnic prin email cu toate notificările și validările din ziua anterioară.

**Ce include raportul:**
- ✅ Toate notificările trimise în ziua anterioară
- 📊 Pattern-uri detectate și pronosticuri făcute
- 💰 Cote Superbet și Netbet pentru fiecare pronostic
- ✅/❌ Status validare (CÂȘTIGAT/PIERDUT/PENDING/NECUNOSCUT)
- 📈 Success rate general
- 📉 Statistici detaliate (total, validate, câștigate, pierdute)

**Când se trimite:**
- 🕗 **Automat în fiecare dimineață la ora 08:00**
- 📧 **Prin email către adresele configurate**

---

## 🚀 Status curent

### ✅ Sistemul este PORNIT și funcțional!

**Procese active:**
- `DAILY_REPORT_SCHEDULER.js` (PID 199173) - Programat să trimită la 08:00

**Următoarea trimitere:**
- 📅 **27 ianuarie 2026, 08:00**

---

## 📧 Exemplu raport

### Header raport:
```
📊 Raport Zilnic Pronosticuri
2025-11-06

┌─────────────────────────────────────────┐
│ STATISTICI                              │
├─────────────────────────────────────────┤
│ Total Pronosticuri:        97           │
│ Validate:                  97           │
│ ✅ Câștigate:              3            │
│ ❌ Pierdute:               9            │
│ ⚠️  Necunoscute:           85           │
│ Success Rate:              25.0%        │
└─────────────────────────────────────────┘
```

### Tabel detaliat:
| Oră   | Meci                    | Liga | HT  | FT  | Pattern     | Echipa    | Prob. | Cotă SB | Cotă NB | Status         |
|-------|-------------------------|------|-----|-----|-------------|-----------|-------|---------|---------|----------------|
| 20:45 | Basel vs FCSB           | UEL  | 1-0 | 3-1 | PATTERN_5.6 | FCSB      | 85.7% | 1.98    | 2.18    | ⚠️ NECUNOSCUT  |
| 20:45 | Midtjylland vs Celtic   | UEL  | 3-0 | 3-1 | PATTERN_3.3 | Meci      | 95%   | 1.83    | 2.03    | ✅ CÂȘTIGAT    |
| 20:45 | Nice vs Freiburg        | UEL  | 1-3 | 1-3 | PATTERN_3.4 | Meci      | 100%  | 1.93    | 1.95    | ❌ PIERDUT     |

---

## 🛠️ Comenzi disponibile

### 1. Generare raport manual

```bash
# Raport pentru ieri
cd "/home/florian/API SMART 5"
node DAILY_REPORT_GENERATOR.js

# Raport pentru dată specifică
node DAILY_REPORT_GENERATOR.js 2025-11-06
```

**Output:**
- Fișier HTML salvat în: `reports/daily-report-YYYY-MM-DD.html`
- Poate fi deschis în browser pentru vizualizare

### 2. Trimitere raport manual

```bash
# Trimite raport pentru ieri
node SEND_DAILY_REPORT.js

# Trimite raport pentru dată specifică
node SEND_DAILY_REPORT.js 2025-11-06
```

**Output:**
- Trimite email cu raportul HTML
- Confirmă trimiterea în terminal

### 3. Test scheduler

```bash
# Test - trimite imediat
node DAILY_REPORT_SCHEDULER.js --test

# Pornește scheduler (08:00 daily)
node DAILY_REPORT_SCHEDULER.js
```

---

## ⚙️ Configurare

### Email destinatari

Editează `NOTIFICATION_CONFIG.js`:

```javascript
email: {
    recipients: [
        'your.email@gmail.com',
        'another.email@gmail.com'
    ],
    smtp: {
        host: 'smtp.gmail.com',
        port: 587,
        secure: false,
        auth: {
            user: 'your.email@gmail.com',
            pass: 'your-app-password'
        }
    }
}
```

### Schimbă ora trimiterii

Editează `DAILY_REPORT_SCHEDULER.js`:

```javascript
// Default: 08:00
const SCHEDULE_TIME = '0 8 * * *';

// Pentru 09:00:
const SCHEDULE_TIME = '0 9 * * *';

// Pentru 07:30:
const SCHEDULE_TIME = '30 7 * * *';

// Pentru 20:00 (seara):
const SCHEDULE_TIME = '0 20 * * *';
```

**Format cron:**
```
  ┌─── minute (0-59)
  │ ┌─── hour (0-23)
  │ │ ┌─── day of month (1-31)
  │ │ │ ┌─── month (1-12)
  │ │ │ │ ┌─── day of week (0-6) (Sunday=0)
  │ │ │ │ │
  * * * * *
```

---

## 🔧 Gestionare procese

### Verifică dacă scheduler-ul rulează

```bash
ps aux | grep "DAILY_REPORT_SCHEDULER" | grep -v grep
```

### Vezi log-ul în timp real

```bash
tail -f logs/daily-report-scheduler.log
```

### Oprește scheduler-ul

```bash
# Găsește PID
ps aux | grep "DAILY_REPORT_SCHEDULER" | grep -v grep

# Oprește procesul
kill <PID>

# SAU
pkill -f "DAILY_REPORT_SCHEDULER"
```

### Repornește scheduler-ul

```bash
cd "/home/florian/API SMART 5"
nohup node DAILY_REPORT_SCHEDULER.js > logs/daily-report-scheduler.log 2>&1 &
```

---

## 📁 Fișiere și directoare

```
API SMART 5/
├── DAILY_REPORT_GENERATOR.js          # Generator raport HTML
├── SEND_DAILY_REPORT.js               # Trimitere email
├── DAILY_REPORT_SCHEDULER.js          # Scheduler automat (cron)
├── reports/                            # Rapoarte generate
│   └── daily-report-YYYY-MM-DD.html   # Rapoarte HTML
└── logs/
    └── daily-report-scheduler.log     # Log scheduler
```

---

## 🎯 Workflow complet

### 1. În timpul zilei
- API SMART 5 trimite notificări cu pronosticuri + cote
- AUTO-VALIDATOR validează automat pronosticurile (la 6h)
- Toate datele sunt salvate în `notifications-tracking.json`

### 2. În fiecare dimineață (08:00)
- **DAILY_REPORT_SCHEDULER** se activează automat
- Generează raport pentru ziua anterioară
- Trimite email cu raportul complet
- Log-ul confirmă trimiterea

### 3. Tu primești email cu:
- Lista completă de notificări din ziua anterioară
- Status fiecărui pronostic (CÂȘTIGAT/PIERDUT)
- Cotele pentru fiecare pronostic
- Success rate general
- Statistici detaliate

---

## 📊 Exemplu email

**Subiect:**
```
📊 Raport Zilnic 2025-11-06 - 97 pronosticuri | 25.0% success rate | ✅ 3 câștigate | ❌ 9 pierdute
```

**Conținut:**
- Tabel HTML frumos formatat cu toate detaliile
- Statistici vizuale (carduri colorate)
- Success rate evidențiat
- Link-uri către cotele de pe Superbet/Netbet

---

## ❓ FAQ

### Q: Pot schimba ora de trimitere?
**A:** Da! Editează `DAILY_REPORT_SCHEDULER.js` și modifică `SCHEDULE_TIME`.

### Q: Pot adăuga mai mulți destinatari?
**A:** Da! Editează `NOTIFICATION_CONFIG.js` și adaugă adrese în `email.recipients`.

### Q: Ce se întâmplă dacă nu sunt notificări într-o zi?
**A:** Primești un email de tip "Nu sunt notificări pentru această zi".

### Q: Pot trimite manual raportul oricând?
**A:** Da! Rulează `node SEND_DAILY_REPORT.js <data>`.

### Q: Unde sunt salvate rapoartele HTML?
**A:** În directorul `reports/` - poți deschide în browser.

### Q: Cum opresc rapoartele automate?
**A:** Oprește procesul: `pkill -f "DAILY_REPORT_SCHEDULER"`.

### Q: Pot primi raportul la mai multe ore pe zi?
**A:** Da! Pornește multiple instanțe cu ore diferite sau modifică cron expression.

---

## 🐛 Troubleshooting

### Raportul nu se trimite

1. Verifică dacă scheduler-ul rulează:
```bash
ps aux | grep "DAILY_REPORT_SCHEDULER"
```

2. Verifică log-ul:
```bash
tail -50 logs/daily-report-scheduler.log
```

3. Testează trimiterea manuală:
```bash
node SEND_DAILY_REPORT.js --test
```

### Erori la trimitere email

1. Verifică configurația email în `NOTIFICATION_CONFIG.js`
2. Verifică că ai App Password pentru Gmail (nu parola normală)
3. Verifică conexiunea la internet

### Nu găsește notificări

1. Verifică că există notificări în `notifications-tracking.json`
2. Verifică că data este corectă
3. Rulează manual pentru a testa:
```bash
node DAILY_REPORT_GENERATOR.js <data>
```

---

## 🎉 Success!

Sistemul e configurat și funcțional! 🚀

**În fiecare dimineață la 08:00, vei primi automat:**
- 📊 Raport complet cu toate pronosticurile de ieri
- ✅/❌ Status fiecărui pronostic
- 💰 Toate cotele
- 📈 Success rate

**Fără nicio intervenție manuală!** 🤖

---

## 📞 Contact / Support

Pentru probleme sau întrebări:
- Verifică log-urile: `logs/daily-report-scheduler.log`
- Testează manual: `node SEND_DAILY_REPORT.js --test`
- Verifică configurația: `NOTIFICATION_CONFIG.js`
