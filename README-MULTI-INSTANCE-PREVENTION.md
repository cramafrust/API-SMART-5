# 🔒 Prevenire Multiple Instanțe - Monitor

## Problema Rezolvată

**ÎNAINTE:** Dacă porneai accidental 3 monitoare simultan, fiecare procesa același meci → **3 emailuri duplicate** per meci!

**ACUM:** Sistemul **BLOCHEAZĂ** automat pornirea unui al doilea monitor dacă unul rulează deja.

## Cum Funcționează

### 1. Lock File (`.monitor.lock`)

Când pornește monitorul, se creează un fișier `.monitor.lock` care conține:

```json
{
  "pid": 12345,
  "startTime": "2025-11-04T21:14:59.252Z",
  "startTimeRo": "04.11.2025, 23:14:59"
}
```

### 2. Verificare la Pornire

Când încerci să pornești un nou monitor:

1. **Verifică** dacă există fișier `.monitor.lock`
2. **Citește** PID-ul din fișier
3. **Testează** dacă procesul cu acel PID încă rulează
4. **Dacă DA** → blochează pornirea cu mesaj de eroare
5. **Dacă NU** → cleanup automat + permite pornirea

### 3. Cleanup Automat

Lock file-ul este șters automat în următoarele situații:

- ✅ Monitor oprit manual (Ctrl+C / SIGINT)
- ✅ Monitor terminat (SIGTERM)
- ✅ Toate verificările completate
- ✅ La orice exit al procesului

## Mesaj de Eroare

Dacă încerci să pornești un al doilea monitor, vei vedea:

```
❌ EROARE: Un alt monitor rulează deja (PID: 12345)

💡 Pentru a opri monitorul existent, rulează:
   kill 12345

   sau
   pkill -f "API-SMART-5.js monitor"
```

## Test Manual

Poți testa mecanismul cu:

```bash
cd "/home/florian/API SMART 5"

# Test automat
./test-lock-scenario.sh

# SAU manual:

# Pornește primul monitor
node API-SMART-5.js monitor &

# Așteaptă 2 secunde
sleep 2

# Încearcă să pornești al doilea (va fi blocat)
node API-SMART-5.js monitor
# → ❌ EROARE: Un alt monitor rulează deja...
```

## Cazuri Speciale

### Monitor mort (zombie)

Dacă un monitor a murit brusc și lock file-ul a rămas, următorul monitor va:

1. Detecta că procesul nu mai rulează
2. Șterge automat lock file-ul vechi
3. Crea un lock nou și continuă normal

```
⚠️  Lock file găsit pentru proces mort (PID: 12345), cleanup...
🔒 Lock file creat: PID 12346
```

### Lock file corupt

Dacă fișierul `.monitor.lock` este corupt (JSON invalid):

```
⚠️  Lock file corupt, cleanup...
🔒 Lock file creat: PID 12346
```

## Beneficii

✅ **Zero emailuri duplicate** - doar un monitor activ
✅ **Zero confuzie** - mesaj clar dacă încerci să pornești al doilea
✅ **Zero maintenance** - cleanup automat
✅ **Zero probleme zombie** - detectează procese moarte

## Cod Tehnic

Implementat în `STATS_MONITOR.js`:

- `acquireLock()` - creează și verifică lock
- `releaseLock()` - șterge lock la cleanup
- `process.kill(pid, 0)` - verifică dacă proces rulează (signal 0 = test only)

## Workflow Normal

```
Zi nouă:
├─ node API-SMART-5.js full
│  ├─ daily (listă meciuri)
│  ├─ schedule (program verificări)
│  └─ monitor
│     ├─ 🔒 acquireLock() → crează .monitor.lock
│     ├─ ⚡ monitorizare activă
│     └─ 🏁 toate completate → releaseLock()
└─ ✅ Lock file șters automat
```

## Notă Importantă

⚠️ **NU ȘTERGE** manual fișierul `.monitor.lock` în timp ce monitorul rulează!
Va fi șters automat când monitorul se oprește.

Dacă totuși vrei să oprești forțat totul:

```bash
# Oprește toate monitoarele
pkill -f "API-SMART-5.js monitor"

# Șterge lock file (doar dacă e nevoie)
rm -f "/home/florian/API SMART 5/.monitor.lock"
```
