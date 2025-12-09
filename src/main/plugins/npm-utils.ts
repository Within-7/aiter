/**
 * npm-utils.ts
 *
 * Utility functions for working with npm packages and registry
 */

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

/**
 * Parse npm package URL to extract package name
 * Supports formats:
 * - https://www.npmjs.com/package/@scope/package-name
 * - https://npmjs.com/package/@scope/package-name
 * - https://www.npmjs.com/package/package-name
 * - @scope/package-name (direct package name)
 * - package-name (direct package name)
 */
export function parseNpmUrl(urlOrPackageName: string): string | null {
  const trimmed = urlOrPackageName.trim();

  // If it's already a package name (contains @scope/ or just alphanumeric-dash)
  if (/^(@[\w-]+\/)?[\w-]+$/.test(trimmed)) {
    return trimmed;
  }

  // Try to parse as URL
  try {
    const url = new URL(trimmed);

    // Extract from npmjs.com URL pattern: /package/<package-name>
    const match = url.pathname.match(/\/package\/(@?[\w-]+(?:\/[\w-]+)?)/);
    if (match) {
      return match[1];
    }
  } catch {
    // Not a valid URL, return null
  }

  return null;
}

/**
 * npm package metadata from registry
 */
export interface NpmPackageMetadata {
  name: string;
  version: string;  // latest version
  description: string;
  author?: {
    name?: string;
    email?: string;
  } | string;
  homepage?: string;
  repository?: {
    type: string;
    url: string;
  } | string;
  keywords?: string[];
  license?: string;
  bin?: string | Record<string, string>;  // Command(s) provided by the package
}

/**
 * Fetch package metadata from npm registry
 * Uses `npm view <package> --json` command
 */
export async function fetchNpmPackageMetadata(
  packageName: string,
  env?: NodeJS.ProcessEnv,
  npmPath?: string
): Promise<NpmPackageMetadata> {
  try {
    const npmExecutable = npmPath || 'npm';
    console.log(`[npm-utils] Fetching metadata for ${packageName} using npm: ${npmExecutable}`);

    const { stdout } = await execFileAsync(npmExecutable, ['view', packageName, '--json'], {
      env: env || process.env,
      maxBuffer: 10 * 1024 * 1024,
    });

    const data = JSON.parse(stdout);

    // Extract author name
    let authorName = 'Unknown';
    if (data.author) {
      if (typeof data.author === 'string') {
        authorName = data.author;
      } else if (data.author.name) {
        authorName = data.author.name;
      }
    }

    // Extract homepage
    let homepage = data.homepage;
    if (!homepage && data.repository) {
      if (typeof data.repository === 'string') {
        homepage = data.repository;
      } else if (data.repository.url) {
        homepage = data.repository.url.replace(/^git\+/, '').replace(/\.git$/, '');
      }
    }

    return {
      name: data.name,
      version: data.version,
      description: data.description || 'No description available',
      author: data.author,
      homepage,
      repository: data.repository,
      keywords: data.keywords || [],
      license: data.license,
      bin: data.bin,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to fetch package metadata: ${message}`);
  }
}

/**
 * Extract command name from package name
 * For scoped packages like @scope/package, returns 'package'
 * For regular packages, returns the package name
 *
 * @deprecated Use getCommandNameFromMetadata() instead to get the actual command name from bin field
 */
export function getCommandNameFromPackage(packageName: string): string {
  const parts = packageName.split('/');
  return parts.length > 1 ? parts[1] : packageName;
}

/**
 * Extract the actual command name from package metadata
 * Reads from the bin field to get the real command name(s) provided by the package
 *
 * Examples:
 * - @google/gemini-cli has bin: { "gemini": "dist/index.js" } → returns "gemini"
 * - @within-7/minto has bin: { "minto": "dist/index.js" } → returns "minto"
 * - package with bin: "dist/cli.js" → returns package name without scope
 */
export function getCommandNameFromMetadata(metadata: NpmPackageMetadata): string {
  if (!metadata.bin) {
    // No bin field, fallback to package name extraction
    return getCommandNameFromPackage(metadata.name);
  }

  if (typeof metadata.bin === 'string') {
    // Single command, name is the package name without scope
    return getCommandNameFromPackage(metadata.name);
  }

  // Multiple commands in object format, take the first one
  const commands = Object.keys(metadata.bin);
  if (commands.length > 0) {
    console.log(`[npm-utils] Package ${metadata.name} provides commands: ${commands.join(', ')}, using: ${commands[0]}`);
    return commands[0];
  }

  // Fallback
  return getCommandNameFromPackage(metadata.name);
}
