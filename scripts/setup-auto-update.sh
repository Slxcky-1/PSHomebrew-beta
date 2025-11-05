#!/bin/bash
# Setup automatic updates via cron
# Usage: bash scripts/setup-auto-update.sh

echo -e "\033[36m⚙️  PSHomebrew Bot - Auto-Update Setup\033[0m"
echo -e "\033[36m======================================\033[0m"
echo ""

# Get absolute path to bot directory
BOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
echo -e "\033[33mBot directory: $BOT_DIR\033[0m"
echo ""

# Make auto-update script executable
chmod +x "$BOT_DIR/scripts/auto-update.sh"
echo -e "\033[32m✅ Made auto-update.sh executable\033[0m"
echo ""

# Ask user for update schedule
echo -e "\033[36mChoose automatic update schedule:\033[0m"
echo "1) Daily at 4:00 AM"
echo "2) Daily at 3:00 AM"
echo "3) Every 6 hours"
echo "4) Every 12 hours"
echo "5) Weekly (Sunday 4:00 AM)"
echo "6) Custom (manual cron entry)"
echo ""
read -p "Select option (1-6): " choice

case $choice in
    1)
        CRON_SCHEDULE="0 4 * * *"
        CRON_DESC="Daily at 4:00 AM"
        ;;
    2)
        CRON_SCHEDULE="0 3 * * *"
        CRON_DESC="Daily at 3:00 AM"
        ;;
    3)
        CRON_SCHEDULE="0 */6 * * *"
        CRON_DESC="Every 6 hours"
        ;;
    4)
        CRON_SCHEDULE="0 */12 * * *"
        CRON_DESC="Every 12 hours"
        ;;
    5)
        CRON_SCHEDULE="0 4 * * 0"
        CRON_DESC="Weekly (Sunday 4:00 AM)"
        ;;
    6)
        echo ""
        echo "Enter cron schedule (e.g., '0 4 * * *' for daily 4 AM):"
        read -p "Schedule: " CRON_SCHEDULE
        CRON_DESC="Custom: $CRON_SCHEDULE"
        ;;
    *)
        echo -e "\033[31m❌ Invalid option\033[0m"
        exit 1
        ;;
esac

# Create cron job
CRON_COMMAND="cd $BOT_DIR && bash $BOT_DIR/scripts/auto-update.sh >> $BOT_DIR/update.log 2>&1"
CRON_ENTRY="$CRON_SCHEDULE $CRON_COMMAND"

echo ""
echo -e "\033[33m📅 Cron entry to be added:\033[0m"
echo "$CRON_ENTRY"
echo ""

read -p "Add this cron job? (y/N): " confirm
if [ "$confirm" != "y" ] && [ "$confirm" != "Y" ]; then
    echo -e "\033[33m❌ Setup cancelled\033[0m"
    exit 0
fi

# Add to crontab
(crontab -l 2>/dev/null | grep -v "auto-update.sh"; echo "$CRON_ENTRY") | crontab -

if [ $? -eq 0 ]; then
    echo ""
    echo -e "\033[32m✅ Automatic updates configured!\033[0m"
    echo ""
    echo -e "\033[36m📋 Details:\033[0m"
    echo -e "  Schedule: $CRON_DESC"
    echo -e "  Script: $BOT_DIR/scripts/auto-update.sh"
    echo -e "  Log file: $BOT_DIR/update.log"
    echo ""
    echo -e "\033[36m🔧 Management commands:\033[0m"
    echo -e "  View cron jobs: crontab -l"
    echo -e "  Edit cron jobs: crontab -e"
    echo -e "  Remove cron job: crontab -e (then delete the line)"
    echo -e "  View update log: tail -f $BOT_DIR/update.log"
    echo ""
    echo -e "\033[36m🧪 Test update now:\033[0m"
    echo -e "  bash $BOT_DIR/scripts/auto-update.sh"
    echo ""
else
    echo -e "\033[31m❌ Failed to add cron job\033[0m"
    exit 1
fi
