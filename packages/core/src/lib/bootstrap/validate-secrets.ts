import * as chalk from 'chalk';
import { environment, isGeneratedSecret } from '@gauzy/config';
import { isKnownDefaultSecret } from '@gauzy/contracts';

/**
 * The authentication/session secrets checked at startup. Each is weak when it is unset, blank, one
 * of the published `KNOWN_DEFAULT_SECRETS` (whichever key it was published for — `refreshSecretKey`
 * as JWT_SECRET is just as public), or the per-process random value `@gauzy/config` substitutes when
 * the variable is unset (GHSA-chm8-2ggf-pgjq, GHSA-39j7-x845-4w3c).
 */
const CHECKED_SECRETS: ReadonlyArray<string> = [
	'JWT_SECRET',
	'JWT_REFRESH_TOKEN_SECRET',
	'JWT_VERIFICATION_TOKEN_SECRET',
	'EXPRESS_SESSION_SECRET'
];

/**
 * Validates that the authentication/session secrets are not unset or left at their well-known
 * default values.
 *
 * - Always logs a prominent warning when weak secrets are detected (any environment).
 * - Additionally refuses to start in a real production deployment (`NODE_ENV=production` and
 *   `DEMO !== 'true'`), unless the operator explicitly opts out via `ALLOW_INSECURE_JWT_SECRET=true`.
 *
 * An unset secret no longer means a published literal anywhere, DEMO included: `@gauzy/config`
 * substitutes a random per-process value (see `resolveSecret`), which this guard still reports as
 * "unset". The daily-reset demo and local development are exempted from the hard FAILURE so they
 * keep booting out of the box, and both are still warned — but neither can sign with a key that is
 * printed in this repository any more.
 *
 * @throws Error in production (non-demo) when weak secrets are detected and the override is not set.
 */
export function validateApplicationSecrets(): void {
	const env = environment as unknown as Record<string, unknown>;

	const weak = CHECKED_SECRETS.filter((key) => {
		const inUse = (env[key] as string | undefined) ?? process.env[key];
		// Trim so whitespace-only values (e.g. " ") are treated as unset rather than a "strong" secret.
		const current = String(inUse ?? '').trim();
		return !current || isKnownDefaultSecret(current) || isGeneratedSecret(key, inUse);
	});

	if (weak.length === 0) {
		return;
	}

	const guidance =
		'Generate strong, unique values (e.g. `openssl rand -hex 64`) and provide them via environment ' +
		'variables before deploying. Default secrets let anyone forge authentication tokens and sessions; ' +
		'unset secrets are replaced by a random value that lives only as long as this process.';

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
const KNOWN_DEFAULT_SEED_CREDENTIALS: ReadonlyArray<{
	key: string;
	value: string;
	email: string;
	role: string;
}> = [
	{ key: 'DEMO_SUPER_ADMIN_PASSWORD', value: 'admin', email: 'admin@ever.co', role: 'SUPER_ADMIN' },
	{ key: 'DEMO_ADMIN_PASSWORD', value: 'admin', email: 'local.admin@ever.co', role: 'ADMIN' },
	{ key: 'DEMO_EMPLOYEE_PASSWORD', value: '12345678', email: 'employee@ever.co', role: 'EMPLOYEE' }
];

/**
 * The seeded default accounts paired with their PUBLISHED passwords, for checking an existing
 * database: an install seeded before the seed guard existed, and never rotated, still has them
 * (GHSA-4r2r-mv32-3468). Emails come from the live config, since that is what was seeded.
 */
export function getPublishedSeedAccounts(): Array<{ email: string; password: string }> {
	const credentials = (environment.demoCredentialConfig ?? {}) as Record<string, string | undefined>;
	const configuredEmails: Record<string, string | undefined> = {
		DEMO_SUPER_ADMIN_PASSWORD: credentials.superAdminEmail,
		DEMO_ADMIN_PASSWORD: credentials.adminEmail,
		DEMO_EMPLOYEE_PASSWORD: credentials.employeeEmail
	};

	// BOTH the currently configured address and the canonical published one. The database was seeded
	// at some point in the past: an operator who changed DEMO_SUPER_ADMIN_EMAIL afterwards still has
	// the original `admin@ever.co` row, with the published password, and checking only today's
	// configuration would walk straight past it.
	const seen = new Set<string>();
	const accounts: Array<{ email: string; password: string }> = [];
	for (const { key, value, email } of KNOWN_DEFAULT_SEED_CREDENTIALS) {
		for (const candidate of [configuredEmails[key], email]) {
			const normalized = String(candidate ?? '').trim();
			if (!normalized) {
				continue;
			}
			// Deduplicated on the pair, so the usual case (configuration unchanged) still yields three.
			const fingerprint = `${normalized.toLowerCase()} :: ${value}`;
			if (seen.has(fingerprint)) {
				continue;
			}
			seen.add(fingerprint);
			accounts.push({ email: normalized, password: value });
		}
	}
	return accounts;
}

/**
 * Resolves the password the seeder would actually use for one of the default accounts.
 *
 * Reads the live `environment.demoCredentialConfig` first — that is the object
 * `DEFAULT_SUPER_ADMINS` / `DEFAULT_ADMINS` / `DEFAULT_EMPLOYEES` are built from, so it is the
 * value that would really be hashed into the database. `process.env` is consulted only when the
 * config carries no value at all. The other order let a variable set AFTER the config was evaluated
 * satisfy this check while the seed still hashed the published default captured earlier.
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

	return String(fromConfig[key] ?? process.env[key] ?? '').trim();
}

/**
 * Options for {@link validateSeedCredentials}.
 */
export interface SeedCredentialOptions {
	/**
	 * Whether this seed also creates the fixture accounts (`DEFAULT_EVER_EMPLOYEES`, created by the
	 * `ever` and `all` seed types). Their password is hard-coded and published, and no variable
	 * rotates it, so such a seed is refused in production outright.
	 */
	readonly createsFixtureAccounts?: boolean;
}

/**
 * Validates that the accounts created by a seed do not use published passwords.
 *
 * Mirrors {@link validateApplicationSecrets} exactly:
 * - always logs a prominent warning when a published password is still in place (any environment);
 * - additionally refuses to seed in a real production deployment (`NODE_ENV=production` or a
 *   production build, and `DEMO !== 'true'`), unless the operator opts out via
 *   `ALLOW_INSECURE_SEED_CREDENTIALS=true`.
 *
 * Exemptions:
 * - `DEMO=true` — the daily-reset demo is meant to be logged into with the documented credentials;
 * - `IS_ELECTRON` — the desktop Gauzy Server spawns this API locally against a private database,
 *   and the desktop README tells the user to sign in as `admin@ever.co`. Refusing to boot there
 *   would break the desktop product. This exemption is NOT harmless: every desktop launcher binds
 *   the API to `0.0.0.0` (remote timers connect to it), so the published seed passwords are
 *   reachable from the LAN — or further, if the port is forwarded — until the user rotates them.
 *   It stays only until the desktop apps seed random per-install passwords and show them in the
 *   setup UI (GHSA-4r2r-mv32-3468 residual).
 *
 * This only runs when a seed is about to run. The boot-time seed runs only against a database with
 * no users, so an existing deployment is never refused by it.
 *
 * Call this BEFORE the seeder touches the database: `runDefaultSeed()` truncates every table before
 * it inserts, so an abort has to happen first to be harmless.
 *
 * @param options - What the seed about to run creates.
 * @throws Error in production (non-demo, non-Electron) when a published seed password is detected.
 */
export function validateSeedCredentials(options: SeedCredentialOptions = {}): void {
	const weak = KNOWN_DEFAULT_SEED_CREDENTIALS.filter(({ key, value }) => {
		const current = resolveSeedPassword(key);
		// Empty counts as weak: an unset variable is exactly how the shipped default is reached.
		return !current || current === value;
	});
	const fixtures = options.createsFixtureAccounts === true;

	if (weak.length === 0 && !fixtures) {
		return;
	}

	const keys = weak.map(({ key }) => key);
	const accounts = weak.map(({ email, role }) => `${email} (${role})`);
	const problems: string[] = [];

	if (weak.length > 0) {
		problems.push(
			`${keys.join(', ')} ${keys.length === 1 ? 'is' : 'are'} unset or use the well-known default value ` +
				`(affected accounts: ${accounts.join(', ')}). Set ${keys.length === 1 ? 'it' : 'them'} to strong, ` +
				'unique values before seeding a new deployment: these variables decide the passwords of the ' +
				'accounts created on the first boot against an empty database, and their defaults are published ' +
				'in this repository, so leaving them unset hands anyone who can reach the login page full control ' +
				'of the new instance.'
		);
	}
	if (fixtures) {
		problems.push(
			'This seed type also creates the DEFAULT_EVER_EMPLOYEES fixture accounts, whose password is ' +
				'hard-coded and published in this repository and cannot be rotated through configuration. Use ' +
				'the default seed (`yarn seed`) for a real deployment.'
		);
	}
	const guidance = problems.join(' ');

	// eslint-disable-next-line no-console
	console.error(
		chalk.bgRed.whiteBright.bold(
			` INSECURE SEED CREDENTIALS: ${[...keys, ...(fixtures ? ['fixture accounts'] : [])].join(', ')} `
		)
	);
	// eslint-disable-next-line no-console
	console.error(chalk.red(guidance));

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
			`Refusing to seed a production deployment: ${guidance} ` +
				'(To override temporarily, set ALLOW_INSECURE_SEED_CREDENTIALS=true — not recommended.)'
		);
	}
}
