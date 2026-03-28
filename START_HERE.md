# 🚀 API SMART 5 - START HERE

## 📚 Documentație Completă

**Citește ÎNTÂI:**
1. **`DOCUMENTATIE-COMPLETA-API-SMART-5.md`** - TOTUL despre sistem (3300+ linii)
2. **`README_API_SMART_5.md`** - Rezumat rapid și ghid utilizare
3. **`CHANGELOG_01_02_2026.md`** - Ultimele îmbunătățiri

---

## ⚡ Start Rapid

### Pornire Sistem
```bash
cd "/home/florian/API SMART 5"
node API-SMART-5.js full
```

### Verificare Status
```bash
ps aux | grep "API-SMART-5"
tail -50 logs/combined.log
```

### Oprire Sistem
```bash
pkill -f "API-SMART-5"
```

---

## 📊 Ce Face Sistemul?

```
┌──────────────────────────────────────────┐
│  1. GENERARE MECIURI ZILNICE             │
│     → Colectează din FlashScore          │
│     → Doar TOP 30 ligi                   │
│     → ~59 meciuri/zi                     │
└──────────────────────────────────────────┘
                   ↓
┌──────────────────────────────────────────┐
│  2. STATS MONITOR (la pauză - HT)        │
│     → Detectează pattern-uri             │
│     → Email cu pronostic                 │
│     → Status: MONITORING                 │
└──────────────────────────────────────────┘
                   ↓
┌──────────────────────────────────────────┐
│  3. SIMPLE ODDS MONITOR (la 2 min)       │
│     → Detectare INTELIGENTĂ cote         │
│     → Email la cota 1.5                  │
│     → Email la cota 2.0                  │
│     → Salvare pentru validare            │
└──────────────────────────────────────────┘
                   ↓
┌──────────────────────────────────────────┐
│  4. AUTO-VALIDATOR (la 6h)               │
│     → Verifică rezultate finale          │
│     → Validează pronosticuri             │
│     → Calculează rata succes             │
└──────────────────────────────────────────┘
```

---

## 🎯 Funcționalități Cheie (v5.1)

✅ **SISTEM INTELIGENT** - Detectare automată cote (Pattern → Prag + Echipă)
✅ **PROTECȚIE DUPLICATE** - Maxim 2 email-uri per meci (1.5 + 2.0)
✅ **ARGENTINA & BRAZILIA** - Adăugate în TOP leagues
✅ **SALVARE AUTOMATĂ** - odds_validation_1.5.json pentru validare
✅ **71 PATTERN-URI** - Probabilități calculate istoric
✅ **MONITORIZARE 24/7** - Automat, zero intervenție

---

## 📁 Fișiere Importante

| Fișier | Descriere |
|--------|-----------|
| `API-SMART-5.js` | **MAIN** - Pornește tot sistemul |
| `ODDS_MONITOR_SIMPLE.js` | Monitorizare cote (2 min) |
| `STATS_MONITOR.js` | Monitorizare meciuri la pauză |
| `TOP_LEAGUES.js` | Whitelist ligi (TOP 30) |
| `notifications_tracking.json` | TOATE notificările |
| `odds_validation_1.5.json` | Pronosticuri pentru validare |
| `meciuri-YYYY-MM-DD.json` | Lista meciuri zilnică |

---

## 🔧 Troubleshooting

### Problema: Nu se trimit email-uri
```bash
# Test email
node -e "require('./EMAIL_SERVICE').sendTestEmail()"
```

### Problema: Meciuri Argentina nu apar
```bash
# Regenerează lista
node GENERARE_MECIURI_ZI.js
```

### Problema: Cote greșite
```bash
# Verifică detectare inteligentă în log-uri
tail -100 logs/combined.log | grep "Detectat prag"
```

---

## 📧 Contact & Suport

**Log-uri:** `tail -f logs/combined.log`
**Erori:** `tail -100 logs/combined.log | grep -i error`
**Status:** `ps aux | grep API-SMART-5`

---

**Versiune:** 5.1
**Data:** 01.02.2026
**Status:** ✅ PRODUCTION READY

**🎯 Citește documentația completă pentru detalii! 📚**
