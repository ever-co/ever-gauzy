import * as dotenv from 'dotenv';
import * as fs from 'node:fs';
import * as path from 'node:path';

/**
 * Names, as a comma-separated list, the variables `.env.local` does not override: each one the environment the worker
 * starts in sets keeps that value. Only the starting environment counts. The same rule as the API's
 * (`apps/api/src/load-env.ts`), which the dev container relies on in a GitHub Codespace.
 */
export const ENV_LOCAL_NO_OVERRIDE = 'ENV_LOCAL_NO_OVERRIDE';

/** The values `env` sets for the variables its `ENV_LOCAL_NO_OVERRIDE` names. */
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

function loadEnvFile(envPath: string, options: { override?: boolean } = {}): void {
	if (!fs.existsSync(envPath)) {
		return;
	}

	dotenv.config({ path: envPath, quiet: true, ...options });
}

export function loadEnv(): void {
	const cwd = process.cwd();
	const envPath = path.resolve(cwd, '.env');
	const envLocalPath = path.resolve(cwd, '.env.local');
	const kept = keptOverEnvLocal(process.env);

	loadEnvFile(envPath);
	loadEnvFile(envLocalPath, { override: true });
	Object.assign(process.env, kept);
}
