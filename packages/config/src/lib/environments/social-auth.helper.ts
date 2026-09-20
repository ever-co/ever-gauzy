/**
 * OAuth clients whose provider ACCESS tokens the API accepts on the email-based social sign-in
 * routes (`/auth/signin.email.social`, `/auth/signup.link.account`).
 *
 * A bare provider access token only proves that SOME application was authorised by the provider
 * account. Before it can stand in for a Gauzy login, the API has to confirm it was issued to one
 * of OUR OAuth clients (GHSA-58x4-7mw9-gmqg); these lists are that allow-list. Introspecting a
 * GitHub or Facebook token requires the client secret of the app it was issued to, so those
 * entries are `clientId` + `clientSecret` pairs.
 */
export interface ISocialAuthOAuthApp {
	clientId: string;
	clientSecret: string;
}

export interface ISocialAuthClientsConfig {
	/** Google OAuth client ids (`aud` / `azp` values) accepted for social sign-in. */
	google: { clientIds: string[] };
	/** GitHub OAuth apps whose tokens are accepted (checked via `POST /applications/{client_id}/token`). */
	github: { apps: ISocialAuthOAuthApp[] };
	/** Facebook apps whose tokens are accepted (checked via `GET /debug_token`). */
	facebook: { apps: ISocialAuthOAuthApp[] };
}

/**
 * Template placeholders shipped in the `.env.*` samples. They are never real credentials, so they
 * are dropped instead of being sent to a provider on every sign-in attempt.
 */
const PLACEHOLDER_VALUES = new Set(['xxxxxxx', 'changeme']);

const clean = (value: string | undefined): string => {
	const trimmed = (value ?? '').trim();
	return trimmed && !PLACEHOLDER_VALUES.has(trimmed.toLowerCase()) ? trimmed : '';
};

/**
 * Parses a comma-separated list of values, dropping blanks and placeholders.
 */
export const parseSocialAuthClientIds = (raw: string | undefined): string[] =>
	(raw ?? '')
		.split(',')
		.map((value) => clean(value))
		.filter(Boolean);

/**
 * Parses a comma-separated list of `clientId:clientSecret` pairs. Only the FIRST `:` separates the
 * id from the secret. Entries missing either half are dropped.
 */
export const parseSocialAuthApps = (raw: string | undefined): ISocialAuthOAuthApp[] =>
	(raw ?? '')
		.split(',')
		.map((entry) => {
			const separator = entry.indexOf(':');
			if (separator === -1) {
				return null;
			}
			const clientId = clean(entry.slice(0, separator));
			const clientSecret = clean(entry.slice(separator + 1));
			return clientId && clientSecret ? { clientId, clientSecret } : null;
		})
		.filter((app): app is ISocialAuthOAuthApp => app !== null);

const uniqueApps = (apps: ISocialAuthOAuthApp[]): ISocialAuthOAuthApp[] => {
	const seen = new Set<string>();
	return apps.filter((app) => {
		if (seen.has(app.clientId)) {
			return false;
		}
		seen.add(app.clientId);
		return true;
	});
};

/**
 * Builds the social sign-in allow-list.
 *
 * Defaults to Gauzy's own OAuth apps, i.e. the very clients the passport strategies already use
 * (`GOOGLE_CLIENT_ID`, `GAUZY_GITHUB_OAUTH_CLIENT_ID`/`_SECRET`, `FACEBOOK_CLIENT_ID`/`_SECRET`).
 * Other first-party clients (for example Ever Teams) are ADDED with:
 *
 * - `GAUZY_SOCIAL_AUTH_GOOGLE_CLIENT_IDS`: comma-separated Google client ids
 * - `GAUZY_SOCIAL_AUTH_GITHUB_APPS`: comma-separated `clientId:clientSecret` pairs
 * - `GAUZY_SOCIAL_AUTH_FACEBOOK_APPS`: comma-separated `appId:appSecret` pairs
 *
 * A provider with no configured client rejects every token (fail closed).
 */
export const resolveSocialAuthClients = (env: NodeJS.ProcessEnv = process.env): ISocialAuthClientsConfig => {
	const ownGoogle = clean(env['GOOGLE_CLIENT_ID']);
	const ownGithub = parseSocialAuthApps(
		`${env['GAUZY_GITHUB_OAUTH_CLIENT_ID'] ?? ''}:${env['GAUZY_GITHUB_OAUTH_CLIENT_SECRET'] ?? ''}`
	);
	const ownFacebook = parseSocialAuthApps(
		`${env['FACEBOOK_CLIENT_ID'] ?? ''}:${env['FACEBOOK_CLIENT_SECRET'] ?? ''}`
	);

	return {
		google: {
			clientIds: Array.from(
				new Set([
					...(ownGoogle ? [ownGoogle] : []),
					...parseSocialAuthClientIds(env['GAUZY_SOCIAL_AUTH_GOOGLE_CLIENT_IDS'])
				])
			)
		},
		github: {
			apps: uniqueApps([...ownGithub, ...parseSocialAuthApps(env['GAUZY_SOCIAL_AUTH_GITHUB_APPS'])])
		},
		facebook: {
			apps: uniqueApps([...ownFacebook, ...parseSocialAuthApps(env['GAUZY_SOCIAL_AUTH_FACEBOOK_APPS'])])
		}
	};
};
