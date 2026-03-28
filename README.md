# API SMART 5

Sistem complet de monitorizare meciuri fotbal: detectare pattern-uri la pauză, serii consecutive pre-meci, notificări email, validare automată.

## Structura proiectului

```
API SMART 5/
├── flashscore-api.js           # Modul central API FlashScore
├── TOP_LEAGUES.js              # Whitelist TOP 30 ligi mondiale
├── DAILY_MATCHES.js            # Lista meciurilor zilnice (cron 08:00)
├── RUN_DAILY_MATCHES.sh        # Wrapper cron job
│
├── STATS_MONITOR.js            # Monitorizare live statistici la pauză
├── pattern-checker.js          # PatternChecker — detectare ~90 pattern-uri HT
├── PROCENTE_LOADER.js          # Loader probabilități per pattern/tier/ligă
│
├── PRE_MATCH_STREAKS.js        # Serii consecutive S01-S22 pre-meci
├── WINNING_STREAK.js           # Serii victorii + goluri + cartonașe
├── POSITION_FALLBACK.js        # Poziție clasament echipă (fallback)
│
├── GENERATE_ALL_PROCENTE.js    # Generator procente HT (standalone, legacy)
├── RECALCULATE_ALL.js          # Recalculare COMPLETĂ probabilități (6 module)
│
├── EMAIL_SERVICE.js            # Trimitere email notificări
├── PRONOSTICS_REPORT.js        # Raport centralizat pronosticuri
├── DAILY_REPORT_SCHEDULER.js   # Scheduler raport zilnic
├── WATCHDOG.js                 # Proces supervizor
│
├── data/
│   ├── seasons/                # Fișiere sezon complete (25.000+ meciuri)
│   │   ├── complete_FULL_SEASON_PremierLeague_*.json
│   │   ├── complete_FULL_SEASON_LaLiga_*.json
│   │   ├── complete_FULL_SEASON_*_SMART4.json   # Date migrate din API SMART 4
│   │   └── ...                 # ~135 fișiere, ~26 ligi, sezoane 2022-2026
│   │
│   ├── procente/
│   │   └── JSON PROCENTE AUTOACTUAL.json    # Probabilități HT per pattern/tier/ligă
│   │
│   ├── streak_patterns_catalog.json          # Catalog S01-S22 serii consecutive
│   ├── scoring_streak_probabilities.json     # 2+ goluri consecutive
│   ├── goal_streak_probabilities.json        # 1+ gol consecutiv
│   ├── yellow_cards_streak_probabilities.json       # 3+ cartonașe consecutive
│   └── yellow_cards_2plus_streak_probabilities.json # 2+ cartonașe consecutive
│
├── logs/                       # Log-uri zilnice
├── package.json
└── README.md
```

## Module principale

### DAILY_MATCHES.js - SISTEM AUTOMAT ZILNIC

**Script automatizat care rulează în fiecare zi la 08:00 pentru generarea listei de meciuri.**

**Funcționalitate:**
- Extrage TOATE meciurile programate pentru ziua curentă
- Filtrare strictă: DOAR TOP 30 ligi mondiale + competiții europene
- Generează fișier JSON: `meciuri-YYYY-MM-DD.json`
- Timezone: Europe/Bucharest (EET) - sincronizat cu FlashScore
- Logging automat în `logs/daily-matches-YYYY-MM-DD.log`

**Structura JSON generată:**
```json
{
  "data": "03.11.2025",
  "generatedAt": "03.11.2025 08:00:15",
  "timezone": "Europe/Bucharest (EET)",
  "totalMatches": 26,
  "meciuri": [
    {
      "matchId": "abc123xyz",
      "homeTeam": "Arsenal",
      "awayTeam": "Chelsea",
      "liga": "ENGLAND: Premier League",
      "ora": "15:00",
      "timestamp": 1762174800,
      "finished": false
    }
  ]
}
```

**Rulare manuală:**
```bash
node DAILY_MATCHES.js
# sau
./RUN_DAILY_MATCHES.sh
```

**Cron job (automat la 08:00):**
```
0 8 * * * /home/florian/API\ SMART\ 5/RUN_DAILY_MATCHES.sh
```

**Utilizare ulterioară:**
- `matchId` - identificator unic pentru fiecare meci
- `ora` + `timestamp` - pentru extragere statistici la minute specifice (ex: ora + 35 min)
- `finished` - status meci (true/false)

### TOP_LEAGUES.js

**Whitelist strict cu TOP 30 ligi mondiale:**
- Top 5: Premier League, LaLiga, Serie A, Bundesliga, Ligue 1
- Ligi majore: Eredivisie, Liga Portugal, Super Lig, Championship, etc.
- Competiții: Champions League, Europa League, Conference League
- Filtrare strictă: excludere automată U21, women, rezerve, ligi secundare

**Metoda principală:**
```javascript
isTopLeague(leagueName) // Returns true doar pentru ligi validate (țară + ligă)
```

### flashscore-api.js

Modulul central care conține toate metodele de accesare API FlashScore:

#### Metode de bază:
- `parseFlashscoreData(data)` - Parsează formatul custom FlashScore (~¬÷)
- `fetchFromAPI(url)` - Fetch generic cu headers + decompresie (gzip, brotli)

#### Metode high-level:
- `fetchLiveMatches()` - Lista meciuri live
- `fetchMainFeed()` - Feed principal (meciuri + ligi)
- `fetchMatchDetails(matchId)` - Detalii complete meci (core, summary, stats)
- `getMatchFromMainFeed(matchId)` - Info meci din main feed

### MASTER-SMART5.js

Script principal de analiză.

**Funcționalități:**
- Fetch main feed
- Afișare meciuri live
- Sistem de lockfile (previne rulări multiple)
- Mod test pentru verificarea API

## Folosire

### 1. Generare listă meciuri zilnică (AUTOMAT)

**Automat la 08:00 în fiecare zi:**
```bash
# Cron job configurat automat
# Vezi: crontab -l
```

**Rulare manuală:**
```bash
node DAILY_MATCHES.js
# sau cu logging
./RUN_DAILY_MATCHES.sh
```

**Output:**
- Fișier JSON: `meciuri-2025-11-03.json`
- Log file: `logs/daily-matches-2025-11-03.log`

### 2. Analiză live matches (MASTER-SMART5)

```bash
./START_SMART_5.sh
# sau
npm start
# sau
node MASTER-SMART5.js
```

### 3. Test API (verificare conexiune)

```bash
npm test
# sau
node MASTER-SMART5.js --test
```

## Exemple de utilizare API

### Exemplu 1: Fetch meciuri live
```javascript
const { fetchMainFeed } = require('./flashscore-api');

const feed = await fetchMainFeed();
const liveMatches = Object.values(feed.matches).filter(m => !m.finished);

console.log('Meciuri live:', liveMatches.length);
```

### Exemplu 2: Detalii meci
```javascript
const { fetchMatchDetails } = require('./flashscore-api');

const details = await fetchMatchDetails('matchId123');
console.log('Core:', details.core);
console.log('Summary:', details.summary);
console.log('Stats:', details.statsData);
```

### Exemplu 3: Info meci din main feed
```javascript
const { getMatchFromMainFeed } = require('./flashscore-api');

const match = await getMatchFromMainFeed('matchId123');
console.log(`${match.homeTeam} vs ${match.awayTeam}`);
console.log(`Liga: ${match.leagueName}`);
console.log(`Scor: ${match.homeScore}-${match.awayScore}`);
```

## Date returnate de API

### fetchMainFeed()
```javascript
{
  matches: {
    'matchId': {
      matchId: string,
      homeTeam: string,
      awayTeam: string,
      leagueId: string,
      timestamp: number,
      homeScore: number,
      awayScore: number,
      status: string,
      finished: boolean
    }
  },
  leagues: {
    'leagueId': {
      id: string,
      name: string,
      country: string,
      countryId: string
    }
  },
  timestamp: number
}
```

### fetchMatchDetails(matchId)
```javascript
{
  matchId: string,
  core: object,        // Date core meci
  summary: array,      // Evenimente (goluri, cardușe)
  statsData: array,    // Statistici (shot, corners, etc.)
  timestamp: number
}
```

## Endpoints FlashScore folosite

1. **Main Feed**: `https://global.flashscore.ninja/2/x/feed/f_1_0_2_en_1`
   - Toate meciurile + ligi

2. **Live Matches**: `https://global.flashscore.ninja/2/x/feed/r_1_1`
   - Doar meciuri live

3. **Match Core**: `https://global.flashscore.ninja/2/x/feed/dc_1_{matchId}`
   - Date de bază despre meci

4. **Match Summary**: `https://global.flashscore.ninja/2/x/feed/df_sui_1_{matchId}`
   - Evenimente (goluri pe reprize)

5. **Match Stats**: `https://2.flashscore.ninja/2/x/feed/df_st_1_{matchId}`
   - Statistici detaliate

## Format date FlashScore

FlashScore folosește un format custom cu separatori speciali:
- `~` - Record separator
- `¬` - Field separator
- `÷` - Key-value separator

Exemplu:
```
~AA÷matchId123¬AE÷HomeTeam¬AF÷AwayTeam~
```

Functia `parseFlashscoreData()` transformă acest format în array de obiecte JavaScript.

## Workflow complet - Extragere statistici la minute specifice

**Pas 1: Lista meciurilor (AUTOMAT la 08:00)**
```bash
# Cron job generează meciuri-2025-11-03.json
# Conține toate meciurile zilei cu matchId și ora de start
```

**Pas 2: Calcul timp extragere**
```javascript
// Exemplu: Meci începe la 15:00, vrei statistici la min 35
const startTime = 15 * 60; // 15:00 = 900 minute
const targetMinute = 35;
const extractTime = startTime + targetMinute; // 15:35
```

**Pas 3: Extragere statistici la timpul dorit**
```javascript
const { fetchMatchDetails } = require('./flashscore-api');

// La 15:35 (minutul 35 al meciului)
const details = await fetchMatchDetails(matchId);

// Extras scor HT
const firstHalf = details.summary?.find(s => s.AC === '1st Half');
const htScore = {
    home: firstHalf?.IG || 0,
    away: firstHalf?.IH || 0
};

// Extras statistici
const stats = details.statsData; // xG, possession, shots, corners, etc.
```

## Note importante

- **Timezone**: Europe/Bucharest (EET/UTC+2) - sincronizat automat cu FlashScore
- **Timestamps**: Format UNIX (secunde) - conversie automată la ora locală
- **matchId**: Identificator unic persistent (ex: "jTySbsQE")
- **Filtrare**: ULTRA STRICT - doar TOP 30 ligi (validare țară + ligă)
- API-ul FlashScore necesită headers specifice (X-Fsign, User-Agent)
- Toate metodele suportă decompresie (gzip, brotli, deflate)
- Lockfile previne rulări multiple simultan (MASTER-SMART5)
- Timeout: 10 secunde pentru fiecare request
- **Scores**: NU folosi feed.matches scores (inexacte) - calculează din summary (IG + IH)

---

## RECALCULATE_ALL.js — Sistem de recalculare probabilități

### Ce face

Script unic care recalculează TOATE probabilitățile din sistem pe baza datelor istorice complete (~20.500 meciuri, ~43 ligi, sezoane 2022-2026). Generează 6 fișiere JSON consumate de restul sistemului.

### Rulare

```bash
node RECALCULATE_ALL.js
```

Timp execuție: ~10 secunde. Backup automat înainte de suprascriere (`*.backup_YYYY-MM-DD.json`).

### Cele 6 fișiere generate

| # | Fișier | Ce calculează | Consumat de |
|---|--------|---------------|-------------|
| 1 | `data/procente/JSON PROCENTE AUTOACTUAL.json` | Probabilități HT — ~90 pattern-uri × 43 ligi × 4 tier-uri | `PROCENTE_LOADER.js` |
| 2 | `data/streak_patterns_catalog.json` | S01-S22: 22 pattern-uri × serii 3-7W × per ligă + global × 3 tier-uri | `PRE_MATCH_STREAKS.js` → `getCatalogProb()` |
| 3 | `data/scoring_streak_probabilities.json` | 2+ goluri consecutive → prob 1+ gol, serii 3-5W | `WINNING_STREAK.js` → `getScoringStreakStats()` |
| 4 | `data/goal_streak_probabilities.json` | 1+ gol consecutiv → prob 1+ gol, serii 5-10W | `WINNING_STREAK.js` → `getGoalStreakStats()` |
| 5 | `data/yellow_cards_streak_probabilities.json` | 3+ cartonașe consecutive → prob 2+/3+, serii 3-5W | Funcții cartonașe |
| 6 | `data/yellow_cards_2plus_streak_probabilities.json` | 2+ cartonașe consecutive → prob 1+/2+, serii 3-7W | Funcții cartonașe |

### Flux intern

```
1. Încarcă TOATE fișierele din data/seasons/ (135+ fișiere)
2. Grupează per ligă (normalizeForGrouping), deduplică per id_meci
3. Sortează meciuri cronologic per ligă
4. Calculează clasament simulat (puncte din rezultate)
5. Backup fișiere existente (*.backup_YYYY-MM-DD)
6. Rulează cele 6 module de calcul
7. Salvează cele 6 fișiere JSON
8. Afișează rezumat comparativ (vechi vs nou)
```

### Cele 6 module interne

**Modul 1 — PROCENTE HT (PatternChecker)**
- Pentru fiecare meci cu statistici R1, rulează `PatternChecker.checkAllPatterns()`
- Detectează ~90 pattern-uri (șuturi, cornere, salvări, xG, posesie, cartonașe)
- Verifică succes = gol în R2
- Agregare per pattern × tier (4 nivele: TOP/MID/LOW/BOTTOM) × ligă
- Tier-uri configurate per tip campionat (18-20 echipe, 12 echipe, Champions League etc.)

**Modul 2 — STREAK CATALOG (S01-S22)**
- 22 pattern-uri de serii consecutive (goluri, cornere, șuturi, faulturi, cartonașe)
- Pentru fiecare echipă, scanează meciurile cronologic, detectează serii 3-7W
- La fiecare serie de lungime N, verifică meciul următor (nextThreshold)
- Agregare: per ligă + global, per tier (3 nivele: TOP/MID/LOW)

**Module 3-6 — Serii specifice**
- Folosesc helper comun `calculateStreakProbabilities()` cu parametri diferiți
- Fiecare generează `global` + `perLeague` × streak windows × tier-uri

### Tier-uri

**4 nivele (pentru PROCENTE HT):**
- Determinate de `getTierConfig()` — mapping explicit per ligă sau fallback pe număr echipe
- Exemple: TOP_1-5, MID_6-10, LOW_11-15, BOTTOM_16-20 (campionate standard 20 echipe)

**3 nivele (pentru serii consecutive):**
- Determinate de `getSimpleTier()` — treimea superioară/mijlocie/inferioară din clasament
- Valori: TOP, MID, LOW

### Sursa datelor

Toate datele vin din `data/seasons/` — fișiere `complete_FULL_SEASON_*.json`:
- Sezoane 2022-2023 până la 2025-2026
- ~26 ligi (Big 5 + Championship, Eredivisie, Super Lig, Superliga RO, etc.)
- Include și date migrate din API SMART 4 (fișiere `*_SMART4.json`)
- Deduplicare pe `id_meci` — fiecare meci contat o singură dată

### Verificare post-recalculare

```bash
# PROCENTE_LOADER funcționează cu noile date
node -e "const P = require('./PROCENTE_LOADER'); const l = new P(); l.load();"

# Catalog S01-S22 valid
node -e "const d = require('./data/streak_patterns_catalog.json'); console.log(Object.keys(d.patterns).length + ' pattern-uri');"

# Scoring streak valid
node -e "const d = require('./data/scoring_streak_probabilities.json'); console.log('Global:', Object.keys(d.global)); console.log('Ligi:', Object.keys(d.perLeague).length);"
```

### Reguli importante

- **NU elimina rate sub 70%** — salvează tot, filtrarea e la afișare/consum
- **Salvează eșantionul** (total) alături de rată la fiecare intrare
- **Backup** obligatoriu înainte de suprascriere
- **Serii cross-sezon**: OK — meciurile sunt sortate cronologic global, seria continuă natural
- **Deduplicare**: pe `id_meci`, previne numărarea dublă a meciurilor care apar în mai multe fișiere sezon

---

## Migrare API SMART 4 → API SMART 5

Datele istorice din API SMART 4 (12 fișiere JSON-*.json) au fost migrate în `data/seasons/` ca fișiere `complete_FULL_SEASON_*_SMART4.json`. Au fost copiate doar meciurile cu `id_meci` unic (3.267 meciuri). RECALCULATE_ALL.js nu mai referă deloc API SMART 4 — totul e self-contained.

Fișiere migrate:
- `complete_FULL_SEASON_PremierLeague_SMART4.json` (456 meciuri)
- `complete_FULL_SEASON_LaLiga_SMART4.json` (469 meciuri)
- `complete_FULL_SEASON_SerieA_SMART4.json` (441 meciuri)
- `complete_FULL_SEASON_Bundesliga_SMART4.json` (73 meciuri)
- `complete_FULL_SEASON_Ligue1_SMART4.json` (386 meciuri)
- `complete_FULL_SEASON_Eredivisie_SMART4.json` (227 meciuri)
- `complete_FULL_SEASON_PrimeiraLiga_SMART4.json` (270 meciuri)
- `complete_FULL_SEASON_AUSTRIABundesliga_SMART4.json` (156 meciuri)
- `complete_FULL_SEASON_Superliga_SMART4.json` (154 meciuri)
- `complete_FULL_SEASON_ROMANIASuperliga_SMART4.json` (339 meciuri)
- `complete_FULL_SEASON_CYPRUSFirstDivision_SMART4.json` (296 meciuri)

---

## Licență

ISC
