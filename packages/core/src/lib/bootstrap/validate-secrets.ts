import * as chalk from 'chalk';
import { environment } from '@gauzy/config';

/**
 * Known default/placeholder secret values shipped in the repository. Running a real deployment with
 * any of these is unsafe: the values are public, so anyone can forge authentication tokens and
 * sessions and impersonate any user (GHSA-chm8-2ggf-pgjq).
 */
const KNOWN_DEFAULT_SECRETS: ReadonlyArray<{ key: string; value: string }> = [
	{ key: 'JWT_SECRET', value: 'secretKey' },
	{ key: 'JWT_REFRESH_TOKEN_SECRET', value: 'refreshSecretKey' },
	{ key: 'JWT_VERIFICATION_TOKEN_SECRET', value: 'verificationSecretKey' },
	{ key: 'EXPRESS_SESSION_SECRET', value: 'gauzy' }
];

/**
 * Validates that the authentication/session secrets are not unset or left at their well-known
 * default values.
 *
 * - Always logs a prominent warning when weak secrets are detected (any environment).
 * - Additionally refuses to start in a real production deployment (`NODE_ENV=production` and
 *   `DEMO !== 'true'`), unless the operator explicitly opts out via `ALLOW_INSECURE_JWT_SECRET=true`.
 *
 * The daily-reset demo (`DEMO=true`) and local development are intentionally exempted from the hard
 * failure so they keep working out of the box, while still being warned.
 *
 * @throws Error in production (non-demo) when weak secrets are detected and the override is not set.
 */
export function validateApplicationSecrets(): void {
	const env = environment as unknown as Record<string, unknown>;

	const weak = KNOWN_DEFAULT_SECRETS.filter(({ key, value }) => {
		// Trim so whitespace-only values (e.g. " ") are treated as unset rather than a "strong" secret.
		const current = String((env[key] as string | undefined) ?? process.env[key] ?? '').trim();
		return !current || current === value;
	}).map(({ key }) => key);

	if (weak.length === 0) {
		return;
	}

	const guidance =
		'Generate strong, unique values (e.g. `openssl rand -hex 64`) and provide them via environment ' +
		'variables before deploying. Default/empty secrets let anyone forge authentication tokens and sessions.';

	// eslint-disable-next-line no-console
	console.error(chalk.bgRed.whiteBright.bold(` INSECURE SECRETS: ${weak.join(', ')} `));
	// eslint-disable-next-line no-console
	console.error(chalk.red(guidance));

	// Use the RUNTIME NODE_ENV (not only the build-time `environment.production` flag), so a deployment
	// that runs a non-prod build with NODE_ENV=production is still protected.
	const isProduction = process.env.NODE_ENV === 'production' || environment.production === true;
	const isDemo = process.env.DEMO === 'true';

	if (isProduction && !isDemo) {
		if (process.env.ALLOW_INSECURE_JWT_SECRET === 'true') {
			// eslint-disable-next-line no-console
			console.error(
				chalk.red(
					'Continuing despite insecure secrets because ALLOW_INSECURE_JWT_SECRET=true. This is STRONGLY discouraged.'
				)
			);
			return;
		}
		throw new Error(
			`Refusing to start: ${weak.join(', ')} ${weak.length === 1 ? 'is' : 'are'} unset or use a ` +
				`well-known default value in a production deployment. ${guidance} ` +
				'(To override temporarily, set ALLOW_INSECURE_JWT_SECRET=true — not recommended.)'
		);
	}
}

/**
 * Seeded accounts whose passwords ship with a publicly documented default value.
 *
 * `seedBasicDefaultData()` creates all three on the FIRST boot against an empty database,
 * regardless of `DEMO` — so a deployment that followed the README's production instructions ended
 * up with a fully privileged Super Admin (plus an Admin and an Employee) whose passwords are
 * printed in that same README (GHSA-4r2r-mv32-3468).
 */
const KNOWN_DEFAULT_SEED_CREDENTIALS: ReadonlyArray<{ key: string; value: string; account: string }> = [
	{ key: 'DEMO_SUPER_ADMIN_PASSWORD', value: 'admin', account: 'admin@ever.co (SUPER_ADMIN)' },
	{ key: 'DEMO_ADMIN_PASSWORD', value: 'admin', account: 'local.admin@ever.co (ADMIN)' },
	{ key: 'DEMO_EMPLOYEE_PASSWORD', value: '12345678', account: 'employee@ever.co (EMPLOYEE)' }
];

/**
 * Resolves the password the seeder would actually use for one of the default accounts.
 *
 * Reads the live `environment.demoCredentialConfig` first — that is the object
 * `DEFAULT_SUPER_ADMINS` / `DEFAULT_ADMINS` / `DEFAULT_EMPLOYEES` are built from, so it is the
 * value that would really be hashed into the database — and falls back to `process.env` so a test
 * or a tool that mutates the environment after the config module was evaluated still gets a
 * truthful answer.
 *
 * @param key - The environment variable backing the account's password.
 * @returns The effective password, trimmed.
 */
function resolveSeedPassword(key: string): string {
	const credentials = (environment.demoCredentialConfig ?? {}) as Record<string, string | undefined>;
	const fromConfig: Record<string, string | undefined> = {
		DEMO_SUPER_ADMIN_PASSWORD: credentials.superAdminPassword,
		DEMO_ADMIN_PASSWORD: credentials.adminPassword,
		DEMO_EMPLOYEE_PASSWORD: credentials.employeePassword
	};

	return String(process.env[key] ?? fromConfig[key] ?? '').trim();
}

/**
 * Validates that the accounts created by the default seed do not use their shipped passwords.
 *
 * Mirrors {@link validateApplicationSecrets} exactly:
 * - always logs a prominent warning when a default is still in place (any environment);
 * - additionally refuses to seed in a real production deployment (`NODE_ENV=production` and
 *   `DEMO !== 'true'`), unless the operator opts out via `ALLOW_INSECURE_SEED_CREDENTIALS=true`.
 *
 * Exemptions, and why they are safe:
 * - `DEMO=true` — the daily-reset demo is meant to be logged into with the documented credentials;
 * - `IS_ELECTRON` — the desktop Gauzy Server spawns this API locally against a private database,
 *   and the desktop README tells the user to sign in as `admin@ever.co`. Refusing to boot there
 *   would break the desktop product without closing any network-reachable hole.
 *
 * Call this BEFORE the seeder touches the database: `runDefaultSeed()` truncates every table before
 * it inserts, so an abort has to happen first to be harmless.
 *
 * @throws Error in production (non-demo, non-Electron) when a default seed password is detected.
 */
export function validateSeedCredentials(): void {
	const weak = KNOWN_DEFAULT_SEED_CREDENTIALS.filter(({ key, value }) => {
		const current = resolveSeedPassword(key);
		// Empty counts as weak: an unset variable is exactly how the shipped default is reached.
		return !current || current === value;
	});

	if (weak.length === 0) {
		return;
	}

	const keys = weak.map(({ key }) => key);
	const accounts = weak.map(({ account }) => account);
	const guidance =
		`Set ${keys.join(', ')} to strong, unique values before seeding a new deployment. ` +
		'These variables decide the passwords of the accounts created on the first boot against an ' +
		'empty database, and their defaults are published in this repository, so leaving them unset ' +
		'hands anyone who can reach the login page full control of the new instance.';

	// eslint-disable-next-line no-console
	console.error(chalk.bgRed.whiteBright.bold(` INSECURE SEED CREDENTIALS: ${keys.join(', ')} `));
	// eslint-disable-next-line no-console
	console.error(chalk.red(`Affected accounts: ${accounts.join(', ')}. ${guidance}`));

	// Use the RUNTIME NODE_ENV (not only the build-time `environment.production` flag), so a
	// deployment that runs a non-prod build with NODE_ENV=production is still protected.
	const isProduction = process.env.NODE_ENV === 'production' || environment.production === true;
	const isDemo = process.env.DEMO === 'true' || environment.demo === true;
	const isElectron = process.env.IS_ELECTRON === 'true' || environment.isElectron === true;

	if (isProduction && !isDemo && !isElectron) {
		if (process.env.ALLOW_INSECURE_SEED_CREDENTIALS === 'true') {
			// eslint-disable-next-line no-console
			console.error(
				chalk.red(
					'Continuing despite insecure seed credentials because ALLOW_INSECURE_SEED_CREDENTIALS=true. ' +
						'This is STRONGLY discouraged — rotate these accounts immediately after the seed.'
				)
			);
			return;
		}
		throw new Error(
			`Refusing to seed: ${keys.join(', ')} ${keys.length === 1 ? 'is' : 'are'} unset or use the ` +
				`well-known default value in a production deployment. ${guidance} ` +
				'(To override temporarily, set ALLOW_INSECURE_SEED_CREDENTIALS=true — not recommended.)'
		);
	}
}
