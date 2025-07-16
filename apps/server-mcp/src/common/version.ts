import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * @description
 * Current version of the Ever Gauzy Server.
 *
 * @example
 * ```
 * import { version } from './version';
 *
 * console.log('Ever Gauzy Server MCP Version:', version);
 * ```
 *
 * @since 0.1.0
 */

/**
 * Reads the version from package.json using fs.readFileSync
 * This approach works in ES modules without using import assertions
 */
function getVersion(): string {
	try {
		// In ES modules, we need to get __dirname equivalent
		const __filename = fileURLToPath(import.meta.url);
		const __dirname = dirname(__filename);

		// Try multiple possible paths for package.json
		const possiblePaths = [
			// When running from dist/apps/server-mcp/src/common/version.js
			join(__dirname, '../../package.json'),
			// When running from apps/server-mcp/build/src/common/version.js
			join(__dirname, '../../../package.json'),
			// Fallback to workspace root
			join(__dirname, '../../../../../package.json')
		];

		for (const packageJsonPath of possiblePaths) {
			try {
				const packageJsonContent = readFileSync(packageJsonPath, 'utf8');
				const packageJson = JSON.parse(packageJsonContent);

				// Return version if found and it's a valid package.json
				if (packageJson.version) {
					return packageJson.version;
				}
			} catch (error) {
				// try next path
				console.error(`Failed to read version from ${packageJsonPath}:`, error);
			}
		}

		// If no package.json found, return fallback
		return '0.1.0';
	} catch (error) {
		console.error('Failed to read version from package.json:', error);
		return '0.1.0'; // fallback version
	}
}

export const version: string = getVersion();

// Additional version info
export const versionInfo = {
	version,
	name: 'Gauzy MCP Server',
	description: 'Model Context Protocol server for Ever Gauzy',
	author: 'Ever Co. LTD',
	license: 'AGPL-3.0'
};
