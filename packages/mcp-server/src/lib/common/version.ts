import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Logger } from '@nestjs/common';

const logger = new Logger('Version');

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
 * Note: This approach requires proper __dirname setup to work correctly.
 * The module configuration must be set up to provide __dirname.
 */
function getVersion(): string {
	try {
		// __dirname is available in CommonJS by default

		// Try multiple possible paths for package.json
		const possiblePaths = [
			// When running from dist/packages/mcp-server/src/lib/common/version.js
			join(__dirname, '../../../package.json'),
			// When running from packages/mcp-server/src/lib/common/version.js
			join(__dirname, '../../../../package.json'),
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
				// Silently continue to next path
			}
		}

		// If no package.json found, return fallback
		return '0.1.0';
	} catch (error) {
		logger.error('Failed to read version from package.json:', error instanceof Error ? error.stack : undefined);
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
