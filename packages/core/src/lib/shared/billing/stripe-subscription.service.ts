import { Injectable, Logger } from '@nestjs/common';

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
function describe(error: unknown): string {
	const message = error instanceof Error ? error.message : String(error);
	return message.replace(/[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+/g, '<redacted-email>');
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
	async getCustomerEmail(customerId: string): Promise<string | null> {
		const key = this.secretKey;
		if (!key || !customerId?.trim()) return null;

		try {
			const customer = await this.request<{ email?: string | null; deleted?: boolean }>(
				key,
				`/customers/${encodeURIComponent(customerId.trim())}`
			);
			// A deleted customer comes back as `{ deleted: true }` with no email.
			return customer?.email?.trim() || null;
		} catch (error) {
			this.logger.error(`Could not resolve the email for a Stripe customer. ${describe(error)}`);
			return null;
		}
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

	/** Whether this customer holds any subscription in an entitling status. */
	private async hasEntitlingSubscription(key: string, customerId: string, deadline: number): Promise<boolean> {
		for await (const subscription of this.paginate<{ id: string; status: string }>(
			key,
			`/subscriptions?customer=${encodeURIComponent(customerId)}&status=all`,
			deadline
		)) {
			if (ENTITLING_STATUSES.has(subscription.status)) return true;
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
		deadline: number
	): AsyncGenerator<T> {
		let startingAfter: string | undefined;
		const separator = path.includes('?') ? '&' : '?';

		for (;;) {
			if (Date.now() > deadline) {
				throw new BudgetExceededError('the entitlement lookup ran out of time mid-pagination');
			}

			const page = await this.request<{ data: T[]; has_more?: boolean }>(
				key,
				`${path}${separator}limit=${PAGE_SIZE}${startingAfter ? `&starting_after=${startingAfter}` : ''}`
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
	private async request<T>(key: string, path: string): Promise<T> {
		const controller = new AbortController();
		const timer = setTimeout(() => controller.abort(), 8000);
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
				throw new Error(`Stripe GET ${redactPath(path)} -> ${response.status}`);
			}

			return (await response.json()) as T;
		} finally {
			clearTimeout(timer);
		}
	}
}
