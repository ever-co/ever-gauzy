import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

/**
 * Names, as a comma-separated list, the variables `.env.local` does not override (for example
 * `ENV_LOCAL_NO_OVERRIDE=API_BASE_URL,CLIENT_BASE_URL`): each one the environment the API starts in sets keeps that
 * value. Only the starting environment counts, so writing the list in `.env` or `.env.local` changes nothing. The dev
 * container sets it in a GitHub Codespace for the forwarded URLs it computes (`.devcontainer/codespaces-env.sh`),
 * which the localhost values of the tracked `.env.local` would otherwise replace.
 */
export const ENV_LOCAL_NO_OVERRIDE = 'ENV_LOCAL_NO_OVERRIDE';

/**
 * The values `env` sets for the variables its `ENV_LOCAL_NO_OVERRIDE` names.
 *
 * @param {NodeJS.ProcessEnv} env - The environment the API starts in.
 * @returns {Record<string, string>} The variables to keep over `.env.local`, with their values.
 */
export function keptOverEnvLocal(env: NodeJS.ProcessEnv): Record<string, string> {
	const kept: Record<string, string> = {};
	for (const name of (env[ENV_LOCAL_NO_OVERRIDE] ?? '').split(',').map((entry) => entry.trim())) {
		const value = name ? env[name] : undefined;
		if (value !== undefined) {
			kept[name] = value;
		}
	}
	return kept;
}

/**
 * Load environment variables from a specified file.
 *
 * @param {string} envPath - The absolute path to the .env file.
 * @param {object} options - Options for dotenv configuration.
 * @param {boolean} [options.override=false] - Whether to override existing environment variables.
 */
export function loadEnvFile(envPath: string, options: { override?: boolean; quiet?: boolean } = {}): void {
	if (fs.existsSync(envPath)) {
		console.time(`✔ Load ${path.basename(envPath)} Time`);
		console.log(`Loading environment variables from: ${envPath}${options.override ? ' (override)' : ''}`);
		dotenv.config({ path: envPath, quiet: true, ...options });
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
		envLocal: path.resolve(currentDir, '.env.local')
	};

	console.log(`API Environment Paths: .env -> ${envPaths.env}, .env.local -> ${envPaths.envLocal}`);

	// Read before either file is loaded, so that only the starting environment's values are kept
	const kept = keptOverEnvLocal(process.env);

	// Load .env file as defaults (does not override existing variables)
	loadEnvFile(envPaths.env);

	// Load .env.local file with override (takes highest priority)
	loadEnvFile(envPaths.envLocal, { override: true });

	// Except over the variables ENV_LOCAL_NO_OVERRIDE names (names only: the values may be secrets)
	if (Object.keys(kept).length > 0) {
		Object.assign(process.env, kept);
		console.log(`Kept from the environment over .env.local: ${Object.keys(kept).join(', ')}`);
	}
}
