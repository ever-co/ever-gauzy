/**
 * Secret values that are published in this repository (code fallbacks, env templates, deploy
 * manifests, desktop build defaults) or are generic placeholders. A token signing or session key
 * that equals one of these is public, so anyone can forge access, refresh, verification, invite and
 * share tokens or session cookies with it (GHSA-39j7-x845-4w3c, GHSA-chm8-2ggf-pgjq).
 *
 * This is the ONE list shared by the API config resolver (`@gauzy/config`), the API startup guard
 * (`validateApplicationSecrets` in `@gauzy/core`) and the desktop secret provisioning
 * (`@gauzy/desktop-lib`). Compare with {@link isKnownDefaultSecret}, not with `includes()`: the
 * match is case-insensitive and ignores surrounding whitespace.
 */
export const KNOWN_DEFAULT_SECRETS: ReadonlyArray<string> = Object.freeze([
	// Code fallbacks in packages/config (environment.ts, default-config.ts) and .env.local.
	'secretKey',
	'refreshSecretKey',
	'verificationSecretKey',
	'gauzy',
	// Desktop build defaults (.scripts/env.ts DESKTOP_JWT_*), baked into every desktop app.
	'refreshTokenSecretKey',
	// MCP auth templates (.env.sample / .env.compose / .env.docker) and config-manager fallback.
	'your-secure-session-secret',
	'your-session-secret-key',
	// Generic placeholders.
	'changeme', // cspell:ignore changeme
	'secret',
	'password',
	'default'
]);

const KNOWN_DEFAULT_SECRETS_NORMALIZED: ReadonlySet<string> = new Set(
	KNOWN_DEFAULT_SECRETS.map((value) => value.toLowerCase())
);

/**
 * Whether a secret value is one of the published {@link KNOWN_DEFAULT_SECRETS}.
 *
 * @param value - The secret value to check (unset and empty values are NOT reported here; callers
 * treat those separately).
 */
export function isKnownDefaultSecret(value: string | null | undefined): boolean {
	if (typeof value !== 'string') {
		return false;
	}
	const normalized = value.trim().toLowerCase();
	return normalized.length > 0 && KNOWN_DEFAULT_SECRETS_NORMALIZED.has(normalized);
}
