#!/bin/bash

##############################################################################
# RESTORE SYSTEM - API SMART 5
# Restaurează backup complet al sistemului
##############################################################################

# Culori
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

BACKUP_DIR="$HOME/API_SMART_5_BACKUPS"
RESTORE_TARGET="/home/florian/API SMART 5"

echo -e "${BLUE}════════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}        API SMART 5 - RESTORE SYSTEM v1.0                   ${NC}"
echo -e "${BLUE}════════════════════════════════════════════════════════════${NC}"
echo ""

# Verifică dacă există backup-uri
if [ ! -d "${BACKUP_DIR}" ]; then
    echo -e "${RED}❌ Director backup nu există: ${BACKUP_DIR}${NC}"
    exit 1
fi

# Listează backup-uri disponibile
echo -e "${YELLOW}📦 Backup-uri disponibile:${NC}"
echo ""

cd "${BACKUP_DIR}"
BACKUPS=($(ls -1t API_SMART_5_backup_*.tar.gz 2>/dev/null))

if [ ${#BACKUPS[@]} -eq 0 ]; then
    echo -e "${RED}❌ Nu există backup-uri!${NC}"
    echo "   Rulează BACKUP_SYSTEM.sh pentru a crea un backup"
    exit 1
fi

# Afișează listă
for i in "${!BACKUPS[@]}"; do
    BACKUP="${BACKUPS[$i]}"
    SIZE=$(du -h "${BACKUP}" | cut -f1)
    DATE_PART=$(echo "${BACKUP}" | sed 's/API_SMART_5_backup_//;s/.tar.gz//')
    FORMATTED_DATE=$(echo "${DATE_PART}" | sed 's/_/ /;s/\(....\)\(..\)\(..\) \(..\)\(..\)\(..\)/\1-\2-\3 \4:\5:\6/')

    echo -e "${GREEN}[$((i+1))]${NC} ${BACKUP}"
    echo "    📅 Data: ${FORMATTED_DATE}"
    echo "    📏 Dimensiune: ${SIZE}"
    echo ""
done

# Selectare backup
echo -e "${YELLOW}Selectează numărul backup-ului de restaurat (1-${#BACKUPS[@]}):${NC}"
read -p "Număr: " CHOICE

if [ -z "${CHOICE}" ] || [ "${CHOICE}" -lt 1 ] || [ "${CHOICE}" -gt ${#BACKUPS[@]} ]; then
    echo -e "${RED}❌ Selecție invalidă!${NC}"
    exit 1
fi

SELECTED_BACKUP="${BACKUPS[$((CHOICE-1))]}"

echo ""
echo -e "${YELLOW}⚠️  ATENȚIE:${NC}"
echo "   Backup selectat: ${SELECTED_BACKUP}"
echo "   Destinație: ${RESTORE_TARGET}"
echo ""
echo -e "${RED}   Acest lucru va SUPRASCRIE fișierele existente!${NC}"
echo ""
read -p "Ești sigur? (yes/no): " CONFIRM

if [ "${CONFIRM}" != "yes" ]; then
    echo -e "${YELLOW}❌ Restaurare anulată${NC}"
    exit 0
fi

echo ""
echo -e "${GREEN}🔄 Restaurare în curs...${NC}"

# Creare director temporar
TEMP_DIR=$(mktemp -d)
cd "${TEMP_DIR}"

# Extragere arhivă
echo "   📦 Extragere arhivă..."
tar -xzf "${BACKUP_DIR}/${SELECTED_BACKUP}"

BACKUP_NAME="${SELECTED_BACKUP%.tar.gz}"

if [ ! -d "${BACKUP_NAME}" ]; then
    echo -e "${RED}❌ Eroare extragere arhivă${NC}"
    rm -rf "${TEMP_DIR}"
    exit 1
fi

# Restaurare fișiere
cd "${BACKUP_NAME}"

echo "   📁 Restaurare cod JavaScript..."
cp -v *.js "${RESTORE_TARGET}/" 2>/dev/null | wc -l | xargs echo "      →" "fișiere JavaScript"

echo "   📄 Restaurare documentație..."
cp -v *.md "${RESTORE_TARGET}/" 2>/dev/null | wc -l | xargs echo "      →" "fișiere Markdown"

echo "   💾 Restaurare date JSON..."
cp -v *.json "${RESTORE_TARGET}/" 2>/dev/null | wc -l | xargs echo "      →" "fișiere JSON"

echo "   ⚙️  Restaurare configurare..."
cp -v package.json "${RESTORE_TARGET}/" 2>/dev/null || true
cp -v NOTIFICATION_CONFIG.js "${RESTORE_TARGET}/" 2>/dev/null || true

if [ -f ".env.backup" ]; then
    cp -v .env.backup "${RESTORE_TARGET}/.env" 2>/dev/null || true
fi

echo "   📋 Restaurare log-uri..."
if [ -d "logs" ]; then
    mkdir -p "${RESTORE_TARGET}/logs"
    cp -v logs/* "${RESTORE_TARGET}/logs/" 2>/dev/null | wc -l | xargs echo "      →" "fișiere log"
fi

# Cleanup
cd /
rm -rf "${TEMP_DIR}"

echo ""
echo -e "${BLUE}════════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}✅ RESTAURARE FINALIZATĂ!${NC}"
echo -e "${BLUE}════════════════════════════════════════════════════════════${NC}"
echo ""
echo "📁 Fișiere restaurate în: ${RESTORE_TARGET}"
echo ""
echo -e "${YELLOW}📝 Pași următori:${NC}"
echo "   1. Verifică fișierele restaurate"
echo "   2. Verifică configurarea (NOTIFICATION_CONFIG.js, .env)"
echo "   3. Repornește sistemul: node API-SMART-5.js full"
echo ""
echo -e "${GREEN}💾 Restaurare completă!${NC}"
