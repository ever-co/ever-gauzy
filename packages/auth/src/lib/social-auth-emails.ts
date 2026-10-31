/**
 * An address a sign-in provider returned, with whether the provider itself vouches that it is verified.
 *
 * `AuthService.validateOAuthLoginEmail` (`@gauzy/core`) signs an existing user in only through an address flagged
 * `verified`, so a strategy sets the flag from the provider's own guarantee and never assumes it.
 */
export interface SocialAuthEmail {
	value: string;
	verified: boolean;
}

/** The OpenID Connect claims that carry an address (ID token or UserInfo response). */
export interface OidcEmailClaims {
	email?: unknown;
	email_verified?: unknown;
}

/**
 * Whether `value` can be an address at all: a string with more than whitespace in it.
 *
 * @param value - The value the provider returned.
 * @returns True for a non-blank string.
 */
const isNonBlankString = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0;

/**
 * Flags the addresses of a provider whose API returns an address only once its holder confirmed it, so the
 * presence of the value is the provider's guarantee (Facebook Graph `/me`, X `account/verify_credentials`).
 * A missing or blank value is never verified.
 *
 * @param emails - The `emails` of the Passport profile the provider's strategy built.
 * @returns One entry per address, in the provider's order.
 */
export function flagProviderConfirmedEmails(
	emails: ReadonlyArray<{ value?: string } | null | undefined> | null | undefined
): SocialAuthEmail[] {
	return (emails ?? []).map((email) => ({ value: email?.value, verified: isNonBlankString(email?.value) }));
}

/**
 * The address of an OpenID Connect claim set, flagged verified only when `email_verified` is the boolean `true`
 * (OpenID Connect Core 1.0, section 5.1: "True if the End-User's e-mail address has been verified").
 * A missing claim, `false`, or any other value such as the string `"true"` is not verified.
 *
 * @param claims - The ID token payload or UserInfo response.
 * @returns The address with its flag, or an empty list when the claims carry no address.
 */
export function emailsFromOidcClaims(claims: OidcEmailClaims | null | undefined): SocialAuthEmail[] {
	const email = claims?.email;
	if (!isNonBlankString(email)) {
		return [];
	}
	return [{ value: email, verified: claims.email_verified === true }];
}
