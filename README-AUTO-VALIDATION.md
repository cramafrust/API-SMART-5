# 🤖 AUTO-VALIDATION SYSTEM

## 📋 Descriere

Sistem automat de validare a pronosticurilor pentru toate notificările trimise.

**Workflow complet:**
1. La HT → Detectare pattern + Trimitere notificare (cu pronostic + cote)
2. După 3+ ore → AUTO-VALIDATOR verifică meciul
3. Extrage scor final → Validează pronostic → Salvează rezultat
4. Repeat la fiecare 6 ore pentru toate notificările nevalidate

---

## 🚀 Cum funcționează

### 1. Pornire automată

AUTO-VALIDATOR pornește **AUTOMAT** când rulezi API SMART 5:

```bash
node API-SMART-5.js full
# sau
node API-SMART-5.js monitor
```

### 2. Validare continuă

- **Interval**: La fiecare **6 ore**
- **Condiție**: Validează doar notificările **mai vechi de 3h**
- **Proces**: Rulează în background (daemon)
- **Logging**: `logs/auto-validator-YYYY-MM-DD.log`

### 3. Ce validează?

Pentru fiecare notificare:

**PATTERN 1, 2, 4, 7, 8**: Echipa marchează GOL în R2
- ✅ CÂȘTIGAT: Dacă echipa a marcat măcar 1 gol în repriza 2
- ❌ PIERDUT: Dacă echipa NU a marcat în repriza 2

**PATTERN 3**: Meciul are GOLURI în R2
- ✅ CÂȘTIGAT: Dacă oricare echipă a marcat în repriza 2
- ❌ PIERDUT: Dacă NU au fost goluri în repriza 2

**PATTERN 5, 6**: Echipa are CORNERE în R2
- ✅ CÂȘTIGAT: Dacă echipa a avut ≥2 cornere în repriza 2
- ❌ PIERDUT: Dacă echipa a avut <2 cornere în repriza 2
- ⚠️ NECUNOSCUT: Dacă statisticile cornere nu sunt disponibile

**PATTERN 9**: Cartonașe/Faulturi R2
- ⚠️ NECUNOSCUT: Momentan statisticile nu sunt disponibile

---

## 📊 Output validare

```
✅ CÂȘTIGAT
   Pattern: PATTERN_7.4.1
   Echipa: Al Wasl (Uae)
   Pronostic: Echipa marchează în R2
   Probabilitate: 83.33%
   💰 Cote:
      Superbet: 1.54 (Echipa marchează în R2)
      Netbet: 1.73 (Echipa marchează în R2)
   → Echipa a marcat 1 gol(uri) în R2 (HT: 1-1 → FT: 2-2)
   → Valoare reală: 1
```

---

## 📁 Fișiere generate

### 1. **notifications-tracking.json**
Toate notificările cu status validare:
```json
{
  "id": "matchId_timestamp",
  "timestamp": "2025-11-05T14:29:30.554Z",
  "match": { ... },
  "patterns": [ ... ],
  "result": { ... },
  "validated": true,
  "validatedAt": "2025-11-05T20:30:00.000Z"
}
```

### 2. **logs/auto-validator-YYYY-MM-DD.log**
Log complet cu toate validările:
```
[2026-01-26T19:41:37.000Z] 🤖 AUTO-VALIDATOR - START
[2026-01-26T19:41:37.000Z] 📊 Total notificări: 497
[2026-01-26T19:41:37.000Z] ⏳ Nevalidate: 485
[2026-01-26T19:41:37.000Z] ✅ Validate: 12
```

---

## ⚙️ Configurare

### Schimbă intervalul de validare

Editează `start-auto-validator.js`:

```javascript
// Default: 6 ore
const INTERVAL_SECONDS = 6 * 60 * 60;

// Pentru 3 ore:
const INTERVAL_SECONDS = 3 * 60 * 60;

// Pentru 12 ore:
const INTERVAL_SECONDS = 12 * 60 * 60;
```

### Schimbă timpul minim după notificare

Editează `AUTO_VALIDATOR.js`:

```javascript
// Default: 3 ore (meci HT + R2 + timp final)
const MIN_MATCH_AGE_HOURS = 3;

// Pentru 2 ore:
const MIN_MATCH_AGE_HOURS = 2;

// Pentru 4 ore:
const MIN_MATCH_AGE_HOURS = 4;
```

---

## 🔧 Comenzi manuale

### Validare single (o dată)
```bash
node API-SMART-5.js autovalidate
```

### Pornire daemon manual
```bash
node start-auto-validator.js
```

### Oprire daemon
```bash
# Găsește procesul
ps aux | grep start-auto-validator

# Oprește procesul
kill <PID>
```

### Vezi log-ul în timp real
```bash
tail -f logs/auto-validator-$(date +%Y-%m-%d).log
```

---

## 📈 Statistici

### Verifică statistici validare
```bash
node NOTIFICATIONS_TRACKER.js stats
```

Output:
```
📊 STATISTICI TRACKING NOTIFICĂRI
============================================================
📝 Total notificări: 497
✅ Validate: 150
⏳ În așteptare: 347

🎯 Rate succes: 78% (117/150)
```

### Raport performanță pe pattern-uri
```bash
node RESULTS_VALIDATOR.js report
```

### Export Excel cu toate datele
```bash
node export-to-excel.js
```

---

## 🎯 Best Practices

### 1. Pornire sistem complet
```bash
# Dimineața (08:00) - pornire completă
node API-SMART-5.js full
```

Aceasta pornește:
- ✅ Generare listă meciuri
- ✅ Monitorizare HT (pattern detection)
- ✅ AUTO-VALIDATOR (validare automată)

### 2. Verificare periodică
```bash
# La fiecare 12h - verifică log-urile
tail -100 logs/auto-validator-$(date +%Y-%m-%d).log

# Verifică statistici
node NOTIFICATIONS_TRACKER.js stats
```

### 3. Export date lunar
```bash
# La sfârșitul lunii - exportă Excel
node export-to-excel.js
```

---

## ❓ FAQ

### Q: Când sunt validate notificările?
**A:** Notificările sunt validate după minim 3 ore de la trimitere (pentru ca meciul să se termine), la fiecare 6 ore.

### Q: Ce se întâmplă dacă meciul nu s-a terminat?
**A:** AUTO-VALIDATOR îl sare și încearcă din nou la următoarea rulare (peste 6h).

### Q: Pot valida manual o notificare specifică?
**A:** Da, folosește:
```bash
node RESULTS_VALIDATOR.js match <matchId>
```

### Q: Pot schimba intervalul de validare?
**A:** Da, editează `start-auto-validator.js` și modifică `INTERVAL_SECONDS`.

### Q: Unde sunt salvate cotele?
**A:** Cotele sunt salvate în fiecare notificare în `notifications-tracking.json` sub `pattern.odds.superbet` și `pattern.odds.netbet`.

### Q: Ce fac cu notificările vechi (înainte de implementare)?
**A:** Poți valida toate notificările vechi manual:
```bash
node API-SMART-5.js autovalidate
```

---

## 🐛 Troubleshooting

### AUTO-VALIDATOR nu pornește
1. Verifică dacă API SMART 5 rulează:
```bash
ps aux | grep "API-SMART-5"
```

2. Verifică log-urile:
```bash
tail -50 logs/auto-validator-$(date +%Y-%m-%d).log
```

### Validările eșuează
1. Verifică conexiunea la FlashScore API
2. Verifică că `FINAL_STATS_EXTRACTOR.js` funcționează:
```bash
node FINAL_STATS_EXTRACTOR.js <matchId>
```

### Notificările nu sunt validate
1. Verifică că notificările sunt mai vechi de 3h
2. Verifică că meciurile s-au terminat
3. Rulează manual:
```bash
node API-SMART-5.js autovalidate
```

---

## 📞 Contact / Support

Pentru probleme sau întrebări:
- Verifică log-urile: `logs/auto-validator-*.log`
- Verifică tracking: `notifications-tracking.json`
- Rulează stats: `node NOTIFICATIONS_TRACKER.js stats`
