# API SMART 5 — Arhitectură completă

Documentație exhaustivă a întregului sistem. Suficientă pentru a reconstrui sau migra aplicația de la zero.

---

## 1. CE FACE SISTEMUL

Monitorizare automată a meciurilor de fotbal din ~30 ligi mondiale:

1. **Dimineața** (08:00): generează lista meciurilor zilei + programul de verificare HT/FT
2. **La pauza fiecărui meci** (+53 min): extrage statistici HT din FlashScore, detectează ~95 pattern-uri statistice (P0-P25), calculează probabilitatea ca echipa să marcheze în R2
3. **Dacă probabilitatea > threshold** (70-85% în funcție de ligă, +penalizări xG și diferență tier): trimite email cu detalii + odds live
4. **După meci** (+120 min): colectează rezultatul final, salvează în baza de date sezon
5. **La fiecare 6 ore**: validează automat dacă predicțiile au fost corecte
6. **Zilnic la 08:00**: trimite raport cu rezultatele zilei precedente
7. **Non-stop**: watchdog monitorizează sănătatea sistemului, repornește la crash

### Fluxul unei zile tipice

```
08:00  DAILY_MATCHES.js → meciuri-2026-03-06.json (26 meciuri)
08:01  GENERATE_CHECK_SCHEDULE.js → verificari-2026-03-06.json (26 timeslots HT)
08:01  GENERATE_FINAL_SCHEDULE.js → final-verificari-2026-03-06.json (26 timeslots FT)
08:01  PRE_MATCH_STREAKS.js → data/pre_match_streaks_2026-03-06.json (alerte serii)
08:02  STATS_MONITOR.js pornește (daemon, verifică schedule la fiecare 1 min)
08:02  FINAL_MONITOR.js pornește (daemon)
...
15:53  STATS_MONITOR detectează: meci Arsenal-Chelsea a ajuns la HT
       → FlashScore API: extrage statistici HT
       → PatternChecker: detectează PATTERN_1.3 (6+ șuturi pe poartă, 0 goluri)
       → PROCENTE_LOADER: probabilitate 78% (TOP_1-5, Premier League)
       → email-notifier: trimite email cu predicție
       → NOTIFICATION_TRACKER: salvează în notifications_tracking.json
       → ODDS_MONITOR: pornește monitorizare odds
...
17:00  FINAL_MONITOR: meci terminat
       → FINAL_STATS_EXTRACTOR: extrage statistici finale
       → CHAMPIONSHIP_JSON_MANAGER: salvează în complete_FULL_SEASON_PremierLeague_2025-2026.json
...
21:00  AUTO_VALIDATOR: verifică notificările din ultimele 6h
       → Arsenal a marcat în R2? Da → status: WON
       → Actualizează notifications_tracking.json
...
08:00  DAILY_REPORT_SCHEDULER: raport ziua precedentă
       → DAILY_REPORT_GENERATOR: 5 predicții, 4 corecte (80%)
       → EMAIL_SERVICE: trimite raport
       → PRONOSTICS_REPORT: actualizează pronostics-history.json
```

---

## 2. TOATE MODULELE

### 2.1 Orchestrare (entry points)

#### `API-SMART-5.js` — Scriptul principal
- **Pornire**: `node API-SMART-5.js full` (mod complet zilnic)
- **Comenzi**: `daily`, `schedule`, `monitor`, `full`, `fullday`, `finalschedule`, `finalmonitor`, `watchdog`, `autovalidate`, `collectyesterday`
- **`full`** = `daily` + `schedule` + `monitor` (secvențial)
- **`fullday`** = `full` + `finalschedule` + `finalmonitor`
- **Exports**: `commandDaily()`, `commandSchedule()`, `commandMonitor()`, `commandFull()`, etc.

#### `WATCHDOG.js` — Supervizor sistem
- **Trigger**: proces separat, verifică la fiecare 3 minute
- **Ce face**:
  - Verifică dacă procesul API-SMART-5 rulează (`ps aux`)
  - Detectează crash-uri → repornește automat (max 2/oră)
  - Monitorizează memorie: warn la 85%, restart la 90%
  - Detectează "stale day process" (proces din ziua anterioară)
  - Heartbeat email la fiecare 3 ore (interval 8:00-1:00)
- **Fișiere state**: `.crash-state.json`, `.no-matches-today.flag`, `.watchdog-shutdown.json`
- **Dependențe**: SYSTEM_NOTIFIER, LIFECYCLE_MANAGER, LOG_MANAGER, MEMORY_THROTTLE

#### `start-auto-validator.js` — Daemon validare automată
- **Trigger**: proces separat, rulează continuu cu interval 6 ore
- **Previne instanțe duplicate** cu lock file
- **Dependențe**: AUTO_VALIDATOR, LOG_MANAGER

#### `DAILY_REPORT_SCHEDULER.js` — Scheduler rapoarte
- **Trigger**: cron la 08:00 zilnic
- **Ce face**: generează + trimite raport zilnic + actualizează raportul master
- **Dependențe**: SEND_DAILY_REPORT, DAILY_REPORT_GENERATOR, PRONOSTICS_REPORT

### 2.2 Colectare date

#### `DAILY_MATCHES.js` — Lista meciurilor zilnice
- **Input**: FlashScore API (`fetchMainFeed()`)
- **Filtrare**: doar TOP 30 ligi (via `TOP_LEAGUES.js`)
- **Include** și meciurile de mâine 00:00-08:00 (pentru ligi din America de Sud)
- **Fix playoff/playout România**: `fixRomaniaLeagueName()` corectează clasificarea pe baza echipelor (FlashScore API pune uneori meciuri playoff sub "Relegation Group")
  - `ROMANIA_PLAYOFF_TEAMS` — top 6 echipe Championship Group 2025-2026
  - `ROMANIA_PLAYOUT_TEAMS` — bottom 10 echipe Relegation Group 2025-2026
- **Output**: `meciuri-YYYY-MM-DD.json`
- **Structura output**:
```json
{
  "data": "06.03.2026",
  "generatedAt": "06.03.2026 08:00:15",
  "timezone": "Europe/Bucharest (EET)",
  "totalMatches": 26,
  "meciuri": [
    {
      "matchId": "jTySbsQE",
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
- **Export**: `generateDailyMatches()`

#### `GENERATE_CHECK_SCHEDULE.js` — Program verificare HT
- **Input**: `meciuri-YYYY-MM-DD.json`
- **Logică**: ora_start + 53 minute = momentul verificării HT
- **Output**: `verificari-YYYY-MM-DD.json`
- **Export**: `generateCheckSchedule(matchesFile)`

#### `GENERATE_FINAL_SCHEDULE.js` — Program verificare FT
- **Input**: `meciuri-YYYY-MM-DD.json`
- **Logică**: ora_start + 120 minute = momentul verificării FT
- **Output**: `final-verificari-YYYY-MM-DD.json`

#### `flashscore-api.js` — Client API FlashScore
- **Format API**: custom cu separatori `~¬÷` (parseFlashscoreData)
- **Metode**:
  - `fetchMainFeed()` — toate meciurile + ligi
  - `fetchMatchDetails(matchId)` — core + summary + stats
  - `getMatchFromMainFeed(matchId)` — info meci din feed
  - `fetchLiveMatches()` — doar meciuri live
- **Endpoints**:
  - Main feed: `https://global.flashscore.ninja/2/x/feed/f_1_0_2_en_1`
  - Live: `https://global.flashscore.ninja/2/x/feed/r_1_1`
  - Core: `https://global.flashscore.ninja/2/x/feed/dc_1_{matchId}`
  - Summary: `https://global.flashscore.ninja/2/x/feed/df_sui_1_{matchId}`
  - Stats: `https://2.flashscore.ninja/2/x/feed/df_st_1_{matchId}`
- **Headers necesare**: X-Fsign, User-Agent
- **Suportă**: gzip, brotli, deflate
- **Timeout**: 10 secunde per request

#### `TOP_LEAGUES.js` — Whitelist ligi
- 30 ligi permise (Big 5 + Championship, Eredivisie, Super Lig, etc.)
- Blacklist: U21, women, rezerve, ligi secundare
- **Export**: `isTopLeague(leagueName)` → boolean

#### `FINAL_STATS_EXTRACTOR.js` — Extragere statistici FT
- Extrage statistici HT + FT + R2 din FlashScore
- Parsează: goluri, șuturi, cornere, cartonașe, posesie, xG
- **Export**: `extractFinalStats(matchId, matchInfo)`

#### `CHAMPIONSHIP_JSON_MANAGER.js` — Salvare date sezon
- Salvează meciuri finalizate în `data/seasons/complete_FULL_SEASON_*.json`
- Creează/actualizează fișiere per ligă per sezon
- Deduplicare pe `id_meci`
- Mapping explicit pentru ligi cu faze (playoff/playout): `ROMANIA: Superliga - Championship Group` → `ROMANIASuperligaChampionshipGroup`

#### `DAILY_FINAL_DATA_COLLECTOR.js` — Colectare batch FT
- Colectează date FT pentru ziua anterioară
- Output: `daily_collected_YYYY-MM-DD.json`
- **Export**: `collectDailyFinalData(date)`

### 2.3 Detectare pattern-uri

#### `pattern-checker.js` — Motor detectare pattern-uri HT
- **Clasă**: `PatternChecker`
- **Metodă principală**: `checkAllPatterns(matchData)` → array de pattern-uri detectate
- **Input** (matchData):
```javascript
{
  matchId, homeTeam, awayTeam, leagueName,
  scor: { pauza_gazda, pauza_oaspete },
  statistici: {
    suturi_pe_poarta: { pauza_gazda, pauza_oaspete },
    total_suturi: { pauza_gazda, pauza_oaspete },
    cornere: { repriza_1_gazda, repriza_1_oaspete },
    cartonase_galbene: { pauza_gazda, pauza_oaspete },
    cartonase_rosii: { pauza_gazda, pauza_oaspete },
    suturi_salvate: { pauza_gazda, pauza_oaspete },
    faulturi: { pauza_gazda, pauza_oaspete },
    ofsaiduri: { pauza_gazda, pauza_oaspete },
    xG: { pauza_gazda, pauza_oaspete } | null,
    posesie: { pauza_gazda, pauza_oaspete } | null
  }
}
```
- **Output**: `[{ name: 'PATTERN_1.3', team: 'gazda'|'oaspete'|'meci', stats: {...} }]`
- **Pattern-uri per echipă** (gazda/oaspete):

| Familie | Condiție | Pattern-uri |
|---------|----------|-------------|
| PATTERN_0.0 | Adversar roșu + șut pe poartă | 1 |
| PATTERN_1.x | X+ șuturi pe poartă, 0 goluri HT | 1.0-1.6 (min 3-9) |
| PATTERN_2.x | X+ total șuturi, 0 goluri HT | 2.1-2.5 (min 6-10) |
| PATTERN_4.x | X+ cornere, 0 goluri HT | 4.5-4.8 (min 5-8) |
| PATTERN_5.x | X+ (șuturi+cornere), 0 goluri HT | 5.5-5.8 (min 5-8) |
| PATTERN_6.x | cornere ≥ Y + șuturi ≥ Z, 0 goluri | 6.3-6.8 |
| PATTERN_7.x.y | cornere ≥ X + salvări adversar ≥ Y, 0 goluri | 7.2.1-7.5.3 |
| PATTERN_8.x.y.z | cornere + salvări + șuturi, 0 goluri | 8.2.1-8.5.3.3 |
| PATTERN_10.x | xG ≥ X, 0 goluri HT | 10.1-10.3 (0.8, 1.2, 1.5) |
| PATTERN_11.x | posesie ≥ X%, 0 goluri HT | 11.1-11.3 (65, 70, 75%) |
| PATTERN_12.x | xG + posesie, 0 goluri HT | 12.1-12.3 |
| PATTERN_13.x | posesie + șuturi, 0 goluri HT | 13.1-13.4 |
| PATTERN_14 | conduce norocos (adversar domină) | 1 |
| PATTERN_16 | ofsaiduri + presiune | 1 |
| PATTERN_17 | salvări adversar ≥ 4, 0 goluri | 1 |
| PATTERN_18 | dominare totală (posesie+cornere) | 1 |
| PATTERN_20 | cornere disproporționate (≥5 vs ≤1) | 1 |

- **Pattern-uri la nivel de meci**:

| Pattern | Condiție | Rata | Eșantion |
|---------|----------|------|----------|
| PATTERN_3.3/3.4/3.5+ | Total 3/4/5+ goluri la HT | ~78% | 1897 |
| PATTERN_9.3-9.7 | Total 3-7+ cartonașe galbene la HT | ~79% | 877 |
| PATTERN_19 | Egal ≥1-1 + total șuturi poartă ≥6 | 80.6% | 1267 |
| PATTERN_21 | Egal ≥1-1 + total șuturi poartă ≥10 | 92.2% | 77 |
| PATTERN_22 | Exact 1 gol total + total șuturi poartă ≥6 | 82.1% | 2098 |
| PATTERN_23 | ≥2 goluri total + total șuturi poartă ≥8 | 83.7% | 1546 |
| PATTERN_24 | Total cornere ≥8 | 81.2% | 3989 |
| PATTERN_25 | Scor 2-0 sau 0-2 (dominanță clară) | 81.2% | 4317 |

#### `PROCENTE_LOADER.js` — Încărcare probabilități
- **Clasă**: `ProcenteLoader`
- **Fișier**: `data/procente/JSON PROCENTE AUTOACTUAL.json`
- **Metodă principală**: `getPatternProbabilityWithFallback(leagueName, tier, patternId)`
- **Logica fallback**:
  1. Campionat exact + tier exact
  2. Campionat exact + tier adiacent
  3. Big 5 leagues (Premier League, La Liga, Serie A, Bundesliga, Ligue 1) + tier original
- **Return**: `{ procent, cazuri, succes, isEstimate, league, tier, patternId }`
- **Normalizare ligi**: map extensiv (ex: "Premier League" → "ENGLAND: Premier League")
- **Detectare tier**: `detectTierFromPosition(position, totalTeams, leagueName)`
- **Structura JSON consumat**:
```json
{
  "versiune": "2.0",
  "campionate": {
    "ENGLAND: Premier League": {
      "numar_echipe": 20,
      "categorii_clasament": [{"nume": "TOP_1-5", "pozitii": "1-5"}],
      "procente_reusita": {
        "TOP_1-5": {
          "PATTERN_1.3": { "cazuri": 8, "succes": 5, "procent": 62.5 }
        }
      }
    }
  }
}
```

#### `PATTERN_DESCRIPTOR.js` — Descrieri pattern-uri
- Convertește ID-uri în text uman
- Ex: "PATTERN_1.3" → "6 șuturi pe poartă, 0 goluri la pauză"
- **Export**: `PatternDescriptor` class, `formatExplicitMessage(pattern)`

#### `PRE_MATCH_STREAKS.js` — Serii consecutive pre-meci (S01-S22)
- Rulează dimineața, analizează meciurile zilei
- Verifică 22 pattern-uri de serii consecutive pe ambele echipe
- **Pattern-uri S01-S22** (detalii complete în secțiunea RECALCULATE_ALL):

| ID | Categorie | Condiție serie | Verificare următor |
|----|-----------|----------------|-------------------|
| S01 | GOLURI | 2+ goluri marcate | 1+ gol |
| S02 | GOLURI | 1+ gol marcat | 1+ gol |
| S03 | GOLURI PRIMITE | 1+ gol primit | 1+ gol primit |
| S04 | GOLURI PRIMITE | 2+ goluri primite | 1+ gol primit |
| S05 | GOLURI R1 | 1+ gol în R1 | 1+ gol R1 |
| S06 | OVER | 3+ goluri total | 2+ goluri total |
| S07-S10 | CORNERE | 4-5+ cornere | 3-5+ cornere |
| S11-S14 | ȘUTURI PE POARTĂ | 4-6+ șuturi | 3-4+ șuturi |
| S15-S17 | TOTAL ȘUTURI | 10-12+ șuturi | 8-10+ șuturi |
| S18-S20 | FAULTURI | 10-12+ faulturi | 8-10+ faulturi |
| S21-S22 | CARTONAȘE | 2+ cartonașe | 1-2+ cartonașe |

- **Probabilitate**: citită din `data/streak_patterns_catalog.json` via `getCatalogProb(patternId, streakLength, league, tier)`
- **Email**: trimis cu 5 minute înainte de start dacă ≥70% probabilitate
- **Output zilnic**: `data/pre_match_streaks_YYYY-MM-DD.json`
- **Exports**: `generatePreMatchStreaks(matchesFile)`, `checkAndSendPreMatchEmails()`

#### `WINNING_STREAK.js` — Serii victorii + goluri
- Calculează seria curentă a unei echipe (live, din fișiere sezon)
- **Funcții principale**:
  - `getTeamStreak(league, team)` → `{ currentWinStreak: N }` — victorii consecutive
  - `getStreakStats(league, streakLength)` → `{ won, total, rate }` — probabilitate continuare (calculat dinamic)
  - `getScoringStreak(league, team)` → `{ currentScoringStreak: N }` — meciuri cu 2+ goluri
  - `getScoringStreakStats(league, streak, tier)` → din `scoring_streak_probabilities.json`
  - `getGoalStreak(league, team)` → `{ currentGoalStreak: N }` — meciuri cu 1+ gol
  - `getGoalStreakStats(league, streak, tier)` → din `goal_streak_probabilities.json`
- **Cache**: 1 oră TTL
- **Sursă date**: `data/seasons/complete_FULL_SEASON_*.json`
- **Exports**: `getTeamStreak`, `getStreakStats`, `getScoringStreak`, `getScoringStreakStats`, `getGoalStreak`, `getGoalStreakStats`, `clearCache`, `leagueToFilePattern`, `normalizeName`

#### `POSITION_FALLBACK.js` — Poziție clasament
- Determină poziția echipei în clasament din date istorice
- Fallback când scraping-ul live eșuează
- **Export**: `getPositionFromHistory(leagueName, teamName)` → `{ position, tier, totalTeams }`
- `leagueToFilePattern(leagueName)` — mapare liga → pattern fișier (ex: "Premier League" → "PremierLeague")
- `normalizeName(teamName)` — normalizare nume echipă (scoate prefixe FC, FK etc.)

### 2.4 Notificări

#### `email-notifier.js` — Notificator principal
- **Trigger**: STATS_MONITOR când detectează pattern cu probabilitate > threshold
- **Generează HTML** cu: pattern, statistici HT, info meci, tier, istoric echipă (ultimele 10 rezultate)
- **Apelează**: EMAIL_SERVICE (trimitere), NOTIFICATION_TRACKER (salvare)
- **Export**: `EmailNotifier` class, `notifyPattern(matchData, patternData, probability)`

#### `EMAIL_SERVICE.js` — Serviciu email centralizat
- Singleton, nodemailer cu Gmail SMTP (smtp.gmail.com:587)
- Credențiale din `NOTIFICATION_CONFIG.js`
- **Exports**: `send({ subject, html })`, `isAvailable()`, `sendTestEmail()`

#### `NOTIFICATION_CONFIG.js` — Configurare email
- Email expeditor: `smartyield365@gmail.com`
- Email destinatar: `mihai.florian@yahoo.com`
- App Password Gmail

#### `NOTIFICATION_TRACKER.js` — Bază de date notificări
- **Fișier**: `notifications_tracking.json` (~582KB, 232+ notificări)
- **Clasă singleton**: `NotificationTracker`
- **Structura unei notificări**:
```json
{
  "id": "uuid",
  "matchId": "jTySbsQE",
  "homeTeam": "Arsenal",
  "awayTeam": "Chelsea",
  "league": "ENGLAND: Premier League",
  "patternName": "PATTERN_1.3",
  "probability": 78,
  "tier": "TOP_1-5",
  "timestamp": 1762174800,
  "status": "MONITORING|COMPLETED|FAILED",
  "validationResult": "WON|LOST|UNKNOWN",
  "initialOdds": 1.85,
  "oddsAt150": null,
  "oddsAt200": null,
  "r2Goals": { "home": 1, "away": 0 }
}
```
- **Deduplicare**: pe `matchId` + `patternName`
- **Exports**: `addNotification()`, `updateNotification()`, `getTeamRecentHistory()`, `getTeamSuccessRate()`

#### `SYSTEM_NOTIFIER.js` — Alerte sistem
- Emailuri de sistem (nu pattern-uri)
- **Metode**: `sendStartupNotification()`, `sendHeartbeatNotification()`, `sendCrashNotification()`, `sendNoMatchesNotification()`
- **Folosit de**: WATCHDOG.js, API-SMART-5.js

#### `ODD_150_NOTIFIER.js` — Alert odds 1.50/2.00
- Email când odds-ul ajunge la 1.50 sau 2.00
- Tracking în `odds_validation_1.5.json`

#### `NOTIFICATION_MONITOR.js` — Daemon monitorizare notificări
- Verifică la fiecare 60 secunde toate notificările active
- Trackează: minutul curent, dacă meciul s-a terminat, odds

### 2.5 Monitorizare live

#### `STATS_MONITOR.js` — Daemon monitorizare HT (MODULUL CENTRAL)
- **Trigger**: pornit de API-SMART-5.js (comanda `monitor`)
- **Funcționare**: verifică programul la fiecare 1 minut
- **La momentul HT** (+53 min):
  1. Extrage statistici HT din FlashScore API
  2. Rulează `PatternChecker.checkAllPatterns()`
  3. Pentru fiecare pattern detectat → `PROCENTE_LOADER.getPatternProbabilityWithFallback()`
  4. Dacă probabilitate ≥ threshold → `email-notifier.notifyPattern()`
  5. Pornește `ODDS_MONITOR_SIMPLE` pentru meciul respectiv
  6. Verifică și serii consecutive (`PRE_MATCH_STREAKS.checkAndSendPreMatchEmails()`)
- **Threshold** (praguri bazate pe analiză rata gol R2, ~15.000 meciuri):
  - 85% — Ligi foarte slabe: Eliteserien (36.9% rata R2)
  - 80% — Ligi sub-medie: Belgium, Argentina, România, Championship, Greece, Portugal, Italia, Brazil
  - 75% — Standard (Serbia, Scotland, Turcia, Olanda, Elveția + restul)
  - 70% — Competiții europene (Champions/Europa/Conference League)
  - **Penalizare xG**: +10% dacă xG echipei > 0 și < 0.5 (xG=0 = indisponibil, fără penalizare)
  - **Penalizare diferență tier**: +5% LOW vs TOP, +3% LOW vs MID / MID vs TOP
- **Export**: `monitorSchedule(scheduleFile)`

#### `FINAL_MONITOR.js` — Daemon monitorizare FT
- **Trigger**: pornit de API-SMART-5.js (comanda `finalmonitor`)
- La momentul FT (+120 min): extrage statistici finale → salvează în baza de date sezon
- **Dependențe**: FINAL_STATS_EXTRACTOR, CHAMPIONSHIP_JSON_MANAGER

#### `ODDS_MONITOR_SIMPLE.js` — Monitorizare odds
- Verifică odds la fiecare 2 minute
- Sursă: Superbet API
- Detectează când odds ajunge la 1.50 sau 2.00
- **State persistent**: salvează `sentThresholds` și `consecutiveFailures` în `data/odds_monitor_state.json`, restaurează la restart (doar din aceeași zi) — previne emailuri duplicate
- **Export**: `SimpleOddsMonitor` class, `start()`

### 2.6 Validare rezultate

#### `AUTO_VALIDATOR.js` — Validare automată
- Rulează la fiecare 6 ore (daemon separat)
- Verifică toate notificările cu status MONITORING
- Condiție: meciul terminat + minim 3 ore de la notificare
- Apelează `RESULTS_VALIDATOR.validateNotification()`
- Actualizează `notifications_tracking.json`
- **Exports**: `validatePendingNotifications()`, `startAutoValidation(intervalSeconds)`

#### `RESULTS_VALIDATOR.js` — Validare individuală
- **Logică**: verifică dacă echipa/meciul a marcat în R2
  - Goluri R2 = goluri_final - goluri_pauza
  - Pattern de echipă (gazda/oaspete): goluri_R2 > 0 → WON
  - Pattern de meci: oricare goluri_R2 > 0 → WON
- Caută date FT în: `daily_collected_*.json`, `complete_FULL_SEASON_*.json`
- **Export**: `ResultsValidator` class, `validateNotification(notification)`

### 2.7 Rapoarte

#### `DAILY_REPORT_GENERATOR.js` — Generator raport zilnic
- Agregare notificări pe ziua anterioară
- Calculează: total predicții, success rate, won/lost/unknown
- Output: HTML cu tabel detaliat
- **Export**: `generateDailyReport(targetDate)`

#### `SEND_DAILY_REPORT.js` — Trimitere raport zilnic
- **Export**: `sendDailyReport(targetDate)`

#### `PRONOSTICS_REPORT.js` — Raport master toate predicțiile
- Generează: `pronostics-history.json` + `pronostics-history.md`
- Categorii: won/lost/unknown/legacy/pending
- Success rate per pattern, per ligă, per tier
- **Export**: `generate()`

#### `WEEKLY_REPORT_GENERATOR.js` / `MONTHLY_REPORT_GENERATOR.js`
- Agregate pe perioadă mai lungă, similar cu daily

### 2.8 Recalculare probabilități

#### `RECALCULATE_ALL.js` — Recalculare completă (6 module)
- **Rulare**: `node RECALCULATE_ALL.js` (~10 secunde)
- **Sursă date**: `data/seasons/` (135 fișiere, ~20.500 meciuri, 43 ligi, 2022-2026)
- **Flux**:
  1. Încarcă toate fișierele sezon
  2. Grupează per ligă, deduplică pe `id_meci`
  3. Sortează cronologic
  4. Calculează clasament simulat
  5. Backup fișiere existente
  6. Rulează 6 module
  7. Salvează 6 JSON-uri
  8. Afișează comparație vechi vs nou

**Modul 1 — PROCENTE HT**:
- Pentru fiecare meci cu statistici HT complete:
  - Construiește `matchData` → `PatternChecker.checkAllPatterns()`
  - Determină tier echipă din clasament simulat
  - Verifică succes = gol R2 (goluri_final - goluri_pauza > 0)
  - Pattern de meci → înregistrat în TOATE tier-urile
  - Pattern de echipă → înregistrat doar în tier-ul echipei
- Tier-uri (4 nivele): TOP/MID/LOW/BOTTOM — config per tip campionat
- Output: `data/procente/JSON PROCENTE AUTOACTUAL.json`

**Modul 2 — STREAK CATALOG S01-S22**:
- 22 pattern-uri definite cu `getStat(meci, isHome)`, `threshold`, `nextThreshold`
- Pentru fiecare echipă, parcurge meciurile cronologic
- La fiecare serie de lungime N (3-7): verifică dacă meciul N+1 depășește `nextThreshold`
- Tier-uri (3 nivele): TOP/MID/LOW (`getSimpleTier`)
- Agregare: per ligă (perLeague) + global
- Output: `data/streak_patterns_catalog.json`
- **Structura**:
```json
{
  "patterns": {
    "S01": {
      "id": "S01",
      "global": {
        "3W": { "TOP": { "success": 45, "total": 52, "rate": 86.5 }, "MID": {...}, "LOW": {...} },
        "4W": {...}, "5W": {...}, "6W": {...}, "7W": {...}
      },
      "perLeague": {
        "ENGLAND: Premier League": {
          "3W": { "TOP": { "success": 5, "total": 6, "rate": 83.3 } }
        }
      }
    }
  }
}
```

**Module 3-6 — Serii specifice** (helper comun `calculateStreakProbabilities()`):

| Modul | Fișier output | Threshold | Next | Serii |
|-------|--------------|-----------|------|-------|
| 3 | `scoring_streak_probabilities.json` | 2+ goluri | 1+ gol | 3-5W |
| 4 | `goal_streak_probabilities.json` | 1+ gol | 1+ gol | 5-10W |
| 5 | `yellow_cards_streak_probabilities.json` | 3+ cartonașe | 2+, 3+ | 3-5W |
| 6 | `yellow_cards_2plus_streak_probabilities.json` | 2+ cartonașe | 1+, 2+ | 3-7W |

- **Structura output module 3-4** (threshold unic):
```json
{
  "global": {
    "3W": { "TOP": { "scored": 45, "total": 52, "rate": 86.5 }, "MID": {...}, "LOW": {...} }
  },
  "perLeague": {
    "ENGLAND: Premier League": { "3W": { "TOP": {...} } }
  }
}
```

- **Structura output module 5-6** (threshold-uri multiple):
```json
{
  "threshold_3plus": {
    "global": { "3W": { "TOP": {...} } },
    "perLeague": {...}
  },
  "threshold_2plus": {
    "global": {...},
    "perLeague": {...}
  }
}
```

#### `GENERATE_ALL_PROCENTE.js` — Generator legacy
- Versiunea veche, standalone, doar pentru Modul 1
- Citea din SMART 4 + SMART 5
- **Înlocuit de** `RECALCULATE_ALL.js` (care include și SMART 4 migrat)

### 2.9 Odds & Betting

#### `ODDS_MONITOR_SIMPLE.js` — Monitorizare odds live
- Verifică la fiecare 2 minute
- Sursă: Superbet API
- Salvează milestones (1.50, 2.00) în `odds_validation_1.5.json`

#### `SUPERBET_ODDS_INTEGRATION.js` / `SUPERBET_LIVE_SCRAPER_FINAL.js`
- Integrare API/scraping Superbet pentru odds live
- Director extern: `../superbet-analyzer/`

#### `BUDGET_MANAGER.js` — Gestiune buget
- Calcul stake bazat pe odds + probabilitate

### 2.10 Utilități

#### `LIFECYCLE_MANAGER.js` — Gestiune timere
- Wrapper centralizat pentru `setInterval`/`setTimeout`
- Previne memory leaks (previne timere orfane)
- Tracking active: `setInterval()`, `setTimeout()`, `clearInterval()`, `clearTimeout()`

#### `LOG_MANAGER.js` — Logging (Winston)
- Rotare: 20MB per fișier, max 14 fișiere
- Output: consolă + `logs/combined.log` + `logs/error.log`
- **Export**: `info()`, `error()`, `warn()`, `debug()`

#### `MEMORY_THROTTLE.js` — Monitorizare memorie
- Warn la 85%, critical la 90%
- **Export**: `check()`

#### `SAFE_FILE_WRITER.js` — Scriere atomică fișiere
- Previne corupție la scriere concurentă

---

## 3. STRUCTURA DATELOR (data/)

### 3.1 Fișiere sezon (`data/seasons/`)

~135 fișiere JSON, ~20.500 meciuri unice, 43 ligi, sezoane 2022-2026.

**Convenție nume**: `complete_FULL_SEASON_{Liga}_{Sezon}.json`
- Ex: `complete_FULL_SEASON_PremierLeague_2024-2025.json`
- Playoff/Playout: `complete_FULL_SEASON_ROMANIASuperligaChampionshipGroup_2025-2026.json`, `complete_FULL_SEASON_ROMANIASuperligaRelegationGroup_2025-2026.json`
- Date migrate: `complete_FULL_SEASON_PremierLeague_SMART4.json`

**Structura unui fișier sezon**:
```json
{
  "campionat": {
    "nume_complet": "ENGLAND: Premier League",
    "tara": "ENGLAND",
    "sezon": "2024-2025",
    "numar_echipe": 20,
    "sistem_organizare": "STANDARD"
  },
  "meciuri": [
    {
      "id_meci": "jTySbsQE",
      "echipa_gazda": { "nume": "Arsenal" },
      "echipa_oaspete": { "nume": "Chelsea" },
      "data_ora": { "data": "2024-09-15", "ora": "15:00" },
      "scor": {
        "pauza_gazda": 0, "pauza_oaspete": 0,
        "final_gazda": 2, "final_oaspete": 1
      },
      "statistici": {
        "suturi_pe_poarta": { "pauza_gazda": 4, "pauza_oaspete": 1, "total_gazda": 7, "total_oaspete": 3 },
        "total_suturi": { "pauza_gazda": 8, "pauza_oaspete": 3, "total_gazda": 15, "total_oaspete": 8 },
        "cornere": { "repriza_1_gazda": 3, "repriza_1_oaspete": 1, "total_gazda": 7, "total_oaspete": 3 },
        "cartonase_galbene": { "pauza_gazda": 1, "pauza_oaspete": 2, "total_gazda": 2, "total_oaspete": 3 },
        "cartonase_rosii": { "pauza_gazda": 0, "pauza_oaspete": 0 },
        "suturi_salvate": { "pauza_gazda": 1, "pauza_oaspete": 3 },
        "faulturi": { "pauza_gazda": 5, "pauza_oaspete": 7, "total_gazda": 10, "total_oaspete": 14 },
        "ofsaiduri": { "pauza_gazda": 1, "pauza_oaspete": 0 },
        "xG": { "pauza_gazda": 0.85, "pauza_oaspete": 0.12 },
        "posesie": { "pauza_gazda": 62, "pauza_oaspete": 38 }
      }
    }
  ]
}
```

### 3.2 Probabilități (`data/procente/`)

**`JSON PROCENTE AUTOACTUAL.json`** (~1.2MB)
- Generat de: RECALCULATE_ALL.js (Modul 1)
- Consumat de: PROCENTE_LOADER.js
- Structura: vezi secțiunea PROCENTE_LOADER

### 3.3 Catalog serii (`data/`)

| Fișier | Generat de | Consumat de | Dimensiune |
|--------|-----------|-------------|------------|
| `streak_patterns_catalog.json` | RECALCULATE_ALL (Modul 2) | PRE_MATCH_STREAKS → getCatalogProb() | ~1.1MB |
| `scoring_streak_probabilities.json` | RECALCULATE_ALL (Modul 3) | WINNING_STREAK → getScoringStreakStats() | ~24KB |
| `goal_streak_probabilities.json` | RECALCULATE_ALL (Modul 4) | WINNING_STREAK → getGoalStreakStats() | ~47KB |
| `yellow_cards_streak_probabilities.json` | RECALCULATE_ALL (Modul 5) | Funcții cartonașe | ~50KB |
| `yellow_cards_2plus_streak_probabilities.json` | RECALCULATE_ALL (Modul 6) | Funcții cartonașe | ~99KB |

### 3.4 Tracking & State

| Fișier | Scris de | Citit de |
|--------|---------|---------|
| `notifications_tracking.json` | NOTIFICATION_TRACKER | AUTO_VALIDATOR, RAPOARTE |
| `odds_validation_1.5.json` | ODDS_MONITOR_SIMPLE | ODD_150_NOTIFIER |
| `meciuri-YYYY-MM-DD.json` | DAILY_MATCHES | GENERATE_*_SCHEDULE, PRE_MATCH_STREAKS |
| `verificari-YYYY-MM-DD.json` | GENERATE_CHECK_SCHEDULE | STATS_MONITOR |
| `final-verificari-YYYY-MM-DD.json` | GENERATE_FINAL_SCHEDULE | FINAL_MONITOR |
| `daily_collected_YYYY-MM-DD.json` | DAILY_FINAL_DATA_COLLECTOR | RESULTS_VALIDATOR |
| `data/pre_match_streaks_YYYY-MM-DD.json` | PRE_MATCH_STREAKS | checkAndSendPreMatchEmails |
| `pronostics-history.json` + `.md` | PRONOSTICS_REPORT | Rapoarte |
| `.crash-state.json` | WATCHDOG | WATCHDOG |
| `.no-matches-today.flag` | API-SMART-5 | WATCHDOG |

---

## 4. TIER-URI ȘI CLASAMENT

### Tier-uri 4 nivele (PROCENTE HT)

Configurate per tip campionat în `TIER_CONFIGS`:

| Config | Nr echipe | Tier-uri | Ligi |
|--------|-----------|----------|------|
| standard_18-20 | 18-20 | TOP_1-5, MID_6-10, LOW_11-15, BOTTOM_16-20 | Premier League, La Liga, Serie A, Bundesliga, Ligue 1, Eredivisie |
| standard_18 | 18 | TOP_1-5, MID_6-10, LOW_11-15, BOTTOM_16-18 | Liga Portugal, Austria Bundesliga |
| standard_12-16 | 12-16 | TOP_1-4, MID_5-8, LOW_9-12, BOTTOM_13-16 | Belgia, etc. |
| denmark | 12 | TOP_1-3, MID_4-6, LOW_7-9, BOTTOM_10-12 | Superliga Danemarca |
| champions_league | 32-36 | TOP_1-8, MID_9-24, BOTTOM_25-36 | CL, EL, Conference |

Mapping explicit în `LEAGUE_TIER_MAP`, fallback pe număr echipe.

### Tier-uri 3 nivele (SERII)

Funcția `getSimpleTier(position, totalTeams)`:
- **TOP**: prima treime din clasament
- **MID**: treimea din mijloc
- **LOW**: ultima treime

### Clasament simulat

`getSimulatedStandings(meciuri)`:
- Calculat din rezultate (nu din `pozitie_clasament` din fișier)
- 3 puncte victorie, 1 punct egal
- Sortat descrescător pe puncte

---

## 5. CONSTANTE ȘI PRAGURI

| Constantă | Valoare | Unde |
|-----------|---------|------|
| Threshold ligi foarte slabe (Eliteserien) | 85% | STATS_MONITOR |
| Threshold ligi sub-medie (BEL/ARG/RO/GRE/POR/ITA/BRA/Championship) | 80% | STATS_MONITOR |
| Threshold standard | 75% | STATS_MONITOR |
| Threshold competiții europene | 70% | STATS_MONITOR |
| Penalizare xG < 0.5 (>0) | +10% | STATS_MONITOR |
| Penalizare tier LOW vs TOP | +5% | STATS_MONITOR |
| Penalizare tier LOW vs MID / MID vs TOP | +3% | STATS_MONITOR |
| Offset verificare HT | +53 min | GENERATE_CHECK_SCHEDULE |
| Offset verificare FT | +120 min | GENERATE_FINAL_SCHEDULE |
| Interval verificare schedule | 1 minut | STATS_MONITOR, FINAL_MONITOR |
| Interval verificare odds | 2 minute | ODDS_MONITOR_SIMPLE |
| Interval health check watchdog | 3 minute | WATCHDOG |
| Interval heartbeat | 3 ore | WATCHDOG |
| Interval auto-validare | 6 ore | AUTO_VALIDATOR |
| Vârstă minimă pentru validare | 3 ore | AUTO_VALIDATOR |
| Memory warning | 85% | WATCHDOG |
| Memory critical (restart) | 90% | WATCHDOG |
| Max restarts/oră | 2 | WATCHDOG |
| Cache TTL (serii) | 1 oră | WINNING_STREAK |
| Deduplicare notificări | matchId + patternName | NOTIFICATION_TRACKER |
| Log rotation | 20MB/fișier, 14 fișiere | LOG_MANAGER |
| Eșantion minim streak | 5 cazuri | getCatalogProb, getStreakStats |
| Serii streak catalog | 3W-7W | RECALCULATE_ALL Modul 2 |
| Serii scoring streak | 3W-5W | RECALCULATE_ALL Modul 3 |
| Serii goal streak | 5W-10W | RECALCULATE_ALL Modul 4 |

---

## 6. PROCESE ȘI PORNIRE

### Procese care rulează permanent

```bash
# 1. Procesul principal (pornit manual sau prin cron)
node API-SMART-5.js full

# 2. Watchdog (proces separat)
node WATCHDOG.js

# 3. Auto-validator (daemon separat)
node start-auto-validator.js
```

### Cron jobs

```
0 8 * * *  /home/florian/API\ SMART\ 5/RUN_DAILY_MATCHES.sh     # Lista meciuri
0 8 * * *  node DAILY_REPORT_SCHEDULER.js                         # Raport zilnic
```

### Recalculare (manuală, periodic)

```bash
node RECALCULATE_ALL.js    # Recalculează toate probabilitățile (~10s)
```

---

## 7. DEPENDENȚE EXTERNE

| Pachet | Folosit pentru |
|--------|---------------|
| nodemailer | Trimitere email (Gmail SMTP) |
| winston | Logging cu rotare |
| puppeteer | Scraping clasamente FlashScore |
| node-cron | Scheduling rapoarte |
| axios | HTTP requests (FlashScore API) |

**Integrări externe**:
- **FlashScore API** (ninja endpoint) — date meciuri, statistici, scoruri
- **Gmail SMTP** — trimitere emailuri (smtp.gmail.com:587)
- **Superbet API** — odds live (opțional)

---

## 8. NORMALIZARE NUME

### Ligi (PROCENTE_LOADER normalizeLeagueName)
```
"Premier League"           → "ENGLAND: Premier League"
"La Liga"                  → "SPAIN: LaLiga"
"Serie A"                  → "ITALY: Serie A"
"Bundesliga"               → "GERMANY: Bundesliga"
"Ligue 1"                  → "FRANCE: Ligue 1"
"Eredivisie"               → "NETHERLANDS: Eredivisie"
"Champions League"         → "EUROPE: Champions League - League phase"
"Conference League"        → "EUROPE: Conference League - League phase"
```

### Ligi → Pattern fișier (WINNING_STREAK leagueToFilePattern)
```
"Premier League"           → "PremierLeague"
"La Liga"                  → "LaLiga"
"Serie A" (Italy)          → "SerieA"
"Bundesliga"               → "Bundesliga"
"Championship"             → "ENGLANDChampionship"
"Superliga" (Romania)      → "ROMANIASuperliga"
"Super Lig" (Turkey)       → "TURKEYSuperLig"
```

### Echipe (normalizeName)
- Lowercase + trim + remove duplicate spaces
- Scoate prefixe: FC, FK, CS, CSM, FCV, FCS, AFC, SC, AS, AC, CF
- Scoate sufixe: FC, FK, CS

---

## 9. DIAGRAMĂ COMPLETĂ DEPENDENȚE

```
                        ┌─────────────────┐
                        │  API-SMART-5.js  │ ← Entry point
                        └──────┬──────────┘
                               │
              ┌────────────────┼────────────────┐
              ▼                ▼                ▼
     DAILY_MATCHES    GEN_CHECK_SCHEDULE    GEN_FINAL_SCHEDULE
     (FlashScore API)  (meciuri.json)       (meciuri.json)
              │                │                │
              ▼                ▼                ▼
     meciuri-DATE.json  verificari.json   final-verificari.json
                               │                │
                               ▼                ▼
                        STATS_MONITOR      FINAL_MONITOR
                               │                │
                    ┌──────────┼──────┐         ▼
                    ▼          ▼      ▼    FINAL_STATS_EXTRACTOR
             FlashScore   pattern-  PROCENTE       │
              API         checker   LOADER         ▼
                    │         │      │     CHAMPIONSHIP_JSON_MGR
                    │         ▼      │         │
                    │    Patterns    │         ▼
                    │    detectate   │    complete_FULL_SEASON_*.json
                    │         │      │
                    │    ┌────┴────┐ │
                    │    │ prob>70%│ │
                    │    └────┬────┘ │
                    │         ▼      │
                    │   email-notifier
                    │         │
                    │    ┌────┴────────────┐
                    │    ▼                 ▼
                    │  EMAIL_SERVICE   NOTIFICATION_TRACKER
                    │  (Gmail SMTP)   (notifications_tracking.json)
                    │                      │
                    │                      ▼
                    │               AUTO_VALIDATOR (6h)
                    │                      │
                    │                      ▼
                    │              RESULTS_VALIDATOR
                    │              (verifică gol R2)
                    │
                    └──── ODDS_MONITOR ──→ odds_validation_1.5.json

    Paralel:
    ┌──────────┐     ┌────────────────┐     ┌─────────────────┐
    │ WATCHDOG │     │ AUTO_VALIDATOR │     │ REPORT_SCHEDULER│
    │ (3 min)  │     │   (6 ore)      │     │   (08:00)       │
    └──────────┘     └────────────────┘     └─────────────────┘

    Recalculare (manuală):
    ┌──────────────────┐
    │ RECALCULATE_ALL  │
    │ (6 module)       │
    │                  │
    │ data/seasons/*   │ ← input
    │       ↓          │
    │ 6 JSON outputs   │ ← output
    └──────────────────┘
```

---

## 10. MIGRARE API SMART 4

Datele istorice din `../API SMART 4/` (12 fișiere `JSON-*.json`) au fost migrate în `data/seasons/` ca fișiere `complete_FULL_SEASON_*_SMART4.json`. Conțin 3.267 meciuri unice (sezoane 2023-2025). RECALCULATE_ALL.js nu referă API SMART 4 — totul e self-contained în `data/seasons/`.

**Fișiere migrate**: AUSTRIABundesliga, Bundesliga, CYPRUSFirstDivision, Superliga (DK), Eredivisie, LaLiga, Ligue1, PrimeiraLiga, PremierLeague, ROMANIASuperliga, SerieA.
