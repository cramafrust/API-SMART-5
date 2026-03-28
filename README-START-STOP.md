# 🚀 API SMART 5 - Ghid Start/Stop

## SOLUȚIA DEFINITIVĂ pentru procesele multiple

De acum înainte, folosește DOAR aceste script-uri pentru a porni/opri sistemul!

---

## 📋 Comenzi Disponibile

### 1. **Pornire Sistem**

```bash
./start.sh
```

**Ce face:**
- ✅ Oprește TOATE procesele vechi (inclusiv cele blocate)
- ✅ Curăță PID file-ul
- ✅ Pornește UN SINGUR proces nou
- ✅ Salvează PID-ul în `/tmp/api-smart-5.pid`
- ✅ Creează un log file nou cu timestamp

**Output:**
```
============================================================
✅ SUCCESS: API SMART 5 pornit cu succes!
============================================================

📊 Status:
   PID: 632858
   Log: tail -f logs/api-smart-5-20251207-200314.log
   Stop: ./stop.sh
```

---

### 2. **Oprire Sistem**

```bash
./stop.sh
```

**Ce face:**
- ✅ Oprește procesul principal (folosind PID file)
- ✅ Oprește TOATE procesele rămase (backup)
- ✅ Curăță PID file-ul
- ✅ Verifică că totul s-a oprit

**Output:**
```
============================================================
✅ API SMART 5 oprit cu succes!
============================================================
```

---

### 3. **Verificare Status**

```bash
ps aux | grep "API-SMART-5.js" | grep -v grep
```

**Ar trebui să vezi UN SINGUR proces:**
```
florian  632858  0.5  2.6 960976 104040 ?  Sl  20:03  0:15 node API-SMART-5.js full
```

---

## ⚠️ IMPORTANT - NU MAI FOLOSI

**NU MAI folosi comenzi directe precum:**
- ❌ `node API-SMART-5.js full`
- ❌ `nohup node API-SMART-5.js full &`
- ❌ `kill <PID>`

**Folosește DOAR:**
- ✅ `./start.sh` - pentru pornire
- ✅ `./stop.sh` - pentru oprire

---

## 🔧 Troubleshooting

### Problema: "Un alt monitor rulează deja"

**Soluție:**
```bash
./stop.sh
./start.sh
```

### Problema: Procese multiple în paralel

**Soluție:**
```bash
./stop.sh  # Oprește tot
ps aux | grep "API-SMART" | grep -v grep  # Verifică că nu mai există procese
./start.sh  # Pornește curat
```

### Verificare log în timp real

```bash
tail -f logs/api-smart-5-*.log
```

---

## 📁 Fișiere Importante

- `start.sh` - Script de pornire (curăță și pornește)
- `stop.sh` - Script de oprire (curăță tot)
- `/tmp/api-smart-5.pid` - Conține PID-ul procesului curent
- `logs/api-smart-5-*.log` - Log-uri cu timestamp

---

## ✅ Beneficii

1. **Nu mai există procese multiple** - Start/stop gestionează corect procesele
2. **Restart curat** - Fiecare pornire curăță tot înainte
3. **PID tracking** - Știi întotdeauna ce proces rulează
4. **Log-uri organizate** - Fiecare run are propriul log cu timestamp
5. **Simplu de folosit** - Doar `./start.sh` și `./stop.sh`

---

🎯 **De acum înainte, problemele cu procesele multiple sunt REZOLVATE!**
