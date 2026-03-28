# 📊 SISTEM TRACKING NOTIFICĂRI - DOCUMENTAȚIE

## 📌 DESCRIERE

Sistem automat pentru tracking-ul notificărilor trimise de API SMART 5.

Monitorizează:
- **Cota** la momentul notificării
- **Când ajunge cota la 1.50** → salvează minutul
- **Când ajunge cota la 2.00** → salvează minutul
- **Când se îndeplinește pronosticul** → salvează minutul (cu verificare VAR)
- **Când se termină meciul** → marchează "NU" dacă nu s-a îndeplinit

---

## 📁 FIȘIERE COMPONENTE

### 1. **NOTIFICATION_TRACKER.js**
- Modul pentru salvare/citire notificări
- Storage în `notifications_tracking.json`
- API pentru CRUD operations

### 2. **NOTIFICATION_MONITOR.js**
- Monitor care rulează din 60 în 60 secunde
- Verifică toate notificările active
- Actualizează status și minute
- **TRIMITE EMAIL automat când cota ≥ 1.50**
- **TRIMITE EMAIL automat când cota ≥ 2.00**

### 3. **notifications_tracking.json**
- Fișier JSON cu toate notificările
- Structură:
```json
{
  "version": "1.0",
  "created": "2025-12-03T...Z",
  "notifications": [
    {
      "id": "matchId_timestamp",
      "date": "03/12/2025",
      "timestamp": 1733234567890,
      "match": "Manchester City vs Liverpool",
      "matchId": "abc123",
      "homeTeam": "Manchester City",
      "awayTeam": "Liverpool",
      "event": "Echipa 1 va marca în repriza 2",
      "initial_odd": 1.70,
      "probability": 85,
      "minute_odd_1_50": 52,
      "minute_odd_2_00": 67,
      "minute_fulfilled": 73,
      "status": "COMPLETED",
      "pattern": { ... },
      "created_at": "2025-12-03T...",
      "updated_at": "2025-12-03T..."
    }
  ]
}
```

---

## 🔄 WORKFLOW

### 1. **Când se trimite notificare:**
```
email-notifier.js
  → NotificationTracker.addNotification()
  → Salvează în JSON cu status="MONITORING"
```

### 2. **La fiecare 60 secunde:**
```
NOTIFICATION_MONITOR
  → Pentru fiecare notificare MONITORING:
    → Obține minut curent meci (Flashscore API)
    → Verifică dacă meciul s-a terminat
    → Extrage cota actuală (Superbet API)
    → Verifică dacă s-a îndeplinit pronosticul
    → Actualizează JSON
```

### 3. **Actualizări automate:**
- **Cota ≥ 1.50** → `minute_odd_1_50 = minut_curent` + **EMAIL NOTIFICARE** ⚡
- **Cota ≥ 2.00** → `minute_odd_2_00 = minut_curent` + **EMAIL NOTIFICARE** (doar dacă min ≤ 75) 🚀
- **Pronostic îndeplinit** → `minute_fulfilled = minut_curent`, `status = "COMPLETED"`
- **Meci terminat fără îndeplinire** → `minute_fulfilled = "NU"`, `status = "FAILED"`

---

## 🚀 UTILIZARE

### Pornire automată (RECOMANDAT):
```bash
cd "/home/florian/API SMART 5"
node API-SMART-5.js full
```

**NOTIFICATION_MONITOR pornește AUTOMAT** odată cu API SMART 5!

### Pornire manuală (opțional):
```bash
cd "/home/florian/API SMART 5"
node NOTIFICATION_MONITOR.js
```

### Oprire monitor:
```
Ctrl+C (SIGINT)
```

### Verificare manuală:
```javascript
const NotificationTracker = require('./NOTIFICATION_TRACKER');

// Vezi notificări active
const active = NotificationTracker.getActiveNotifications();
console.log(active);

// Vezi toate notificările
const all = NotificationTracker.getAllNotifications();
console.log(all);

// Vezi statistici
const stats = NotificationTracker.generateStats();
console.log(stats);
```

---

## 📊 CÂMPURI JSON

| Câmp | Tip | Descriere |
|------|-----|-----------|
| `id` | string | ID unic: `matchId_timestamp` |
| `date` | string | Data în format `DD/MM/YYYY` |
| `timestamp` | number | Unix timestamp |
| `match` | string | "Echipa1 vs Echipa2" |
| `matchId` | string | ID meci Flashscore |
| `homeTeam` | string | Echipa gazdă |
| `awayTeam` | string | Echipa oaspete |
| `event` | string | Evenimentul pronosticat |
| `initial_odd` | number | Cota la momentul notificării |
| `probability` | number | Probabilitatea pattern-ului (%) |
| `minute_odd_1_50` | number\|null | Minutul când cota a ajuns la 1.50 |
| `minute_odd_2_00` | number\|null | Minutul când cota a ajuns la 2.00 |
| `minute_fulfilled` | number\|string\|null | Minutul când s-a îndeplinit SAU "NU" |
| `status` | string | "MONITORING", "COMPLETED", "FAILED" |
| `pattern` | object | Pattern-ul complet (pentru monitorizare) |
| `created_at` | string | Timestamp ISO creareșare |
| `updated_at` | string | Timestamp ISO ultimă actualizare |

---

## 🎯 VERIFICĂRI SPECIALE

### Goluri - Verificare VAR:
```javascript
// Verifică dacă golul a fost validat VAR
async isGoalConfirmed(matchId, goalCount) {
    // TODO: Implementare API Flashscore pentru verificare VAR
    // Momentan: presupune că golul e valid
    return true;
}
```

**Important:** Dacă un gol este anulat de VAR:
- Continuăm monitorizarea
- NU marcăm ca îndeplinit până la validare finală

### Minutul curent:
```javascript
// Extrage minutul din API Flashscore
// Format: "52'" sau "45'+2"
const minute = await getCurrentMinute(matchId);
```

### Status meci:
```javascript
// Verifică dacă meciul s-a terminat
// AX = 100 → Meci terminat
const finished = await isMatchFinished(matchId);
```

---

## 🔧 CONFIGURARE

### Interval verificare (default 60s):
```javascript
// În NOTIFICATION_MONITOR.js, linia 17
this.checkInterval = 60 * 1000; // 60 secunde
```

### Fișier storage:
```javascript
// În NOTIFICATION_TRACKER.js, linia 13
this.storageFile = path.join(__dirname, 'notifications_tracking.json');
```

---

## 📈 STATISTICI

### Generare raport:
```javascript
const stats = NotificationTracker.generateStats();

// Output:
{
  total: 150,
  monitoring: 5,
  completed: 120,
  failed: 25,
  successRate: 83 // % (completed / (completed + failed))
}
```

### Export date pentru analiză:
```bash
# Copiază fișierul JSON pentru analiză externă
cp notifications_tracking.json /path/to/analysis/
```

---

## ⚠️ CAZURI SPECIALE

### 1. Meci terminat înainte de verificare:
```
→ Se marchează automat ca FAILED dacă nu s-a îndeplinit
```

### 2. Cota nu mai e disponibilă (event-ul s-a îndeplinit):
```
→ Monitor verifică scorul/statistici direct
→ Salvează minutul îndeplinirii
→ Marchează status=COMPLETED
```

### 3. API Superbet indisponibil:
```
→ Skip verificarea cotei
→ Continuă cu verificarea îndeplinirii din scor
→ Log warning
```

### 4. API Flashscore indisponibil:
```
→ Skip verificarea pentru această tură
→ Încearcă din nou la următoarea verificare (60s)
→ Log warning
```

### 5. Gol anulat VAR:
```
→ Revenire la status MONITORING
→ Continuă verificarea
```

---

## 🧪 TESTARE

### Test adăugare notificare:
```javascript
const NotificationTracker = require('./NOTIFICATION_TRACKER');

NotificationTracker.addNotification({
    matchId: 'TEST123',
    homeTeam: 'Test Home',
    awayTeam: 'Test Away',
    event: 'Test Event',
    initialOdd: 1.85,
    probability: 80,
    pattern: { name: 'TEST_PATTERN', team: 'gazda' }
});
```

### Test monitorizare:
```bash
# Rulează monitor pentru un ciclu
node NOTIFICATION_MONITOR.js

# Oprește după 2-3 minute (Ctrl+C)
# Verifică fișierul JSON
cat notifications_tracking.json
```

---

## 📝 INTEGRARE CU EMAIL-NOTIFIER

### Modificare necesară în email-notifier.js:

```javascript
const NotificationTracker = require('./NOTIFICATION_TRACKER');

// După trimiterea email-ului cu succes:
if (emailSent) {
    // Pentru fiecare pattern notificat:
    patterns.forEach(pattern => {
        // Extrage cota din oddsResult
        const odd = extractOddForPattern(pattern, oddsResult);

        NotificationTracker.addNotification({
            matchId: matchData.matchId,
            homeTeam: matchData.homeTeam,
            awayTeam: matchData.awayTeam,
            event: generateEventDescription(pattern),
            initialOdd: odd,
            probability: pattern.probability,
            pattern: pattern
        });
    });
}
```

---

## 🔮 ÎMBUNĂTĂȚIRI VIITOARE

1. **Dashboard web** pentru vizualizare statistici
2. **Alerte** când cota atinge threshold-uri
3. **Machine learning** pentru predicție success rate
4. **Export rapoarte** PDF/Excel
5. **Verificare VAR** automată completă
6. **Notificări push** când se îndeplinește pronosticul

---

## ✅ CHECKLIST IMPLEMENTARE

- [x] Modul tracking (NOTIFICATION_TRACKER.js)
- [x] Monitor automat (NOTIFICATION_MONITOR.js)
- [x] Fișier storage JSON
- [x] Verificare cote Superbet
- [x] Verificare minut curent Flashscore
- [x] Verificare status meci
- [x] Documentație completă
- [ ] Integrare cu email-notifier.js
- [ ] Pornire automată monitor la boot
- [ ] Verificare VAR completă
- [ ] Dashboard vizualizare

---

**© 2025 - API SMART 5 Notification Tracking System**
**Versiune:** 1.0
**Data:** 3 Decembrie 2025
