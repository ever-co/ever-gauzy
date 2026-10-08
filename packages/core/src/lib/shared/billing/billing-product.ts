// cspell:ignore selfhosted
/**
 * Which Ever product this deployment bills for, and how to tell whether a Stripe object belongs to it.
 *
 * Every Ever product sells through ONE shared Stripe account (the ever.co checkout, Ever Works' own
 * checkout, directory sites, GitHands, ...). Anything that reads that account — the webhook, the
 * signup paywall, the lazy tenant link, the billing pages — therefore sees every product's customers
 * and subscriptions, and must decide for itself which ones are its own. Before this module none of
 * them did: a Teams, Works or Platform subscription counted as a Gauzy one everywhere.
 *
 * "This product" means this product's HOSTED plan. ever.co also sells self-hosted licenses of Gauzy
 * and Teams as recurring subscriptions on the same account (`ever_<product>_selfhosted_*` prices,
 * `metadata.ever_hosting = 'selfhosted'`). A license is not a cloud plan: counting one as the cloud
 * subscription would bind the buyer's cloud tenant to their license, show the license as the cloud
 * plan, and let "Cancel" or "Switch plan" act on it. So a subscription or session whose
 * `ever_hosting` says anything other than `cloud`, or whose plan price is a non-cloud price of this
 * product, is never this product's.
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

/** The only `metadata.ever_hosting` value a hosted deployment counts as its own. */
export const CLOUD_HOSTING = 'cloud';

/** `ever_<product>_cloud_` — the prefix of that product's hosted plans (the prefix listPlans uses). */
export function cloudLookupKeyPrefix(product: string): string {
	return `${lookupKeyPrefix(product)}${CLOUD_HOSTING}_`;
}

/**
 * Whether `metadata.ever_hosting` allows the object to be a hosted-plan purchase: absent (objects
 * made before the checkout stamped it, or in the Dashboard) or exactly `cloud`. `selfhosted` — or
 * anything else — is not.
 */
export function hostingIsCloud(metadata: Record<string, string> | null | undefined): boolean {
	const hosting = metadata?.ever_hosting;
	return hosting === undefined || hosting === null || hosting === '' || hosting === CLOUD_HOSTING;
}

/**
 * Resolve `BILLING_WEBHOOK_LINKING`: whether the Stripe webhook may WRITE a tenant's billing link.
 *
 * Defaults to `false`. The webhook can only match a purchase to a tenant by the address the payer
 * typed at checkout, and a free Starter can be started under anybody's address, so it cannot tell
 * the account owner's purchase from somebody else's made in their name. It can also bind an existing
 * admin's OLD tenant a minute before the same buyer registers the NEW one they just paid for. With
 * the flag off the webhook still runs every check and logs `would-link`, but writes nothing; links
 * are made by the buyer's own Checkout Session at onboarding and by an admin opening Settings >
 * Billing. Only an explicit on value (`true`, `1`, `yes`, `on`) turns writing on.
 */
export function resolveWebhookLinking(raw: string | undefined = process.env.BILLING_WEBHOOK_LINKING): boolean {
	const value = (raw ?? '').trim().toLowerCase();
	return ['true', '1', 'yes', 'on'].includes(value);
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
 * Whether a Subscription is a HOSTED (cloud) plan of `product`.
 *
 * `metadata.ever_product` is what the shared checkout stamps on every subscription it creates. The
 * lookup-key branch covers subscriptions made in the Stripe Dashboard or the customer portal, which
 * carry no metadata but still sit on a catalog price. Only the FIRST item is read: it is the plan
 * (add-ons come after it) and it is the item `changePlan` operates on.
 *
 * A self-hosted license of the same product is refused on either signal: `ever_hosting` other than
 * `cloud`, or a plan price of this product that is not an `ever_<product>_cloud_` price.
 *
 * When the plan sits on a catalog price (`ever_<any>_...`), the price decides and the metadata may
 * only agree with it. Stripe updates a subscription's price and its metadata independently, so a
 * Teams price under `ever_product: 'gauzy'` metadata (or the reverse) is not this product's plan.
 * The metadata alone decides only when the plan has no catalog lookup key.
 */
export function subscriptionIsForProduct(
	subscription: ProductScopedSubscription | null | undefined,
	product: string | null | undefined
): boolean {
	if (!subscription || !product) return false;
	if (!hostingIsCloud(subscription.metadata)) return false;
	const lookupKey = planItemOf(subscription)?.price?.lookup_key;
	const metadataProduct = subscription.metadata?.ever_product;
	if (typeof lookupKey === 'string' && CATALOG_LOOKUP_KEY.test(lookupKey)) {
		return lookupKey.startsWith(cloudLookupKeyPrefix(product)) && (!metadataProduct || metadataProduct === product);
	}
	return metadataProduct === product;
}

/** Any catalog lookup key: `ever_<product>_<hosting>_...`. */
const CATALOG_LOOKUP_KEY = /^ever_[a-z0-9]+_/;

/** Prefix of a plan's per-employee add-on price: `seat_<plan lookup key>`. */
export const SEAT_LOOKUP_KEY_PREFIX = 'seat_';

/** The lookup key of the per-employee add-on price that belongs to a plan price. */
export function seatLookupKey(planLookupKey: string): string {
	return `${SEAT_LOOKUP_KEY_PREFIX}${planLookupKey}`;
}

/**
 * The plan item of a subscription: the first item on a catalog price (`ever_<product>_...`), or the
 * first item when none is. The shared checkout puts the plan first and an optional per-employee
 * add-on (`seat_<plan lookup key>`) after it, but nothing that edits the subscription later is bound
 * to that order, so the plan is found by its price rather than by its position.
 */
export function planItemOf<T extends { price?: { lookup_key?: string | null } | null }>(
	subscription: { items?: { data?: T[] } | null } | null | undefined
): T | undefined {
	const items = subscription?.items?.data ?? [];
	return items.find((item) => CATALOG_LOOKUP_KEY.test(item?.price?.lookup_key ?? '')) ?? items[0];
}

/**
 * Whether a completed Checkout Session is a purchase of `product`'s HOSTED plan that can establish a
 * tenant link.
 *
 * All are required. `mode === 'subscription'` excludes payment-mode sessions (lifetime licenses,
 * Ever Works credit packs) and setup-mode card saves, none of which buys a hosted plan; the hosting
 * check excludes self-hosted license subscriptions (`ever_hosting: 'selfhosted'`); and a
 * `metadata.ever_lookup_key`, which the shared checkout stamps on every session, must be one of this
 * product's cloud prices when it is present.
 */
export function checkoutSessionIsForProduct(
	session: ProductScopedCheckoutSession | null | undefined,
	product: string | null | undefined
): boolean {
	if (!session || !product) return false;
	if (
		session.metadata?.ever_product !== product ||
		session.mode !== 'subscription' ||
		!hostingIsCloud(session.metadata)
	) {
		return false;
	}
	const lookupKey = session.metadata?.ever_lookup_key;
	return !lookupKey || lookupKey.startsWith(cloudLookupKeyPrefix(product));
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
	const lookupKey = planItemOf(object)?.price?.lookup_key;
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
