/**
 * The environment variable that lets a provider sign-in also match accounts whose own address is not confirmed.
 *
 * A sign-in through an identity provider (Google, GitHub, Microsoft, Keycloak..., and Ever Teams'
 * `POST /auth/signin.email.social`) matches an account only when the provider reports the email verified AND the
 * Gauzy account has confirmed that address itself (owner decision 5). An unconfirmed account carrying the address
 * may have been registered by anyone: matching it put the address's owner in a workspace whose password someone
 * else holds.
 *
 * On by default. `SOCIAL_SIGNIN_REQUIRE_VERIFIED_ACCOUNT=false` brings back the previous candidates (any active
 * account on `signin.email.social`; a confirmed account or one in a tenant on the redirect sign-ins), for a client
 * whose sign-up signs in through the provider before the address is confirmed. The workspace picker applies either
 * way.
 */
export const SOCIAL_SIGNIN_VERIFIED_ACCOUNT_ENV = 'SOCIAL_SIGNIN_REQUIRE_VERIFIED_ACCOUNT';

/** The 401 of a provider sign-in whose address only has accounts that have not confirmed it yet. */
export const SOCIAL_SIGNIN_UNCONFIRMED_ACCOUNT_MESSAGE =
	'Confirm the email address of your account before signing in with this provider.';

/**
 * Whether a provider sign-in matches only accounts whose own address is confirmed.
 *
 * @returns False only when {@link SOCIAL_SIGNIN_VERIFIED_ACCOUNT_ENV} is `false`.
 */
export function socialSigninRequiresVerifiedAccount(): boolean {
	const value = String(process.env[SOCIAL_SIGNIN_VERIFIED_ACCOUNT_ENV] ?? '');
	return value.trim().toLowerCase() !== 'false';
}
