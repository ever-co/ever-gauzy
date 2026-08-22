import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { StripeSubscriptionService } from './stripe-subscription.service';

/**
 * Everything the in-product billing pages need, and nothing they do not.
 *
 * Two ways to manage a subscription are supported deliberately and both must stay good: these
 * endpoints power the native billing screens inside the product, and `createPortalSession()` hands
 * the user to Stripe's own customer portal for anything the native screens do not cover. The portal
 * is the escape hatch, not the primary experience.
 *
 * Available plans are read back out of **Stripe** rather than from a catalog file copied into this
 * repo. The catalog is defined once, on the checkout host, and synced into Stripe; reading Stripe
 * here means the platform can never drift from what is actually purchasable.
 *
 * Every method is inert-by-construction: callers must check `isBillingEnforced()` first, and the
 * controller hides the whole surface when Stripe is not configured.
 */

export interface BillingPlan {
	/** `ever_<product>_<hosting>_<tier>_<interval>` — stable across price replacements. */
	lookupKey: string;
	priceId: string;
	productName: string;
	amount: number;
	currency: string;
	interval: 'month' | 'year' | 'one_time';
	tier?: string;
	hosting?: string;
	product?: string;
}

export interface BillingSubscription {
	id: string;
	status: string;
	planName: string;
	lookupKey?: string;
	amount: number;
	currency: string;
	interval: 'month' | 'year' | 'one_time';
	/** ISO timestamps, or null where Stripe does not supply one. */
	trialEndsAt: string | null;
	renewsAt: string | null;
	/** True when the subscription is set to stop at the end of the current period. */
	cancelAtPeriodEnd: boolean;
}

export interface BillingInvoice {
	id: string;
	number: string | null;
	status: string | null;
	amountPaid: number;
	currency: string;
	createdAt: string;
	hostedInvoiceUrl: string | null;
	invoicePdfUrl: string | null;
}

export interface BillingPaymentMethod {
	brand: string | null;
	last4: string | null;
	expMonth: number | null;
	expYear: number | null;
}

const STRIPE_API = 'https://api.stripe.com/v1';

@Injectable()
export class BillingService {
	private readonly logger = new Logger(BillingService.name);

	constructor(private readonly stripeSubscriptionService: StripeSubscriptionService) {}

	/** Mirrors the subscription service's switch, so the controller only has to ask one object. */
	isBillingEnforced(): boolean {
		return this.stripeSubscriptionService.isBillingEnforced();
	}

	/**
	 * The tenant's current subscription, or null when it has never had one.
	 *
	 * Cancelled and otherwise dead subscriptions are excluded: the billing page should say "no
	 * subscription" rather than show a corpse.
	 */
	async getSubscription(stripeCustomerId: string): Promise<BillingSubscription | null> {
		// `data.items.data.price.product` is five levels deep and Stripe expands at most four, so the
		// product name is resolved separately in toSubscription().
		const { data } = await this.get<{ data: StripeSubscriptionObject[] }>(
			`/subscriptions?customer=${encodeURIComponent(stripeCustomerId)}&status=all&limit=100`
		);

		const live = (data ?? []).filter((s) => LIVE_STATUSES.has(s.status));
		if (!live.length) return null;

		// Newest first, so a resubscribe wins over the subscription it replaced.
		live.sort((a, b) => (b.created ?? 0) - (a.created ?? 0));
		return this.toSubscription(live[0]);
	}

	/**
	 * Plans this tenant could switch to, taken from the prices actually present in Stripe.
	 *
	 * `productKey` narrows the list to one Ever product (e.g. `gauzy`), since a Gauzy tenant should
	 * not be offered Ever Demand's tiers.
	 */
	async listPlans(productKey: string, hosting = 'cloud'): Promise<BillingPlan[]> {
		const prefix = `ever_${productKey}_${hosting}_`;
		const { data } = await this.get<{ data: StripePriceObject[] }>(
			`/prices?active=true&limit=100&expand[]=data.product`
		);

		return (data ?? [])
			.filter((price) => price.lookup_key?.startsWith(prefix))
			.map((price) => this.toPlan(price))
			.sort((a, b) => a.amount - b.amount);
	}

	/**
	 * Move the tenant's subscription onto another price.
	 *
	 * Proration is left to Stripe's default so an upgrade bills the difference immediately and a
	 * downgrade credits it — surprising the customer with a bespoke proration rule is worse than
	 * following the behaviour their invoice will explain.
	 */
	async changePlan(stripeCustomerId: string, lookupKey: string): Promise<BillingSubscription> {
		const subscription = await this.requireSubscriptionObject(stripeCustomerId);

		const { data: prices } = await this.get<{ data: StripePriceObject[] }>(
			`/prices?lookup_keys[]=${encodeURIComponent(lookupKey)}&active=true&limit=1`
		);
		const price = prices?.[0];
		if (!price) {
			throw new NotFoundException(`No active plan with lookup key "${lookupKey}".`);
		}

		const item = subscription.items?.data?.[0];
		if (!item) {
			throw new BadRequestException('That subscription has no billable item to change.');
		}
		if (item.price?.id === price.id) {
			throw new BadRequestException('The subscription is already on that plan.');
		}

		const updated = await this.post<StripeSubscriptionObject>(`/subscriptions/${subscription.id}`, {
			'items[0][id]': item.id,
			'items[0][price]': price.id,
			// A pending cancellation would otherwise survive the switch and quietly kill the new plan.
			cancel_at_period_end: 'false'
		});

		return this.toSubscription(updated);
	}

	/** Schedule cancellation for the end of the paid period — never an immediate cut-off. */
	async cancelSubscription(stripeCustomerId: string): Promise<BillingSubscription> {
		const subscription = await this.requireSubscriptionObject(stripeCustomerId);
		const updated = await this.post<StripeSubscriptionObject>(`/subscriptions/${subscription.id}`, {
			cancel_at_period_end: 'true'
		});
		return this.toSubscription(updated);
	}

	/** Undo a pending cancellation while the period is still running. */
	async resumeSubscription(stripeCustomerId: string): Promise<BillingSubscription> {
		const subscription = await this.requireSubscriptionObject(stripeCustomerId);
		const updated = await this.post<StripeSubscriptionObject>(`/subscriptions/${subscription.id}`, {
			cancel_at_period_end: 'false'
		});
		return this.toSubscription(updated);
	}

	/** Invoice history, newest first. */
	async listInvoices(stripeCustomerId: string, limit = 24): Promise<BillingInvoice[]> {
		const { data } = await this.get<{ data: StripeInvoiceObject[] }>(
			`/invoices?customer=${encodeURIComponent(stripeCustomerId)}&limit=${limit}`
		);

		return (data ?? []).map((invoice) => ({
			id: invoice.id,
			number: invoice.number ?? null,
			status: invoice.status ?? null,
			amountPaid: invoice.amount_paid ?? 0,
			currency: invoice.currency,
			createdAt: new Date((invoice.created ?? 0) * 1000).toISOString(),
			hostedInvoiceUrl: invoice.hosted_invoice_url ?? null,
			invoicePdfUrl: invoice.invoice_pdf ?? null
		}));
	}

	/**
	 * The card on file, or null when there is none (a free tier never collects one).
	 *
	 * Only the display fields Stripe exposes — brand, last four, expiry. Nothing here is card data in
	 * any sense that matters; the number never reaches this system.
	 */
	async getPaymentMethod(stripeCustomerId: string): Promise<BillingPaymentMethod | null> {
		const { data } = await this.get<{ data: StripePaymentMethodObject[] }>(
			`/payment_methods?customer=${encodeURIComponent(stripeCustomerId)}&type=card&limit=1`
		);

		const card = data?.[0]?.card;
		if (!card) return null;

		return {
			brand: card.brand ?? null,
			last4: card.last4 ?? null,
			expMonth: card.exp_month ?? null,
			expYear: card.exp_year ?? null
		};
	}

	/**
	 * A one-shot Stripe customer portal URL.
	 *
	 * This is the second of the two supported paths: the native pages cover the common cases, the
	 * portal covers everything else — and keeps covering it as Stripe adds features we have not
	 * built. In live mode it renders on the account's custom domain.
	 */
	async createPortalSession(stripeCustomerId: string, returnUrl: string): Promise<string> {
		const session = await this.post<{ url: string }>('/billing_portal/sessions', {
			customer: stripeCustomerId,
			return_url: returnUrl
		});

		if (!session.url) {
			throw new BadRequestException('Stripe did not return a portal URL.');
		}
		return session.url;
	}

	/* ------------------------------------------------------------------ internals */

	private async requireSubscriptionObject(stripeCustomerId: string): Promise<StripeSubscriptionObject> {
		const { data } = await this.get<{ data: StripeSubscriptionObject[] }>(
			`/subscriptions?customer=${encodeURIComponent(stripeCustomerId)}&status=all&limit=100`
		);

		const live = (data ?? []).filter((s) => LIVE_STATUSES.has(s.status));
		if (!live.length) {
			throw new NotFoundException('This account has no active subscription.');
		}
		live.sort((a, b) => (b.created ?? 0) - (a.created ?? 0));
		return live[0];
	}

	private async toSubscription(subscription: StripeSubscriptionObject): Promise<BillingSubscription> {
		const item = subscription.items?.data?.[0];
		const price = item?.price;

		return {
			id: subscription.id,
			status: subscription.status,
			planName: (await this.productNameFor(price)) ?? price?.nickname ?? 'Subscription',
			lookupKey: price?.lookup_key ?? undefined,
			amount: price?.unit_amount ?? 0,
			currency: price?.currency ?? 'usd',
			interval: price?.recurring?.interval === 'year' ? 'year' : price?.recurring ? 'month' : 'one_time',
			trialEndsAt: toIso(subscription.trial_end),
			renewsAt: toIso(subscription.current_period_end),
			cancelAtPeriodEnd: Boolean(subscription.cancel_at_period_end)
		};
	}

	/**
	 * The display name of a price's product.
	 *
	 * Subscription payloads carry `price.product` as a bare id — it sits one level below Stripe's
	 * four-level expand ceiling — so it is fetched here and memoised. Product names change rarely and
	 * the cache lives only as long as the request handler's service instance.
	 */
	private async productNameFor(price?: StripePriceObject): Promise<string | undefined> {
		if (!price?.product) return undefined;
		if (typeof price.product === 'object') return price.product.name;

		const productId = price.product;
		const cached = this.productNames.get(productId);
		if (cached) return cached;

		try {
			const product = await this.get<StripeProductObject>(`/products/${encodeURIComponent(productId)}`);
			if (product?.name) {
				this.productNames.set(productId, product.name);
				return product.name;
			}
		} catch (error) {
			// A missing name is cosmetic; the caller falls back to the nickname or a generic label.
			this.logger.warn(`Could not read Stripe product ${productId}: ${(error as Error).message}`);
		}
		return undefined;
	}

	private readonly productNames = new Map<string, string>();

	private toPlan(price: StripePriceObject): BillingPlan {
		const product = typeof price.product === 'object' ? price.product : undefined;
		const metadata = { ...(product?.metadata ?? {}), ...(price.metadata ?? {}) };

		return {
			lookupKey: price.lookup_key as string,
			priceId: price.id,
			productName: product?.name ?? (price.lookup_key as string),
			amount: price.unit_amount ?? 0,
			currency: price.currency,
			interval: price.recurring?.interval === 'year' ? 'year' : price.recurring ? 'month' : 'one_time',
			tier: metadata.ever_tier,
			hosting: metadata.ever_hosting,
			product: metadata.ever_product
		};
	}

	private get<T>(path: string): Promise<T> {
		return this.request<T>('GET', path);
	}

	private post<T>(path: string, form: Record<string, string>): Promise<T> {
		return this.request<T>('POST', path, form);
	}

	private async request<T>(method: 'GET' | 'POST', path: string, form?: Record<string, string>): Promise<T> {
		const key = process.env.STRIPE_SECRET_KEY?.trim();
		if (!key) {
			// Reached only if a caller skipped the isBillingEnforced() check.
			throw new BadRequestException('Billing is not configured on this deployment.');
		}

		const controller = new AbortController();
		const timer = setTimeout(() => controller.abort(), 10000);
		try {
			const response = await fetch(`${STRIPE_API}${path}`, {
				method,
				headers: {
					Authorization: `Bearer ${key}`,
					'Stripe-Version': '2025-02-24.acacia',
					...(form ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {})
				},
				body: form ? new URLSearchParams(form).toString() : undefined,
				signal: controller.signal
			});

			const json = await response.json();
			if (!response.ok) {
				const message = json?.error?.message ?? `Stripe ${method} ${path} failed`;
				this.logger.error(`Stripe ${method} ${path} -> ${response.status}: ${message}`);
				// Stripe's message is safe to surface: it describes the request, not the account.
				throw new BadRequestException(message);
			}
			return json as T;
		} finally {
			clearTimeout(timer);
		}
	}
}

/** Statuses that represent a subscription the customer still has. */
const LIVE_STATUSES = new Set(['active', 'trialing', 'past_due', 'unpaid', 'incomplete']);

function toIso(seconds?: number | null): string | null {
	return seconds ? new Date(seconds * 1000).toISOString() : null;
}

/* Minimal shapes for the Stripe payloads actually read above. */

interface StripeProductObject {
	name?: string;
	metadata?: Record<string, string>;
}

interface StripePriceObject {
	id: string;
	lookup_key?: string | null;
	nickname?: string | null;
	unit_amount?: number | null;
	currency: string;
	recurring?: { interval?: string } | null;
	product?: string | StripeProductObject;
	metadata?: Record<string, string>;
}

interface StripeSubscriptionObject {
	id: string;
	status: string;
	created?: number;
	trial_end?: number | null;
	current_period_end?: number | null;
	cancel_at_period_end?: boolean;
	items?: { data?: Array<{ id: string; price?: StripePriceObject }> };
}

interface StripeInvoiceObject {
	id: string;
	number?: string | null;
	status?: string | null;
	amount_paid?: number;
	currency: string;
	created?: number;
	hosted_invoice_url?: string | null;
	invoice_pdf?: string | null;
}

interface StripePaymentMethodObject {
	card?: { brand?: string; last4?: string; exp_month?: number; exp_year?: number };
}
