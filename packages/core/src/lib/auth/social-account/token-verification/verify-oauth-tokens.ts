// cspell:ignore tokeninfo
import { ProviderEnum } from '@gauzy/contracts';
import { environment, ISocialAuthClientsConfig, ISocialAuthOAuthApp } from '@gauzy/config';
import { HttpService } from '@nestjs/axios';
import { Logger, UnauthorizedException } from '@nestjs/common';
import { firstValueFrom } from 'rxjs';

/**
 * Generic message for every social-token rejection. Provider error text is never echoed back: it
 * can reveal which check failed, or which OAuth clients are configured.
 */
export const SOCIAL_AUTH_FAILED_MESSAGE = 'Invalid social account credentials';

/**
 * A provider identity that passed audience AND email verification, normalised for lookups.
 */
export interface IVerifiedSocialIdentity {
	provider: ProviderEnum;
	/** The provider's stable account id, as a non-empty string. */
	id: string;
	/** The provider-verified email, trimmed and lowercased. */
	email: string;
	/** The same email as the provider returned it (trimmed only), for case-sensitive stored rows. */
	rawEmail: string;
}

const logger = new Logger('SocialTokenVerification');

/**
 * Internal marker for a rejected token. Mapped to a generic 401 by {@link verifySocialAccessToken}.
 */
class SocialTokenRejected extends Error {}

const reject = (reason: string): never => {
	throw new SocialTokenRejected(reason);
};

/**
 * The provider account id as a non-empty string, or `''` when it is missing or malformed.
 *
 * Providers disagree on the type: Google returns `sub` as a string, GitHub returns a numeric id.
 * Anything else (object, boolean, float, negative, unsafe integer) is not an identity.
 *
 * @param rawId - The `id` as the provider returned it.
 * @returns The normalised id, or an empty string.
 */
function normalizeProviderAccountId(rawId: unknown): string {
	if (typeof rawId === 'string') {
		return rawId.trim();
	}
	// GitHub account ids are numeric
	if (typeof rawId === 'number' && Number.isSafeInteger(rawId) && rawId > 0) {
		return String(rawId);
	}
	return '';
}

/**
 * Normalises and validates what a provider verifier returned.
 *
 * An absent `id` or `email` must never reach a `find()`: TypeORM runs with
 * `invalidWhereValuesBehavior.undefined = 'ignore'`, so `{ email: undefined }` drops the predicate
 * and matches EVERY user (GHSA-58x4-7mw9-gmqg, Facebook variant).
 *
 * @throws UnauthorizedException (generic message) when either value is missing or malformed.
 */
export function normalizeSocialIdentity(
	provider: ProviderEnum,
	raw: { id?: unknown; email?: unknown } | null | undefined
): IVerifiedSocialIdentity {
	const id = normalizeProviderAccountId(raw?.id);

	const rawEmail = typeof raw?.email === 'string' ? raw.email.trim() : '';
	const email = rawEmail.toLowerCase();

	if (!provider || !id || !rawEmail || !email.includes('@')) {
		throw new UnauthorizedException(SOCIAL_AUTH_FAILED_MESSAGE);
	}
	return { provider, id, email, rawEmail };
}

/**
 * Google: the token must have been issued to one of our OAuth clients (`aud` or `azp`) and carry a
 * Google-verified email. `tokeninfo` is called with the token in the POST body, not the URL.
 */
export async function verifyGoogleToken(httpService: HttpService, token: string, clientIds: string[]) {
	if (!clientIds?.length) {
		return reject('no Google client configured');
	}

	const { data } = await firstValueFrom(
		httpService.post(
			'https://oauth2.googleapis.com/tokeninfo',
			new URLSearchParams({ access_token: token }).toString(),
			{
				headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
			}
		)
	);

	const audiences = [data?.aud, data?.azp].filter((value) => typeof value === 'string' && value.length > 0);
	if (!audiences.some((audience) => clientIds.includes(audience))) {
		return reject('Google token issued to a foreign client');
	}

	// tokeninfo returns `email_verified` as the STRING "true"; accept the boolean as well.
	if (data?.email_verified !== true && data?.email_verified !== 'true') {
		return reject('Google email not verified');
	}

	return { id: data?.sub, email: data?.email };
}

/**
 * GitHub: `POST /applications/{client_id}/token` (basic auth with that app's credentials) only
 * succeeds for a token issued to that app, which rejects personal access tokens and other apps'
 * tokens. The email must be the account's PRIMARY and VERIFIED address.
 */
export async function verifyGithubToken(httpService: HttpService, token: string, apps: ISocialAuthOAuthApp[]) {
	if (!apps?.length) {
		return reject('no GitHub app configured');
	}

	let application: any = null;
	for (const app of apps) {
		try {
			const { data } = await firstValueFrom(
				httpService.post(
					`https://api.github.com/applications/${encodeURIComponent(app.clientId)}/token`,
					{ access_token: token },
					{
						auth: { username: app.clientId, password: app.clientSecret },
						headers: { Accept: 'application/vnd.github+json' }
					}
				)
			);
			if (data) {
				application = data;
				break;
			}
		} catch {
			// 404/422: the token does not belong to this app. Try the next one.
		}
	}

	if (!application) {
		return reject('GitHub token not issued to an allowed app');
	}

	const headers = { Authorization: `token ${token}`, Accept: 'application/vnd.github+json' };
	const [userResponse, emailsResponse] = await Promise.all([
		firstValueFrom(httpService.get('https://api.github.com/user', { headers })),
		firstValueFrom(httpService.get('https://api.github.com/user/emails', { headers }))
	]);

	const userId = userResponse.data?.id;
	if (application.user?.id !== undefined && application.user.id !== userId) {
		return reject('GitHub token user mismatch');
	}

	const emails = Array.isArray(emailsResponse.data) ? emailsResponse.data : [];
	const primary = emails.find((entry: any) => entry?.primary === true && entry?.verified === true);
	if (!primary) {
		return reject('GitHub primary email missing or unverified');
	}

	return { id: userId, email: primary.email };
}

/**
 * Facebook: `GET /debug_token` with an app access token must report the token as valid AND
 * issued to one of our apps. Then `/me?fields=id,email` (without `fields` Graph returns no email).
 */
export async function verifyFacebookToken(httpService: HttpService, token: string, apps: ISocialAuthOAuthApp[]) {
	if (!apps?.length) {
		return reject('no Facebook app configured');
	}

	let debug: any = null;
	for (const app of apps) {
		try {
			const { data } = await firstValueFrom(
				httpService.get('https://graph.facebook.com/debug_token', {
					params: { input_token: token, access_token: `${app.clientId}|${app.clientSecret}` }
				})
			);
			if (data?.data?.is_valid === true && String(data.data.app_id) === app.clientId) {
				debug = data.data;
				break;
			}
		} catch {
			// Invalid for this app. Try the next one.
		}
	}

	if (!debug) {
		return reject('Facebook token not issued to an allowed app');
	}

	const { data } = await firstValueFrom(
		httpService.get('https://graph.facebook.com/me', {
			params: { fields: 'id,email' },
			headers: { Authorization: `Bearer ${token}` }
		})
	);

	if (debug.user_id !== undefined && String(debug.user_id) !== String(data?.id)) {
		return reject('Facebook token user mismatch');
	}

	return { id: data?.id, email: data?.email };
}

/**
 * Verifies a provider ACCESS token presented to the email-based social sign-in routes and returns
 * the normalised identity. Fails closed: an unsupported provider (Twitter/X gives no verified
 * email), a provider with no configured client, a foreign-audience token, an unverified email or
 * any provider error all end in the same generic 401.
 */
export async function verifySocialAccessToken(
	httpService: HttpService,
	provider: ProviderEnum,
	token: string,
	clients: ISocialAuthClientsConfig | undefined = environment.socialAuth
): Promise<IVerifiedSocialIdentity> {
	try {
		if (typeof token !== 'string' || !token.trim()) {
			return reject('missing token');
		}

		let raw: { id?: unknown; email?: unknown };
		switch (provider) {
			case ProviderEnum.GOOGLE:
				raw = await verifyGoogleToken(httpService, token, clients?.google?.clientIds ?? []);
				break;
			case ProviderEnum.GITHUB:
				raw = await verifyGithubToken(httpService, token, clients?.github?.apps ?? []);
				break;
			case ProviderEnum.FACEBOOK:
				raw = await verifyFacebookToken(httpService, token, clients?.facebook?.apps ?? []);
				break;
			default:
				// Twitter/X included: it provides no verified email, so it cannot sign in by email.
				return reject(`unsupported provider ${provider}`);
		}

		return normalizeSocialIdentity(provider, raw);
	} catch (error) {
		if (!(error instanceof UnauthorizedException)) {
			logger.warn(`Social token rejected for provider ${provider}: ${error?.message ?? 'provider error'}`);
		}
		throw new UnauthorizedException(SOCIAL_AUTH_FAILED_MESSAGE);
	}
}
