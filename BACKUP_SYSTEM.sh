#!/bin/bash

##############################################################################
# BACKUP SYSTEM - API SMART 5
# Crează backup complet al sistemului (cod + date + configurare)
##############################################################################

# Culori pentru output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Directoare
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
BACKUP_DIR="$HOME/API_SMART_5_BACKUPS"
DATE_STAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_NAME="API_SMART_5_backup_${DATE_STAMP}"
BACKUP_PATH="${BACKUP_DIR}/${BACKUP_NAME}"

echo -e "${BLUE}════════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}          API SMART 5 - BACKUP SYSTEM v1.0                  ${NC}"
echo -e "${BLUE}════════════════════════════════════════════════════════════${NC}"
echo ""

# Creare director backup dacă nu există
mkdir -p "${BACKUP_DIR}"
mkdir -p "${BACKUP_PATH}"

echo -e "${YELLOW}📁 Director backup: ${BACKUP_DIR}${NC}"
echo -e "${YELLOW}📦 Nume backup: ${BACKUP_NAME}${NC}"
echo ""

##############################################################################
# 1. BACKUP COD SURSĂ
##############################################################################
echo -e "${GREEN}1️⃣  Backup COD SURSĂ...${NC}"

# Cod JavaScript
echo "   → Cod JavaScript (.js)"
find "${SCRIPT_DIR}" -maxdepth 1 -name "*.js" -exec cp {} "${BACKUP_PATH}/" \;

# Module importante
if [ -d "${SCRIPT_DIR}/../superbet-analyzer" ]; then
    echo "   → Modul superbet-analyzer"
    mkdir -p "${BACKUP_PATH}/superbet-analyzer"
    cp -r "${SCRIPT_DIR}/../superbet-analyzer"/*.js "${BACKUP_PATH}/superbet-analyzer/" 2>/dev/null || true
fi

# Numără fișiere JavaScript
JS_COUNT=$(find "${BACKUP_PATH}" -name "*.js" | wc -l)
echo -e "   ${GREEN}✅ ${JS_COUNT} fișiere JavaScript backup${NC}"

##############################################################################
# 2. BACKUP DOCUMENTAȚIE
##############################################################################
echo ""
echo -e "${GREEN}2️⃣  Backup DOCUMENTAȚIE...${NC}"

# Markdown
echo "   → Fișiere Markdown (.md)"
find "${SCRIPT_DIR}" -maxdepth 1 -name "*.md" -exec cp {} "${BACKUP_PATH}/" \;

MD_COUNT=$(find "${BACKUP_PATH}" -name "*.md" | wc -l)
echo -e "   ${GREEN}✅ ${MD_COUNT} fișiere Markdown backup${NC}"

##############################################################################
# 3. BACKUP DATE (JSON)
##############################################################################
echo ""
echo -e "${GREEN}3️⃣  Backup DATE (JSON)...${NC}"

# Fișiere JSON critice
echo "   → notifications_tracking.json"
cp "${SCRIPT_DIR}/notifications_tracking.json" "${BACKUP_PATH}/" 2>/dev/null || echo "   ⚠️  notifications_tracking.json nu există"

echo "   → odds_validation_1.5.json"
cp "${SCRIPT_DIR}/odds_validation_1.5.json" "${BACKUP_PATH}/" 2>/dev/null || echo "   ⚠️  odds_validation_1.5.json nu există"

echo "   → JSON PROCENTE AUTOACTUAL.json"
cp "${SCRIPT_DIR}/JSON PROCENTE AUTOACTUAL.json" "${BACKUP_PATH}/" 2>/dev/null || echo "   ⚠️  JSON PROCENTE AUTOACTUAL.json nu există"

# Fișiere zilnice (ultimele 7 zile)
echo "   → Meciuri și verificări (ultimele 7 zile)"
find "${SCRIPT_DIR}" -maxdepth 1 -name "meciuri-*.json" -mtime -7 -exec cp {} "${BACKUP_PATH}/" \;
find "${SCRIPT_DIR}" -maxdepth 1 -name "verificari-*.json" -mtime -7 -exec cp {} "${BACKUP_PATH}/" \;

JSON_COUNT=$(find "${BACKUP_PATH}" -name "*.json" | wc -l)
echo -e "   ${GREEN}✅ ${JSON_COUNT} fișiere JSON backup${NC}"

##############################################################################
# 4. BACKUP CONFIGURARE
##############################################################################
echo ""
echo -e "${GREEN}4️⃣  Backup CONFIGURARE...${NC}"

# Package.json
echo "   → package.json"
cp "${SCRIPT_DIR}/package.json" "${BACKUP_PATH}/" 2>/dev/null || echo "   ⚠️  package.json nu există"

# .env (dacă există - ATENȚIE: conține parole!)
if [ -f "${SCRIPT_DIR}/.env" ]; then
    echo "   → .env (CONFIDENȚIAL)"
    cp "${SCRIPT_DIR}/.env" "${BACKUP_PATH}/.env.backup"
    echo -e "   ${YELLOW}⚠️  ATENȚIE: .env conține parole - păstrează backup-ul SECURIZAT!${NC}"
fi

# Config files
if [ -f "${SCRIPT_DIR}/NOTIFICATION_CONFIG.js" ]; then
    echo "   → NOTIFICATION_CONFIG.js (CONFIDENȚIAL)"
    cp "${SCRIPT_DIR}/NOTIFICATION_CONFIG.js" "${BACKUP_PATH}/"
    echo -e "   ${YELLOW}⚠️  ATENȚIE: conține email/parole - păstrează SECURIZAT!${NC}"
fi

echo -e "   ${GREEN}✅ Configurare backup${NC}"

##############################################################################
# 5. BACKUP LOG-URI (ultimele 7 zile)
##############################################################################
echo ""
echo -e "${GREEN}5️⃣  Backup LOG-URI (ultimele 7 zile)...${NC}"

if [ -d "${SCRIPT_DIR}/logs" ]; then
    mkdir -p "${BACKUP_PATH}/logs"

    # Doar log-uri recente (ultimele 7 zile)
    find "${SCRIPT_DIR}/logs" -name "*.log" -mtime -7 -exec cp {} "${BACKUP_PATH}/logs/" \; 2>/dev/null || true

    LOG_COUNT=$(find "${BACKUP_PATH}/logs" -name "*.log" | wc -l)
    echo -e "   ${GREEN}✅ ${LOG_COUNT} fișiere log backup${NC}"
else
    echo "   ⚠️  Director logs nu există"
fi

##############################################################################
# 6. CREARE ARHIVĂ COMPRIMATĂ
##############################################################################
echo ""
echo -e "${GREEN}6️⃣  Creare arhivă .tar.gz...${NC}"

cd "${BACKUP_DIR}"
tar -czf "${BACKUP_NAME}.tar.gz" "${BACKUP_NAME}/" 2>/dev/null

if [ -f "${BACKUP_NAME}.tar.gz" ]; then
    ARCHIVE_SIZE=$(du -h "${BACKUP_NAME}.tar.gz" | cut -f1)
    echo -e "   ${GREEN}✅ Arhivă creată: ${BACKUP_NAME}.tar.gz (${ARCHIVE_SIZE})${NC}"

    # Șterge directorul temporar (păstrează doar arhiva)
    rm -rf "${BACKUP_PATH}"
    echo "   🗑️  Director temporar șters"
else
    echo -e "   ${RED}❌ Eroare creare arhivă${NC}"
    exit 1
fi

##############################################################################
# 7. STATISTICI FINALE
##############################################################################
echo ""
echo -e "${BLUE}════════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}✅ BACKUP COMPLET FINALIZAT!${NC}"
echo -e "${BLUE}════════════════════════════════════════════════════════════${NC}"
echo ""
echo "📊 STATISTICI:"
echo "   📦 Arhivă: ${BACKUP_NAME}.tar.gz"
echo "   📏 Dimensiune: ${ARCHIVE_SIZE}"
echo "   📁 Locație: ${BACKUP_DIR}"
echo ""
echo "📂 CONȚINUT BACKUP:"
echo "   ✅ ${JS_COUNT} fișiere JavaScript (cod sursă)"
echo "   ✅ ${MD_COUNT} fișiere Markdown (documentație)"
echo "   ✅ ${JSON_COUNT} fișiere JSON (date)"
echo "   ✅ ${LOG_COUNT} fișiere log (ultimele 7 zile)"
echo "   ✅ Fișiere configurare (package.json, .env, config)"
echo ""
echo -e "${YELLOW}⚠️  IMPORTANT:${NC}"
echo "   • Backup-ul conține parole (NOTIFICATION_CONFIG.js, .env)"
echo "   • Păstrează backup-ul într-un loc SECURIZAT"
echo "   • NU urca pe GitHub sau servicii publice"
echo ""
echo -e "${GREEN}💾 Backup salvat cu succes!${NC}"
echo ""

##############################################################################
# 8. CLEANUP - Păstrează doar ultimele 10 backup-uri
##############################################################################
echo -e "${YELLOW}🧹 Cleanup backup-uri vechi...${NC}"

cd "${BACKUP_DIR}"
BACKUP_COUNT=$(ls -1 API_SMART_5_backup_*.tar.gz 2>/dev/null | wc -l)

if [ ${BACKUP_COUNT} -gt 10 ]; then
    echo "   → Găsite ${BACKUP_COUNT} backup-uri, șterg cele mai vechi..."
    ls -1t API_SMART_5_backup_*.tar.gz | tail -n +11 | xargs rm -f
    NEW_COUNT=$(ls -1 API_SMART_5_backup_*.tar.gz 2>/dev/null | wc -l)
    DELETED=$((BACKUP_COUNT - NEW_COUNT))
    echo -e "   ${GREEN}✅ ${DELETED} backup-uri vechi șterse, păstrate ${NEW_COUNT}${NC}"
else
    echo "   ✅ ${BACKUP_COUNT} backup-uri (sub limita de 10)"
fi

echo ""
echo -e "${BLUE}════════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}🎯 Backup finalizat cu succes! 📦${NC}"
echo -e "${BLUE}════════════════════════════════════════════════════════════${NC}"
