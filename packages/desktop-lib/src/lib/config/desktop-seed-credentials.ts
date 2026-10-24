import { randomBytes } from 'node:crypto';

/** The accounts the API creates when it seeds an empty database (its first start), as stored. */
export type DesktopSeedAccountKey = 'superAdmin' | 'admin' | 'employee';

/** One seeded account and the variables the API reads its email and password from. */
export interface DesktopSeedAccount {
	readonly key: DesktopSeedAccountKey;
	/** Read by `environment.demoCredentialConfig` in `@gauzy/config`, then hashed by the seed. */
	readonly passwordEnv: string;
	readonly emailEnv: string;
	/** The email the API uses when `emailEnv` is unset. */
	readonly defaultEmail: string;
}

/** The three default accounts, in the order the user is shown them. */
export const DESKTOP_SEED_ACCOUNTS: ReadonlyArray<DesktopSeedAccount> = Object.freeze([
	Object.freeze({
		key: 'superAdmin',
		passwordEnv: 'DEMO_SUPER_ADMIN_PASSWORD',
		emailEnv: 'DEMO_SUPER_ADMIN_EMAIL',
		defaultEmail: 'admin@ever.co'
	} as const),
	Object.freeze({
		key: 'admin',
		passwordEnv: 'DEMO_ADMIN_PASSWORD',
		emailEnv: 'DEMO_ADMIN_EMAIL',
		defaultEmail: 'local.admin@ever.co'
	} as const),
	Object.freeze({
		key: 'employee',
		passwordEnv: 'DEMO_EMPLOYEE_PASSWORD',
		emailEnv: 'DEMO_EMPLOYEE_EMAIL',
		defaultEmail: 'employee@ever.co'
	} as const)
]);

/** This install's generated password for each default account. */
export type DesktopSeedCredentials = Record<DesktopSeedAccountKey, string>;

/** An account a seed created with its generated password. */
export interface DesktopSeededAccount {
	key: DesktopSeedAccountKey;
	email: string;
}

/** What the electron-store keeps under {@link DESKTOP_SEED_CREDENTIALS_STORE_KEY}. */
export interface StoredDesktopSeedCredentials extends Partial<DesktopSeedCredentials> {
	/**
	 * The accounts a seed started with these passwords (recorded when the seed begins, so a seed that
	 * fails after creating them still counts). They are shown, with their passwords, at every start
	 * until the user confirms they saved them; then the whole entry is deleted.
	 */
	pending?: DesktopSeededAccount[];
}

/**
 * The electron-store key. Deliberately not inside `configs`: that object is sent to the settings
 * window, and these passwords never leave the main process except in the one-time dialog.
 */
export const DESKTOP_SEED_CREDENTIALS_STORE_KEY = 'seedCredentials';

/** Shorter values (or any with whitespace) are not ones this module generated, and are replaced. */
const MIN_PASSWORD_LENGTH = 16;

/** A new random password: 18 random bytes, 24 URL-safe characters (letters, digits, `-`, `_`). */
export function generateDesktopSeedPassword(): string {
	return randomBytes(18).toString('base64url');
}

function isUsablePassword(value: unknown): value is string {
	return typeof value === 'string' && value.length >= MIN_PASSWORD_LENGTH && !/\s/.test(value);
}

function isPresent(value: unknown): value is string {
	return typeof value === 'string' && value.trim().length > 0;
}

/**
 * Returns this install's seed passwords, generating any that are missing.
 *
 * The API seeds its three default accounts (Super Admin, Admin, Employee) on its first start
 * against an empty database. They used to get the passwords published in the README (`admin`,
 * `admin`, `12345678`); each install now gets its own random ones, which the desktop app passes to
 * the API in `DEMO_*_PASSWORD` (GHSA-4r2r-mv32-3468).
 *
 * - a missing, short or blank value is generated (first run, or after the user confirmed they saved
 *   the previous ones, which deletes them);
 * - a value a seed already used (`pending`) is never replaced: it is that account's password now;
 * - any other value is kept, so every start passes the same passwords until a seed uses them.
 *
 * Pure apart from the randomness: the caller persists the result when `changed` is true, BEFORE
 * starting the API.
 *
 * @param stored - The stored entry (undefined on a first run).
 * @param generate - Source of new passwords; injectable for tests.
 */
export function ensureDesktopSeedCredentials(
	stored?: StoredDesktopSeedCredentials | null,
	generate: () => string = generateDesktopSeedPassword
): { credentials: StoredDesktopSeedCredentials & DesktopSeedCredentials; changed: boolean } {
	const credentials = { ...(stored ?? {}) } as StoredDesktopSeedCredentials & DesktopSeedCredentials;
	let changed = false;

	// A pending account whose password went missing cannot be shown any more: forget it rather than
	// show a new password the database never received.
	const pending = Array.isArray(stored?.pending)
		? stored.pending.filter((account) => isPresent(account?.email) && isPresent(stored[account.key]))
		: undefined;
	if (pending && pending.length !== stored.pending.length) {
		changed = true;
	}
	if (pending?.length) {
		credentials.pending = pending;
	} else {
		delete credentials.pending;
	}

	for (const { key } of DESKTOP_SEED_ACCOUNTS) {
		const isPending = pending?.some((account) => account.key === key) ?? false;
		if (isPending || isUsablePassword(credentials[key])) {
			continue;
		}
		credentials[key] = generate();
		changed = true;
	}

	return { credentials, changed };
}

/**
 * The environment variables that hand the generated passwords to the API.
 *
 * A password the operator already set in `inherited` (the environment the app was started with) is
 * left to them: the API uses theirs, and the one-time dialog does not show the generated one.
 *
 * @param credentials - The passwords returned by {@link ensureDesktopSeedCredentials}.
 * @param inherited - The environment the operator controls (the app's own `process.env`).
 */
export function desktopSeedCredentialsToEnv(
	credentials: DesktopSeedCredentials,
	inherited: Record<string, string | undefined> = {}
): Record<string, string> {
	const env: Record<string, string> = {};
	for (const { key, passwordEnv } of DESKTOP_SEED_ACCOUNTS) {
		if (isPresent(inherited[passwordEnv])) {
			continue;
		}
		env[passwordEnv] = credentials[key];
	}
	return env;
}

/**
 * The accounts that a seed run with `env` created with a generated password: those whose password
 * variable holds this install's generated value. Each comes with the email the API used.
 *
 * @param credentials - The stored passwords.
 * @param env - The environment the API process ran with.
 */
export function findDesktopSeededAccounts(
	credentials: Partial<DesktopSeedCredentials> | null | undefined,
	env: Record<string, string | undefined>
): DesktopSeededAccount[] {
	return DESKTOP_SEED_ACCOUNTS.filter(
		({ key, passwordEnv }) => isPresent(credentials?.[key]) && env[passwordEnv] === credentials[key]
	).map(({ key, emailEnv, defaultEmail }) => ({
		key,
		email: isPresent(env[emailEnv]) ? env[emailEnv].trim() : defaultEmail
	}));
}

/**
 * The line the API prints when its default seed of an empty database begins, before it creates any
 * account (`SeedDataService.runDefaultSeed`). Do not change one without the other.
 */
export const DESKTOP_API_SEED_STARTED_MARKER = 'Database Default Seed Started';

/**
 * The line the API prints when its default seed has finished (`SeedDataService.runDefaultSeed`).
 * Do not change one without the other.
 */
export const DESKTOP_API_SEED_COMPLETED_MARKER = 'Database Default Seed Completed';

/**
 * The start of the line the API prints at boot when seeded accounts of an existing database still
 * sign in with a published password (`AppService.warnAboutPublishedSeedPasswords`), followed by
 * their emails. Do not change one without the other.
 */
export const DESKTOP_API_PUBLISHED_PASSWORDS_MARKER = 'INSECURE ACCOUNTS:';

/** Removes terminal colour codes (chalk adds them when the child process inherits FORCE_COLOR). */
export function stripAnsiCodes(text: string): string {
	// eslint-disable-next-line no-control-regex
	return text.replace(/\u001b\[[0-9;]*m/g, '');
}

/** Whether the API output reports a finished default seed. */
export function reportsDesktopSeedCompleted(output: string): boolean {
	return stripAnsiCodes(output).includes(DESKTOP_API_SEED_COMPLETED_MARKER);
}

/**
 * Whether the API output reports a default seed that began, finished or not. The accounts it creates
 * get the generated passwords as soon as they are inserted, so a seed that fails (or is stopped)
 * later still leaves them with those passwords, and the next start skips seeding because users exist.
 */
export function reportsDesktopSeedStarted(output: string): boolean {
	const text = stripAnsiCodes(output);
	return text.includes(DESKTOP_API_SEED_STARTED_MARKER) || text.includes(DESKTOP_API_SEED_COMPLETED_MARKER);
}

/**
 * The emails the API output reports as still using a published password, or an empty list. Only a
 * complete line counts, so a line cut between two output chunks is not read short.
 */
export function parsePublishedPasswordAccounts(output: string): string[] {
	const line = new RegExp(`${DESKTOP_API_PUBLISHED_PASSWORDS_MARKER}([^\\r\\n]*)\\r?\\n`).exec(
		stripAnsiCodes(output)
	);
	if (!line) {
		return [];
	}
	return line[1]
		.split(',')
		.map((email) => email.trim())
		.filter((email) => email.length > 0);
}
