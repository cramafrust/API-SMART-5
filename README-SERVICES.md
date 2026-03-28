# 🔧 API SMART 5 - Servicii Systemd

## 📋 Ce Face Acest Sistem?

Sistemul este configurat să ruleze **permanent** prin servicii systemd care:

✅ **Pornesc automat** la boot (când pornești computerul)
✅ **Se restartează automat** dacă se opresc accidental
✅ **Rulează în fundal** fără să necesite terminal deschis
✅ **Log-uri centralizate** prin systemd journal

---

## 🚀 Instalare

### 1️⃣ Instalează Serviciile

```bash
cd "/home/florian/API SMART 5"
sudo bash install-service.sh
```

Script-ul va:
- Copia fișierele de serviciu în `/etc/systemd/system/`
- Activa pornirea automată la boot
- Întreba dacă vrei să pornești serviciile imediat

---

## 📋 Comenzi Utile

### ▶️ Pornire Servicii

```bash
# Pornește monitorizarea meciurilor
sudo systemctl start api-smart-5

# Pornește watchdog-ul (notificări)
sudo systemctl start api-smart-5-watchdog

# Pornește ambele
sudo systemctl start api-smart-5 api-smart-5-watchdog
```

### ⏹️ Oprire Servicii

```bash
sudo systemctl stop api-smart-5
sudo systemctl stop api-smart-5-watchdog
```

### 🔄 Restart Servicii

```bash
sudo systemctl restart api-smart-5
sudo systemctl restart api-smart-5-watchdog
```

### 📊 Verificare Status

```bash
# Status detaliat
sudo systemctl status api-smart-5
sudo systemctl status api-smart-5-watchdog

# Verificare rapidă dacă rulează
systemctl is-active api-smart-5
systemctl is-active api-smart-5-watchdog
```

### 📝 Vizualizare Log-uri

```bash
# Log-uri LIVE (în timp real)
sudo journalctl -u api-smart-5 -f
sudo journalctl -u api-smart-5-watchdog -f

# Ultimele 100 linii
sudo journalctl -u api-smart-5 -n 100
sudo journalctl -u api-smart-5-watchdog -n 100

# Log-uri din ultima oră
sudo journalctl -u api-smart-5 --since "1 hour ago"

# Log-uri de azi
sudo journalctl -u api-smart-5 --since today

# Export log-uri în fișier
sudo journalctl -u api-smart-5 --since today > api-smart-5-today.log
```

---

## ✅ Activare/Dezactivare Pornire Automată

### Activare (pornește automat la boot)

```bash
sudo systemctl enable api-smart-5
sudo systemctl enable api-smart-5-watchdog
```

### Dezactivare (nu pornește automat la boot)

```bash
sudo systemctl disable api-smart-5
sudo systemctl disable api-smart-5-watchdog
```

---

## 🔍 Verificare Configurație

```bash
# Verifică dacă serviciile sunt active la boot
systemctl is-enabled api-smart-5
systemctl is-enabled api-smart-5-watchdog

# Afișează configurația serviciului
systemctl cat api-smart-5
systemctl cat api-smart-5-watchdog
```

---

## 🛠️ Modificare Configurație

Dacă vrei să modifici configurația serviciilor:

1. **Editează fișierul de serviciu:**
   ```bash
   sudo nano /etc/systemd/system/api-smart-5.service
   ```

2. **Reload configurația:**
   ```bash
   sudo systemctl daemon-reload
   ```

3. **Restart serviciu:**
   ```bash
   sudo systemctl restart api-smart-5
   ```

---

## 📁 Locații Fișiere

- **Servicii systemd:** `/etc/systemd/system/api-smart-5*.service`
- **Log-uri aplicație:** `/home/florian/API SMART 5/logs/`
- **Log-uri systemd:** `journalctl -u api-smart-5`

---

## ⚠️ Troubleshooting

### Serviciul nu pornește

```bash
# Verifică erori
sudo systemctl status api-smart-5 -l

# Verifică log-uri de eroare
sudo journalctl -u api-smart-5 -n 50 --no-pager

# Verifică permisiuni
ls -la "/home/florian/API SMART 5/API-SMART-5.js"
```

### Serviciul se oprește des

```bash
# Verifică de câte ori s-a restartat
systemctl show api-smart-5 | grep NRestarts

# Verifică cauza ultimei opriri
sudo journalctl -u api-smart-5 | tail -100
```

### Verifică dacă Node.js există

```bash
which node
node --version
```

---

## 🗑️ Dezinstalare

```bash
# Oprește și dezactivează serviciile
sudo systemctl stop api-smart-5 api-smart-5-watchdog
sudo systemctl disable api-smart-5 api-smart-5-watchdog

# Șterge fișierele de serviciu
sudo rm /etc/systemd/system/api-smart-5.service
sudo rm /etc/systemd/system/api-smart-5-watchdog.service

# Reload systemd
sudo systemctl daemon-reload
```

---

## 💡 Tips

1. **Log-uri separate:** Serviciul salvează log-uri și în:
   - `/home/florian/API SMART 5/logs/service-output.log`
   - `/home/florian/API SMART 5/logs/service-error.log`

2. **Verificare rapidă:**
   ```bash
   ps aux | grep "API-SMART-5"
   ```

3. **Restart după modificări cod:**
   ```bash
   sudo systemctl restart api-smart-5
   ```

---

## ✅ Rezultat Final

După instalare, sistemul va:
- ✅ Porni automat când pornești PC-ul
- ✅ Rula non-stop în fundal
- ✅ Se restarta automat dacă se oprește
- ✅ Nu mai pierzi meciuri pentru că sistemul nu rulează!

**Nu mai trebuie să pornești manual API SMART 5!** 🎉
