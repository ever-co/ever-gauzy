import { Profile } from 'passport';
import { emailsFromOidcClaims, SocialAuthEmail } from '../social-auth-emails';

/**
 * "Sign In with LinkedIn using OpenID Connect", the only sign-in product LinkedIn offers new apps: it replaced the
 * `r_liteprofile` and `r_emailaddress` scopes and their `/v2/me` and `/v2/emailAddress` APIs.
 *
 * @see https://learn.microsoft.com/en-us/linkedin/consumer/integrations/self-serve/sign-in-with-linkedin-v2
 */
export const LINKEDIN_OIDC_SCOPES: readonly string[] = ['openid', 'profile', 'email'];

/** LinkedIn's UserInfo endpoint (`userinfo_endpoint` of https://www.linkedin.com/oauth/.well-known/openid-configuration). */
export const LINKEDIN_USERINFO_URL = 'https://api.linkedin.com/v2/userinfo';

/**
 * The UserInfo response. LinkedIn documents `email` as the member's primary address and `email_verified` as the
 * "indicator that Member's primary email has been verified"; both are optional and may be absent.
 */
export interface LinkedinUserInfo {
	sub: string;
	name?: string;
	given_name?: string;
	family_name?: string;
	picture?: string;
	locale?: unknown;
	email?: string;
	email_verified?: boolean;
}

/** The Passport profile built from {@link LinkedinUserInfo}; each address carries LinkedIn's own verified flag. */
export interface LinkedinProfile extends Profile {
	emails: SocialAuthEmail[];
	_raw: string;
	_json: LinkedinUserInfo;
}

/**
 * Builds the Passport profile from a UserInfo response.
 *
 * The address is flagged verified only when LinkedIn says so (`email_verified: true`), because sign-in matches
 * existing accounts by verified address only.
 *
 * @param body - The UserInfo response body, as text or parsed.
 * @returns The member's profile.
 * @throws When the body is not JSON or has no subject (`sub` is required in every UserInfo response).
 */
export function parseLinkedinUserInfo(body: string | LinkedinUserInfo): LinkedinProfile {
	const json: LinkedinUserInfo = typeof body === 'string' ? JSON.parse(body) : body;
	if (typeof json?.sub !== 'string' || json.sub.length === 0) {
		throw new Error('LinkedIn UserInfo response has no subject');
	}

	const { sub, name, given_name: givenName, family_name: familyName, picture } = json;

	return {
		provider: 'linkedin',
		id: sub,
		displayName: name ?? [givenName, familyName].filter(Boolean).join(' '),
		name: { givenName, familyName },
		emails: emailsFromOidcClaims(json),
		photos: picture ? [{ value: picture }] : [],
		_raw: typeof body === 'string' ? body : JSON.stringify(body),
		_json: json
	};
}
