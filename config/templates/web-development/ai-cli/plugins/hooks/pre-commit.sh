#!/bin/bash
# Pre-commit hook: Run linter and type check

echo "🔍 Running pre-commit checks..."

# Check if npm is available
if ! command -v npm &> /dev/null; then
    echo "⚠️ npm not found, skipping checks"
    exit 0
fi

# Check if package.json exists
if [ ! -f "package.json" ]; then
    echo "⚠️ package.json not found, skipping checks"
    exit 0
fi

# Run ESLint if available
if grep -q '"lint"' package.json; then
    echo "📋 Running ESLint..."
    npm run lint --silent
    if [ $? -ne 0 ]; then
        echo "❌ Linting failed. Please fix errors before committing."
        exit 1
    fi
    echo "✅ Linting passed"
fi

# Run TypeScript type check if available
if grep -q '"type-check"' package.json; then
    echo "📝 Running TypeScript check..."
    npm run type-check --silent
    if [ $? -ne 0 ]; then
        echo "❌ Type check failed. Please fix type errors before committing."
        exit 1
    fi
    echo "✅ Type check passed"
fi

echo "✅ All pre-commit checks passed!"
exit 0
