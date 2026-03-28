# 📦 COLECTOR AUTOMAT DATE FINALE - Meciuri Ziua Precedentă

## 🎯 Concept

**Sistemul colectează dimineața (6:00-12:00) toate datele finale pentru meciurile din ziua precedentă.**

### ✅ Avantaje:
- **Nu interferează** cu monitorizarea live HT
- **Rate limiter friendly** - 3 secunde între request-uri
- **Retry logic** - rulează la 7:00, 8:00, 9:00, 10:00 pentru meciuri neterminate
- **Automatic** - se rulează zilnic prin CRON

---

## 🚀 Utilizare

### **Opțiunea 1: Rulare Manuală**

```bash
# Colectează date de ieri
cd "/home/florian/API SMART 5"
node API-SMART-5.js collectyesterday
```

### **Opțiunea 2: Rulare Automată (CRON) - RECOMANDAT**

```bash
# Instalează CRON jobs
cd "/home/florian/API SMART 5"
bash SETUP_CRON.sh install
```

**Programare automată:**
- **07:00** - Colectare date finale (ziua precedentă)
- **08:00** - Retry pentru meciuri neterminate
- **09:00** - Retry pentru meciuri neterminate
- **10:00** - Retry pentru meciuri neterminate

**Gestionare CRON:**
```bash
# Listează jobs active
bash SETUP_CRON.sh list

# Elimină jobs
bash SETUP_CRON.sh remove

# Reinstalează jobs
bash SETUP_CRON.sh install
```

### **Opțiunea 3: Rulare Directă (Stand-alone)**

```bash
# Colectează date de ieri
node DAILY_FINAL_DATA_COLLECTOR.js

# Colectează date pentru o dată specifică
node DAILY_FINAL_DATA_COLLECTOR.js --date=2025-11-03

# Test fără salvare (dry run)
node DAILY_FINAL_DATA_COLLECTOR.js --dry-run
```

---

## 📊 Ce Face Scriptul?

### **Workflow Complet:**

1. **Identifică fișierul** `meciuri-2025-11-03.json` (ziua precedentă)
2. **Pentru fiecare meci:**
   - Verifică dacă s-a terminat (API check)
   - Extrage date complete FT + HT
   - Salvează în JSON campionat corespunzător
3. **Generează raport final** cu statistici

### **Date Extrase:**

- ✅ **Informații meci:** echipe, dată, ligă, sezon
- ✅ **Scoruri:** HT și FT
- ✅ **Statistici HT:** 12-13 categorii (xG, posesie, șuturi, corner-e, etc.)
- ✅ **Statistici FT:** 12-13 categorii complete

### **Exemplu Output:**

```
📊 RAPORT FINAL - COLECTARE DATE 2025-11-03
============================================================
📋 Total meciuri: 26
✅ Salvate cu succes: 25
⏭️  Duplicate (skip): 0
⚠️  Neterminate: 1
❌ Eșuate: 0

🏆 Date salvate pe ligi:
   ASIA: AFC Champions League - League phase: 4 meciuri
   POLAND: Ekstraklasa: 3 meciuri
   TURKEY: Super Lig: 3 meciuri
   ROMANIA: Superliga: 2 meciuri
   ITALY: Serie A: 2 meciuri
   ENGLAND: Premier League: 1 meci
   ...
```

---

## 📁 Structură Fișiere

### **Input:**
```
/home/florian/API SMART 5/
  └── meciuri-2025-11-03.json  (generat de DAILY_MATCHES)
```

### **Output:**
```
/home/florian/football-analyzer/
  ├── complete_FULL_SEASON_PremierLeague_2025-2026.json
  ├── complete_FULL_SEASON_LaLiga_2025-2026.json
  ├── complete_FULL_SEASON_SerieA_2025-2026.json
  ├── complete_FULL_SEASON_ROMANIASuperliga_2025-2026.json
  └── ... (create automat pentru fiecare ligă)
```

### **Logs:**
```
/home/florian/API SMART 5/logs/
  ├── daily-collector.log        (rulare principală 7:00)
  └── daily-collector-retry.log  (retry-uri 8:00-10:00)
```

---

## ⚙️ Configurare

### **Delay între request-uri:**
```javascript
// În DAILY_FINAL_DATA_COLLECTOR.js
const REQUEST_DELAY = 3000; // 3 secunde (default)
```

### **Director output:**
```javascript
// În DAILY_FINAL_DATA_COLLECTOR.js
const CHAMPIONSHIP_DIR = '/home/florian/football-analyzer';
```

### **Sezon:**
```javascript
// În FINAL_STATS_EXTRACTOR.js (linia 209)
season: '2025-2026'  // Actualizează la început de sezon nou
```

---

## 📈 Monitorizare

### **Verificare log-uri:**

```bash
# Log-uri principale (7:00)
tail -f "/home/florian/API SMART 5/logs/daily-collector.log"

# Log-uri retry (8:00-10:00)
tail -f "/home/florian/API SMART 5/logs/daily-collector-retry.log"

# Ultima rulare
tail -100 "/home/florian/API SMART 5/logs/daily-collector.log"
```

### **Verificare JSON-uri generate:**

```bash
# Listează toate JSON-urile create azi
ls -lth /home/florian/football-analyzer/complete_FULL_SEASON_*.json | head -20

# Contorizează meciuri în fiecare JSON
cd /home/florian/football-analyzer
for file in complete_FULL_SEASON_*.json; do
    count=$(grep -c '"matchId"' "$file" 2>/dev/null || echo 0)
    echo "$file: $count meciuri"
done
```

### **Verificare CRON status:**

```bash
# Listează jobs active
crontab -l | grep "API-SMART-5"

# Verifică dacă cron rulează
systemctl status cron

# Log-uri sistem pentru cron
grep CRON /var/log/syslog | tail -20
```

---

## 🐛 Troubleshooting

### **Problema: Nu se găsește fișierul meciuri-YYYY-MM-DD.json**

**Soluție:** Rulează mai întâi generarea meciurilor pentru ziua anterioară:
```bash
# Pentru ieri
node API-SMART-5.js daily
```

### **Problema: CRON nu rulează**

**Verificare:**
```bash
# Verifică dacă cron service rulează
systemctl status cron

# Verifică jobs instalate
crontab -l

# Verifică log-uri sistem
grep CRON /var/log/syslog | tail -50
```

**Soluție:** Asigură-te că ai instalat jobs:
```bash
bash SETUP_CRON.sh install
```

### **Problema: API rate limiting**

**Simptome:** Multe erori sau timeout-uri

**Soluție:** Crește delay-ul în `DAILY_FINAL_DATA_COLLECTOR.js`:
```javascript
const REQUEST_DELAY = 5000; // 5 secunde în loc de 3
```

### **Problema: Meciuri neterminate**

**Normal!** Unele meciuri pot fi:
- Amânate
- Anulate
- În pauză tehnică

**Soluție:** Retry-urile automate de la 8:00, 9:00, 10:00 vor prinde meciurile care se termină mai târziu.

---

## 🔄 Workflow Zilnic Complet

### **Dimineața (07:00-10:00):**
```
07:00 → CRON: Colectare date de ieri
08:00 → CRON: Retry meciuri neterminate
09:00 → CRON: Retry meciuri neterminate
10:00 → CRON: Retry meciuri neterminate
```

### **În timpul zilei (13:00-23:00):**
```
Manual → node API-SMART-5.js full
         (Generare meciuri + monitorizare HT pentru azi)
```

### **Rezultat:**
- ✅ Date **complete** pentru meciurile de ieri (FT + HT)
- ✅ Alertă **pattern-uri** pentru meciurile de azi (HT)
- ✅ **Nicio interferență** între cele două sisteme

---

## 📊 Performanță

**Test Real (26 meciuri din 03.11.2025):**
- ✅ **Success rate:** 96% (25/26 meciuri)
- ⏱️ **Timp total:** ~2 minute
- 🔄 **Request delay:** 3 secunde
- ❌ **Eșuări:** 0
- ⚠️ **Neterminate:** 1 (normal pentru meciuri amânate)

**Statistici JSON-uri:**
- 📁 **Fișiere create:** 14 JSON-uri noi
- 🏆 **Ligi procesate:** 14 campionate diferite
- 📊 **Date per meci:** ~12-13 categorii statistici (HT + FT)

---

## 🎯 Next Steps

### **După instalare:**

1. **Testează manual:**
   ```bash
   node API-SMART-5.js collectyesterday
   ```

2. **Instalează CRON:**
   ```bash
   bash SETUP_CRON.sh install
   ```

3. **Verifică dimineață următoare:**
   ```bash
   tail -f "/home/florian/API SMART 5/logs/daily-collector.log"
   ```

4. **Monitorizează JSON-uri:**
   ```bash
   ls -lth /home/florian/football-analyzer/complete_FULL_SEASON_*.json
   ```

---

## 📞 Support

### **Comenzi Utile:**

```bash
# Manual: Colectare date ieri
node API-SMART-5.js collectyesterday

# CRON: Instalare automată
bash SETUP_CRON.sh install

# CRON: Verificare status
bash SETUP_CRON.sh list

# Log-uri: Monitorizare timp real
tail -f logs/daily-collector.log

# JSON-uri: Verificare date salvate
cat /home/florian/football-analyzer/complete_FULL_SEASON_PremierLeague_2025-2026.json | head -100
```

---

**Versiune:** 2.0.0
**Data:** Noiembrie 2025
**Status:** ✅ Production Ready
**Testat:** 26 meciuri, 96% success rate
