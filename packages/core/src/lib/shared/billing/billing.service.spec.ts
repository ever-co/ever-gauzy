import { BadRequestException, Logger, NotFoundException } from '@nestjs/common';
import { BillingService, PaymentMethodRequiredError } from './billing.service';
import { StripeSubscriptionService } from './stripe-subscription.service';

/**
 * The in-product billing pages act on a Stripe customer that may also hold subscriptions to other Ever
 * products (the account is shared). These tests pin that the pages see, cancel and re-price ONLY this
 * deployment's product, and that an upgrade to a paid plan is refused — before anything is changed —
 * when there is no card to charge (CC02-13: the $0 Starter subscriptions collect none).
 */

const CUSTOMER = 'cus_1';

function sub(overrides: Record<string, any> = {}) {
	return {
		id: 'sub_g',
		status: 'trialing',
		created: 1_700_000_000,
		metadata: { ever_product: 'gauzy' },
		items: {
			data: [
				{
					id: 'si_g',
					price: {
						id: 'price_starter',
						lookup_key: 'ever_gauzy_cloud_starter_annual',
						unit_amount: 0,
						currency: 'usd',
						recurring: { interval: 'year' }
					}
				}
			]
		},
		default_payment_method: null,
		default_source: null,
		latest_invoice: 'in_1',
		...overrides
	};
}

function teams(overrides: Record<string, any> = {}) {
	return sub({
		id: 'sub_t',
		status: 'active',
		created: 1_800_000_000, // newer than the Gauzy one on purpose
		metadata: { ever_product: 'teams' },
		items: {
			data: [
				{
					id: 'si_t',
					price: {
						id: 'price_t',
						lookup_key: 'ever_teams_cloud_starter_monthly',
						unit_amount: 0,
						currency: 'usd',
						recurring: { interval: 'month' }
					}
				}
			]
		},
		...overrides
	});
}

const PAID_PRICE = {
	id: 'price_pro',
	lookup_key: 'ever_gauzy_cloud_small_business_annual',
	unit_amount: 16680,
	currency: 'usd',
	recurring: { interval: 'year' }
};
const FREE_PRICE = {
	id: 'price_free_monthly',
	lookup_key: 'ever_gauzy_cloud_starter_monthly',
	unit_amount: 0,
	currency: 'usd',
	recurring: { interval: 'month' }
};

interface StripeState {
	subscriptions: any[];
	prices: Record<string, any>;
	customer: Record<string, any>;
}

let calls: Array<{ method: string; path: string; body?: string }> = [];

function stubStripe(state: StripeState) {
	calls = [];
	(global as any).fetch = jest.fn(async (input: string, init: any = {}) => {
		const method = init.method ?? 'GET';
		const path = String(input).replace('https://api.stripe.com/v1', '');
		calls.push({ method, path, body: init.body });
		let body: any;
		if (method === 'GET' && path.startsWith(`/subscriptions?customer=${CUSTOMER}&status=all`)) {
			body = { data: state.subscriptions, has_more: false };
		} else if (method === 'GET' && path.startsWith('/prices?lookup_keys[]=')) {
			const key = decodeURIComponent(/lookup_keys\[\]=([^&]+)/.exec(path)[1]);
			body = { data: state.prices[key] ? [state.prices[key]] : [] };
		} else if (method === 'GET' && path === `/customers/${CUSTOMER}`) {
			body = { id: CUSTOMER, ...state.customer };
		} else if (method === 'POST' && path.startsWith('/subscriptions/')) {
			const params = new URLSearchParams(init.body);
			const current = state.subscriptions.find((s) => path === `/subscriptions/${s.id}`);
			const newPrice =
				Object.values(state.prices).find((p: any) => p.id === params.get('items[0][price]')) ??
				current.items.data[0].price;
			body = { ...current, items: { data: [{ id: current.items.data[0].id, price: newPrice }] } };
		} else {
			throw new Error(`Unexpected Stripe request in test: ${method} ${path}`);
		}
		return { ok: true, status: 200, text: async () => JSON.stringify(body), json: async () => body };
	});
}

const posts = () => calls.filter((c) => c.method === 'POST');

const ENV_KEYS = ['STRIPE_SECRET_KEY', 'STRIPE_LIVE_MODE', 'DEMO', 'BILLING_PRODUCT'];
const saved: Record<string, string | undefined> = {};
const realFetch = (global as any).fetch;

beforeEach(() => {
	for (const key of ENV_KEYS) saved[key] = process.env[key];
	process.env.STRIPE_SECRET_KEY = 'sk_test_billing_scope_fixture';
	delete process.env.STRIPE_LIVE_MODE;
	delete process.env.DEMO;
	delete process.env.BILLING_PRODUCT;
	jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
	jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
});

afterEach(() => {
	for (const key of ENV_KEYS) {
		if (saved[key] === undefined) delete process.env[key];
		else process.env[key] = saved[key];
	}
	(global as any).fetch = realFetch;
	jest.restoreAllMocks();
});

const service = () => new BillingService(new StripeSubscriptionService());

describe('BillingService — reads only this product', () => {
	it('shows the Gauzy subscription even when a newer Teams one exists on the same customer', async () => {
		stubStripe({ subscriptions: [teams(), sub()], prices: {}, customer: {} });
		const current = await service().getSubscription(CUSTOMER);
		expect(current).toMatchObject({ id: 'sub_g', lookupKey: 'ever_gauzy_cloud_starter_annual' });
	});

	it('shows no subscription when the customer only holds another product', async () => {
		stubStripe({ subscriptions: [teams()], prices: {}, customer: {} });
		await expect(service().getSubscription(CUSTOMER)).resolves.toBeNull();
	});

	it('a Dashboard-made subscription on an ever_gauzy_ price (no metadata) is still Gauzy', async () => {
		stubStripe({ subscriptions: [sub({ metadata: {} })], prices: {}, customer: {} });
		await expect(service().getSubscription(CUSTOMER)).resolves.toMatchObject({ id: 'sub_g' });
	});

	it("cancel never touches another product's subscription", async () => {
		stubStripe({ subscriptions: [teams()], prices: {}, customer: {} });
		await expect(service().cancelSubscription(CUSTOMER)).rejects.toBeInstanceOf(NotFoundException);
		expect(posts()).toEqual([]);
	});

	it('isCustomerOfProduct: any-status Gauzy history counts; Teams-only does not', async () => {
		stubStripe({ subscriptions: [teams()], prices: {}, customer: {} });
		await expect(service().isCustomerOfProduct(CUSTOMER)).resolves.toBe(false);
		stubStripe({ subscriptions: [teams(), sub({ status: 'canceled' })], prices: {}, customer: {} });
		await expect(service().isCustomerOfProduct(CUSTOMER)).resolves.toBe(true);
	});
});

describe('BillingService.changePlan — product scope', () => {
	it('refuses a target plan of another product without calling Stripe', async () => {
		stubStripe({ subscriptions: [sub()], prices: {}, customer: {} });
		await expect(
			service().changePlan(CUSTOMER, 'ever_teams_cloud_starter_monthly', 'gauzy')
		).rejects.toBeInstanceOf(BadRequestException);
		expect(calls).toEqual([]);
	});

	it("refuses to re-price a customer whose only live subscription is another product's", async () => {
		stubStripe({ subscriptions: [teams()], prices: { [FREE_PRICE.lookup_key]: FREE_PRICE }, customer: {} });
		await expect(service().changePlan(CUSTOMER, FREE_PRICE.lookup_key, 'gauzy')).rejects.toBeInstanceOf(
			NotFoundException
		);
		expect(posts()).toEqual([]);
	});

	it('re-prices the Gauzy subscription, never the Teams one beside it', async () => {
		stubStripe({
			subscriptions: [teams(), sub()],
			prices: { [FREE_PRICE.lookup_key]: FREE_PRICE },
			customer: {}
		});
		await service().changePlan(CUSTOMER, FREE_PRICE.lookup_key, 'gauzy');
		expect(posts().map((p) => p.path)).toEqual(['/subscriptions/sub_g']);
	});
});

describe('BillingService.changePlan — CC02-13: a paid upgrade needs a card first', () => {
	it('refuses a $0 → paid switch when nothing could pay, and changes NOTHING', async () => {
		stubStripe({
			subscriptions: [sub()],
			prices: { [PAID_PRICE.lookup_key]: PAID_PRICE },
			customer: { invoice_settings: { default_payment_method: null }, default_source: null }
		});
		await expect(service().changePlan(CUSTOMER, PAID_PRICE.lookup_key, 'gauzy')).rejects.toBeInstanceOf(
			PaymentMethodRequiredError
		);
		expect(posts()).toEqual([]);
	});

	it('a card merely attached (not the invoice default) does not count', async () => {
		// No `invoice_settings.default_payment_method`: Stripe would not charge it automatically.
		stubStripe({
			subscriptions: [sub()],
			prices: { [PAID_PRICE.lookup_key]: PAID_PRICE },
			customer: { invoice_settings: {} }
		});
		await expect(service().changePlan(CUSTOMER, PAID_PRICE.lookup_key, 'gauzy')).rejects.toBeInstanceOf(
			PaymentMethodRequiredError
		);
		expect(posts()).toEqual([]);
	});

	it('switches once the customer has an invoice default (e.g. added in the portal)', async () => {
		stubStripe({
			subscriptions: [sub()],
			prices: { [PAID_PRICE.lookup_key]: PAID_PRICE },
			customer: { invoice_settings: { default_payment_method: 'pm_card' } }
		});
		const updated = await service().changePlan(CUSTOMER, PAID_PRICE.lookup_key, 'gauzy');
		expect(updated.lookupKey).toBe(PAID_PRICE.lookup_key);
		expect(posts().map((p) => p.path)).toEqual(['/subscriptions/sub_g']);
	});

	it("uses the subscription's own default payment method without asking for the customer", async () => {
		stubStripe({
			subscriptions: [sub({ default_payment_method: 'pm_sub' })],
			prices: { [PAID_PRICE.lookup_key]: PAID_PRICE },
			customer: {}
		});
		await service().changePlan(CUSTOMER, PAID_PRICE.lookup_key, 'gauzy');
		expect(calls.some((c) => c.path === `/customers/${CUSTOMER}`)).toBe(false);
		expect(posts()).toHaveLength(1);
	});

	it('a switch to another $0 plan needs no card', async () => {
		stubStripe({ subscriptions: [sub()], prices: { [FREE_PRICE.lookup_key]: FREE_PRICE }, customer: {} });
		await service().changePlan(CUSTOMER, FREE_PRICE.lookup_key, 'gauzy');
		expect(calls.some((c) => c.path === `/customers/${CUSTOMER}`)).toBe(false);
		expect(posts()).toHaveLength(1);
	});

	it('a price with no unit_amount (tiered/metered) is treated as paid', async () => {
		const tiered = {
			...PAID_PRICE,
			id: 'price_tiered',
			lookup_key: 'ever_gauzy_cloud_enterprise_annual',
			unit_amount: null
		};
		stubStripe({ subscriptions: [sub()], prices: { [tiered.lookup_key]: tiered }, customer: {} });
		await expect(service().changePlan(CUSTOMER, tiered.lookup_key, 'gauzy')).rejects.toBeInstanceOf(
			PaymentMethodRequiredError
		);
		expect(posts()).toEqual([]);
	});
});
