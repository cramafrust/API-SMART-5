# 📁 DATA FOLDER - API SMART 5

Acest folder centralizează toate datele JSON folosite de API SMART 5.

## 📊 Structură

```
data/
├── seasons/          # JSON-uri cu date complete de sezoane
│   ├── complete_FULL_SEASON_*.json
│   └── ... (40 fișiere)
├── procente/         # JSON-uri cu procente de reușită pattern-uri
│   └── JSON PROCENTE AUTOACTUAL.json
└── README.md         # Acest fișier
```

## 📋 Descriere Foldere

### `seasons/` (40 fișiere)
Conține JSON-uri cu date complete pentru toate campionatele:
- **Premier League** - Anglia
- **La Liga** - Spania
- **Serie A** - Italia
- **Bundesliga** - Germania
- **Ligue 1** - Franța
- **Championship** - Anglia (liga secundă)
- **Eredivisie** - Olanda
- **Primeira Liga** - Portugalia
- **Poland Ekstraklasa** - Polonia
- **Belgium** - Belgia (Jupiler Pro League + Challenger)
- **Austria Bundesliga** - Austria
- **Romania SuperLiga** - România
- **Greece Super League** - Grecia
- **Turkey Süper Lig** - Turcia
- **Serbia** - Serbia
- **Norway Eliteserien** - Norvegia
- **Scotland Premiership** - Scoția
- **Switzerland Super League** - Elveția
- **Sweden Allsvenskan** - Suedia
- **Champions League** - UEFA
- **Europa League** - UEFA
- **Conference League** - UEFA
- **Copa Sudamericana** - America de Sud
- **Brazil Serie A** - Brazilia
- **USA MLS** - SUA

### `procente/` (1 fișier)
Conține JSON cu procente de reușită pentru toate cele 71 pattern-uri:
- **JSON PROCENTE AUTOACTUAL.json** - Procente calculate pe baza istoricului

## 🔄 Sursă Date

Datele au fost copiate din:
- `/home/florian/football-analyzer/` - 20+ fișiere
- `/home/florian/API SMART 4/` - 15+ fișiere

**IMPORTANT:** Fișierele originale NU au fost șterse, doar copiate.

## ⚙️ Scripturi Care Folosesc Aceste Date

- **PROCENTE_LOADER.js** - Încarcă `data/procente/JSON PROCENTE AUTOACTUAL.json`
- **API-SMART-5.js** - Script principal care folosește PROCENTE_LOADER
- **CHAMPIONSHIP_JSON_MANAGER.js** - Salvează meciuri noi în `data/seasons/`
- **DAILY_FINAL_DATA_COLLECTOR.js** - Colectează automat date finale zilnice în `data/seasons/`

## 📝 Note

- Fișierele de backup (cu *BACKUP* în nume) au fost excluse automat
- Toate fișierele sunt în format JSON valid
- Data ultimei actualizări JSON PROCENTE: **8 noiembrie 2025, 12:57:10**

## 🔧 Mentenanță

Pentru a actualiza datele:
1. Rulați scripturile de extragere din `football-analyzer`
2. Copiați noile JSON-uri în `data/seasons/`
3. Actualizați `data/procente/JSON PROCENTE AUTOACTUAL.json` cu noi procente

---

**Data creării structurii:** 24 noiembrie 2025
**Autor:** Claude Code + Florian
