/**
 * The environment variable that lets a deployment keep new self-registrations active before their e-mail is confirmed.
 *
 * A self-registered account (`POST /auth/register` with no invitation and no tenant, which an admin's creation and
 * every invite path always name) stays inactive until the link in its verification e-mail is clicked: it cannot
 * sign in, so an account registered on somebody else's address never becomes a working workspace under that
 * address. This includes a second account registered on an address that already has one. Invited users are
 * confirmed by the invitation itself, and existing accounts are not touched.
 *
 * On by default. `SIGNUP_EMAIL_VERIFICATION_REQUIRED=false` restores the previous behaviour (active at once, the
 * verification e-mail still sent), for a client whose sign-up still signs in straight after registering. It has no
 * effect while `FEATURE_EMAIL_VERIFICATION` is off: with no verification e-mail, nothing could ever activate the
 * account.
 */
export const SIGNUP_EMAIL_VERIFICATION_ENV = 'SIGNUP_EMAIL_VERIFICATION_REQUIRED';

/**
 * Whether a new self-registration waits, inactive, for its e-mail confirmation.
 *
 * @returns False only when {@link SIGNUP_EMAIL_VERIFICATION_ENV} is `false`.
 */
export function signupRequiresEmailVerification(): boolean {
	const value = String(process.env[SIGNUP_EMAIL_VERIFICATION_ENV] ?? '');
	return value.trim().toLowerCase() !== 'false';
}
