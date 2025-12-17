#!/bin/bash

# AiTer Auto-Installer Script
# Automatically downloads and installs AiTer from GitHub Releases
# Handles macOS security restrictions (Gatekeeper, quarantine attributes)

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# GitHub repository information
GITHUB_REPO="within-7/aiter"
GITHUB_API="https://api.github.com/repos/${GITHUB_REPO}/releases/latest"

# Print colored message
print_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Detect OS and architecture
detect_system() {
    print_info "Detecting system information..."

    OS=$(uname -s)
    ARCH=$(uname -m)

    case "$OS" in
        Darwin)
            OS_TYPE="mac"
            if [ "$ARCH" = "arm64" ]; then
                ARCH_TYPE="arm64"
                INSTALLER_PATTERN="mac-arm64.dmg"
            else
                ARCH_TYPE="x64"
                INSTALLER_PATTERN="mac-x64.dmg"
            fi
            ;;
        Linux)
            print_error "Linux is not yet supported. Only macOS and Windows are currently supported."
            exit 1
            ;;
        MINGW*|MSYS*|CYGWIN*)
            OS_TYPE="win"
            ARCH_TYPE="x64"
            INSTALLER_PATTERN="win-x64.exe"
            ;;
        *)
            print_error "Unsupported operating system: $OS"
            exit 1
            ;;
    esac

    print_success "Detected: ${OS_TYPE} (${ARCH_TYPE})"
}

# Get latest release information from GitHub
get_latest_release() {
    print_info "Fetching latest release information from GitHub..."

    if ! command -v curl &> /dev/null; then
        print_error "curl is required but not installed. Please install curl and try again."
        exit 1
    fi

    RELEASE_JSON=$(curl -s "$GITHUB_API")

    if [ $? -ne 0 ]; then
        print_error "Failed to fetch release information from GitHub."
        exit 1
    fi

    # Extract version and download URL
    VERSION=$(echo "$RELEASE_JSON" | grep '"tag_name":' | sed -E 's/.*"v?([^"]+)".*/\1/' | head -1)
    DOWNLOAD_URL=$(echo "$RELEASE_JSON" | grep '"browser_download_url":' | grep "$INSTALLER_PATTERN" | sed -E 's/.*"([^"]+)".*/\1/' | head -1)

    if [ -z "$VERSION" ] || [ -z "$DOWNLOAD_URL" ]; then
        print_error "Could not find release information for your system."
        echo "Pattern searched: $INSTALLER_PATTERN"
        exit 1
    fi

    print_success "Latest version: v${VERSION}"
    print_info "Download URL: ${DOWNLOAD_URL}"
}

# Download the installer
download_installer() {
    print_info "Downloading AiTer v${VERSION}..."

    TEMP_DIR=$(mktemp -d)
    if [ "$OS_TYPE" = "mac" ]; then
        INSTALLER_FILE="${TEMP_DIR}/AiTer-${VERSION}-${OS_TYPE}-${ARCH_TYPE}.dmg"
    else
        INSTALLER_FILE="${TEMP_DIR}/AiTer-${VERSION}-${OS_TYPE}-${ARCH_TYPE}.exe"
    fi

    curl -L -# -o "$INSTALLER_FILE" "$DOWNLOAD_URL"

    if [ $? -ne 0 ]; then
        print_error "Download failed."
        rm -rf "$TEMP_DIR"
        exit 1
    fi

    print_success "Download completed: ${INSTALLER_FILE}"
}

# Remove macOS quarantine attribute
remove_quarantine_macos() {
    print_info "Removing macOS quarantine attribute..."

    if command -v xattr &> /dev/null; then
        xattr -d com.apple.quarantine "$1" 2>/dev/null || true
        print_success "Quarantine attribute removed"
    else
        print_warning "xattr command not found, skipping quarantine removal"
    fi
}

# Install on macOS
install_macos() {
    print_info "Installing AiTer on macOS..."

    # Remove quarantine attribute from DMG
    remove_quarantine_macos "$INSTALLER_FILE"

    # Mount DMG
    print_info "Mounting disk image..."
    MOUNT_POINT=$(hdiutil attach "$INSTALLER_FILE" | grep '/Volumes/' | sed 's/.*\(\/Volumes\/.*\)/\1/')

    if [ -z "$MOUNT_POINT" ]; then
        print_error "Failed to mount disk image"
        rm -rf "$TEMP_DIR"
        exit 1
    fi

    print_success "Mounted at: ${MOUNT_POINT}"

    # Find .app bundle
    APP_NAME=$(ls "$MOUNT_POINT" | grep '.app$' | head -1)

    if [ -z "$APP_NAME" ]; then
        print_error "Could not find .app bundle in disk image"
        hdiutil detach "$MOUNT_POINT" -quiet
        rm -rf "$TEMP_DIR"
        exit 1
    fi

    APP_PATH="${MOUNT_POINT}/${APP_NAME}"
    INSTALL_PATH="/Applications/${APP_NAME}"

    # Remove existing installation
    if [ -d "$INSTALL_PATH" ]; then
        print_warning "Removing existing installation..."
        rm -rf "$INSTALL_PATH"
    fi

    # Copy to Applications
    print_info "Copying to /Applications..."
    cp -R "$APP_PATH" /Applications/

    if [ $? -ne 0 ]; then
        print_error "Failed to copy application. You may need sudo privileges."
        hdiutil detach "$MOUNT_POINT" -quiet
        rm -rf "$TEMP_DIR"
        exit 1
    fi

    # Remove quarantine from installed app
    remove_quarantine_macos "$INSTALL_PATH"

    # Remove extended attributes recursively
    print_info "Removing all extended attributes from app bundle..."
    xattr -cr "$INSTALL_PATH" 2>/dev/null || true

    # Unmount DMG
    print_info "Unmounting disk image..."
    hdiutil detach "$MOUNT_POINT" -quiet

    print_success "AiTer has been installed to ${INSTALL_PATH}"

    # Bypass Gatekeeper on first launch
    print_info "Configuring first-launch Gatekeeper bypass..."
    if command -v spctl &> /dev/null; then
        sudo spctl --add "$INSTALL_PATH" 2>/dev/null || print_warning "Could not add to Gatekeeper whitelist (requires sudo)"
    fi

    print_success "Installation complete!"
    echo ""
    print_info "You can now launch AiTer from /Applications or Spotlight"
    print_info "If macOS shows a security warning on first launch:"
    echo "  1. Go to System Preferences > Privacy & Security"
    echo "  2. Click 'Open Anyway' next to the blocked app warning"
    echo "  Or run: sudo xattr -cr /Applications/AiTer.app"
}

# Install on Windows
install_windows() {
    print_info "Installing AiTer on Windows..."

    print_info "Running installer..."
    print_warning "Windows SmartScreen may block the installer."
    print_info "If blocked, click 'More info' then 'Run anyway'"

    # Run installer (will show GUI)
    cmd //c start //wait "$INSTALLER_FILE"

    print_success "Installation initiated. Please follow the on-screen instructions."
}

# Cleanup temporary files
cleanup() {
    print_info "Cleaning up temporary files..."
    rm -rf "$TEMP_DIR"
    print_success "Cleanup complete"
}

# Main installation flow
main() {
    echo ""
    echo "╔════════════════════════════════════════════╗"
    echo "║   AiTer Auto-Installer                     ║"
    echo "║   GitHub: github.com/within-7/aiter        ║"
    echo "╚════════════════════════════════════════════╝"
    echo ""

    detect_system
    get_latest_release
    download_installer

    if [ "$OS_TYPE" = "mac" ]; then
        install_macos
    elif [ "$OS_TYPE" = "win" ]; then
        install_windows
    fi

    cleanup

    echo ""
    print_success "🎉 All done! Enjoy using AiTer!"
    echo ""
}

# Run main function
main
