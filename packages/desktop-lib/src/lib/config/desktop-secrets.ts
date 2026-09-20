import { randomBytes } from 'crypto';
import { IDesktopSecret, isKnownDefaultSecret } from '@gauzy/contracts';

/** The four signing/session secrets of the API a desktop app runs locally, as stored in `configs.secret`. */
export type DesktopSecrets = Required<IDesktopSecret['secret']>;

/** Maps each stored field to the environment variable the local API reads it from. */
export const DESKTOP_SECRET_ENV: Readonly<Record<keyof DesktopSecrets, string>> = Object.freeze({
	jwt: 'JWT_SECRET',
	refresh_token: 'JWT_REFRESH_TOKEN_SECRET',
	verification_token: 'JWT_VERIFICATION_TOKEN_SECRET',
	session: 'EXPRESS_SESSION_SECRET'
});

/**
 * Returns the local API's secrets for this install, generating any that are missing.
 *
 * The desktop apps (Gauzy Desktop with the integrated server, Gauzy Server, Gauzy API Server) run the
 * API on `0.0.0.0` so remote timers can connect. Their builds used to bake `secretKey` /
 * `refreshTokenSecretKey` in as the defaults, and the verification and session secrets were never
 * passed at all, so anyone on the network could forge tokens for a default install
 * (GHSA-39j7-x845-4w3c). Each install now gets its own random values instead:
 *
 * - a missing or blank value is generated (first run);
 * - a value from the published `KNOWN_DEFAULT_SECRETS` list is replaced (upgrade from a build that
 *   stored `secretKey`). Users signed in to that server have to sign in again once;
 * - any other value, including one the user typed in the setup screen, is kept as is.
 *
 * Pure apart from the randomness: the caller persists the result to its LocalStore when `changed` is
 * true, BEFORE starting the API, so every restart signs with the same keys.
 *
 * @param stored - `configs.secret` as currently stored (may be undefined on first run).
 * @param generate - Source of new secrets; injectable for tests.
 * @returns The secrets to use, and whether any of them differ from what is stored.
 */
export function ensureDesktopSecrets(
	stored?: Partial<IDesktopSecret['secret']> | null,
	generate: () => string = () => randomBytes(64).toString('hex')
): { secret: DesktopSecrets; changed: boolean } {
	const secret = { ...(stored ?? {}) } as DesktopSecrets;
	let changed = false;

	for (const key of Object.keys(DESKTOP_SECRET_ENV) as Array<keyof DesktopSecrets>) {
		const current = secret[key];
		if (typeof current !== 'string' || !current.trim() || isKnownDefaultSecret(current)) {
			secret[key] = generate();
			changed = true;
		}
	}

	return { secret, changed };
}

/**
 * The environment variables that hand {@link DesktopSecrets} to the local API process.
 *
 * @param secret - The secrets returned by {@link ensureDesktopSecrets}.
 */
export function desktopSecretsToEnv(secret: DesktopSecrets): Record<string, string> {
	return {
		[DESKTOP_SECRET_ENV.jwt]: secret.jwt,
		[DESKTOP_SECRET_ENV.refresh_token]: secret.refresh_token,
		[DESKTOP_SECRET_ENV.verification_token]: secret.verification_token,
		[DESKTOP_SECRET_ENV.session]: secret.session
	};
}

/**
 * A copy of `values` that is safe to log: values under secret-looking keys (and a nested `secret`
 * object) are replaced. The local API's env and the setup config carry the per-install secrets.
 *
 * @param values - Environment variables or a config object.
 */
export function redactSecretsForLog<T extends Record<string, any>>(values: T | null | undefined): Record<string, unknown> {
	return Object.fromEntries(
		Object.entries(values ?? {}).map(([key, value]) => [
			key,
			/secret|pass|token|key/i.test(key) && value ? '[REDACTED]' : value
		])
	);
}
