import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

/**
 * Load environment variables from a specified file.
 *
 * @param {string} envPath - The absolute path to the .env file.
 * @param {object} options - Options for dotenv configuration.
 * @param {boolean} [options.override=false] - Whether to override existing environment variables.
 */
export function loadEnvFile(envPath: string, options: { override?: boolean } = {}): void {
	if (fs.existsSync(envPath)) {
		console.time(`✔ Load ${path.basename(envPath)} Time`);
		console.log(`Loading environment variables from: ${envPath}${options.override ? ' (override)' : ''}`);
		dotenv.config({ path: envPath, ...options });
		console.timeEnd(`✔ Load ${path.basename(envPath)} Time`);
	}
}

/**
 * Load environment variables from .env and .env.local files.
 */
export function loadEnv(): void {
	const currentDir = process.cwd();
	console.log('Current API Directory:', currentDir);

	// Define paths for environment files
	const envPaths = {
		env: path.resolve(currentDir, '.env'),
		envLocal: path.resolve(currentDir, '.env.local'),
	};

	console.log(`API Environment Paths: .env -> ${envPaths.env}, .env.local -> ${envPaths.envLocal}`);

	// Load .env file with override
	loadEnvFile(envPaths.env, { override: true });

	// Load .env.local file without overriding existing variables
	loadEnvFile(envPaths.envLocal);
}
