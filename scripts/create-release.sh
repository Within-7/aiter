#!/bin/bash

# AiTer Release Creation Script
# This script automates the process of creating a new GitHub release
# Usage: ./scripts/create-release.sh [version]
# Example: ./scripts/create-release.sh 0.1.1

set -e  # Exit on error

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_info() {
    echo -e "${BLUE}ℹ ${NC}$1"
}

print_success() {
    echo -e "${GREEN}✓${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

print_header() {
    echo ""
    echo -e "${BLUE}═══════════════════════════════════════════════════════${NC}"
    echo -e "${BLUE}  $1${NC}"
    echo -e "${BLUE}═══════════════════════════════════════════════════════${NC}"
    echo ""
}

# Function to validate version format
validate_version() {
    if [[ ! $1 =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
        print_error "Invalid version format: $1"
        print_info "Version must follow semantic versioning: MAJOR.MINOR.PATCH"
        print_info "Example: 0.1.0, 1.0.0, 1.2.3"
        exit 1
    fi
}

# Function to check if tag already exists
check_tag_exists() {
    if git rev-parse "v$1" >/dev/null 2>&1; then
        print_error "Tag v$1 already exists!"
        print_info "Use a different version number or delete the existing tag:"
        print_info "  git tag -d v$1"
        print_info "  git push origin :refs/tags/v$1"
        exit 1
    fi
}

# Function to check git status
check_git_status() {
    if [[ -n $(git status -s) ]]; then
        print_warning "You have uncommitted changes:"
        git status -s
        echo ""
        read -p "Do you want to commit all changes before releasing? (y/n) " -n 1 -r
        echo ""
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            return 0
        else
            print_error "Please commit or stash your changes before creating a release."
            exit 1
        fi
    fi
    return 1
}

# Function to update package.json version
update_package_version() {
    local version=$1
    print_info "Updating package.json version to $version..."

    # Use Node.js to update package.json
    node -e "
        const fs = require('fs');
        const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
        pkg.version = '$version';
        fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2) + '\n');
    "

    print_success "package.json updated"
}

# Function to get commit message
get_commit_message() {
    local version=$1
    echo "chore: Release version $version

Bump version to $version for new release.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
}

# Main script starts here
print_header "AiTer Release Creation Script"

# Check if version is provided
if [ -z "$1" ]; then
    print_error "Version number is required!"
    echo ""
    echo "Usage: $0 <version>"
    echo "Example: $0 0.1.1"
    echo ""
    print_info "Current version in package.json:"
    node -e "console.log(require('./package.json').version)"
    exit 1
fi

VERSION=$1
TAG="v$VERSION"

print_info "Creating release for version: $VERSION"
print_info "Git tag will be: $TAG"
echo ""

# Step 1: Validate version format
print_info "Step 1/7: Validating version format..."
validate_version "$VERSION"
print_success "Version format is valid"

# Step 2: Check if tag exists
print_info "Step 2/7: Checking if tag already exists..."
check_tag_exists "$VERSION"
print_success "Tag does not exist, safe to proceed"

# Step 3: Check git status
print_info "Step 3/7: Checking git status..."
HAS_CHANGES=false
if check_git_status; then
    HAS_CHANGES=true
fi

# Step 4: Update package.json version
print_info "Step 4/7: Updating package.json version..."
update_package_version "$VERSION"

# Step 5: Commit changes (if any)
if [ "$HAS_CHANGES" = true ] || [[ -n $(git status -s) ]]; then
    print_info "Step 5/7: Committing changes..."
    git add -A
    COMMIT_MSG=$(get_commit_message "$VERSION")
    git commit -m "$COMMIT_MSG"
    print_success "Changes committed"
else
    print_info "Step 5/7: No changes to commit"
fi

# Step 6: Create and push tag
print_info "Step 6/7: Creating git tag..."
git tag -a "$TAG" -m "Release version $VERSION"
print_success "Tag created: $TAG"

print_info "Step 7/7: Pushing to GitHub..."
echo ""
print_warning "This will push commits and tag to GitHub, which will trigger the release workflow."
read -p "Continue? (y/n) " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    print_error "Release cancelled by user"
    print_warning "Rolling back tag creation..."
    git tag -d "$TAG"
    print_info "Tag deleted. You can run this script again when ready."
    exit 1
fi

# Push commits and tag
git push origin main
git push origin "$TAG"

print_success "Tag pushed to GitHub"

# Display summary
print_header "Release Summary"
echo -e "  Version:      ${GREEN}$VERSION${NC}"
echo -e "  Git Tag:      ${GREEN}$TAG${NC}"
echo -e "  Status:       ${GREEN}Success${NC}"
echo ""
print_info "GitHub Actions will now build and create the release automatically."
print_info "Monitor progress at:"
echo -e "  ${BLUE}https://github.com/Within-7/aiter/actions${NC}"
echo ""
print_info "Once complete, the release will be available at:"
echo -e "  ${BLUE}https://github.com/Within-7/aiter/releases/tag/$TAG${NC}"
echo ""
print_success "Release creation initiated successfully! 🎉"
echo ""
