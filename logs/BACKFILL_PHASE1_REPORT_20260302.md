# BACKFILL PHASE 1 - RAPORT COMPLET
## Data: 02.03.2026

### Timeline
- **01:15** - Night ops pornit, așteptare meciuri active (20 min)
- **01:25** - Monitor restartat (PID 382529), DAILY_MASTER oprit, fix sendEmail activ
- **01:25** - Phase 1 pornit
- **03:16** - Premier League terminat
- **03:17** - LaLiga + Bundesliga terminate
- **03:43** - Serie A + Ligue 1 terminate
- **03:44-03:45** - Eredivisie, Portugal terminate
- **03:45** - Belgium EROARE (liga negăsită în config)
- **03:46** - Turkey terminat, Scotland pornit
- **03:46-12:14** - Scotland BLOCAT ~8.5 ore (browser Puppeteer înghețat)
- **12:14** - Scotland deblocat manual (kill -9), continuare automată
- **12:14-12:18** - Austria, Denmark, Switzerland, Greece, Romania procesate rapid

### Rezultate Phase 1 - MatchIds Descoperite

| # | Campionat | Sezon 2024-2025 | Sezon 2023-2024 | Total NOI |
|---|-----------|-----------------|-----------------|-----------|
| 1 | ENGLAND: Premier League | 0 (381 existente) | 103 | **103** |
| 2 | SPAIN: LaLiga | 107 | 106 | **213** |
| 3 | GERMANY: Bundesliga | 0 (200 existente) | 104 | **104** |
| 4 | ITALY: Serie A | 105 | 105 | **210** |
| 5 | FRANCE: Ligue 1 | 108 | 109 | **217** |
| 6 | NETHERLANDS: Eredivisie | 104 | 104 | **208** |
| 7 | PORTUGAL: Liga Portugal | 106 | 103 | **209** |
| 8 | TURKEY: Super Lig | 107 | 106 | **213** |
| 9 | SCOTLAND: Premiership | 106 | 103 | **209** |
| 10 | AUSTRIA: Bundesliga | 106 | 105 | **211** |
| 11 | DENMARK: Superliga | 108 | 103 | **211** |
| 12 | SWITZERLAND: Super League | 104 | 104 | **208** |
| 13 | GREECE: Super League | 104 | 107 | **211** |
| 14 | ROMANIA: Superliga | 103 | ~105 (în curs) | **~208** |
| | **TOTAL** | | | **~2,935** |

### Nescanate (rămase de făcut)
- BELGIUM: Jupiler Pro League - EROARE: "Liga nu a fost gasită în config" (numele din config nu se potrivește cu cel din script)
- SERBIA: Mozzart Bet Super Liga (2 sezoane)
- POLAND: Ekstraklasa (2 sezoane)
- ENGLAND: Championship (2 sezoane)
- GERMANY: 2. Bundesliga (2 sezoane)
- SPAIN: LaLiga2 (2 sezoane)
- NORWAY: Eliteserien (1 sezon)
- SWEDEN: Allsvenskan (1 sezon)
- BRAZIL: Serie A (2 sezoane)
- ARGENTINA: Liga Profesional (2 sezoane)
- UEFA: Champions League (1 sezon)
- UEFA: Europa League (1 sezon)
- UEFA: Conference League (1 sezon)
**Total nescanat: ~18 combinații campionat+sezon**

### Observații importante
1. **FlashScore returnează doar ~100-110 meciuri per pagină** (nu toate 300-380). Butonul "Show more" nu a fost clickat cu succes la Scotland (0 clickuri) - probabil trebuie verificat selectorul CSS.
2. **Scotland s-a blocat 8.5 ore** - browser Puppeteer hung. Trebuie adăugat timeout per campionat (max 5 min).
3. **Belgium a eșuat** - numele din config ("BELGIUM: Jupiler Pro League") nu se potrivește cu ce e în BACKFILL_LEAGUE_CONFIG.js. De verificat.
4. **Meciurile 2023-2024 se salvează în fișierul greșit** (ex: PremierLeague_2025-2026.json în loc de PremierLeague_2023-2024.json). BUG CRITIC - de fixat urgent.
5. **Premier League 2024-2025 deja completă** (381 meciuri). Bundesliga 2024-2025 parțial (200 meciuri).

### Phase 2 Status
- Pornit în paralel la 12:25
- 16/200 meciuri procesate până la 12:27
- ~4s per meci (HTTP API, fără browser)
- BUG: salvează în sezonul greșit (de fixat!)
