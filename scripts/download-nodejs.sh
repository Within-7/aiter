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

# Detect current OS
CURRENT_OS="unknown"
if [[ "$OSTYPE" == "darwin"* ]]; then
    CURRENT_OS="darwin"
elif [[ "$OSTYPE" == "msys" ]] || [[ "$OSTYPE" == "win32" ]] || [[ "$OSTYPE" == "cygwin" ]]; then
    CURRENT_OS="win32"
fi

echo "Detected OS: ${CURRENT_OS}"

# Function to download and extract Node.js
download_nodejs() {
    local platform=$1
    local arch=$2
    local ext=$3

    local filename="node-${NODE_VERSION}-${platform}-${arch}.${ext}"
    local url="${BASE_URL}/${NODE_VERSION}/${filename}"
    local target_dir="${RESOURCES_DIR}/${platform}-${arch}"

    echo "Downloading Node.js ${NODE_VERSION} for ${platform}-${arch}..."
    echo "URL: ${url}"

    # Create target directory
    mkdir -p "${target_dir}"

    # Download file
    if command -v curl &> /dev/null; then
        curl -# -L "${url}" -o "/tmp/${filename}"
    elif command -v wget &> /dev/null; then
        wget -q --show-progress "${url}" -O "/tmp/${filename}"
    else
        echo "Error: Neither curl nor wget found"
        exit 1
    fi

    # Extract based on extension
    if [ "${ext}" = "tar.gz" ]; then
        echo "Extracting ${filename}..."
        tar -xzf "/tmp/${filename}" -C "${target_dir}" --strip-components=1
    elif [ "${ext}" = "zip" ]; then
        echo "Extracting ${filename}..."
        if command -v unzip &> /dev/null; then
            unzip -q "/tmp/${filename}" -d "${target_dir}"
        else
            # Fallback for Windows runners without unzip
            powershell -Command "Expand-Archive -Path '/tmp/${filename}' -DestinationPath '${target_dir}' -Force"
        fi
        # Move files from nested directory
        if [ -d "${target_dir}/node-${NODE_VERSION}-${platform}-${arch}" ]; then
            mv "${target_dir}/node-${NODE_VERSION}-${platform}-${arch}"/* "${target_dir}/"
            rmdir "${target_dir}/node-${NODE_VERSION}-${platform}-${arch}"
        fi
    fi

    # Clean up
    rm "/tmp/${filename}"

    echo "✓ Downloaded and extracted ${platform}-${arch}"
}

# Download based on current platform
if [ "$CURRENT_OS" = "darwin" ]; then
    echo "Building for macOS - downloading both Intel and Apple Silicon binaries..."
    download_nodejs "darwin" "x64" "tar.gz"
    download_nodejs "darwin" "arm64" "tar.gz"
elif [ "$CURRENT_OS" = "win32" ]; then
    echo "Building for Windows - downloading Windows binary..."
    download_nodejs "win32" "x64" "zip"
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
