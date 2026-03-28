# 📅 CONFIGURARE CRON - RAPOARTE LUNARE ȘI SĂPTĂMÂNALE

**Data:** 31 ianuarie 2026
**Sistem:** API SMART 5

---

## 📊 RAPOARTE AUTOMATE

### 1. RAPORT LUNAR
**Frecvență:** 1 a fiecărei luni, ora 08:00
**Fișiere:** 4 PDF-uri (TOATE, COTĂ 1.50, COTĂ 2.00, PIERDUTE)

### 2. RAPORT SĂPTĂMÂNAL
**Frecvență:** În fiecare Marți, ora 08:00
**Fișiere:** 4 PDF-uri (TOATE, COTĂ 1.50, COTĂ 2.00, PIERDUTE)

---

## ⚙️ CONFIGURARE CRON

### Editare crontab:
```bash
crontab -e
```

### Adaugă liniile:

```bash
# ============================================================
# API SMART 5 - RAPOARTE AUTOMATE
# ============================================================

# RAPORT LUNAR - 1 a fiecărei luni la 08:00
0 8 1 * * cd "/home/florian/API SMART 5" && /usr/bin/node SEND_MONTHLY_REPORT.js >> logs/cron-monthly-report.log 2>&1

# RAPORT SĂPTĂMÂNAL - În fiecare Marți la 08:00
0 8 * * 2 cd "/home/florian/API SMART 5" && /usr/bin/node SEND_WEEKLY_REPORT.js >> logs/cron-weekly-report.log 2>&1
```

---

## ✅ VERIFICARE CONFIGURARE

### 1. Verifică că liniile au fost adăugate:
```bash
crontab -l | grep -E "MONTHLY|WEEKLY"
```

**Output așteptat:**
```
0 8 1 * * cd "/home/florian/API SMART 5" && /usr/bin/node SEND_MONTHLY_REPORT.js >> logs/cron-monthly-report.log 2>&1
0 8 * * 2 cd "/home/florian/API SMART 5" && /usr/bin/node SEND_WEEKLY_REPORT.js >> logs/cron-weekly-report.log 2>&1
```

### 2. Verifică sintaxă CRON:
```
┌───────────── minut (0 - 59)
│ ┌───────────── oră (0 - 23)
│ │ ┌───────────── zi din lună (1 - 31)
│ │ │ ┌───────────── lună (1 - 12)
│ │ │ │ ┌───────────── zi din săptămână (0 - 6) (0 = Duminică)
│ │ │ │ │
* * * * *
```

**Raport LUNAR:** `0 8 1 * *` = Ora 08:00, Ziua 1 a lunii, Orice lună, Orice zi săptămână
**Raport SĂPTĂMÂNAL:** `0 8 * * 2` = Ora 08:00, Orice zi lună, Orice lună, Marți (2)

---

## 🧪 TESTARE

### Test manual RAPORT LUNAR:
```bash
cd "/home/florian/API SMART 5"
node SEND_MONTHLY_REPORT.js
```

**Output așteptat:**
```
============================================================
📧 SEND MONTHLY REPORT - API SMART 5
============================================================

🗓️  Luna raportată: Ianuarie 2026

============================================================
1️⃣  RAPORT COMPLET - TOATE NOTIFICĂRILE
============================================================

   ✅ PDF generat: monthly-report-2026-01.pdf

============================================================
2️⃣  RAPORT COTĂ 1.50
============================================================

   ✅ PDF generat: monthly-report-2026-01-cota-1.50.pdf

...

✅ Email trimis cu succes!
   Message ID: <abc123@gmail.com>
   Atașamente trimise: 4
```

### Test manual RAPORT SĂPTĂMÂNAL:
```bash
cd "/home/florian/API SMART 5"
node SEND_WEEKLY_REPORT.js
```

---

## 📋 VERIFICARE EXECUȚIE CRON

### După ce CRON-ul a rulat (prima dată 1 Februarie 08:00 / Marți 08:00):

**1. Verifică log-urile:**
```bash
# Raport lunar
tail -50 logs/cron-monthly-report.log

# Raport săptămânal
tail -50 logs/cron-weekly-report.log
```

**2. Verifică fișierele generate:**
```bash
ls -lh reports/monthly-report-*.pdf
ls -lh reports/weekly-report-*.pdf
```

**3. Verifică syslog:**
```bash
grep "CRON" /var/log/syslog | grep "SEND.*REPORT"
```

---

## ⚠️ NOTIȚE IMPORTANTE

### 1. WSL Shutdown
- **⚠️ CRON-urile NU rulează dacă WSL este oprit**
- Dacă WSL este oprit Marți 08:00, raportul săptămânal nu se va trimite
- **Soluție:** Păstrează WSL pornit permanent SAU folosește Windows Task Scheduler

### 2. Email Configuration
- Verifică că `sendEmail: true` în `NOTIFICATION_CONFIG.js`
- Verifică credențiale SMTP (Gmail App Password)

### 3. wkhtmltopdf (Conversie PDF)
```bash
# Instalare (dacă nu e instalat)
sudo apt-get update
sudo apt-get install wkhtmltopdf

# Verificare instalare
which wkhtmltopdf
```

**Dacă NU e instalat:** Rapoartele se trimit ca HTML (funcționează perfect!)

---

## 📧 FORMAT EMAIL

### RAPORT LUNAR:
**Subject:** `📊 RAPORT LUNAR Ianuarie 2026 - API SMART 5 (150 notificări)`

**Atașamente:**
1. `monthly-report-2026-01.pdf` (TOATE - 150 notificări)
2. `monthly-report-2026-01-cota-1.50.pdf` (COTĂ 1.50 - 65 notificări)
3. `monthly-report-2026-01-cota-2.00.pdf` (COTĂ 2.00 - 28 notificări)
4. `monthly-report-2026-01-pierdute.pdf` (PIERDUTE - 35 notificări)

### RAPORT SĂPTĂMÂNAL:
**Subject:** `📊 RAPORT SĂPTĂMÂNAL 20-26 Ianuarie 2026 - API SMART 5 (38 notificări)`

**Atașamente:**
1. `weekly-report-2026-01-20.pdf` (TOATE - 38 notificări)
2. `weekly-report-2026-01-20-cota-1.50.pdf` (COTĂ 1.50 - 15 notificări)
3. `weekly-report-2026-01-20-cota-2.00.pdf` (COTĂ 2.00 - 7 notificări)
4. `weekly-report-2026-01-20-pierdute.pdf` (PIERDUTE - 10 notificări)

---

## 🔄 MODIFICARE FRECVENȚĂ

### Raport lunar - 5 a lunii în loc de 1:
```bash
crontab -e
# Schimbă: 0 8 1 * * → 0 8 5 * *
```

### Raport săptămânal - Luni în loc de Marți:
```bash
crontab -e
# Schimbă: 0 8 * * 2 → 0 8 * * 1
```

### Raport săptămânal - Ora 10:00 în loc de 08:00:
```bash
crontab -e
# Schimbă: 0 8 * * 2 → 0 10 * * 2
```

---

## ✅ CHECKLIST FINAL

- [ ] Adăugat liniile CRON în crontab
- [ ] Verificat sintaxă CRON (`crontab -l`)
- [ ] Testat manual `node SEND_MONTHLY_REPORT.js`
- [ ] Testat manual `node SEND_WEEKLY_REPORT.js`
- [ ] Verificat email primit cu 4 atașamente
- [ ] Instalat wkhtmltopdf (opțional, pentru PDF)
- [ ] Păstrat WSL pornit permanent (sau configurat Task Scheduler)

---

**Generat:** 31 ianuarie 2026
**Autor:** Florian + Claude Code
**Status:** ✅ CONFIGURAT

**Următoarea execuție:**
- 📅 Raport lunar: 1 Februarie 2026, 08:00
- 📅 Raport săptămânal: Marți următoare, 08:00
