import * as dotenv from 'dotenv';
import * as fs from 'node:fs';
import * as path from 'node:path';

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

	loadEnvFile(envPath, { override: true });
	loadEnvFile(envLocalPath);
}
