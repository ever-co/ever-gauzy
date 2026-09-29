/**
 * Which Ever product this deployment bills for, and how to tell whether a Stripe object belongs to it.
 *
 * Every Ever product sells through ONE shared Stripe account (the ever.co checkout, Ever Works' own
 * checkout, directory sites, GitHands, ...). Anything that reads that account — the webhook, the
 * signup paywall, the lazy tenant link, the billing pages — therefore sees every product's customers
 * and subscriptions, and must decide for itself which ones are its own. Before this module none of
 * them did: a Teams, Works or Platform subscription counted as a Gauzy one everywhere.
 *
 * The rules are deliberately an ALLOWLIST. Ever Works, GitHands and the directory sites never set
 * `metadata.ever_product` (Works pay-as-you-go subscriptions carry only `metadata.kind`), so a denylist keyed
 * on known foreign products would silently accept all of them.
 *
 * Pure functions only: nothing here performs I/O, so every caller can apply the predicate before it
 * touches the database or Stripe.
 */

/** The product a deployment bills for when `BILLING_PRODUCT` is not set. */
export const DEFAULT_BILLING_PRODUCT = 'gauzy';

/**
 * Product keys as the shared catalog spells them (`gauzy`, `teams`, `platform`, `works`, ...). The
 * key is embedded in every lookup key as `ever_<product>_<hosting>_<tier>_<interval>`, so anything
 * outside this shape could never match a real price.
 */
const PRODUCT_KEY_PATTERN = /^[a-z][a-z0-9]{0,31}$/;

/**
 * A Stripe Checkout Session id. Stripe ids are base62 after the prefix; the length bounds keep an
 * arbitrary string from being forwarded to the Stripe API as a path segment.
 */
export const CHECKOUT_SESSION_ID_PATTERN = /^cs_(live|test)_[A-Za-z0-9]{8,255}$/;

/** Whether `value` is shaped like a Stripe Checkout Session id. */
export function isCheckoutSessionId(value: unknown): value is string {
	return typeof value === 'string' && CHECKOUT_SESSION_ID_PATTERN.test(value);
}

/**
 * Resolve `BILLING_PRODUCT`.
 *
 * Returns `{ product }` for a usable key (lower-cased, trimmed; unset means `gauzy`), or
 * `{ product: null, invalid }` when the value cannot be a catalog product key. An invalid value is
 * NOT silently replaced by the default: on the Ever Teams deployment that would quietly start linking
 * Gauzy purchases to Teams tenants. The caller disables billing instead and says why.
 */
export function resolveBillingProduct(raw: string | undefined = process.env.BILLING_PRODUCT): {
	product: string | null;
	invalid?: string;
} {
	const value = (raw ?? '').trim().toLowerCase();
	if (!value) return { product: DEFAULT_BILLING_PRODUCT };
	if (!PRODUCT_KEY_PATTERN.test(value)) return { product: null, invalid: value.slice(0, 64) };
	return { product: value };
}

/**
 * Resolve `BILLING_SIGNUP_PAYWALL`: whether `POST /auth/register` requires a subscription.
 *
 * Defaults to `true` — the behaviour app.gauzy.co has had since the paywall shipped. Only an explicit
 * off value (`false`, `0`, `no`, `off`) turns it off, so a typo keeps the stricter behaviour rather
 * than opening signup. The Ever Teams deployment sets it to `false`: Teams links billing but does not
 * put a paywall in front of signup.
 */
export function resolveSignupPaywall(raw: string | undefined = process.env.BILLING_SIGNUP_PAYWALL): boolean {
	const value = (raw ?? '').trim().toLowerCase();
	return !['false', '0', 'no', 'off'].includes(value);
}

/** `ever_<product>_` — the prefix every lookup key of that product starts with. */
export function lookupKeyPrefix(product: string): string {
	return `ever_${product}_`;
}

/** The minimal shape of a Stripe Subscription that the product predicate reads. */
export interface ProductScopedSubscription {
	metadata?: Record<string, string> | null;
	items?: { data?: Array<{ price?: { lookup_key?: string | null } | null }> } | null;
}

/** The minimal shape of a Stripe Checkout Session that the product predicate reads. */
export interface ProductScopedCheckoutSession {
	mode?: string | null;
	metadata?: Record<string, string> | null;
}

/**
 * Whether a Subscription belongs to `product`.
 *
 * `metadata.ever_product` is what the shared checkout stamps on every subscription it creates. The
 * lookup-key branch covers subscriptions made in the Stripe Dashboard or the customer portal, which
 * carry no metadata but still sit on a catalog price. Only the FIRST item is read: it is the plan
 * (add-ons come after it) and it is the item `changePlan` operates on.
 */
export function subscriptionIsForProduct(
	subscription: ProductScopedSubscription | null | undefined,
	product: string | null | undefined
): boolean {
	if (!subscription || !product) return false;
	if (subscription.metadata?.ever_product === product) return true;
	const lookupKey = subscription.items?.data?.[0]?.price?.lookup_key;
	return typeof lookupKey === 'string' && lookupKey.startsWith(lookupKeyPrefix(product));
}

/**
 * Whether a completed Checkout Session is a purchase of `product` that can establish a tenant link.
 *
 * Both halves are required. `mode === 'subscription'` excludes payment-mode sessions (lifetime
 * licenses, Ever Works credit packs) and setup-mode card saves, none of which buys a hosted plan.
 */
export function checkoutSessionIsForProduct(
	session: ProductScopedCheckoutSession | null | undefined,
	product: string | null | undefined
): boolean {
	if (!session || !product) return false;
	return session.metadata?.ever_product === product && session.mode === 'subscription';
}

/**
 * A short, non-identifying label for which product an object appears to belong to — for logs only,
 * so a skipped event still says what it was. Never decides anything.
 */
export function describeProduct(object: {
	metadata?: Record<string, string> | null;
	items?: ProductScopedSubscription['items'];
}): string {
	const metadata = object?.metadata ?? {};
	if (typeof metadata.ever_product === 'string' && metadata.ever_product) {
		return clip(metadata.ever_product);
	}
	const lookupKey = object?.items?.data?.[0]?.price?.lookup_key;
	if (typeof lookupKey === 'string') {
		const match = /^ever_([a-z0-9]+)_/.exec(lookupKey);
		if (match) return clip(match[1]);
	}
	if (typeof metadata.kind === 'string' && metadata.kind) {
		return `kind:${clip(metadata.kind)}`;
	}
	return 'unknown';
}

function clip(value: string): string {
	return value.replace(/[^A-Za-z0-9_.:-]/g, '').slice(0, 40) || 'unknown';
}
