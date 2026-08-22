import {
	BadRequestException,
	GatewayTimeoutException,
	Injectable,
	Logger,
	NotFoundException,
	ServiceUnavailableException,
	UnauthorizedException
} from '@nestjs/common';
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

/**
 * Stripe supports `day`, `week`, `month` and `year`. Collapsing everything non-yearly to `month`
 * would show a weekly plan as monthly — wrong about the customer's own billing period.
 */
export type BillingInterval = 'day' | 'week' | 'month' | 'year' | 'one_time';

export interface BillingPlan {
	/** `ever_<product>_<hosting>_<tier>_<interval>` — stable across price replacements. */
	lookupKey: string;
	priceId: string;
	productName: string;
	amount: number;
	currency: string;
	interval: BillingInterval;
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
	interval: BillingInterval;
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

	/** Which Stripe account this deployment talks to: live, test, or none at all. */
	get mode(): 'live' | 'test' | 'disabled' {
		return this.stripeSubscriptionService.mode;
	}

	/**
	 * The tenant's current subscription, or null when it has never had one.
	 *
	 * Cancelled and otherwise dead subscriptions are excluded: the billing page should say "no
	 * subscription" rather than show a corpse.
	 */
	async getSubscription(stripeCustomerId: string): Promise<BillingSubscription | null> {
		const current = await this.findCurrentSubscription(stripeCustomerId);
		return current ? this.toSubscription(current) : null;
	}

	/**
	 * Plans this tenant could switch to, taken from the prices actually present in Stripe.
	 *
	 * `productKey` narrows the list to one Ever product (e.g. `gauzy`), since a Gauzy tenant should
	 * not be offered Ever Demand's tiers.
	 */
	async listPlans(productKey: string, hosting = 'cloud'): Promise<BillingPlan[]> {
		const prefix = `ever_${productKey}_${hosting}_`;

		// Paged, not truncated. One page holds 100 prices and the shared account already carries 40
		// across four products; the moment another product lands, a first-page-only read would start
		// dropping real plans out of the switcher with no error to notice.
		const prices = await this.listAll<StripePriceObject>('/prices?active=true&expand[]=data.product');

		return prices
			.filter((price) => price.lookup_key?.startsWith(prefix))
			.map((price) => this.toPlan(price))
			.sort((a, b) => a.amount - b.amount);
	}

	/** Walk every page of a Stripe list endpoint. */
	private async listAll<T extends { id?: string }>(path: string): Promise<T[]> {
		const separator = path.includes('?') ? '&' : '?';
		const items: T[] = [];
		let startingAfter: string | undefined;

		for (;;) {
			const page = await this.get<{ data: T[]; has_more?: boolean }>(
				`${path}${separator}limit=100${startingAfter ? `&starting_after=${startingAfter}` : ''}`
			);
			const rows = page.data ?? [];
			items.push(...rows);

			const last = rows[rows.length - 1];
			if (!page.has_more || !last?.id) return items;
			startingAfter = last.id;
		}
	}

	/**
	 * Move the tenant's subscription onto another price.
	 *
	 * Proration is left to Stripe's default so an upgrade bills the difference immediately and a
	 * downgrade credits it — surprising the customer with a bespoke proration rule is worse than
	 * following the behaviour their invoice will explain.
	 */
	async changePlan(
		stripeCustomerId: string,
		lookupKey: string,
		productKey: string,
		hosting = 'cloud'
	): Promise<BillingSubscription> {
		// The catalog is shared by every Ever product, so a lookup key from another one is perfectly
		// valid in Stripe and would otherwise be accepted here — moving a Gauzy tenant onto, say,
		// Ever Demand's pricing. `listPlans` already narrows what the UI offers; this refuses anything
		// outside that set regardless of what the client sends.
		const allowedPrefix = `ever_${productKey}_${hosting}_`;
		if (!lookupKey.startsWith(allowedPrefix)) {
			throw new BadRequestException('That plan is not available for this product.');
		}

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

		const updated = await this.post<StripeSubscriptionObject>(
			`/subscriptions/${subscription.id}`,
			{
				'items[0][id]': item.id,
				'items[0][price]': price.id,
				// A pending cancellation would otherwise survive the switch and quietly kill the new plan.
				cancel_at_period_end: 'false'
			},
			idempotencyKey('change', subscription, price.id)
		);

		return this.toSubscription(updated);
	}

	/** Schedule cancellation for the end of the paid period — never an immediate cut-off. */
	async cancelSubscription(stripeCustomerId: string): Promise<BillingSubscription> {
		const subscription = await this.requireSubscriptionObject(stripeCustomerId);
		const updated = await this.post<StripeSubscriptionObject>(
			`/subscriptions/${subscription.id}`,
			{ cancel_at_period_end: 'true' },
			idempotencyKey('cancel', subscription)
		);
		return this.toSubscription(updated);
	}

	/** Undo a pending cancellation while the period is still running. */
	async resumeSubscription(stripeCustomerId: string): Promise<BillingSubscription> {
		const subscription = await this.requireSubscriptionObject(stripeCustomerId);
		const updated = await this.post<StripeSubscriptionObject>(
			`/subscriptions/${subscription.id}`,
			{ cancel_at_period_end: 'false' },
			idempotencyKey('resume', subscription)
		);
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

	/**
	 * The subscription the billing page is about: the newest one still alive, so a resubscribe wins
	 * over the subscription it replaced. Dead ones are excluded — the page should say "no
	 * subscription" rather than show a corpse.
	 *
	 * `data.items.data.price.product` is five levels deep and Stripe expands at most four, so the
	 * product name is resolved separately in toSubscription().
	 */
	private async findCurrentSubscription(stripeCustomerId: string): Promise<StripeSubscriptionObject | null> {
		const subscriptions = await this.listAll<StripeSubscriptionObject>(
			`/subscriptions?customer=${encodeURIComponent(stripeCustomerId)}&status=all`
		);

		const live = subscriptions.filter((s) => LIVE_STATUSES.has(s.status));
		if (!live.length) return null;

		live.sort((a, b) => (b.created ?? 0) - (a.created ?? 0));
		return live[0];
	}

	private async requireSubscriptionObject(stripeCustomerId: string): Promise<StripeSubscriptionObject> {
		const current = await this.findCurrentSubscription(stripeCustomerId);
		if (!current) {
			throw new NotFoundException('This account has no active subscription.');
		}
		return current;
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
			interval: toInterval(price),
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
			interval: toInterval(price),
			tier: metadata.ever_tier,
			hosting: metadata.ever_hosting,
			product: metadata.ever_product
		};
	}

	private get<T>(path: string): Promise<T> {
		return this.request<T>('GET', path);
	}

	/**
	 * `idempotencyKey` makes a retried POST safe. Without it, a network blip on a plan change can
	 * leave the caller unsure whether the switch happened, and a retry would apply it twice — with a
	 * proration invoice each time. Stripe replays the original response instead when the key repeats.
	 */
	private post<T>(path: string, form: Record<string, string>, idempotencyKey?: string): Promise<T> {
		return this.request<T>('POST', path, form, idempotencyKey);
	}

	private async request<T>(
		method: 'GET' | 'POST',
		path: string,
		form?: Record<string, string>,
		idempotencyKey?: string
	): Promise<T> {
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
					...(form ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {}),
					...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {})
				},
				body: form ? new URLSearchParams(form).toString() : undefined,
				signal: controller.signal
			});

			// A proxy or gateway in front of Stripe can answer with HTML, so parsing is not assumed.
			const raw = await response.text();
			let json: any;
			try {
				json = raw ? JSON.parse(raw) : {};
			} catch {
				this.logger.error(`Stripe ${method} ${path} -> ${response.status}: non-JSON response`);
				throw new ServiceUnavailableException('Billing is temporarily unavailable.');
			}

			if (!response.ok) {
				const message = json?.error?.message ?? `Stripe ${method} ${path} failed`;
				this.logger.error(`Stripe ${method} ${path} -> ${response.status}: ${message}`);
				throw stripeStatusToException(response.status, message);
			}
			return json as T;
		} catch (error) {
			// An aborted fetch is our timeout firing, not a client mistake; without this it surfaces
			// as an unhandled AbortError and the caller sees a 500.
			if (error instanceof Error && error.name === 'AbortError') {
				this.logger.error(`Stripe ${method} ${path} timed out`);
				throw new GatewayTimeoutException('Billing did not respond in time. Please try again.');
			}
			throw error;
		} finally {
			clearTimeout(timer);
		}
	}
}

/**
 * Map a Stripe HTTP status onto an accurate one of ours.
 *
 * Everything used to become a 400, which told the caller they had made a mistake even when the real
 * cause was our expired key, our rate limit, or Stripe being down — and a 400 invites the client to
 * "fix" a request that was never wrong, rather than retry.
 */
function stripeStatusToException(status: number, message: string): Error {
	if (status === 401 || status === 403) {
		// Our credentials, not the caller's problem — never echo Stripe's wording to them.
		return new UnauthorizedException('Billing is not correctly configured on this deployment.');
	}
	if (status === 404) return new NotFoundException(message);
	if (status === 429) return new ServiceUnavailableException('Billing is busy. Please try again shortly.');
	if (status >= 500) return new ServiceUnavailableException('Billing is temporarily unavailable.');
	return new BadRequestException(message);
}

/**
 * A key that collapses a *retry* but never a genuine second request.
 *
 * Keying purely on the operation and subscription looked right, but cancel -> resume -> cancel is a
 * real sequence a customer can perform, and inside Stripe's idempotency retention window the second
 * cancel would have replayed the first response instead of acting. Mixing in the subscription's
 * current state means each of those is a distinct key, while an immediate retry — where nothing has
 * changed yet — reuses the same one.
 */
function idempotencyKey(operation: string, subscription: StripeSubscriptionObject, extra?: string): string {
	const state = `${subscription.status}:${subscription.cancel_at_period_end ? 'pending-cancel' : 'live'}`;
	const currentPrice = subscription.items?.data?.[0]?.price?.id ?? 'none';
	return [operation, subscription.id, state, currentPrice, extra].filter(Boolean).join(':');
}

/** Statuses that represent a subscription the customer still has. */
const LIVE_STATUSES = new Set(['active', 'trialing', 'past_due', 'unpaid', 'incomplete']);

/** Stripe's recurring interval, or `one_time` for a price with no `recurring` block. */
function toInterval(price?: StripePriceObject): BillingInterval {
	const interval = price?.recurring?.interval;
	if (interval === 'day' || interval === 'week' || interval === 'month' || interval === 'year') {
		return interval;
	}
	return price?.recurring ? 'month' : 'one_time';
}

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
