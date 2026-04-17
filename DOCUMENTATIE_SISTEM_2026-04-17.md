# API SMART 5 — Documentație Sistem Completă
**Data:** 17 aprilie 2026

---

## 1. CE FACE SISTEMUL

Monitorizare automată meciuri fotbal din ~50 ligi mondiale:
- Detectează ~95 pattern-uri statistice la pauza fiecărui meci
- Calculează probabilitatea ca echipa să marcheze în repriza 2
- Trimite notificări email dacă probabilitatea > prag
- Validează automat dacă predicțiile au fost corecte
- Generează rapoarte zilnice, săptămânale, lunare

## 2. CIFRE ACTUALE

| Metric | Valoare |
|--------|---------|
| **Notificări HT trimise** | 431 |
| **Câștigate (WON)** | 296 |
| **Pierdute (LOST)** | 133 |
| **Win Rate HT** | **69%** |
| **Predicții prematch** | 1431 |
| **Fișiere sezon** | 149 |
| **Ligi monitorizate** | 51 |
| **Meciuri în baza de date** | 34.689 |
| **Sezoane acoperite** | 6 (2021-2026) |
| **Pattern-uri** | 95+ (P0-P25 + S01-S22) |

## 3. PROCES UNIC: `node API-SMART-5.js all`

Un singur proces care include:
- **WATCHDOG** — health check intern
- **AUTO-VALIDATOR** — validare automată la 6h
- **FULL workflow** — daily matches + schedule + HT monitor
- **Report scheduler** — rapoarte automate

**Crontab:**
- `@reboot` — pornire automată la boot
- `0 8 * * *` — restart zilnic la 08:00
- `0 7,9,11 * * *` — colectare meciuri terminate (ieri)
- `0 2 * * *` — auto git push
- `@reboot` — dashboard Next.js pe port 3001
- `@reboot` — cloudflared tunnel

## 4. STRUCTURA FIȘIERE

```
API SMART 5/
├── core/                          # Module unificate
│   ├── index.js                   # Export centralizat
│   ├── config.js                  # Path-uri + constante + praguri + ligi
│   ├── logger.js                  # Logging Winston
│   ├── notifications.js           # Tracking notificări
│   ├── patterns.js                # Detectare + probabilități
│   ├── seasons.js                 # Citire/scriere season files
│   └── anomaly.js                 # Detectare anomalii + auto-clean
│
├── data/
│   ├── seasons/                   # Baza de date meciuri
│   │   ├── 2021-2022/             # ~20 fișiere
│   │   ├── 2022-2023/             # ~25 fișiere
│   │   ├── 2023-2024/             # ~25 fișiere
│   │   ├── 2024-2025/             # ~35 fișiere
│   │   └── 2025-2026/             # ~46 fișiere (sezon curent)
│   ├── procente/
│   │   └── PROCENTE_AUTOACTUAL.json  # 29 campionate × 95 pattern-uri × tieri
│   ├── streaks/                   # Probabilități serii consecutive
│   ├── tracking/
│   │   ├── notifications.json     # 431 notificări HT
│   │   └── prematch.json          # 1431 predicții prematch
│   └── daily/                     # ~150 subdirectoare (o zi = un folder)
│       └── YYYY-MM-DD/
│           ├── meciuri.json
│           ├── verificari.json
│           └── collected.json
│
├── reports/                       # Rapoarte HTML generate
│   ├── monthly-report-2026-01.html
│   ├── monthly-report-2026-02.html
│   ├── monthly-report-2026-03.html
│   └── weekly-report-*.html
│
├── logs/                          # Loguri (rotație 20MB × 14 fișiere)
│
├── API-SMART-5.js                 # Entry point principal (comanda: all)
├── WATCHDOG.js                    # Supervizor (integrat în all)
├── STATS_MONITOR.js               # Monitorizare HT (modulul central)
├── pattern-checker.js             # Detectare 95 pattern-uri
├── RECALCULATE_ALL.js             # Recalculare probabilități
├── AUTO_VALIDATOR.js              # Validare automată
├── PRE_MATCH_STREAKS.js           # Serii consecutive + emailuri prematch
├── email-notifier.js              # Notificări HT email
├── flashscore-api.js              # API client FlashScore
├── CHAMPIONSHIP_JSON_MANAGER.js   # Salvare date sezon
├── DAILY_MATCHES.js               # Generare listă meciuri zilnică
└── ... (~50 alte module)
```

## 5. PATTERN-URI

### Pattern-uri HT (la pauză) — per echipă:
| Pattern | Condiție | Predicție |
|---------|----------|-----------|
| P0.0 | Adversar roșu + șut pe poartă | Echipa marchează R2 |
| P1.0-1.6 | 3-9+ șuturi pe poartă, 0 gol | Echipa marchează R2 |
| P2.1-2.5 | 6-10+ total șuturi, 0 gol | Echipa marchează R2 |
| P4.5-4.8 | 5-8+ cornere, 0 gol | Echipa marchează R2 |
| P5.5-5.8 | 5-8+ (șuturi+cornere), 0 gol | Echipa marchează R2 |
| P10.1-10.3 | xG ≥0.8/1.2/1.5, 0 gol | Echipa marchează R2 |
| P11.1-11.3 | Posesie ≥65/70/75%, 0 gol | Echipa marchează R2 |
| P14 | Conduce norocos (adversar domină) | Adversarul marchează R2 |
| P16 | Ofsaiduri + presiune | Echipa marchează R2 |
| P17 | Salvări adversar ≥4, 0 gol | Echipa marchează R2 |
| P18 | Dominare totală | Echipa marchează R2 |

### Pattern-uri HT — per meci:
| Pattern | Condiție | Predicție | Win Rate |
|---------|----------|-----------|----------|
| P3.3/3.4/3.5+ | 3/4/5+ goluri HT | Gol în R2 | 81% |
| P9.3-9.7 | 3-7+ cartonașe HT | Cartonaș în R2 | 79% |
| P19 | Egal ≥1-1 & 6+ șuturi poartă | Gol în R2 | 81% |
| **P21** | Egal ≥1-1 & 10+ șuturi poartă | Gol în R2 | **92%** |
| **P22** | 1 gol HT & 6+ șuturi poartă | Gol în R2 | **82%** |
| **P23** | ≥2 goluri & 8+ șuturi poartă | Gol în R2 | **84%** |
| **P24** | 8+ cornere total | Gol în R2 | 81% |
| **P25** | Scor 2-0 sau 0-2 | Gol în R2 | 81% |

### Pattern-uri prematch (S01-S22):
| Pattern | Categorie | Predicție |
|---------|-----------|-----------|
| S01-S02 | GOLURI | Echipa marchează |
| S03-S04 | GOLURI PRIMITE | Echipa primește gol |
| S05 | GOLURI R1 | Echipa marchează în R1 |
| S06 | OVER TOTAL MECI | ≥2 goluri total |
| S07-S10 | CORNERE | Echipa are X+ cornere |
| S11-S14 | ȘUTURI PE POARTĂ | Echipa are X+ șuturi |
| S15-S17 | TOTAL ȘUTURI | Echipa trage X+ șuturi |
| S18-S20 | FAULTURI | Echipa comite X+ faulturi |
| S21-S22 | CARTONAȘE | Echipa primește X+ cartonașe |

## 6. PRAGURI

| Categorie | Prag | Ligi |
|-----------|------|------|
| 85% | Foarte slabe | Eliteserien (Norvegia) |
| 80% | Sub-medie | Belgium, Argentina, România, Championship, Greece, Portugal, Italia, Brazil |
| 75% | Standard | Serbia, Scotland, Turcia, Olanda, Elveția + restul |
| 70% | Competiții europene | Champions/Europa/Conference League |

**Penalizări:**
- xG < 0.5 (dar > 0): +10% la prag
- LOW vs TOP: +5% | LOW vs MID / MID vs TOP: +3%
- Minim 5 cazuri în baza de date (altfel nu trimite)

## 7. INFRASTRUCTURĂ

| Component | Unde | Status |
|-----------|------|--------|
| Proces principal | WSL (laptop) | ✅ Activ |
| Dashboard | localhost:3001 | ✅ Activ |
| Cloudflare Tunnel | trycloudflare.com | ✅ Activ (URL temporar) |
| GitHub | cramafrust/API-SMART-5 | ✅ Push automat zilnic |
| Email | Gmail (Nodemailer) | ✅ Funcțional |
| Backup local | tar.gz | ✅ Periodic |

## 8. DASHBOARD (Next.js)

Locație: `/home/florian/api-smart-5-dashboard/`

Pagini:
- **LIVE** — procese, meciuri azi (expandabil), notificări, prematch
- **ISTORIC** — grafice win rate, filtre checkbox ligi+tieri+pattern-uri cu won/total + DB stats
- **LOGURI** — live logs cu filtre, auto-refresh
- **CONTROL** — restart, recalculare, refresh, validare, rapoarte lunare
- **MECI** — detalii per meci (click din notificare)
