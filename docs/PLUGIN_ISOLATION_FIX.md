# Plugin Installation Isolation Fix

## Issue Description

When a plugin was installed in the production environment, the development environment would incorrectly show the plugin as "installed" even though the plugin binary was not present in the development environment's bin directory.

## Root Cause

The issue was **historical data** in the development environment's `plugin-registry.json` file from before the dev/production isolation was implemented. The registry contained plugin definitions in the `custom` section that made the plugin appear in the UI, even though `installedVersion` was `null`.

## Timeline

1. Development/production isolation was implemented in `src/main/index.ts`
2. Separate userData directories were configured:
   - Production: `/Users/lib/Library/Application Support/AiTer`
   - Development: `/Users/lib/Library/Application Support/AiTer-Dev`
3. Before isolation, some plugins were added to the registry
4. After isolation implementation, this historical data remained in the dev registry
5. When loading plugins, the dev environment would show these historical plugins

## Solution

Clean the development environment's `plugin-registry.json` to remove any stale plugin definitions from the `custom` section.

### Steps Applied

1. Backed up the existing registry file
2. Removed all plugin definitions from the `custom` section
3. Kept only the base structure with an empty `custom` object
4. Restarted the application

### File Modified

```
/Users/lib/Library/Application Support/AiTer-Dev/plugin-registry.json
```

**Before:**
```json
{
  "plugins": {
    "registry": {
      "minto": {
        "id": "minto",
        "enabled": true,
        "installedVersion": null,
        "lastChecked": null,
        "configuration": {}
      },
      "@anthropic-ai/claude-code": {
        "id": "@anthropic-ai/claude-code",
        "enabled": true,
        "installedVersion": null,
        "lastChecked": null,
        "configuration": {}
      }
    },
    "custom": {
      "@anthropic-ai/claude-code": {
        "packageName": "@anthropic-ai/claude-code",
        "commandName": "claude",
        // ... plugin definition
      }
    }
  }
}
```

**After:**
```json
{
  "plugins": {
    "registry": {
      "minto": {
        "id": "minto",
        "enabled": true,
        "installedVersion": null,
        "lastChecked": null,
        "configuration": {}
      }
    },
    "custom": {}
  }
}
```

## Verification

After the fix:
- Development environment: Shows only base Node.js binaries (node, npm, npx, corepack)
- Production environment: Shows all installed plugin binaries (claude, gemini, minto, etc.)
- Both environments are properly isolated

## Prevention

This was a one-time cleanup issue. The isolation code is working correctly for all new operations:

1. **Separate Registries**: Each environment has its own `plugin-registry.json`
2. **Separate npm Installations**: Each environment uses its own `npm_config_prefix`
3. **Separate Binary Directories**: Plugins are installed to environment-specific bin directories
4. **Proper Detection**: `getCurrentVersion()` checks the correct environment's global node_modules

## Code References

The isolation implementation is in:
- `src/main/index.ts:13-39` - Environment detection and userData separation
- `src/main/plugins/PluginManager.ts:142-186` - Custom plugin loading
- `src/main/plugins/installers/NpmPluginInstaller.ts:102-126` - Version detection

## Date

2025-12-17
