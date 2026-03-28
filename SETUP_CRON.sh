#!/bin/bash
##
# SETUP_CRON.sh
#
# Script pentru configurare CRON jobs pentru API SMART 5
#
# Rulează automat:
# - Colectare date finale dimineața (7:00)
# - Retry pentru meciuri neterminate (8:00, 9:00, 10:00)
#
# USAGE:
#   bash SETUP_CRON.sh install    # Instalează CRON jobs
#   bash SETUP_CRON.sh remove     # Elimină CRON jobs
#   bash SETUP_CRON.sh list       # Listează CRON jobs active
##

# Culori pentru output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Director proiect
PROJECT_DIR="/home/florian/API SMART 5"
LOG_DIR="$PROJECT_DIR/logs"

# Funcție pentru creare director logs
create_logs_dir() {
    if [ ! -d "$LOG_DIR" ]; then
        echo -e "${YELLOW}Creez director logs...${NC}"
        mkdir -p "$LOG_DIR"
        echo -e "${GREEN}✅ Director logs creat${NC}"
    fi
}

# Funcție pentru instalare CRON jobs
install_cron() {
    echo -e "${GREEN}🔧 INSTALARE CRON JOBS - API SMART 5${NC}"
    echo "============================================"

    # Creează director logs
    create_logs_dir

    # Obține crontab existent
    crontab -l > /tmp/current_cron 2>/dev/null || true

    # Verifică dacă job-urile există deja
    if grep -q "API-SMART-5.js collectyesterday" /tmp/current_cron 2>/dev/null; then
        echo -e "${YELLOW}⚠️  CRON jobs pentru API SMART 5 există deja!${NC}"
        echo ""
        read -p "Vrei să le reinstalezi? (y/n) " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            echo -e "${YELLOW}Anulat${NC}"
            rm /tmp/current_cron
            exit 0
        fi

        # Elimină job-urile vechi
        grep -v "API-SMART-5.js collectyesterday" /tmp/current_cron > /tmp/new_cron
        mv /tmp/new_cron /tmp/current_cron
    fi

    # Adaugă job-urile noi
    cat >> /tmp/current_cron << EOF

# ============================================
# API SMART 5 - COLECTARE AUTOMATĂ DATE FINALE
# ============================================

# Colectare date finale - DIMINEAȚA 7:00
# Extrage toate meciurile din ziua precedentă
0 7 * * * cd "$PROJECT_DIR" && /usr/bin/node API-SMART-5.js collectyesterday >> "$LOG_DIR/daily-collector.log" 2>&1

# Retry colectare - 8:00, 9:00, 10:00
# Pentru meciuri care nu s-au terminat la prima rulare
0 8-10 * * * cd "$PROJECT_DIR" && /usr/bin/node API-SMART-5.js collectyesterday >> "$LOG_DIR/daily-collector-retry.log" 2>&1

# ============================================

EOF

    # Instalează crontab nou
    crontab /tmp/current_cron
    rm /tmp/current_cron

    echo ""
    echo -e "${GREEN}✅ CRON jobs instalate cu succes!${NC}"
    echo ""
    echo "📋 Programare:"
    echo "   - 07:00 - Colectare date finale (ziua precedentă)"
    echo "   - 08:00 - Retry pentru meciuri neterminate"
    echo "   - 09:00 - Retry pentru meciuri neterminate"
    echo "   - 10:00 - Retry pentru meciuri neterminate"
    echo ""
    echo "📁 Log-uri salvate în:"
    echo "   - $LOG_DIR/daily-collector.log"
    echo "   - $LOG_DIR/daily-collector-retry.log"
    echo ""
    echo "💡 Pentru a vedea CRON jobs: crontab -l"
    echo "💡 Pentru a vedea log-uri: tail -f \"$LOG_DIR/daily-collector.log\""
    echo ""
}

# Funcție pentru eliminare CRON jobs
remove_cron() {
    echo -e "${YELLOW}🗑️  ELIMINARE CRON JOBS - API SMART 5${NC}"
    echo "============================================"

    # Obține crontab existent
    crontab -l > /tmp/current_cron 2>/dev/null || true

    # Verifică dacă există job-uri
    if ! grep -q "API-SMART-5.js collectyesterday" /tmp/current_cron 2>/dev/null; then
        echo -e "${YELLOW}⚠️  Nu s-au găsit CRON jobs pentru API SMART 5${NC}"
        rm /tmp/current_cron
        exit 0
    fi

    # Elimină job-urile
    grep -v "API-SMART-5.js collectyesterday" /tmp/current_cron | \
    grep -v "API SMART 5 - COLECTARE" | \
    grep -v "daily-collector" > /tmp/new_cron

    # Elimină linii goale consecutive
    cat -s /tmp/new_cron > /tmp/current_cron

    # Instalează crontab actualizat
    crontab /tmp/current_cron
    rm /tmp/current_cron /tmp/new_cron

    echo ""
    echo -e "${GREEN}✅ CRON jobs eliminate cu succes!${NC}"
    echo ""
}

# Funcție pentru listare CRON jobs
list_cron() {
    echo -e "${GREEN}📋 CRON JOBS ACTIVE - API SMART 5${NC}"
    echo "============================================"
    echo ""

    crontab -l 2>/dev/null | grep -A 10 "API SMART 5" || echo -e "${YELLOW}⚠️  Nu s-au găsit CRON jobs pentru API SMART 5${NC}"

    echo ""
}

# Main
case "$1" in
    install)
        install_cron
        ;;
    remove)
        remove_cron
        ;;
    list)
        list_cron
        ;;
    *)
        echo "SETUP_CRON.sh - Configurare CRON pentru API SMART 5"
        echo ""
        echo "USAGE:"
        echo "  bash SETUP_CRON.sh install    # Instalează CRON jobs"
        echo "  bash SETUP_CRON.sh remove     # Elimină CRON jobs"
        echo "  bash SETUP_CRON.sh list       # Listează CRON jobs active"
        echo ""
        echo "PROGRAMARE AUTOMATĂ:"
        echo "  07:00 - Colectare date finale (ziua precedentă)"
        echo "  08:00 - Retry pentru meciuri neterminate"
        echo "  09:00 - Retry pentru meciuri neterminate"
        echo "  10:00 - Retry pentru meciuri neterminate"
        echo ""
        exit 1
        ;;
esac
