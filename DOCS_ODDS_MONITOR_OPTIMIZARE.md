# OPTIMIZARE ODDS_CONTINUOUS_MONITOR

**Data**: 31 ianuarie 2026
**Versiune**: 2.0 - Optimizat pentru eficiență

## Problema Identificată

Sistemul făcea **monitoring continuu** pentru meciuri care nu erau găsite pe Superbet:
- **112 verificări** pe parcursul a **2 ore** pentru un singur meci
- 2 browsere Puppeteer active continuu
- Suprasolicitare sistem

### Exemplu Concret (Goztepe vs Karagumruk)
- Notificare trimisă: 19:53
- Monitorizare cote: 19:16 - 21:20 (2h 4min)
- Verificări: 112 încercări
- **Problemă**: Căuta "Goztepe vs Trabzonspor" în loc de "Goztepe vs Karagumruk"
- **Rezultat**: Meci NICIODATĂ găsit, sistem blocat 2 ore

## Soluția Implementată

### 1. Separare în 2 Etape

#### ETAPA 1: Căutare Meci pe Superbet
```javascript
const MAX_MATCH_RETRIES = 15;  // Încercări de găsire meci
const RETRY_DELAY = 40000;     // 40 secunde între încercări
```

**Proces:**
- Caută meciul după **NUME echipă** (nu string complet)
- MAX 15 încercări × 40 secunde = **10 minute MAX**
- Dacă NU găsește: STOP și marchează `oddsMonitoringFailed`

#### ETAPA 2: Extragere Cote (după găsire meci)
```javascript
const MAX_ODDS_RETRIES = 5;    // Retry-uri pentru cote
const RETRY_DELAY = 40000;     // 40 secunde între încercări
```

**Proces:**
- Meciul DEJA găsit în Etapa 1
- Încearcă să extragă cote: MAX 5 încercări × 40 secunde = **3 min 20s MAX**
- Verifică cote pentru "Total Goluri" peste 1.5 și peste 2.5

### 2. Verificare Scor (Opțional)

După găsirea meciului, verifică scorul pentru confirmare:
```javascript
if (expectedScore) {
    const matchData = await this.oddsExtractor.getMatchScore(eventId);
    if (matchData.score !== expectedScore) {
        return { available: false, reason: 'Scor necorespunzător' };
    }
}
```

### 3. Stop Automat după Limită

```javascript
const attemptsCount = notification.oddsAttempts || 0;

if (attemptsCount >= 15) {
    console.log('⛔ STOP: S-au făcut deja 15 încercări');
    this.tracker.updateNotification(notification.id, {
        oddsMonitoringFailed: true,
        oddsFailureReason: 'Meci nu găsit pe Superbet după 15 încercări'
    });
    return; // STOP monitoring
}
```

### 4. Filtrare Meciuri Eșuate

```javascript
// În checkCycle()
activeMatches = activeMatches.filter(m => !m.oddsMonitoringFailed);
```

Meciurile care au eșuat la găsirea cotelor **NU mai sunt verificate** în ciclurile următoare.

## Comparație Înainte vs Acum

| Aspect | Înainte | Acum |
|--------|---------|------|
| **Căutare meci** | La nesfârșit | MAX 15 încercări (10 min) |
| **Extragere cote** | Implicit în căutare | Separat: MAX 5 încercări (3m 20s) |
| **Interval retry** | ~60 secunde | 40 secunde (documentație) |
| **Stop automat** | ❌ Nu | ✅ Da, după 15 încercări |
| **Timp total MAX** | 2+ ore | **13 min 20s** |
| **Browsere active** | 2/2 continuu | 2/2 doar când lucrează |
| **Marcare eșec** | ❌ Nu | ✅ `oddsMonitoringFailed` |

## Exemple de Loguri

### Succes - Meci Găsit
```
🔍 ETAPA 1: Căutare meci pe Superbet...
🔄 Încercare 1/15 - Căutare: Goztepe vs Karagumruk
✅ Event ID găsit: 12345678 (la încercarea 1)
✅ Scor confirmat: 2-1
💰 ETAPA 2: Extragere cote live...
🔄 Încercare cote 1/5
✅ Cote extrase cu succes!
📊 Peste 1.5: 1.35 | Peste 2.5: 2.10
```

### Eșec - Meci Nu Găsit
```
🔍 ETAPA 1: Căutare meci pe Superbet...
🔄 Încercare 1/15 - Căutare: Rapid București vs U. Cluj
⏳ Meci nu găsit, retry în 40s (0m 40s)...
🔄 Încercare 2/15 - Căutare: Rapid București vs U. Cluj
⏳ Meci nu găsit, retry în 40s (0m 40s)...
...
🔄 Încercare 15/15 - Căutare: Rapid București vs U. Cluj
❌ Meci nu găsit pe Superbet după 15 încercări
⛔ STOP: S-au făcut deja 15 încercări
⚠️  Meciul nu a fost găsit pe Superbet - renunț la monitorizare cote
```

### Eșec - Cote Indisponibile (după găsire meci)
```
🔍 ETAPA 1: Căutare meci pe Superbet...
✅ Event ID găsit: 12345678 (la încercarea 1)
💰 ETAPA 2: Extragere cote live...
🔄 Încercare cote 1/5
⏳ Cote Total Goluri indisponibile, retry în 40s...
🔄 Încercare cote 2/5
⏳ Cote Total Goluri indisponibile, retry în 40s...
...
🔄 Încercare cote 5/5
❌ Cote Total Goluri indisponibile după 5 încercări
```

## Câmpuri Noi în Tracking

### notifications_tracking.json
```json
{
  "oddsAttempts": 3,
  "oddsMonitoringFailed": true,
  "oddsFailureReason": "Meci nu găsit pe Superbet după 15 încercări"
}
```

## Configurare

### Parametri Ajustabili

```javascript
// În ODDS_CONTINUOUS_MONITOR.js (linia ~120)

const MAX_MATCH_RETRIES = 15;  // Încercări căutare meci (default: 15)
const MAX_ODDS_RETRIES = 5;    // Încercări extragere cote (default: 5)
const RETRY_DELAY = 40000;     // Delay între retry-uri în ms (default: 40s)
```

### Intervalul de Check Cycle
```javascript
// În constructor (linia ~27)
this.checkInterval = 2 * 60 * 1000; // 2 minute între cicluri
```

## Beneficii

1. ✅ **Eficiență**: Timp de monitoring redus de la 2h+ la MAX 13 minute
2. ✅ **Resurse**: Browsere Puppeteer eliberate rapid
3. ✅ **Claritate**: Loguri clare cu etape separate
4. ✅ **Debugging**: Ușor de identificat unde eșuează (meci vs cote)
5. ✅ **Scalabilitate**: Poate procesa mai multe meciuri simultan
6. ✅ **Stop automat**: Nu mai blochează sistemul ore întregi

## Note Importante

- Verificarea scorului este **OPȚIONALĂ** - dacă eșuează, continuă oricum
- Delay-ul de 40 secunde este conform **documentației inițiale**
- Meciurile marcate cu `oddsMonitoringFailed` **NU** mai sunt procesate
- Pronosticul se verifică în continuare (CÂȘTIGAT/PIERDUT) chiar dacă cotele au eșuat

## Autor

Optimizare implementată: 31 ianuarie 2026
Bazat pe analiza cazului: Goztepe vs Karagumruk (112 verificări inutile)
