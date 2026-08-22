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
		const key = this.secretKey;
		if (!key) return EntitlementResult.ENTITLED; // billing off: nothing to check

		const normalized = email?.trim().toLowerCase();
		if (!normalized) return EntitlementResult.NOT_ENTITLED;

		try {
			const customers = await this.request<{ data: Array<{ id: string }> }>(
				key,
				`/customers?email=${encodeURIComponent(normalized)}&limit=100`
			);

			if (!customers.data?.length) {
				return EntitlementResult.NOT_ENTITLED;
			}

			// Stripe allows several customers to share an email, so every one of them has to be
			// checked before concluding the person has nothing.
			for (const customer of customers.data) {
				const subscriptions = await this.request<{ data: Array<{ status: string }> }>(
					key,
					`/subscriptions?customer=${encodeURIComponent(customer.id)}&status=all&limit=100`
				);

				if (subscriptions.data?.some((s) => ENTITLING_STATUSES.has(s.status))) {
					return EntitlementResult.ENTITLED;
				}
			}

			return EntitlementResult.NOT_ENTITLED;
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
