// cspell:ignore selfhosted
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

/** A Gauzy SELF-HOSTED license ($1,668/yr) — same product key, not the hosted plan. */
function selfHosted(overrides: Record<string, any> = {}) {
	return sub({
		id: 'sub_s',
		status: 'active',
		created: 1_900_000_000, // the newest on purpose
		metadata: { ever_product: 'gauzy', ever_hosting: 'selfhosted' },
		items: {
			data: [
				{
					id: 'si_s',
					price: {
						id: 'price_s',
						lookup_key: 'ever_gauzy_selfhosted_enterprise_annual',
						unit_amount: 166800,
						currency: 'usd',
						recurring: { interval: 'year' }
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
	invoices?: any[];
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
		} else if (method === 'GET' && path.startsWith('/invoices?subscription=')) {
			// Stripe filters by subscription server-side; so does this stub.
			const id = decodeURIComponent(/subscription=([^&]+)/.exec(path)[1]);
			const limit = Number(/limit=(\d+)/.exec(path)?.[1] ?? 10);
			const own = (state.invoices ?? []).filter((invoice) => invoice.subscription === id);
			body = { data: own.slice(0, limit), has_more: own.length > limit };
		} else if (method === 'GET' && path === `/customers/${CUSTOMER}`) {
			body = { id: CUSTOMER, ...state.customer };
		} else if (method === 'POST' && path.startsWith('/subscriptions/')) {
			const params = new URLSearchParams(init.body);
			const current = state.subscriptions.find((s) => path === `/subscriptions/${s.id}`);
			// Apply every `items[i][id]` / `items[i][price]` pair to the item with that id, like Stripe.
			const changes = new Map<string, string>();
			for (let i = 0; params.has(`items[${i}][id]`); i++) {
				changes.set(params.get(`items[${i}][id]`), params.get(`items[${i}][price]`));
			}
			body = {
				...current,
				items: {
					data: current.items.data.map((item: any) => ({
						...item,
						price: changes.has(item.id)
							? (Object.values(state.prices).find((p: any) => p.id === changes.get(item.id)) ??
								item.price)
							: item.price
					}))
				}
			};
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

	it('a Gauzy SELF-HOSTED license is never shown, canceled or counted as the cloud plan', async () => {
		stubStripe({ subscriptions: [selfHosted(), sub()], prices: {}, customer: {} });
		await expect(service().getSubscription(CUSTOMER)).resolves.toMatchObject({ id: 'sub_g' });

		stubStripe({ subscriptions: [selfHosted()], prices: {}, customer: {} });
		await expect(service().getSubscription(CUSTOMER)).resolves.toBeNull();
		await expect(service().cancelSubscription(CUSTOMER)).rejects.toBeInstanceOf(NotFoundException);
		expect(posts()).toEqual([]);
		await expect(service().isCustomerOfProduct(CUSTOMER)).resolves.toBe(false);
	});

	it('isCustomerOfProduct caches only a positive answer', async () => {
		const billing = service();
		stubStripe({ subscriptions: [teams()], prices: {}, customer: {} });
		await expect(billing.isCustomerOfProduct(CUSTOMER)).resolves.toBe(false);
		await expect(billing.isCustomerOfProduct(CUSTOMER)).resolves.toBe(false);
		expect(calls).toHaveLength(2); // a "no" is re-checked every time

		stubStripe({ subscriptions: [sub()], prices: {}, customer: {} });
		await expect(billing.isCustomerOfProduct(CUSTOMER)).resolves.toBe(true);
		await expect(billing.isCustomerOfProduct(CUSTOMER)).resolves.toBe(true);
		expect(calls).toHaveLength(1); // the second "yes" came from the cache
	});

	it("invoices: only this product's subscriptions, merged newest first — never another product's or one-offs", async () => {
		const invoice = (id: string, subscription: string | null, created: number) => ({
			id,
			number: id.toUpperCase(),
			status: 'paid',
			amount_paid: 100,
			amount_due: 100,
			currency: 'usd',
			created,
			subscription
		});
		// 150 NEWER foreign invoices: a per-customer listing would fill a whole Stripe page with them and
		// never reach the Gauzy ones. Listing per subscription cannot be crowded out.
		const foreign = Array.from({ length: 150 }, (_, i) => invoice(`in_teams_${i}`, 'sub_t', 1_900_000_000 + i));
		stubStripe({
			subscriptions: [teams(), sub(), sub({ id: 'sub_g_old', status: 'canceled', created: 1_600_000_000 })],
			prices: {},
			customer: {},
			invoices: [
				...foreign,
				invoice('in_license', null, 1_950_000_000),
				invoice('in_gauzy_old', 'sub_g_old', 1_600_000_100),
				invoice('in_gauzy', 'sub_g', 1_700_000_100),
				invoice('in_gauzy_renewal', 'sub_g', 1_731_536_100)
			]
		});
		const invoices = await service().listInvoices(CUSTOMER);
		expect(invoices.map((i) => i.id)).toEqual(['in_gauzy_renewal', 'in_gauzy', 'in_gauzy_old']);
		// Asked per Gauzy subscription only — the Teams subscription's invoices are never requested.
		const invoiceCalls = calls.filter((c) => c.path.startsWith('/invoices')).map((c) => c.path);
		expect(invoiceCalls.sort()).toEqual([
			'/invoices?subscription=sub_g&limit=24',
			'/invoices?subscription=sub_g_old&limit=24'
		]);
	});

	it('invoices: the page limit applies after merging', async () => {
		stubStripe({
			subscriptions: [sub(), sub({ id: 'sub_g_old', status: 'canceled', created: 1_600_000_000 })],
			prices: {},
			customer: {},
			invoices: [
				{ id: 'in_a', subscription: 'sub_g', created: 3, currency: 'usd' },
				{ id: 'in_b', subscription: 'sub_g_old', created: 2, currency: 'usd' },
				{ id: 'in_c', subscription: 'sub_g', created: 1, currency: 'usd' }
			]
		});
		const invoices = await service().listInvoices(CUSTOMER, 2);
		expect(invoices.map((i) => i.id)).toEqual(['in_a', 'in_b']);
		// Each subscription is asked for no more than the page needs.
		expect(calls.filter((c) => c.path.startsWith('/invoices')).every((c) => c.path.endsWith('&limit=2'))).toBe(
			true
		);
	});

	it('invoices: a customer with no subscription to this product gets none, and Stripe is not asked for them', async () => {
		stubStripe({
			subscriptions: [teams()],
			prices: {},
			customer: {},
			invoices: [{ id: 'in_teams', subscription: 'sub_t' }]
		});
		await expect(service().listInvoices(CUSTOMER)).resolves.toEqual([]);
		expect(calls.some((c) => c.path.startsWith('/invoices'))).toBe(false);
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

	it('never re-prices a self-hosted license: alone it is "no subscription", beside the cloud plan it is skipped', async () => {
		stubStripe({ subscriptions: [selfHosted()], prices: { [FREE_PRICE.lookup_key]: FREE_PRICE }, customer: {} });
		await expect(service().changePlan(CUSTOMER, FREE_PRICE.lookup_key, 'gauzy')).rejects.toBeInstanceOf(
			NotFoundException
		);
		expect(posts()).toEqual([]);

		stubStripe({
			subscriptions: [selfHosted(), sub()],
			prices: { [FREE_PRICE.lookup_key]: FREE_PRICE },
			customer: {}
		});
		await service().changePlan(CUSTOMER, FREE_PRICE.lookup_key, 'gauzy');
		expect(posts().map((p) => p.path)).toEqual(['/subscriptions/sub_g']);
	});

	it('refuses a self-hosted target price without calling Stripe', async () => {
		stubStripe({ subscriptions: [sub()], prices: {}, customer: {} });
		await expect(
			service().changePlan(CUSTOMER, 'ever_gauzy_selfhosted_enterprise_annual', 'gauzy')
		).rejects.toBeInstanceOf(BadRequestException);
		expect(calls).toEqual([]);
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

describe('BillingService.changePlan — the plan item, not the per-employee add-on', () => {
	const SB_MONTHLY = {
		id: 'price_sb_m',
		lookup_key: 'ever_gauzy_cloud_small_business_monthly',
		unit_amount: 4900,
		currency: 'usd',
		recurring: { interval: 'month' }
	};
	const ENT_MONTHLY = {
		id: 'price_ent_m',
		lookup_key: 'ever_gauzy_cloud_enterprise_monthly',
		unit_amount: 49900,
		currency: 'usd',
		recurring: { interval: 'month' }
	};
	const SEAT_SB = {
		id: 'price_seat_sb_m',
		lookup_key: 'seat_ever_gauzy_cloud_small_business_monthly',
		unit_amount: 500,
		currency: 'usd',
		recurring: { interval: 'month' }
	};
	const SEAT_ENT = {
		id: 'price_seat_ent_m',
		lookup_key: 'seat_ever_gauzy_cloud_enterprise_monthly',
		unit_amount: 1000,
		currency: 'usd',
		recurring: { interval: 'month' }
	};
	const withSeats = (order: 'plan-first' | 'seat-first') => {
		const plan = { id: 'si_plan', price: SB_MONTHLY };
		const seat = { id: 'si_seat', quantity: 3, price: SEAT_SB };
		return sub({
			status: 'active',
			default_payment_method: 'pm_sub',
			items: { data: order === 'plan-first' ? [plan, seat] : [seat, plan] }
		});
	};
	const body = () => new URLSearchParams(posts()[0].body);

	it('moves the plan and its add-on together: Small Business + seats → Enterprise + Enterprise seats', async () => {
		stubStripe({
			subscriptions: [withSeats('plan-first')],
			prices: { [ENT_MONTHLY.lookup_key]: ENT_MONTHLY, [SEAT_ENT.lookup_key]: SEAT_ENT },
			customer: {}
		});
		const updated = await service().changePlan(CUSTOMER, ENT_MONTHLY.lookup_key, 'gauzy');
		expect(posts()).toHaveLength(1);
		expect(body().get('items[0][id]')).toBe('si_plan');
		expect(body().get('items[0][price]')).toBe(ENT_MONTHLY.id);
		expect(body().get('items[1][id]')).toBe('si_seat');
		expect(body().get('items[1][price]')).toBe(SEAT_ENT.id);
		expect(updated.lookupKey).toBe(ENT_MONTHLY.lookup_key);
		expect(updated.amount).toBe(49900);
	});

	it('finds the plan by its price when the add-on is the first item', async () => {
		stubStripe({
			subscriptions: [withSeats('seat-first')],
			prices: { [ENT_MONTHLY.lookup_key]: ENT_MONTHLY, [SEAT_ENT.lookup_key]: SEAT_ENT },
			customer: {}
		});
		const updated = await service().changePlan(CUSTOMER, ENT_MONTHLY.lookup_key, 'gauzy');
		expect(body().get('items[0][id]')).toBe('si_plan');
		expect(body().get('items[1][id]')).toBe('si_seat');
		expect(updated.lookupKey).toBe(ENT_MONTHLY.lookup_key);
	});

	it('refuses a target with no add-on price of its own while the subscription has extra employees, changing nothing', async () => {
		stubStripe({
			subscriptions: [withSeats('plan-first')],
			prices: { [FREE_PRICE.lookup_key]: FREE_PRICE },
			customer: {}
		});
		await expect(service().changePlan(CUSTOMER, FREE_PRICE.lookup_key, 'gauzy')).rejects.toBeInstanceOf(
			BadRequestException
		);
		expect(posts()).toEqual([]);
	});

	it('a subscription without the add-on changes only the plan item', async () => {
		stubStripe({
			subscriptions: [sub({ default_payment_method: 'pm_sub' })],
			prices: { [ENT_MONTHLY.lookup_key]: ENT_MONTHLY, [SEAT_ENT.lookup_key]: SEAT_ENT },
			customer: {}
		});
		await service().changePlan(CUSTOMER, ENT_MONTHLY.lookup_key, 'gauzy');
		expect(body().get('items[0][id]')).toBe('si_g');
		expect(body().has('items[1][id]')).toBe(false);
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
