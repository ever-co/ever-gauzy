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
	 * Read straight from the process environment rather than `@gauzy/config`, because the *absence*
	 * of this value is the feature switch: nothing else in the platform should have to know that
	 * billing exists, and a fork with no Stripe account must behave exactly as it does today.
	 */
	private get secretKey(): string | undefined {
		const key = process.env.STRIPE_SECRET_KEY?.trim();
		return key ? key : undefined;
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
				`Could not determine Stripe entitlement for a registration attempt; allowing it through. ${
					error instanceof Error ? error.message : error
				}`
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
				`Could not resolve a Stripe customer for a new tenant; it will need linking later. ${
					error instanceof Error ? error.message : error
				}`
			);
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

				if (++examined > MAX_CUSTOMERS_EXAMINED || Date.now() > deadline) {
					// Rather than keep a signup waiting, give up and let the caller treat this as
					// UNKNOWN — which lets the registration through. Someone with this many Stripe
					// customers is not the case this gate is defending against.
					throw new Error(
						`Entitlement lookup exceeded its budget after ${examined} customer(s); treating as unknown.`
					);
				}

				for await (const subscription of this.paginate<{ id: string; status: string }>(
					key,
					`/subscriptions?customer=${encodeURIComponent(customer.id)}&status=all`,
					deadline
				)) {
					if (ENTITLING_STATUSES.has(subscription.status)) {
						return customer.id;
					}
				}
			}
		}

		return null;
	}

	/**
	 * Walk every page of a Stripe list endpoint, stopping at `deadline`.
	 *
	 * Reading only the first page is the failure that matters here: it turns "your subscription is on
	 * page two" into "you have no subscription", and refuses a paying customer.
	 */
	private async *paginate<T extends { id?: string }>(
		key: string,
		path: string,
		deadline: number
	): AsyncGenerator<T> {
		let startingAfter: string | undefined;
		const separator = path.includes('?') ? '&' : '?';

		for (;;) {
			if (Date.now() > deadline) return;

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
				const body = await response.text().catch(() => '');
				throw new Error(`Stripe GET ${path} -> ${response.status} ${body.slice(0, 200)}`);
			}

			return (await response.json()) as T;
		} finally {
			clearTimeout(timer);
		}
	}
}
