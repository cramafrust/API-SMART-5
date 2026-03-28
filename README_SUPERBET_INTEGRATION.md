# 🎯 SUPERBET LIVE ODDS - INTEGRARE CU API SMART 5

## 📌 QUICK START

Acest sistem extrage automat cote LIVE de la Superbet și le atașează în email-urile de notificare ale API SMART 5.

**Status:** ✅ **PRODUCTION READY** (Versiunea 2.0 - 3 Decembrie 2025)

---

## 🚀 UTILIZARE RAPIDĂ

### Sistemul rulează automat!

Nu trebuie să faci nimic - integrarea este **activă** și **automată**:

1. ✅ API SMART 5 detectează pattern-uri în meciuri LIVE
2. ✅ Sistemul extrage automat cote relevante de pe Superbet
3. ✅ Cotele sunt atașate în email-ul de notificare
4. ✅ Primești email cu pattern + cotă LIVE

---

## 📧 EXEMPLU EMAIL

```
📊 PATTERN_SUTURI_GAZDA: Echipa gazdă are multe șuturi pe poartă
   Probabilitate: 85%
   Tier: TOP_1-5 (Poziție 3)

   💰 COTE LIVE SUPERBET:

   📌 Manchester City peste 1.5 goluri
      Cotă: 1.70
      (Situație: 1 gol acum)

   📊 Situație actuală: 2 goluri total, 7 cornere, 2 cartonașe
```

---

## 🎯 CE COTE SE EXTRAG?

### Pentru pattern-uri **ECHIPĂ GAZDĂ**:
```
"Manchester City peste 1.5 goluri" → Cotă: 1.70
(Echipa are 1 gol, mai marchează ÎNCĂ UNU)
```

### Pentru pattern-uri **ECHIPĂ OASPETE**:
```
"Liverpool peste 1.5 goluri" → Cotă: 1.50
(Echipa are 1 gol, mai marchează ÎNCĂ UNU)
```

### Pentru pattern-uri **GENERALE** (meci):
```
"Încă un gol (peste 2.5)" → Cotă: 1.14
(Sunt 2 goluri total, mai marchează ÎNCĂ UNU indiferent de echipă)
```

### Pentru pattern-uri **CORNERE**:
```
"Încă 2 cornere (peste 8.5)" → Cotă: 1.85
(Sunt 7 cornere, mai sunt ÎNCĂ 2)
```

### Pentru pattern-uri **CARTONAȘE**:
```
"Încă un cartonaș (peste 3.5)" → Cotă: 2.10
(Sunt 3 cartonașe, mai este ÎNCĂ UNU)
```

---

## 📁 STRUCTURA FIȘIERE

```
/home/florian/
├── superbet-analyzer/
│   └── SUPERBET_LIVE_ODDS.js          # Modul principal extragere cote
│
└── API SMART 5/
    ├── SUPERBET_ODDS_INTEGRATION.js   # Wrapper integrare
    ├── email-notifier.js              # Email notifier (modificat)
    │
    ├── 📖 DOCUMENTAȚIE:
    ├── README_SUPERBET_INTEGRATION.md           # ⭐ ACEST FIȘIER
    ├── INTEGRARE_SUPERBET_LIVE.md               # Documentație completă
    ├── TEST_SCRIPTS_README.md                   # Ghid scripturi test
    └── CHANGELOG_SUPERBET_INTEGRATION.md        # Istoric modificări
    │
    └── 🧪 TESTE:
        ├── test-both-teams.js                   # ⭐ Test principal
        ├── debug-available-odds.js              # Debug cote
        ├── investigate-all-markets.js           # Explorare piețe
        └── test-realistic-patterns.js           # Test pattern-uri
```

---

## 🧪 TESTARE

### Test rapid (verifică că totul funcționează):

```bash
cd "/home/florian/API SMART 5"
node test-both-teams.js
```

**Output așteptat:**
```
✅ Event ID găsit: 11359110
✅ Găsite 3 cote relevante

📌 [PATTERN_GAZDA_SUTURI]
   Independiente Petrolero peste 1.5 goluri
   Cotă: 1.70

📌 [PATTERN_OASPETE_ATACURI]
   Guabira peste 1.5 goluri
   Cotă: 1.50

📌 [PATTERN_GOL_MECI]
   Încă un gol (peste 2.5)
   Cotă: 1.14
```

---

## 📖 DOCUMENTAȚIE DETALIATĂ

### 1. **INTEGRARE_SUPERBET_LIVE.md** (Documentație completă)
- Explicații tehnice detaliate
- Toate piețele suportate
- Workflow complet
- Troubleshooting

### 2. **TEST_SCRIPTS_README.md** (Ghid teste)
- Descriere fiecare script test
- Cum să modifici meciuri de test
- Interpretare rezultate
- Template teste noi

### 3. **CHANGELOG_SUPERBET_INTEGRATION.md** (Istoric)
- Toate modificările versiune 2.0
- Bugfix-uri
- Migration guide
- Teste efectuate

---

## 💡 FEATURES PRINCIPALE

### ✅ Extragere automată cote
- API SSE de la Superbet
- Cache Event ID (10 minute)
- Timeout 5 secunde

### ✅ Cote dinamice
- Calculare automată threshold bazat pe situație actuală
- Funcționează indiferent de scor
- Support pentru toate evenimentele

### ✅ Priorități exclusive
- Fiecare pattern afișează DOAR o singură cotă relevantă
- Fără duplicate
- Email-uri clare și concise

### ✅ Rezolvare problemă "Marchează DA"
- Cota "Echipa marchează DA" dispare după primul gol
- **Soluție:** Folosim "Total goluri echipă peste X.5"
- Funcționează indiferent dacă echipa a marcat sau nu

### ✅ Statistici detaliate
- Goluri total meci
- Goluri echipa gazdă
- Goluri echipa oaspete
- Cornere total
- Cartonașe total

---

## 🔧 TROUBLESHOOTING RAPID

### ❌ "Cote indisponibile" în test
**Cauze posibile:**
- Meciul nu este LIVE pe Superbet
- Numele echipelor nu match
- Cotele sunt suspendate

**Soluție:**
```bash
# Verifică cote disponibile
node debug-available-odds.js
```

### ❌ "Event ID not found"
**Cauze posibile:**
- Numele echipelor diferit de Superbet
- Cache învechit

**Soluție:**
- Verifică spelling exact
- Așteaptă 10 minute (cache expire)

### ❌ "Nu s-au găsit cote relevante"
**Cauze posibile:**
- Piața "Total goluri echipă" nu există
- Threshold-ul calculat nu e disponibil (ex: "peste 4.5")

**Soluție:**
```bash
# Vezi ce piețe sunt disponibile
node investigate-all-markets.js
```

---

## 🎯 CÂND SE EXTRAG COTELE?

Cotele se extrag **DOAR** când:

1. ✅ API SMART 5 detectează un pattern cu probabilitate **≥ 70%**
2. ✅ Pattern-ul trece de filtrare (`filterBestPatternsOnly`)
3. ✅ Email-ul urmează să fie trimis
4. ✅ Meciul este LIVE pe Superbet

**IMPORTANT:** Dacă cotele nu sunt disponibile, email-ul SE TRIMITE ORICUM (fără cote).

---

## 📊 MONITORIZARE

### Verificare funcționare:
```bash
# Verifică logs API SMART 5
# Caută mesaje ca:
🎯 Căutare cote LIVE Superbet pentru [echipă] vs [echipă]...
✅ Event ID găsit: [id]
✅ Găsite [n] cote relevante
```

### Verificare email-uri:
- Check folder email pentru notificări
- Verifică că secțiunea "💰 COTE LIVE SUPERBET" apare
- Verifică că cotele sunt relevante pentru pattern

---

## ⚙️ CONFIGURARE (AVANSATĂ)

### Modificare timeout SSE:
```javascript
// SUPERBET_LIVE_ODDS.js, linia 91
const cmd = `curl -s --max-time 5 ...`  // Schimbă 5 cu altă valoare
```

### Modificare cache duration:
```javascript
// SUPERBET_LIVE_ODDS.js, linia 30
if (Date.now() - cached.timestamp < 10 * 60 * 1000)  // 10 minute
```

### Adăugare piețe noi:
- Vezi `investigate-all-markets.js` pentru piețe disponibile
- Adaugă extragere în `getLiveOdds()` (similar cu cornere/cartonașe)
- Adaugă prioritate în `getOddsForPatterns()`

---

## 🚨 WHAT IF...

### Q: Email-ul nu conține cote?
**A:** Normal dacă:
- Meciul nu e LIVE pe Superbet
- Cotele sunt suspendate temporar
- API Superbet nu răspunde
→ **Pattern-ul rămâne valid și se trimite email fără cote**

### Q: Cotele par greșite?
**A:** Verifică:
1. `debug-available-odds.js` - vezi ce cote extrage sistemul
2. `investigate-all-markets.js` - vezi ce cote oferă Superbet
3. Verifică manual pe site-ul Superbet

### Q: Vreau să dezactivez cotele?
**A:**
```javascript
// email-notifier.js, linia 10
// const BettingOdds = require('./SUPERBET_ODDS_INTEGRATION');
const BettingOdds = null;  // Dezactivează
```

---

## 🎓 ÎNVAȚĂ MAI MULT

### Documentație completă:
```bash
cat INTEGRARE_SUPERBET_LIVE.md
```

### Ghid scripturi test:
```bash
cat TEST_SCRIPTS_README.md
```

### Istoric modificări:
```bash
cat CHANGELOG_SUPERBET_INTEGRATION.md
```

---

## 📞 CONTACT & SUPPORT

Pentru probleme sau întrebări:

1. **Citește documentația:**
   - README_SUPERBET_INTEGRATION.md (acest fișier)
   - INTEGRARE_SUPERBET_LIVE.md (detalii complete)

2. **Rulează teste:**
   ```bash
   node test-both-teams.js
   node debug-available-odds.js
   ```

3. **Check logs:**
   - Verifică output-ul consolei API SMART 5
   - Caută mesaje de eroare

---

## ✅ CHECKLIST VERIFICARE

- [ ] Rulat `node test-both-teams.js` → Success
- [ ] Verificat email-uri primite → Conțin cote
- [ ] Verificat cote sunt corecte → Match cu Superbet
- [ ] Verificat pattern-uri fără cote → Email se trimite oricum
- [ ] Citit documentația completă → Înțeles workflow

---

## 🎉 CONCLUZIE

Integrarea este **completă**, **testată** și **production ready**!

Sistemul:
- ✅ Extrage automat cote LIVE
- ✅ Funcționează pentru toate scenariile (0-0, 3-3, etc.)
- ✅ Afișează doar cote relevante
- ✅ Rezolvă problema "Marchează DA" dispare
- ✅ Nu blochează email-urile dacă cotele lipsesc

**Enjoy! 🚀**

---

**© 2025 - API SMART 5 + Superbet Live Odds Integration**
**Versiune:** 2.0
**Status:** ✅ Production Ready
**Data:** 3 Decembrie 2025
