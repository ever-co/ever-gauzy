/**
 * The Stripe Checkout Session a visitor completed on the shared ever.co checkout, carried from the
 * register form to tenant onboarding.
 *
 * ever.co/checkout/complete forwards the session id to the register form as `checkout_session`. The
 * API reads it twice: at registration, as proof of purchase for the signup paywall, and at tenant
 * onboarding — a separate request, after the login that follows registration — where it links the new
 * tenant to the buyer's Stripe customer. Registration creates no tenant, so the id has to survive in
 * between; it is kept in this browser's session storage (not local storage: it is only needed for the
 * next few minutes, and a shared computer should not keep it).
 *
 * The id is only ever SENT to our own API, which verifies it with Stripe. Nothing in the browser
 * trusts it.
 */

/** Same shape the API validates: `cs_live_` / `cs_test_` followed by Stripe's base62 id. */
export const CHECKOUT_SESSION_ID_PATTERN = /^cs_(live|test)_[A-Za-z0-9]{8,255}$/;

const STORAGE_KEY = 'gauzy.stripeCheckoutSessionId';

/** Whether `value` is shaped like a Stripe Checkout Session id. */
export function isCheckoutSessionId(value: unknown): value is string {
	return typeof value === 'string' && CHECKOUT_SESSION_ID_PATTERN.test(value);
}

/** Remember a Checkout Session id for tenant onboarding. Ignores anything not shaped like one. */
export function rememberCheckoutSession(value: unknown): void {
	if (!isCheckoutSessionId(value)) return;
	try {
		sessionStorage.setItem(STORAGE_KEY, value);
	} catch {
		// Storage can be unavailable (private mode, blocked site data). The purchase is still linked
		// later by verified email, so this is not worth failing anything over.
	}
}

/** The remembered Checkout Session id, if there is a well-formed one. */
export function readRememberedCheckoutSession(): string | undefined {
	try {
		const value = sessionStorage.getItem(STORAGE_KEY);
		return isCheckoutSessionId(value) ? value : undefined;
	} catch {
		return undefined;
	}
}

/** Forget the remembered Checkout Session id — once onboarding has used it. */
export function clearRememberedCheckoutSession(): void {
	try {
		sessionStorage.removeItem(STORAGE_KEY);
	} catch {
		// Nothing to do: see rememberCheckoutSession.
	}
}
