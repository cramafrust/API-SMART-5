# API SMART 5 - Documentație Completă

## 📋 CE ESTE API SMART 5?

**API SMART 5** este un sistem automat de analiză și monitorizare meciuri de fotbal care:
1. **Identifică pattern-uri** în meciuri live (la pauză)
2. **Trimite notificări email** automate când detectează evenimente importante
3. **Monitorizează cote live** pe Superbet și alertează când ajung la praguri (1.5 și 2.0)
4. **Validează automat** pronosticurile pentru a măsura acuratețea

---

## 🏗️ ARHITECTURA SISTEMULUI

```
┌─────────────────────────────────────────────────────────────────┐
│                        API SMART 5                               │
│                     (API-SMART-5.js)                             │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ├── 1. STATS MONITOR
                              │   └─ Verifică meciuri la pauză (HT)
                              │   └─ Detectează pattern-uri
                              │   └─ Trimite email cu pronostic
                              │
                              ├── 2. SIMPLE ODDS MONITOR
                              │   └─ Monitorizează cote live (la 2 min)
                              │   └─ Trimite email la cota 1.5
                              │   └─ Trimite email la cota 2.0
                              │   └─ Salvează pentru validare
                              │
                              ├── 3. NOTIFICATION TRACKER
                              │   └─ Stochează toate notificările
                              │   └─ Gestionează status-uri
                              │
                              ├── 4. AUTO-VALIDATOR
                              │   └─ Verifică rezultate finale
                              │   └─ Validează pronosticuri
                              │
                              └── 5. EMAIL SERVICE
                                  └─ Trimite email-uri HTML
```

---

## 🚀 PORNIRE SISTEM

### Start Complet
```bash
cd "/home/florian/API SMART 5"
node API-SMART-5.js full
```

**Ce pornește automat:**
- ✅ STATS MONITOR - Verifică meciuri la pauză
- ✅ SIMPLE ODDS MONITOR - Monitorizează cote live
- ✅ MATCH VERIFICATION ALERTER - Alertează probleme
- ✅ AUTO-VALIDATOR - Validează pronosticuri
- ✅ EMAIL SERVICE - Serviciu trimitere email-uri

### Verificare Status
```bash
ps aux | grep "API-SMART-5"
```

### Oprire Sistem
```bash
pkill -f "API-SMART-5.js"
```

**⚠️ IMPORTANT:** Există un **watchdog** care repornește automat sistemul dacă se oprește!

---

## 📊 FLUXUL COMPLET (PAS CU PAS)

### PASUL 1: Generare Listă Meciuri Zilnică

**Fișier:** `meciuri-YYYY-MM-DD.json`

```bash
node GENERARE_MECIURI_ZI.js
```

**Ce face:**
- Citește meciuri din FlashScore pentru ziua curentă
- Filtrează doar TOP 30 ligi (definite în `TOP_LEAGUES.js`)
- Generează program verificări la pauză (HT)
- Salvează în `meciuri-2026-02-01.json` și `verificari-2026-02-01.json`

**Exemplu meciuri-2026-02-01.json:**
```json
{
  "date": "01.02.2026",
  "totalMatches": 59,
  "leagues": {
    "SPAIN: LaLiga": 2,
    "ENGLAND: Premier League": 5,
    "ARGENTINA: Liga Profesional - Apertura": 4
  },
  "matches": [...]
}
```

---

### PASUL 2: Monitorizare la Pauză (HT) - STATS MONITOR

**Modul:** `STATS_MONITOR.js`

**Când rulează:** La fiecare 60 secunde, verifică dacă vreun meci a ajuns la pauză

**Ce face:**
1. Verifică dacă meciul este la HT (status "Half Time" pe FlashScore)
2. Extrage scorul de la pauză (ex: 1-0, 0-1, 1-1)
3. Calculează probabilități din `JSON PROCENTE AUTOACTUAL.json`
4. Detectează pattern-uri (ex: "Echipa oaspete marchează în R2 după ce a pierdut R1")
5. **Trimite EMAIL** cu pronosticul
6. **Adaugă în NOTIFICATION_TRACKER** cu status `MONITORING`

**Exemplu pattern detectat:**
```
Meci: Independiente vs Velez Sarsfield
Scor HT: 1-0 (gazdă câștigă la pauză)
Pattern: "Echipa oaspete marchează în R2 după ce a pierdut R1"
Probabilitate: 85%
Event: "UN GOL marcat de Velez în repriza 2"
```

**Email trimis automat:**
```
Subject: ⚽ Independiente vs Velez Sarsfield - Pattern Detectat
Content:
  - Scor HT: 1-0
  - Pattern: Echipa oaspete marchează în R2 după ce a pierdut R1
  - Probabilitate: 85%
  - Event: UN GOL în repriza 2
  - Status: MONITORING (monitorizare cote activă)
```

---

### PASUL 3: Monitorizare Cote Live - SIMPLE ODDS MONITOR

**Modul:** `ODDS_MONITOR_SIMPLE.js`

**Când rulează:** La fiecare **2 minute**, verifică meciurile în status `MONITORING`

**Ce face:**

1. **Ia meciuri active** din NOTIFICATION_TRACKER (status = MONITORING)
2. **Filtrare:**
   - Doar meciuri din ziua curentă
   - Fără flag `oddsMonitoringFailed`
3. **Pentru fiecare meci:**
   - Găsește pe Superbet (folosind `SUPERBET_LIVE_ODDS.js`)
   - Extrage cote live
   - **DETECTARE INTELIGENTĂ:**
     - Detectează **prag** din pattern (0.5, 1.5, 2.5)
     - Detectează **echipă** din pattern (HOME/AWAY/Total)
     - Construiește key-ul corect (ex: `echipa_1_peste_1_5`, `echipa_2_peste_0_5`)
   - Verifică praguri:
     - **Cota >= 1.5** → Trimite email + Salvează în `odds_validation_1.5.json`
     - **Cota >= 2.0** → Trimite email
   - **Marchează** în tracker (minute_odd_1_50, minute_odd_2_00)

**Exemplu detectare inteligentă:**
```
Pattern: "Echipa HOME marchează peste 1.5"
          ↓
Detectat: HOME + 1.5
          ↓
Key cota: "echipa_1_peste_1_5"
          ↓
Monitorizează: Independiente > 1.5 goluri
```

**Protecție duplicate:**
```javascript
if (cotaMonitorizata >= 1.5 && !alreadySent_1_50) {
    // Trimite email DOAR dacă NU a fost trimis înainte
    // Flag minute_odd_1_50 = "01:36:14"
}
// La următoarea verificare:
// alreadySent_1_50 = "01:36:14" → SKIP (nu mai trimite)
```

**Rezultat:**
- **MAXIM 2 email-uri** per meci:
  - 1 email când cota >= 1.5
  - 1 email când cota >= 2.0

---

### PASUL 4: Salvare pentru Validare

**Fișier:** `odds_validation_1.5.json`

**Când se salvează:** Când se trimite email la cota 1.5

**Structură:**
```json
[
  {
    "id": "ARG_INDEPENDIENTE_1769900263847",
    "match": "Independiente vs Velez Sarsfield",
    "homeTeam": "Independiente",
    "awayTeam": "Velez Sarsfield",
    "league": "Argentina - Primera Division",
    "event": "Independiente marchează peste 1.5 goluri",
    "pattern": {
      "name": "Echipa HOME marchează peste 1.5"
    },
    "probability": "85%",

    "odd_1_5_reached": true,
    "odd_1_5_value": 1.85,
    "odd_1_5_type": "Independiente > 1.5",
    "odd_1_5_timestamp": "2026-01-31T23:36:14.833Z",
    "odd_1_5_minute": "01:36:14",

    "validated": false,
    "validation_result": null,
    "validation_timestamp": null,

    "date": "01.02.2026"
  }
]
```

**Utilizare:** La finalul zilei, se verifică automat dacă pronosticurile s-au îndeplinit.

---

### PASUL 5: Validare Automată - AUTO-VALIDATOR

**Modul:** `AUTO_VALIDATOR.js`

**Când rulează:** La fiecare **6 ore**

**Ce face:**
1. Citește `odds_validation_1.5.json`
2. Pentru fiecare pronostic nevalidat (`validated: false`)
3. Verifică rezultatul final pe FlashScore
4. Compară cu pronosticul (ex: Independiente a marcat peste 1.5 goluri?)
5. Salvează rezultat (`validation_result: "SUCCESS"` sau `"FAILED"`)
6. Marchează `validated: true`

---

## 📁 FIȘIERE IMPORTANTE

### Fișiere de Configurare
| Fișier | Descriere |
|--------|-----------|
| `TOP_LEAGUES.js` | Whitelist ligi (doar top 30 primesc notificări) |
| `NOTIFICATION_CONFIG.js` | Configurare email (Gmail) |
| `JSON PROCENTE AUTOACTUAL.json` | Probabilități statistice pentru pattern-uri |

### Fișiere Zilnice (Generate Automat)
| Fișier | Descriere |
|--------|-----------|
| `meciuri-YYYY-MM-DD.json` | Lista meciuri pentru ziua curentă |
| `verificari-YYYY-MM-DD.json` | Program verificări la pauză |

### Fișiere de Tracking
| Fișier | Descriere |
|--------|-----------|
| `notifications_tracking.json` | TOATE notificările (istoric complet) |
| `odds_validation_1.5.json` | Pronosticuri trimise la cota 1.5 (pentru validare) |

### Module Principale
| Modul | Rol |
|-------|-----|
| `API-SMART-5.js` | **MAIN** - Pornește toate modulele |
| `STATS_MONITOR.js` | Monitorizare meciuri la pauză (HT) |
| `ODDS_MONITOR_SIMPLE.js` | Monitorizare cote live (2 min) |
| `NOTIFICATION_TRACKER.js` | Gestionare notificări (CRUD) |
| `EMAIL_SERVICE.js` | Trimitere email-uri |
| `AUTO_VALIDATOR.js` | Validare automată pronosticuri |

### Module Utilitare
| Modul | Rol |
|-------|-----|
| `flashscore-api.js` | API FlashScore (extragere meciuri, scoruri) |
| `SUPERBET_LIVE_ODDS.js` | Scraper Superbet (cote live) |
| `GENERARE_MECIURI_ZI.js` | Generator listă meciuri zilnică |

---

## 🎯 EXEMPLE DE UTILIZARE

### Exemplu 1: Adăugare Manuală Meci în Monitorizare

```bash
node add-independiente-full.js
```

**Sau manual în cod:**
```javascript
const tracker = require('./NOTIFICATION_TRACKER');

tracker.addNotification({
    id: 'ARG_INDEPENDIENTE_' + Date.now(),
    match: 'Independiente vs Velez Sarsfield',
    homeTeam: 'Independiente',
    awayTeam: 'Velez Sarsfield',
    league: 'Argentina - Primera Division',
    date: new Date().toLocaleDateString('ro-RO'),
    event: 'UN GOL în repriza 2',
    pattern: {
        name: 'Echipa HOME marchează peste 1.5',
        code: 'HOME_GOAL_R2'
    },
    probability: '85%',
    status: 'MONITORING',
    skipMinuteFilter: true
});
```

### Exemplu 2: Verificare Cote Manuală

```bash
node check-independiente-velez.js
```

### Exemplu 3: Verificare Status Monitorizare

```javascript
const tracker = require('./NOTIFICATION_TRACKER');

const active = tracker.getActiveMonitoring();
console.log('Meciuri active:', active.length);

active.forEach(m => {
    console.log(`
    Meci: ${m.match}
    Event: ${m.event}
    Cota 1.5: ${m.minute_odd_1_50 || 'NU'}
    Cota 2.0: ${m.minute_odd_2_00 || 'NU'}
    Status: ${m.status}
    `);
});
```

---

## 🔧 CONFIGURARE EMAIL

**Fișier:** `NOTIFICATION_CONFIG.js`

```javascript
module.exports = {
    email: {
        user: 'vostruemail@gmail.com',
        pass: 'vostra_parola_aplicatie',  // NU parola normală!
        to: 'destinatar@gmail.com'
    }
};
```

**⚠️ IMPORTANT:** Folosiți **App Password** din Gmail, NU parola obișnuită!

**Cum generați App Password:**
1. Mergeți la https://myaccount.google.com/security
2. Activați "2-Step Verification"
3. Generați "App Password" pentru "Mail"
4. Folosiți parola generată în config

---

## 📊 NOTIFICATION_TRACKER - Stări și Status-uri

### Status-uri Posibile
| Status | Descriere |
|--------|-----------|
| `MONITORING` | Meci în monitorizare activă (verificare cote la 2 min) |
| `COMPLETED` | Meci finalizat, pronostic validat |
| `FAILED` | Monitorizare eșuată (meci nu găsit pe Superbet) |

### Câmpuri Importante
| Câmp | Descriere |
|------|-----------|
| `minute_odd_1_50` | Timestamp când s-a trimis email la cota 1.5 (ex: "01:36:14") |
| `minute_odd_2_00` | Timestamp când s-a trimis email la cota 2.0 |
| `skipMinuteFilter` | `true` = Nu expira după 80 min (pentru meciuri adăugate manual) |
| `oddsMonitoringFailed` | `true` = Monitorizare oprită (meci nu găsit pe Superbet) |

---

## 🌍 TOP 30 LIGI (Whitelist)

**Fișier:** `TOP_LEAGUES.js`

**Ligi cu date statistice (prioritate maximă):**
- Premier League (Anglia)
- LaLiga (Spania)
- Serie A (Italia)
- Bundesliga + 2. Bundesliga (Germania)
- Ligue 1 (Franța)
- Eredivisie (Olanda)
- Primeira Liga (Portugalia)
- Austrian Bundesliga (Austria)
- Superliga (România/Danemarca)
- Cyprus League (Cipru)

**Alte ligi TOP:**
- Championship (Anglia)
- Scottish Premiership (Scoția)
- Super Lig (Turcia)
- Brasileirão (Brazilia)
- Liga Profesional (Argentina)
- MLS (USA)
- Jupiler Pro League (Belgia)
- Super League (Elveția/Grecia)
- Ekstraklasa (Polonia)

**Competiții internaționale:**
- UEFA Champions League
- Europa League
- Conference League
- Copa Libertadores
- Copa Sudamericana

**⚠️ BLOCAT:** Competiții AFC (Asia), ligi tineret (U21, U19), rezerve, feminin

---

## 🔍 DETECTARE INTELIGENTĂ COTE

**Modul:** `ODDS_MONITOR_SIMPLE.js` (liniile 109-152)

### Cum funcționează:

**1. Detectare Prag (0.5, 1.5, 2.5)**
```javascript
const pattern = "Echipa HOME marchează peste 1.5";

// Sistem caută "1.5" în text
if (pattern.includes('1.5')) {
    threshold = '1_5';  // → "echipa_1_peste_1_5"
}
```

**2. Detectare Echipă (HOME/AWAY/Total)**
```javascript
const pattern = "Echipa HOME marchează peste 1.5";

// Sistem caută "HOME", "AWAY", sau nume echipă
if (pattern.includes('home') || pattern.includes('HOME')) {
    cotaKey = `echipa_1_peste_${threshold}`;  // HOME = echipa 1
    tipCota = `${homeTeam} > 1.5`;
}
else if (pattern.includes('away') || pattern.includes('AWAY')) {
    cotaKey = `echipa_2_peste_${threshold}`;  // AWAY = echipa 2
    tipCota = `${awayTeam} > 0.5`;
}
else {
    cotaKey = `peste_${threshold}`;  // Total goluri
    tipCota = `Total goluri > 1.5`;
}
```

**3. Extragere Cotă de pe Superbet**
```javascript
const oddsData = await scraper.getLiveOdds(eventId);
const cotaMonitorizata = oddsData.odds[cotaKey];

// Ex: oddsData.odds.echipa_1_peste_1_5 = 1.85
```

**Exemple cote disponibile pe Superbet:**
- `peste_0_5`, `peste_1_5`, `peste_2_5` - Total goluri
- `echipa_1_peste_0_5`, `echipa_1_peste_1_5`, `echipa_1_peste_2_5` - Echipa gazdă
- `echipa_2_peste_0_5`, `echipa_2_peste_1_5`, `echipa_2_peste_2_5` - Echipa oaspete

---

## 📧 TEMPLATE-URI EMAIL

### Email 1: Pattern Detectat la Pauză
```
Subject: ⚽ Independiente vs Velez Sarsfield - Pattern Detectat

═══════════════════════════════════════
⚽ MECI LIVE - PATTERN DETECTAT
═══════════════════════════════════════

🏟️  MECI: Independiente vs Velez Sarsfield
📍 LIGA: Argentina - Primera Division
📊 SCOR HT: 1-0

🎯 PATTERN DETECTAT:
   Echipa oaspete marchează în R2 după ce a pierdut R1

📈 PROBABILITATE: 85%

🎲 EVENIMENT PREZIS:
   UN GOL marcat de Velez în repriza 2

⏰ Status: MONITORING
   → Monitorizare cote activă
   → Email automat la cota 1.5 și 2.0
```

### Email 2: Cota 1.5 Atinsă
```
Subject: 💰 COTA 1.5 ATINSĂ - Independiente vs Velez Sarsfield

═══════════════════════════════════════
💰 COTA MONITOR - PRAG ATINS
═══════════════════════════════════════

⚽ MECI: Independiente vs Velez Sarsfield

📊 EVENIMENT: Independiente marchează peste 1.5 goluri
🎯 PATTERN: Echipa HOME marchează peste 1.5
📈 PROBABILITATE: 85%

💰 COTĂ ACTUALĂ: 1.85
✅ Prag atins: 1.5
⏰ Minut: 01:36:14

🔍 Verifică meciul LIVE pe Superbet!
```

### Email 3: Cota 2.0 Atinsă
```
Subject: 💰 COTA 2.0 ATINSĂ - Independiente vs Velez Sarsfield

[Similar cu Email 2, dar cu prag 2.0]
```

---

## 🐛 TROUBLESHOOTING

### Problema: Sistemul nu trimite email-uri

**Verificări:**
1. Check configurare email:
```javascript
const emailService = require('./EMAIL_SERVICE');
emailService.sendTestEmail();
```

2. Check Gmail App Password:
   - Trebuie să fie activ "2-Step Verification"
   - Folosiți App Password, NU parola normală

3. Check log-uri:
```bash
tail -100 logs/combined.log | grep -i "email\|error"
```

### Problema: Meciuri din Argentina/Brazilia nu apar

**Soluție:**
1. Verifică dacă liga e în `TOP_LEAGUES.js`:
```javascript
const { isTopLeague } = require('./TOP_LEAGUES');
console.log(isTopLeague('ARGENTINA: Liga Profesional'));  // true
```

2. Regenerează lista meciuri:
```bash
node GENERARE_MECIURI_ZI.js
```

### Problema: Cotele nu se găsesc pe Superbet

**Cauze posibile:**
1. Meciul nu este disponibil live pe Superbet
2. Numele echipelor diferă (ex: "CA Independiente" vs "Independiente")

**Verificare manuală:**
```bash
node check-independiente-velez.js
```

### Problema: Duplicate email-uri la aceeași cotă

**NU ar trebui să se întâmple!** Sistem are protecție:
```javascript
if (cota >= 1.5 && !minute_odd_1_50) {
    // Trimite email DOAR dacă flag NU e setat
}
```

**Debug:**
```javascript
const tracker = require('./NOTIFICATION_TRACKER');
const m = tracker.getActiveMonitoring()[0];
console.log('Flag 1.5:', m.minute_odd_1_50);  // Dacă e setat → NU mai trimite
```

---

## 📝 LOG-URI ȘI DEBUGGING

### Log-uri Principale
```bash
# Log complet (toate modulele)
tail -f logs/combined.log

# Doar ODDS MONITOR
tail -f logs/combined.log | grep "ODDS MONITOR"

# Doar email-uri trimise
tail -f logs/combined.log | grep -i "email trimis"

# Erori
tail -f logs/combined.log | grep -i "error\|eroare"
```

### Verificare Status Live
```javascript
const tracker = require('./NOTIFICATION_TRACKER');

// Meciuri în monitorizare
const active = tracker.getActiveMonitoring();
console.log('Total active:', active.length);

// Meciuri din astăzi
const today = new Date().toLocaleDateString('ro-RO');
const todayMatches = active.filter(m => m.date === today);
console.log('Astăzi:', todayMatches.length);

// Meciuri cu email 1.5 trimis
const with1_5 = active.filter(m => m.minute_odd_1_50);
console.log('Cu cota 1.5:', with1_5.length);
```

---

## 🎓 ÎNTREBĂRI FRECVENTE (FAQ)

### Q: Cum adaug o ligă nouă în whitelist?
**A:** Editează `TOP_LEAGUES.js`, adaugă în `validPairs`:
```javascript
{ country: 'croatia', league: 'hnl' },
```

### Q: Cum schimb intervalul de verificare cote?
**A:** Editează `ODDS_MONITOR_SIMPLE.js`, linia 18:
```javascript
this.checkIntervalMs = 2 * 60 * 1000; // 2 minute → schimbă în 5 * 60 * 1000 pentru 5 min
```

### Q: Cum opresc monitorizarea pentru un meci specific?
**A:**
```javascript
const tracker = require('./NOTIFICATION_TRACKER');
tracker.updateNotification('MECI_ID', {
    status: 'COMPLETED',  // sau 'FAILED'
    oddsMonitoringFailed: true
});
```

### Q: Cum verific cate email-uri am primit astăzi?
**A:**
```bash
grep "Email trimis" logs/combined.log | grep "$(date +%Y-%m-%d)" | wc -l
```

### Q: De ce primesc email doar la anumite meciuri?
**A:** Doar meciuri din **TOP 30 ligi** primesc notificări. Verifică `TOP_LEAGUES.js`.

### Q: Pot schimba pragurile de la 1.5 și 2.0 la alte valori?
**A:** Da, editează `ODDS_MONITOR_SIMPLE.js`, liniile 166 și 189:
```javascript
if (cotaMonitorizata >= 1.5 && !alreadySent_1_50) {  // Schimbă 1.5 în 1.8
```

---

## 📊 STATISTICI ȘI PERFORMANȚĂ

### Metrici Importante
- **Acuratețe pronosticuri:** Verifică `odds_validation_1.5.json` → `validation_result`
- **Total notificări:** `notifications_tracking.json` → lungime array
- **Meciuri monitorizate astăzi:** Filtrare după `date`
- **Email-uri trimise astăzi:** Filtrare după `minute_odd_1_50` și `minute_odd_2_00`

### Rapoarte Generate Automat
```bash
node GENERARE_RAPORT_ZILNIC.js  # Dacă există
```

---

## 🔐 SECURITATE

**⚠️ IMPORTANT:**
1. **NU** commit-eți `NOTIFICATION_CONFIG.js` în Git (conține parole)
2. Folosiți **App Password** pentru Gmail (NU parola reală)
3. Păstrați `notifications_tracking.json` backup-at

**Backup automat:**
```bash
cp notifications_tracking.json "notifications_tracking_$(date +%Y%m%d).json"
```

---

## 📞 SUPORT ȘI CONTACT

**Probleme/Bug-uri:**
- Check log-uri: `logs/combined.log`
- Verificare status: `ps aux | grep API-SMART-5`
- Restart sistem: `pkill -f API-SMART-5 && node API-SMART-5.js full`

**Backup Date:**
```bash
tar -czf backup_$(date +%Y%m%d).tar.gz \
    notifications_tracking.json \
    odds_validation_1.5.json \
    meciuri-*.json \
    verificari-*.json
```

---

## ✅ CHECKLIST PORNIRE DIMINEAȚA

1. ✅ Verifică sistem rulează: `ps aux | grep API-SMART-5`
2. ✅ Generează meciuri pentru azi: `node GENERARE_MECIURI_ZI.js`
3. ✅ Verifică email funcționează: `node test-email.js`
4. ✅ Check log-uri: `tail -50 logs/combined.log`
5. ✅ Verifică meciuri active: `node check-active-monitoring.js`

---

## 🎯 REZUMAT RAPID

```
┌─────────────────────────────────────────────────────────────┐
│  API SMART 5 - Flux Complet                                  │
└─────────────────────────────────────────────────────────────┘

1. GENERARE LISTĂ MECIURI (manual sau automat)
   → meciuri-2026-02-01.json (59 meciuri, doar TOP 30 ligi)

2. STATS MONITOR (la fiecare 60 sec)
   → Verifică meciuri la pauză (HT)
   → Detectează pattern-uri (85% probabilitate)
   → Trimite EMAIL cu pronostic
   → Adaugă în NOTIFICATION_TRACKER (status: MONITORING)

3. SIMPLE ODDS MONITOR (la fiecare 2 min)
   → Ia meciuri MONITORING din tracker
   → Caută pe Superbet
   → Extrage cote live
   → DETECTARE INTELIGENTĂ (HOME/AWAY + 0.5/1.5/2.5)
   → Email la cota 1.5 → Salvează în odds_validation_1.5.json
   → Email la cota 2.0
   → DOAR 2 email-uri per meci (protecție duplicate)

4. AUTO-VALIDATOR (la fiecare 6h)
   → Citește odds_validation_1.5.json
   → Verifică rezultate finale
   → Validează pronosticuri (SUCCESS/FAILED)

TOTAL:
- Email-uri per meci: MAX 3 (HT + Cota 1.5 + Cota 2.0)
- Meciuri monitorizate: ~10-30 per zi (doar TOP ligi)
- Acuratețe: ~70-85% (în funcție de pattern)
```

---

**Versiune:** 5.0
**Ultimul Update:** 01.02.2026
**Status:** ✅ PRODUCTION READY

---

*Acest document conține TOTUL ce trebuie să știi despre API SMART 5. Dacă ai uitat cum funcționează, citește acest fișier de la început la sfârșit și vei înțelege complet sistemul!*
