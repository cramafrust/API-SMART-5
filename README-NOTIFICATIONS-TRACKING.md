# 📊 SISTEM TRACKING NOTIFICĂRI + VALIDARE PATTERN-URI

## 🎯 Concept

**Sistemul urmărește TOATE notificările trimise și validează ulterior dacă pattern-urile au ieșit.**

### ✅ Funcționalități:

1. **Salvare automată** a tuturor notificărilor cu:
   - Pattern-uri detectate
   - Pronosticuri făcute
   - Cote de la case de pariuri (MOCK deocamdată)
   - Statistici HT complete

2. **Validare rezultate** după terminarea meciurilor:
   - Extrage scoruri finale
   - Verifică dacă fiecare pattern a ieșit
   - Calculează success rate per pattern

3. **Rapoarte performanță**:
   - Success rate global
   - Success rate per tip de pattern
   - Export CSV pentru analiză

---

## 🚀 Workflow Complet

### **PASUL 1: Sistemul rulează și trimite notificări**

```bash
# Rulează monitorizare HT
node API-SMART-5.js full
```

**Ce se întâmplă în fundal:**
```
Meci live → Pattern detectat → Email trimis
                              ↓
                    📊 SALVARE AUTOMATĂ în tracking:
                    - Pattern-uri detectate
                    - Cote pariuri (MOCK)
                    - Statistici HT
                    - Timestamp
```

### **PASUL 2: Dimineața următoare - Validare rezultate**

```bash
# Validează toate notificările din ziua precedentă
node RESULTS_VALIDATOR.js validate
```

**Ce se întâmplă:**
```
1. Găsește notificări nevalidate
2. Pentru fiecare meci:
   - Extrage scor final (FT)
   - Verifică dacă pattern-ul a ieșit
   - Salvează rezultatul (✅ succes / ❌ eșuat)
3. Generează raport
```

### **PASUL 3: Vezi raportul de performanță**

```bash
# Raport performanță global
node RESULTS_VALIDATOR.js report
```

**Output exemplu:**
```
📊 RAPORT PERFORMANȚĂ PATTERN-URI
============================================================
📋 Total notificări validate: 45
📊 Total pattern-uri: 128
✅ Succes: 89 (69%)
❌ Eșuat: 39 (31%)

📈 PERFORMANȚĂ PE PATTERN:

   OVER_2_5_GOLURI:
      Total: 34 | ✅ 24 | ❌ 10 | Rate: 71%

   BTTS_GOLURI_AMBELE:
      Total: 28 | ✅ 19 | ❌ 9 | Rate: 68%

   OVER_CORNERE_R2:
      Total: 22 | ✅ 14 | ❌ 8 | Rate: 64%
```

---

## 📁 Structură Fișiere

### **Module Noi Create:**

```
/home/florian/API SMART 5/
├── NOTIFICATIONS_TRACKER.js      # Salvare tracking notificări
├── BETTING_ODDS_SCRAPER.js       # Extragere cote (MOCK deocamdată)
├── RESULTS_VALIDATOR.js          # Validare rezultate post-meci
└── notifications-tracking.json   # Fișier JSON cu toate notificările
```

### **Module Modificate:**

```
email-notifier.js
  ↓ Acum salvează AUTOMAT în tracking când trimite email
  ↓ Extrage cote pariuri (MOCK)
  ↓ Afișează cote în email
```

---

## 📊 Structură Date Tracking

### **notifications-tracking.json**

```json
{
  "metadata": {
    "createdAt": "2025-11-04T...",
    "version": "1.0.0"
  },
  "notifications": [
    {
      "id": "matchId_timestamp",
      "timestamp": "2025-11-04T18:30:00Z",

      "match": {
        "matchId": "abc123",
        "homeTeam": "Liverpool",
        "awayTeam": "Chelsea",
        "league": "Premier League",
        "htScore": "1-0"
      },

      "patterns": [
        {
          "patternName": "OVER_2_5_GOLURI",
          "team": "gazda",
          "teamName": "Liverpool",
          "probability": 78,
          "tier": "A",
          "position": 3,
          "prediction": {
            "market": "Team Total Goals",
            "bet": "Over 1.5",
            "description": "Liverpool va marca încă un gol"
          },
          "odds": {
            "superbet": 1.65,
            "netbet": 1.72
          }
        }
      ],

      "validated": false,
      "result": null
    }
  ]
}
```

---

## 🔧 Comenzi Disponibile

### **Tracking:**

```bash
# Vezi statistici tracking
node NOTIFICATIONS_TRACKER.js stats

# Export CSV pentru analiză
node NOTIFICATIONS_TRACKER.js export notifications.csv
```

### **Validare:**

```bash
# Validează toate notificările pending
node RESULTS_VALIDATOR.js validate

# Raport performanță
node RESULTS_VALIDATOR.js report

# Validează un meci specific
node RESULTS_VALIDATOR.js match <matchId>
```

### **Cote:**

```bash
# Test extragere cote pentru un meci
node BETTING_ODDS_SCRAPER.js "Liverpool" "Chelsea"
```

---

## ⚙️ Integrare în Workflow Zilnic

### **Workflow Automat Recomandat:**

```bash
# 07:00 - Colectare date finale ziua precedentă
(CRON instalat deja)

# 07:30 - Validare notificări (ADAUGĂ ÎN CRON)
# Adaugă în crontab:
30 7 * * * cd "/home/florian/API SMART 5" && /usr/bin/node RESULTS_VALIDATOR.js validate >> logs/validator.log 2>&1
```

### **Instalare CRON pentru validare:**

```bash
# Deschide crontab
crontab -e

# Adaugă linia:
30 7 * * * cd "/home/florian/API SMART 5" && /usr/bin/node RESULTS_VALIDATOR.js validate >> logs/validator.log 2>&1
```

---

## 📈 Pattern-uri Suportate pentru Validare

### **✅ Goluri:**
- `OVER_1_5_GOLURI` - Echipa va marca >1.5 goluri
- `OVER_2_5_GOLURI` - Echipa va marca >2.5 goluri
- `OVER_2_5_GOLURI_MECI` - Meci >2.5 goluri total
- `OVER_3_5_GOLURI_MECI` - Meci >3.5 goluri total
- `UNDER_2_5_GOLURI_MECI` - Meci <2.5 goluri total

### **✅ BTTS:**
- `BTTS_GOLURI_AMBELE` - Ambele echipe marchează
- `BTTS_NU` - Nu marchează ambele echipe

### **⚠️ Cornere/Cartonașe:**
- `OVER_CORNERE_R2` - Suport parțial (necesită date repriza 2)
- `CARTONASE_R2` - Suport parțial
- `CARTONASE_MECI` - Suport parțial

**NOTĂ:** Pentru cornere și cartonașe, validarea completă necesită statistici FT detaliate care pot să nu fie disponibile în toate cazurile.

---

## 💰 Cote Pariuri

### **Status Actual: MOCK (Simulate)**

Cotele sunt generate MOCK pentru testare. Pentru cote REALE, opțiuni:

1. **Web Scraping (Puppeteer)** - Gratis, mai complex
2. **The Odds API** - Plătit (~$50/lună), simplu
3. **Manual** - Fără cote automate

### **Structură Cote MOCK:**

```javascript
{
  "superbet": {
    "team_to_score_2h": 1.65,      // Echipa marchează R2
    "match_over_2_5": 1.85,         // Peste 2.5 goluri
    "btts_yes": 1.70                // BTTS Yes
  },
  "netbet": {
    "team_to_score_2h": 1.72,
    "match_over_2_5": 1.90,
    "btts_yes": 1.75
  }
}
```

Cotele variază random ±10% pentru a simula diferențe între case.

---

## 📊 Exemplu Workflow Complet

### **Ziua 1 - Detectare + Notificare (17:30)**

```
🔔 Pattern detectat: Liverpool vs Chelsea (HT 1-0)

Pattern: OVER_2_5_GOLURI
Team: Liverpool
Probability: 78%
Pronostic: Liverpool va marca încă un gol (Over 1.5 FT)

Cote:
  Superbet: 1.65
  Netbet: 1.72

→ Email trimis ✅
→ Salvat în tracking ✅
```

### **Ziua 2 - Validare (07:30)**

```bash
$ node RESULTS_VALIDATOR.js validate

🔍 VALIDARE NOTIFICARE: matchId_timestamp
============================================================
⚽ Meci: Liverpool vs Chelsea
📋 Pattern-uri de validat: 1

📊 Extragere date finale...
   ✅ Scor final: 3-0
   ✅ Scor HT: 1-0

📋 Validare pattern-uri:

✅ OVER_2_5_GOLURI (Liverpool)
   Echipa a marcat 3 goluri

📊 REZULTAT VALIDARE:
   ✅ Succes: 1/1
   📈 Success rate: 100%
```

### **Verificare Raport**

```bash
$ node RESULTS_VALIDATOR.js report

📊 RAPORT PERFORMANȚĂ PATTERN-URI
============================================================
📝 Total notificări: 1
✅ Validate: 1
⏳ În așteptare: 0

🎯 Rate succes: 100% (1/1)

📈 PERFORMANȚĂ PE PATTERN:

   OVER_2_5_GOLURI:
      Total: 1 | ✅ 1 | ❌ 0 | Rate: 100%
```

---

## 🐛 Troubleshooting

### **Problema: Notificările nu se salvează în tracking**

**Verificare:**
```bash
# Verifică dacă fișierul există
ls -lh notifications-tracking.json

# Vezi conținutul
cat notifications-tracking.json | head -50
```

**Soluție:** Verifică că `email-notifier.js` are importurile corecte.

### **Problema: Validarea nu găsește meciuri**

**Cauze posibile:**
- Meciul nu s-a terminat încă
- API FlashScore nu returnează date
- matchId invalid

**Verificare:**
```bash
# Test extragere date finale pentru un meci
node FINAL_STATS_EXTRACTOR.js <matchId>
```

### **Problema: Success rate prea mic**

**Normal!** Pattern-urile nu au 100% acuratețe. Ținte realiste:
- 60-70% = Bun
- 70-80% = Foarte bun
- 80%+ = Excelent

---

## 📞 Comenzi Rapide

```bash
# Statistici tracking
node NOTIFICATIONS_TRACKER.js stats

# Validare toate notificările
node RESULTS_VALIDATOR.js validate

# Raport performanță
node RESULTS_VALIDATOR.js report

# Export CSV
node NOTIFICATIONS_TRACKER.js export data.csv

# Test cote pentru un meci
node BETTING_ODDS_SCRAPER.js "Real Madrid" "Barcelona"
```

---

**Versiune:** 1.0.0
**Data:** Noiembrie 2025
**Status:** ✅ Production Ready (cu cote MOCK)
**Next Steps:** Implementare cote reale (Puppeteer sau The Odds API)
