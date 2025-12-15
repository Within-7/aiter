#!/bin/bash

# Script to download Node.js LTS binaries for AiTer
# Downloads only the necessary binaries based on the current platform

set -e

# Configuration
NODE_VERSION="v20.18.0"  # LTS version as of 2024
BASE_URL="https://nodejs.org/dist"
RESOURCES_DIR="./resources/nodejs"

# Create resources directory
mkdir -p "$RESOURCES_DIR"

# Detect current OS - more robust detection
CURRENT_OS="unknown"
if [[ "$OSTYPE" == "darwin"* ]]; then
    CURRENT_OS="darwin"
elif [[ "$OSTYPE" == "msys"* ]] || [[ "$OSTYPE" == "win32" ]] || [[ "$OSTYPE" == "cygwin" ]]; then
    CURRENT_OS="win32"
elif [[ "$(uname -s)" == "Darwin" ]]; then
    CURRENT_OS="darwin"
elif [[ "$(uname -s)" == MINGW* ]] || [[ "$(uname -s)" == MSYS* ]] || [[ "$(uname -s)" == CYGWIN* ]]; then
    CURRENT_OS="win32"
fi

echo "Detected OSTYPE: ${OSTYPE}"
echo "Detected uname -s: $(uname -s)"
echo "Current OS: ${CURRENT_OS}"

# Function to download and extract Node.js
download_nodejs() {
    local platform=$1
    local arch=$2
    local ext=$3
    local save_as_platform=${4:-$platform}  # Optional 4th arg for directory name

    local filename="node-${NODE_VERSION}-${platform}-${arch}.${ext}"
    local url="${BASE_URL}/${NODE_VERSION}/${filename}"
    local target_dir="${RESOURCES_DIR}/${save_as_platform}-${arch}"

    # Use a temporary directory that works on both Unix and Windows
    local temp_file="${filename}"

    echo "Downloading Node.js ${NODE_VERSION} for ${platform}-${arch}..."
    echo "URL: ${url}"

    # Create target directory
    mkdir -p "${target_dir}"

    # Download file with retry and verification
    echo "Downloading to: ${temp_file}"
    if command -v curl &> /dev/null; then
        # Use curl with follow redirects and fail on error
        curl -f -L --retry 3 --retry-delay 2 "${url}" -o "${temp_file}"
    elif command -v wget &> /dev/null; then
        wget --retry-connrefused --waitretry=2 --read-timeout=20 --timeout=15 -t 3 "${url}" -O "${temp_file}"
    else
        echo "Error: Neither curl nor wget found"
        exit 1
    fi

    # Verify file was downloaded
    if [ ! -f "${temp_file}" ]; then
        echo "Error: Downloaded file not found: ${temp_file}"
        exit 1
    fi

    # Check file size
    local file_size=$(stat -f%z "${temp_file}" 2>/dev/null || stat -c%s "${temp_file}" 2>/dev/null || echo "0")
    echo "Downloaded file size: ${file_size} bytes"
    if [ "${file_size}" -lt 10000000 ]; then
        echo "Warning: File size seems too small (< 10MB)"
    fi

    # Extract based on extension
    if [ "${ext}" = "tar.gz" ]; then
        echo "Extracting ${filename}..."
        tar -xzf "${temp_file}" -C "${target_dir}" --strip-components=1
    elif [ "${ext}" = "zip" ]; then
        echo "Extracting ${filename}..."
        echo "Archive file: ${temp_file}"
        echo "Target directory: ${target_dir}"

        # Test zip file integrity first
        if command -v unzip &> /dev/null; then
            # Test the zip file
            echo "Testing zip file integrity..."
            if ! unzip -t "${temp_file}" > /dev/null 2>&1; then
                echo "Error: ZIP file is corrupted or incomplete"
                ls -lh "${temp_file}"
                exit 1
            fi

            echo "ZIP file is valid, extracting..."
            unzip -q "${temp_file}" -d "${target_dir}"
        else
            # Fallback for Windows runners without unzip - use PowerShell
            echo "Using PowerShell to extract..."
            # Get absolute paths
            local abs_temp_file=$(cd "$(dirname "${temp_file}")" && pwd)/$(basename "${temp_file}")
            local abs_target_dir=$(cd "$(dirname "${target_dir}")" && pwd)/$(basename "${target_dir}")

            # Convert Unix path to Windows path for PowerShell
            local win_temp_file=$(cygpath -w "${abs_temp_file}" 2>/dev/null || echo "${abs_temp_file}")
            local win_target_dir=$(cygpath -w "${abs_target_dir}" 2>/dev/null || echo "${abs_target_dir}")

            echo "PowerShell source: ${win_temp_file}"
            echo "PowerShell target: ${win_target_dir}"

            powershell.exe -Command "Expand-Archive -Path '${win_temp_file}' -DestinationPath '${win_target_dir}' -Force"
        fi

        # Move files from nested directory
        if [ -d "${target_dir}/node-${NODE_VERSION}-${platform}-${arch}" ]; then
            echo "Moving files from nested directory..."
            mv "${target_dir}/node-${NODE_VERSION}-${platform}-${arch}"/* "${target_dir}/" 2>/dev/null || true
            rmdir "${target_dir}/node-${NODE_VERSION}-${platform}-${arch}" 2>/dev/null || true
        fi
    fi

    # Clean up
    rm -f "${temp_file}"

    echo "✓ Downloaded and extracted ${platform}-${arch}"
}

# Download based on current platform
if [ "$CURRENT_OS" = "darwin" ]; then
    echo "Building for macOS - downloading both Intel and Apple Silicon binaries..."
    download_nodejs "darwin" "x64" "tar.gz"
    download_nodejs "darwin" "arm64" "tar.gz"
elif [ "$CURRENT_OS" = "win32" ]; then
    echo "Building for Windows - downloading Windows binary..."
    # Note: Node.js uses "win" in download URLs, but we save to "win32" directory for electron-builder
    download_nodejs "win" "x64" "zip" "win32"
else
    echo "Error: Unsupported OS ${CURRENT_OS}"
    exit 1
fi

echo ""
echo "✓ All Node.js binaries downloaded successfully!"
echo ""
echo "Directory structure:"
if command -v tree &> /dev/null; then
    tree -L 2 "${RESOURCES_DIR}"
else
    ls -R "${RESOURCES_DIR}"
fi
