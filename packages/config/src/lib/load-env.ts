import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
import { Logger } from '@nestjs/common';

const logger: Logger = new Logger('GZY - Environment Variables');

/**
 * Load environment variables from a specified file.
 *
 * @param {string} envPath - The absolute path to the .env file.
 * @param {object} options - Options for dotenv configuration.
 * @param {boolean} [options.override=false] - Whether to override existing environment variables.
 */
function loadEnvFile(envPath: string, options: { override?: boolean } = {}): void {
	dotenv.config({ path: envPath, ...options });
	logger.verbose(`Values loaded from: ${envPath}`);
}

/**
 * Load environment variables from .env or .env.local files.
 */
export function loadEnv(): void {
	const currentDir = process.cwd();
	const dotenvPath = path.resolve(currentDir, '.env');
	const dotenvLocalPath = path.resolve(currentDir, '.env.local');

	// Load env variables from correct file file with override
	loadEnvFile(fs.existsSync(dotenvPath) ? dotenvPath : dotenvLocalPath, { override: true });
}
