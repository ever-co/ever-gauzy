import { Injectable, Logger } from '@nestjs/common';
import {
	isCheckoutSessionId,
	resolveBillingProduct,
	resolveSignupPaywall,
	subscriptionIsForProduct
} from './billing-product';

/**
 * Minimal Stripe lookup used to decide whether an email is entitled to register on a hosted Ever
 * deployment (app.gauzy.co and friends).
 *
 * Deliberately implemented against Stripe's REST API with `fetch` rather than the `stripe` SDK, so
 * that self-hosted installs gain no new dependency for a feature they never use. The two calls
 * needed here are trivial; the SDK earns its place on the checkout host, which also has to verify
 * webhook signatures, not here.
 *
 * The whole thing is inert unless STRIPE_SECRET_KEY is set — see `isBillingEnforced()`.
 */

/**
 * Raised when the lookup gives up on its own budget rather than because Stripe failed.
 *
 * A distinct type so it reads correctly in logs: this is us stopping, not Stripe erroring.
 */
class BudgetExceededError extends Error {
	constructor(reason: string) {
		super(`Entitlement lookup abandoned: ${reason}. Treating the result as unknown.`);
		this.name = 'BudgetExceededError';
	}
}

/** Strip the query string; it carries the registrant's email address. */
function redactPath(path: string): string {
	const q = path.indexOf('?');
	return q === -1 ? path : `${path.slice(0, q)}?<redacted>`;
}

/** An error's message with any stray email address masked, for safe logging. */
export function describeError(error: unknown): string {
	const message = error instanceof Error ? error.message : String(error);
	return message.replace(/[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+/g, '<redacted-email>');
}
const describe = describeError;

/** A non-2xx answer from Stripe, with the status kept so callers can tell "not found" from "down". */
class StripeHttpError extends Error {
	constructor(message: string, readonly status: number) {
		super(message);
		this.name = 'StripeHttpError';
	}
}

/**
 * Secret credentials that spend real money.
 *
 * Stripe issues two families: standard keys (`sk_live_`) and **restricted** keys (`rk_live_`). A
 * restricted key is exactly what an operator would sensibly provision for an integration like this
 * one, so matching only `sk_live_` would wave the more security-conscious choice straight past the
 * opt-in below and label it "test" in the UI.
 */
const LIVE_KEY_PREFIX = /^(sk|rk)_live_/;

/** Subscription statuses that entitle the holder to finish registering. */
const ENTITLING_STATUSES = new Set(['active', 'trialing', 'past_due']);

const STRIPE_API = 'https://api.stripe.com/v1';

/** Stripe's maximum page size; fewer pages means fewer round trips on a request thread. */
const PAGE_SIZE = 100;

/**
 * How many customers sharing one email are worth checking before giving up.
 *
 * A real person has one or two. Anything beyond this is either test data or an attempt to make the
 * lookup expensive, and neither deserves an unbounded number of HTTP calls inside a signup.
 */
const MAX_CUSTOMERS_EXAMINED = 20;

/**
 * Wall-clock budget for the entire entitlement check.
 *
 * The per-request timeout bounds one call; this bounds the whole fan-out, so registration latency
 * cannot grow with the number of Stripe records behind an address.
 */
const OVERALL_DEADLINE_MS = 10_000;

/** Per-request timeout for a Stripe GET, unless the caller brings a tighter budget. */
const REQUEST_TIMEOUT_MS = 8000;

/**
 * How old a Checkout Session may be and still prove who bought it.
 *
 * Buyers register a median of one minute after paying (51 minutes at most in the first 62 LIVE
 * purchases). The session id is a bearer credential that sits in the buyer's browser history, so a
 * short window bounds how long a leaked one stays useful. Anyone outside it is linked later by the
 * verified-email path instead.
 */
const CHECKOUT_SESSION_MAX_AGE_SECONDS = 14 * 24 * 60 * 60;

/** Why a Checkout Session was not accepted as proof of purchase. Logged; never shown to the user. */
export type CheckoutSessionDeclineReason =
	| 'billing-disabled'
	| 'malformed'
	| 'mode-mismatch'
	| 'not-found'
	| 'stripe-unavailable'
	| 'incomplete'
	| 'foreign-product'
	| 'email-mismatch'
	| 'expired'
	| 'no-customer'
	| 'not-entitled';

export type CheckoutSessionVerification =
	| { ok: true; customerId: string }
	| { ok: false; reason: CheckoutSessionDeclineReason };

export enum EntitlementResult {
	/** A matching customer holds an entitling subscription. */
	ENTITLED = 'entitled',
	/** Stripe answered, and this email has no entitling subscription. */
	NOT_ENTITLED = 'not_entitled',
	/** Stripe could not be reached or errored. Caller decides; this is never a hard "no". */
	UNKNOWN = 'unknown'
}

@Injectable()
export class StripeSubscriptionService {
	private readonly logger = new Logger(StripeSubscriptionService.name);

	/**
	 * The Stripe key this deployment may actually use, or undefined if it must not bill at all.
	 *
	 * Read straight from the process environment rather than `@gauzy/config`, because the *absence*
	 * of this value is the feature switch: nothing else in the platform should have to know that
	 * billing exists, and a fork with no Stripe account must behave exactly as it does today.
	 *
	 * Two refusals are enforced here rather than left to deployment discipline, because the cost of
	 * getting either wrong is charging somebody real money from an environment that should not:
	 *
	 *  - **A demo deployment never bills.** `DEMO=true` disables billing outright, even if a key is
	 *    present. demo.gauzy.co resets daily and is handed round freely; nothing there should reach a
	 *    payment provider.
	 *  - **A live key needs a second, deliberate opt-in.** Any live credential — `sk_live_` *or* the
	 *    restricted `rk_live_` an operator might reasonably prefer — is honoured only when
	 *    `STRIPE_LIVE_MODE=true` is also set. Copying a production secret bundle onto staging is an
	 *    ordinary mistake; silently taking real payments from stage.gauzy.co because of it is not an
	 *    ordinary consequence. Staging uses a test key and needs no opt-in.
	 */
	private get secretKey(): string | undefined {
		const key = process.env.STRIPE_SECRET_KEY?.trim();
		if (!key) return undefined;

		if (process.env.DEMO === 'true') {
			this.warnOnce(
				'demo',
				'STRIPE_SECRET_KEY is set on a DEMO deployment. Billing is disabled: demo environments must never reach Stripe.'
			);
			return undefined;
		}

		// A deployment that cannot say which product it bills for must not bill at all. Falling back to
		// the default would, on the Ever Teams deployment, quietly start treating Gauzy purchases as
		// Teams ones — so an unusable BILLING_PRODUCT switches billing off, loudly, instead.
		const { invalid } = resolveBillingProduct();
		if (invalid !== undefined) {
			this.warnOnce(
				'product',
				`BILLING_PRODUCT="${invalid}" is not a catalog product key (e.g. "gauzy", "teams"). Billing is disabled ` +
					'until it is corrected.'
			);
			return undefined;
		}

		if (LIVE_KEY_PREFIX.test(key) && process.env.STRIPE_LIVE_MODE !== 'true') {
			this.warnOnce(
				'live',
				'A LIVE Stripe key is configured but STRIPE_LIVE_MODE is not "true". Billing is disabled rather than ' +
					'charging real cards from an environment that has not explicitly opted in. Use a test key here, ' +
					'or set STRIPE_LIVE_MODE=true if this really is production.'
			);
			return undefined;
		}

		return key;
	}

	/**
	 * The key any Stripe call must use, or throws if this deployment must not bill.
	 *
	 * Exists so that nothing reads `process.env.STRIPE_SECRET_KEY` for itself. Every refusal encoded
	 * above — demo deployments, and live keys without an explicit opt-in — is only worth anything if
	 * it is the single way a credential can be obtained; a second service reading the environment
	 * directly silently reinstates exactly the behaviour those rules exist to prevent.
	 */
	requireKey(): string {
		const key = this.secretKey;
		if (!key) {
			throw new Error('Billing is not configured on this deployment.');
		}
		return key;
	}

	/** Which Stripe mode this deployment is operating in — surfaced so the UI can say so. */
	get mode(): 'live' | 'test' | 'disabled' {
		const key = this.secretKey;
		if (!key) return 'disabled';
		return LIVE_KEY_PREFIX.test(key) ? 'live' : 'test';
	}

	private readonly warned = new Set<string>();

	/** Loud, but once per reason — this is read on every request that touches billing. */
	private warnOnce(reason: string, message: string): void {
		if (this.warned.has(reason)) return;
		this.warned.add(reason);
		this.logger.error(message);
	}

	/**
	 * Whether registration should be gated on a Stripe subscription at all.
	 *
	 * False on every self-hosted install that has not configured Stripe, which is the default — and
	 * the reason this returns a plain boolean rather than throwing.
	 */
	isBillingEnforced(): boolean {
		return Boolean(this.secretKey);
	}

	/**
	 * The Ever product this deployment bills for: `BILLING_PRODUCT`, default `gauzy`.
	 *
	 * Every read of the shared Stripe account is scoped to it — the webhook, the signup paywall, the
	 * lazy tenant link and the billing pages all count only this product's subscriptions. Null when the
	 * variable is set to something unusable, in which case billing is disabled (see `secretKey`).
	 */
	get billingProduct(): string | null {
		return resolveBillingProduct().product;
	}

	/**
	 * Whether `POST /auth/register` must be backed by a subscription to this product.
	 *
	 * Billing has to be on for a paywall to mean anything, and `BILLING_SIGNUP_PAYWALL=false` turns the
	 * paywall off while leaving the rest of billing (linking, the billing pages) working — which is
	 * what the Ever Teams deployment needs. Unset keeps today's behaviour: the paywall is on.
	 */
	isSignupPaywallEnabled(): boolean {
		return this.isBillingEnforced() && resolveSignupPaywall();
	}

	/**
	 * Look up whether `email` holds a subscription that entitles them to register.
	 *
	 * Returns UNKNOWN rather than NOT_ENTITLED when Stripe cannot be reached. Callers are expected to
	 * let UNKNOWN through: the card was already captured during checkout, so someone arriving at
	 * registration has almost certainly just paid, and making signup unavailable whenever Stripe has
	 * a bad minute is a far worse failure than briefly admitting someone who slipped past.
	 */
	async getEntitlement(email: string): Promise<EntitlementResult> {
		if (!this.secretKey) return EntitlementResult.ENTITLED; // billing off: nothing to check

		try {
			const customerId = await this.findEntitlingCustomerId(email);
			return customerId ? EntitlementResult.ENTITLED : EntitlementResult.NOT_ENTITLED;
		} catch (error) {
			this.logger.error(
				`Could not determine Stripe entitlement for a registration attempt; allowing it through. ${describe(error)}`
			);
			return EntitlementResult.UNKNOWN;
		}
	}

	/**
	 * The Stripe customer behind an entitling subscription for `email`, or null.
	 *
	 * Used when a tenant is first created, to record the link between that tenant and its billing
	 * account. From then on the stored id is authoritative and the email is never consulted again —
	 * an email can be changed, and Stripe permits several customers to share one.
	 *
	 * Returns null rather than throwing when Stripe is unreachable: failing to record the link must
	 * not fail the onboarding around it.
	 */
	async findCustomerIdForEmail(email: string): Promise<string | null> {
		if (!this.secretKey) return null;

		try {
			return await this.findEntitlingCustomerId(email);
		} catch (error) {
			this.logger.error(
				`Could not resolve a Stripe customer for a new tenant; it will need linking later. ${describe(error)}`
			);
			return null;
		}
	}

	/**
	 * The email Stripe holds for a customer, or null.
	 *
	 * Needed because most events identify the customer by id alone. A Subscription object carries no
	 * email field whatsoever — verified against a real `customer.subscription.created` payload — so a
	 * receiver that reads `customer_email` off the event finds nothing and silently does nothing.
	 * Only `checkout.session.completed` includes the address inline.
	 *
	 * Returns null rather than throwing: this resolves a link, and failing to resolve one must never
	 * escalate into failing the operation that triggered it.
	 */
	async getCustomerEmail(customerId: string, timeoutMs = REQUEST_TIMEOUT_MS): Promise<string | null> {
		const key = this.secretKey;
		if (!key || !customerId?.trim()) return null;

		try {
			const customer = await this.request<{ email?: string | null; deleted?: boolean }>(
				key,
				`/customers/${encodeURIComponent(customerId.trim())}`,
				timeoutMs
			);
			// A deleted customer comes back as `{ deleted: true }` with no email.
			return customer?.email?.trim() || null;
		} catch (error) {
			this.logger.error(`Could not resolve the email for a Stripe customer. ${describe(error)}`);
			return null;
		}
	}

	/**
	 * Whether this customer holds an entitling (active, trialing or past_due) subscription to THIS
	 * deployment's product.
	 *
	 * The webhook asks this before it links anything, so a customer that only ever bought another Ever
	 * product, or only made a one-off payment or saved a card, is never adopted. Throws when Stripe
	 * cannot answer: the caller must treat that as "do not link", never as "no".
	 */
	async customerHasEntitlingSubscription(customerId: string, timeoutMs = REQUEST_TIMEOUT_MS): Promise<boolean> {
		const key = this.secretKey;
		if (!key) throw new Error('Billing is not configured on this deployment.');
		if (!customerId?.trim()) return false;
		return this.hasEntitlingSubscription(key, customerId.trim(), Date.now() + timeoutMs, timeoutMs);
	}

	/**
	 * Check that a Checkout Session proves `email` bought THIS deployment's product, and return the
	 * Stripe customer it created.
	 *
	 * This is the proven-identity link. The ever.co checkout forwards the session id to the register
	 * form (`checkout_session`), and only the browser that completed the checkout has it. Every rule
	 * below must hold, or the session is declined and the caller falls back to the slower paths:
	 *
	 *  - it is a session of this deployment's Stripe mode (a `cs_live_` id is never looked up with a
	 *    test key, or the reverse);
	 *  - Stripe says it is `complete`, in `subscription` mode, for `metadata.ever_product` = this
	 *    product — never a payment-mode license, a setup-mode card save or another product;
	 *  - the address the buyer gave Stripe equals `email` (case-insensitive), so a session id cannot be
	 *    replayed onto somebody else's registration;
	 *  - it is recent (CHECKOUT_SESSION_MAX_AGE_SECONDS) and has a customer;
	 *  - its subscription is still entitling and still on this product's price.
	 *
	 * Never throws; a Stripe failure is the `stripe-unavailable` decline.
	 */
	async verifyCheckoutSession(
		sessionId: string,
		email: string,
		timeoutMs = REQUEST_TIMEOUT_MS
	): Promise<CheckoutSessionVerification> {
		const key = this.secretKey;
		const product = this.billingProduct;
		if (!key || !product) return { ok: false, reason: 'billing-disabled' };
		if (!isCheckoutSessionId(sessionId)) return { ok: false, reason: 'malformed' };

		const expectLive = sessionId.startsWith('cs_live_');
		if (expectLive !== LIVE_KEY_PREFIX.test(key)) return { ok: false, reason: 'mode-mismatch' };

		const typed = typeof email === 'string' ? email.trim().toLowerCase() : '';
		if (!typed) return { ok: false, reason: 'email-mismatch' };

		let session: StripeCheckoutSessionObject;
		try {
			session = await this.request<StripeCheckoutSessionObject>(
				key,
				`/checkout/sessions/${encodeURIComponent(sessionId)}?expand[]=subscription`,
				timeoutMs
			);
		} catch (error) {
			if (error instanceof StripeHttpError && error.status === 404) return { ok: false, reason: 'not-found' };
			this.logger.error(`Could not retrieve a Checkout Session to verify a purchase. ${describe(error)}`);
			return { ok: false, reason: 'stripe-unavailable' };
		}

		if (session?.status !== 'complete') return { ok: false, reason: 'incomplete' };
		if (session.mode !== 'subscription' || session.metadata?.ever_product !== product) {
			return { ok: false, reason: 'foreign-product' };
		}

		const buyerEmail = (session.customer_details?.email ?? session.customer_email ?? '').trim().toLowerCase();
		if (!buyerEmail || buyerEmail !== typed) return { ok: false, reason: 'email-mismatch' };

		const ageSeconds = Date.now() / 1000 - Number(session.created ?? 0);
		if (!Number.isFinite(ageSeconds) || ageSeconds > CHECKOUT_SESSION_MAX_AGE_SECONDS) {
			return { ok: false, reason: 'expired' };
		}

		const customerId = typeof session.customer === 'string' ? session.customer : session.customer?.id;
		if (!customerId) return { ok: false, reason: 'no-customer' };

		try {
			const subscription = session.subscription;
			const entitled =
				subscription && typeof subscription === 'object'
					? ENTITLING_STATUSES.has(subscription.status ?? '') && subscriptionIsForProduct(subscription, product)
					: await this.customerHasEntitlingSubscription(customerId, timeoutMs);
			if (!entitled) return { ok: false, reason: 'not-entitled' };
		} catch (error) {
			this.logger.error(`Could not confirm the subscription behind a Checkout Session. ${describe(error)}`);
			return { ok: false, reason: 'stripe-unavailable' };
		}

		return { ok: true, customerId };
	}

	/**
	 * Shared lookup: the first customer sharing this email that holds an entitling subscription.
	 *
	 * Throws on transport or API failure so each caller can decide what that means for it.
	 *
	 * Three constraints shape this, and all three exist because it runs inside a request to the
	 * public `POST /auth/register`:
	 *
	 *  - **Bounded work.** Stripe's `email` filter can return many customers, and each needs its own
	 *    subscription lookup. Left unbounded that is one HTTP call per customer on a request thread,
	 *    so the number examined is capped and the whole operation shares a single deadline.
	 *  - **Paginated, not truncated.** A single page would silently conclude NOT_ENTITLED for a paying
	 *    customer whose record happened to sit on page two — the worst possible way to be wrong here.
	 *  - **Case-tolerant.** Stripe's `email` filter is an exact match, so an address stored with
	 *    different casing than the one typed at registration would not be found by either spelling
	 *    alone.
	 */
	private async findEntitlingCustomerId(email: string): Promise<string | null> {
		const key = this.secretKey;
		if (!key) return null;

		const typed = email?.trim();
		if (!typed) return null;

		const deadline = Date.now() + OVERALL_DEADLINE_MS;
		// Both spellings, because Stripe matches the stored address exactly. De-duplicated so the
		// common all-lowercase case still costs one request.
		const spellings = [...new Set([typed, typed.toLowerCase()])];

		const seen = new Set<string>();
		let examined = 0;

		for (const spelling of spellings) {
			for await (const customer of this.paginate<{ id: string }>(
				key,
				`/customers?email=${encodeURIComponent(spelling)}`,
				deadline
			)) {
				if (seen.has(customer.id)) continue;
				seen.add(customer.id);

				if (++examined > MAX_CUSTOMERS_EXAMINED) {
					throw new BudgetExceededError(`examined ${examined} customers sharing one address`);
				}
				if (await this.hasEntitlingSubscription(key, customer.id, deadline)) {
					return customer.id;
				}
			}
		}

		return null;
	}

	/**
	 * Whether this customer holds a subscription to THIS deployment's product in an entitling status.
	 *
	 * The product half is what stops a Teams, Platform, Works or GitHands subscription on the shared
	 * account from passing the Gauzy paywall or being linked to a Gauzy tenant.
	 */
	private async hasEntitlingSubscription(
		key: string,
		customerId: string,
		deadline: number,
		timeoutMs = REQUEST_TIMEOUT_MS
	): Promise<boolean> {
		const product = this.billingProduct;
		if (!product) return false;

		for await (const subscription of this.paginate<StripeSubscriptionListItem>(
			key,
			`/subscriptions?customer=${encodeURIComponent(customerId)}&status=all`,
			deadline,
			timeoutMs
		)) {
			if (ENTITLING_STATUSES.has(subscription.status) && subscriptionIsForProduct(subscription, product)) {
				return true;
			}
		}
		return false;
	}

	/**
	 * Walk every page of a Stripe list endpoint.
	 *
	 * Reading only the first page is the failure that matters here: it turns "your subscription is on
	 * page two" into "you have no subscription", and refuses a paying customer.
	 *
	 * Running out of time **throws** rather than ending the iteration quietly. Returning early would
	 * be indistinguishable from a genuinely exhausted list, and the caller would read it as "this
	 * person has nothing" — reintroducing exactly the wrong answer the pagination exists to prevent.
	 * As a thrown error it becomes UNKNOWN instead, which lets the registration through.
	 */
	private async *paginate<T extends { id?: string }>(
		key: string,
		path: string,
		deadline: number,
		timeoutMs = REQUEST_TIMEOUT_MS
	): AsyncGenerator<T> {
		let startingAfter: string | undefined;
		const separator = path.includes('?') ? '&' : '?';

		for (;;) {
			if (Date.now() > deadline) {
				throw new BudgetExceededError('the entitlement lookup ran out of time mid-pagination');
			}

			const page = await this.request<{ data: T[]; has_more?: boolean }>(
				key,
				`${path}${separator}limit=${PAGE_SIZE}${startingAfter ? `&starting_after=${startingAfter}` : ''}`,
				Math.max(1, Math.min(timeoutMs, deadline - Date.now()))
			);

			const rows = page.data ?? [];
			for (const row of rows) yield row;

			const last = rows[rows.length - 1];
			if (!page.has_more || !last?.id) return;
			startingAfter = last.id;
		}
	}

	/**
	 * GET a Stripe endpoint, with a short timeout so a hanging call cannot stall registration.
	 */
	private async request<T>(key: string, path: string, timeoutMs = REQUEST_TIMEOUT_MS): Promise<T> {
		const controller = new AbortController();
		const timer = setTimeout(() => controller.abort(), timeoutMs);
		try {
			const response = await fetch(`${STRIPE_API}${path}`, {
				headers: {
					Authorization: `Bearer ${key}`,
					'Stripe-Version': '2025-02-24.acacia'
				},
				signal: controller.signal
			});

			if (!response.ok) {
				// Deliberately neither the query string nor Stripe's body: the path carries
				// `?email=<registrant>`, and Stripe echoes the offending parameters back in its error
				// message. Logging either would put an address someone typed into a signup form into
				// the application log. The endpoint and status are enough to debug with.
				throw new StripeHttpError(`Stripe GET ${redactPath(path)} -> ${response.status}`, response.status);
			}

			return (await response.json()) as T;
		} finally {
			clearTimeout(timer);
		}
	}
}

/* Minimal shapes for the Stripe payloads read above. */

interface StripeSubscriptionListItem {
	id: string;
	status: string;
	metadata?: Record<string, string> | null;
	items?: { data?: Array<{ price?: { lookup_key?: string | null } | null }> } | null;
}

interface StripeCheckoutSessionObject {
	id?: string;
	status?: string | null;
	mode?: string | null;
	created?: number;
	customer?: string | { id?: string } | null;
	customer_email?: string | null;
	customer_details?: { email?: string | null } | null;
	metadata?: Record<string, string> | null;
	subscription?: string | (Partial<StripeSubscriptionListItem> & { status?: string }) | null;
}
