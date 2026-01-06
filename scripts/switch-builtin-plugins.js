#!/usr/bin/env node

/**
 * Switch Built-in Plugins Configuration
 *
 * This script copies the appropriate builtin-plugins configuration file
 * based on the build variant (internal, public, or default).
 *
 * Usage:
 *   node scripts/switch-builtin-plugins.js [variant]
 *
 * Variants:
 *   - default (or no argument): Uses builtin-plugins.json as-is
 *   - internal: Copies builtin-plugins.internal.json to builtin-plugins.json
 *   - public: Copies builtin-plugins.public.json to builtin-plugins.json
 *
 * Examples:
 *   node scripts/switch-builtin-plugins.js internal
 *   node scripts/switch-builtin-plugins.js public
 *   node scripts/switch-builtin-plugins.js          # uses default
 */

const fs = require('fs');
const path = require('path');

const CONFIG_DIR = path.join(__dirname, '..', 'config');
const TARGET_FILE = 'builtin-plugins.json';

const VARIANTS = {
  default: 'builtin-plugins.json',
  internal: 'builtin-plugins.internal.json',
  public: 'builtin-plugins.public.json',
};

function switchConfig(variant) {
  const variantLower = (variant || 'default').toLowerCase();

  if (!VARIANTS[variantLower]) {
    console.error(`Error: Unknown variant "${variant}"`);
    console.error(`Available variants: ${Object.keys(VARIANTS).join(', ')}`);
    process.exit(1);
  }

  const sourceFile = VARIANTS[variantLower];
  const sourcePath = path.join(CONFIG_DIR, sourceFile);
  const targetPath = path.join(CONFIG_DIR, TARGET_FILE);

  // Check if source file exists
  if (!fs.existsSync(sourcePath)) {
    console.error(`Error: Source file not found: ${sourcePath}`);
    process.exit(1);
  }

  // If default variant, just verify the target exists
  if (variantLower === 'default') {
    if (fs.existsSync(targetPath)) {
      console.log(`✓ Using default configuration: ${TARGET_FILE}`);
      printConfigSummary(targetPath);
      return;
    } else {
      console.error(`Error: Default config file not found: ${targetPath}`);
      process.exit(1);
    }
  }

  // Copy variant config to target
  try {
    const content = fs.readFileSync(sourcePath, 'utf-8');
    fs.writeFileSync(targetPath, content, 'utf-8');
    console.log(`✓ Switched to ${variantLower} configuration`);
    console.log(`  Copied: ${sourceFile} → ${TARGET_FILE}`);
    printConfigSummary(targetPath);
  } catch (error) {
    console.error(`Error copying config file: ${error.message}`);
    process.exit(1);
  }
}

function printConfigSummary(configPath) {
  try {
    const content = fs.readFileSync(configPath, 'utf-8');
    const config = JSON.parse(content);
    console.log(`\n  Configuration summary:`);
    console.log(`  - Description: ${config.description || 'N/A'}`);
    console.log(`  - Plugins count: ${config.plugins?.length || 0}`);
    if (config.plugins && config.plugins.length > 0) {
      console.log(`  - Plugins: ${config.plugins.map(p => p.name).join(', ')}`);
    }
  } catch (error) {
    console.warn(`  Warning: Could not read config summary: ${error.message}`);
  }
}

// Run if called directly
if (require.main === module) {
  const variant = process.argv[2];
  switchConfig(variant);
}

module.exports = { switchConfig, VARIANTS };
