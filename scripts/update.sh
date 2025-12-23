#!/bin/bash

# AiTer Update Script for macOS
# This script is called by the application to perform self-update
# It waits for the app to exit, replaces the old version, and restarts

set -e

# Arguments
APP_PID="$1"           # Current app process ID
DOWNLOAD_PATH="$2"     # Path to downloaded .zip file
APP_PATH="$3"          # Path to installed app (e.g., /Applications/AiTer.app)
RESTART="${4:-true}"   # Whether to restart after update

# Log file
LOG_DIR="$HOME/Library/Logs/AiTer"
mkdir -p "$LOG_DIR"
LOG_FILE="$LOG_DIR/update.log"

# Logging function
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" >> "$LOG_FILE"
    echo "$1"
}

log "=========================================="
log "AiTer Update Script Started"
log "PID to wait: $APP_PID"
log "Download path: $DOWNLOAD_PATH"
log "App path: $APP_PATH"
log "Restart: $RESTART"
log "=========================================="

# Validate arguments
if [ -z "$APP_PID" ] || [ -z "$DOWNLOAD_PATH" ] || [ -z "$APP_PATH" ]; then
    log "ERROR: Missing required arguments"
    log "Usage: update.sh <pid> <download_path> <app_path> [restart]"
    exit 1
fi

# Check if download file exists
if [ ! -f "$DOWNLOAD_PATH" ]; then
    log "ERROR: Download file not found: $DOWNLOAD_PATH"
    exit 1
fi

# Wait for the application to exit
log "Waiting for application to exit (PID: $APP_PID)..."
MAX_WAIT=60  # Maximum wait time in seconds
WAIT_COUNT=0

while kill -0 "$APP_PID" 2>/dev/null; do
    sleep 1
    WAIT_COUNT=$((WAIT_COUNT + 1))
    if [ $WAIT_COUNT -ge $MAX_WAIT ]; then
        log "WARNING: Application did not exit within $MAX_WAIT seconds, force killing..."
        kill -9 "$APP_PID" 2>/dev/null || true
        sleep 2
        break
    fi
done

log "Application has exited"

# Create temporary directory for extraction
TEMP_DIR=$(mktemp -d)
log "Extracting to: $TEMP_DIR"

# Extract the zip file
log "Extracting update package..."
if ! unzip -q "$DOWNLOAD_PATH" -d "$TEMP_DIR"; then
    log "ERROR: Failed to extract update package"
    rm -rf "$TEMP_DIR"
    exit 1
fi

# Find the .app bundle in extracted files
NEW_APP=$(find "$TEMP_DIR" -maxdepth 2 -name "*.app" -type d | head -1)

if [ -z "$NEW_APP" ]; then
    log "ERROR: Could not find .app bundle in update package"
    rm -rf "$TEMP_DIR"
    exit 1
fi

log "Found new app: $NEW_APP"

# Backup old app (optional, for rollback)
BACKUP_PATH="${APP_PATH}.backup"
if [ -d "$APP_PATH" ]; then
    log "Backing up old version..."
    rm -rf "$BACKUP_PATH" 2>/dev/null || true
    mv "$APP_PATH" "$BACKUP_PATH"
fi

# Copy new app to destination
log "Installing new version..."
if ! cp -R "$NEW_APP" "$APP_PATH"; then
    log "ERROR: Failed to copy new app"
    # Attempt rollback
    if [ -d "$BACKUP_PATH" ]; then
        log "Rolling back to previous version..."
        mv "$BACKUP_PATH" "$APP_PATH"
    fi
    rm -rf "$TEMP_DIR"
    exit 1
fi

# Remove quarantine attributes
log "Removing quarantine attributes..."
xattr -cr "$APP_PATH" 2>/dev/null || true

# Set proper permissions
log "Setting permissions..."
chmod -R 755 "$APP_PATH"

# Cleanup
log "Cleaning up..."
rm -rf "$TEMP_DIR"
rm -f "$DOWNLOAD_PATH"
rm -rf "$BACKUP_PATH" 2>/dev/null || true

log "Update completed successfully!"

# Restart application if requested
if [ "$RESTART" = "true" ]; then
    log "Restarting application..."
    sleep 1
    open "$APP_PATH"
    log "Application restarted"
fi

log "Update script finished"
exit 0
