// cspell:ignore payg gauzyx flase
import { Logger } from '@nestjs/common';
import { EntitlementResult, StripeSubscriptionService } from './stripe-subscription.service';
import {
	checkoutSessionIsForProduct,
	isCheckoutSessionId,
	resolveBillingProduct,
	resolveSignupPaywall,
	subscriptionIsForProduct
} from './billing-product';

/**
 * The paywall, the lazy tenant link and the proven-identity (Checkout Session) link all read a Stripe
 * account shared by every Ever product. These tests pin that each of them counts ONLY this
 * deployment's product (`BILLING_PRODUCT`), and that a Checkout Session is accepted as proof of
 * purchase only when every rule holds. Stripe is a fixture router over `fetch`; no network.
 */

const EMAIL = 'Buyer@Example.test';
const SESSION_LIVE = 'cs_live_a1FixtureSessionForBillingScopeTests000000000000000000000';
const SESSION_TEST = 'cs_test_a1FixtureSessionForBillingScopeTests000000000000000000000';

type Route = (path: string) => { status?: number; body: any } | undefined;

let fetchCalls: string[] = [];
function stubStripe(route: Route) {
	fetchCalls = [];
	(global as any).fetch = jest.fn(async (input: string) => {
		const path = String(input).replace('https://api.stripe.com/v1', '');
		fetchCalls.push(path);
		const answer = route(path);
		if (!answer) throw new Error(`Unexpected Stripe request in test: ${path}`);
		const status = answer.status ?? 200;
		return {
			ok: status >= 200 && status < 300,
			status,
			json: async () => answer.body,
			text: async () => JSON.stringify(answer.body)
		};
	});
}

function gauzySub(overrides: Record<string, any> = {}) {
	return {
		id: 'sub_1',
		status: 'trialing',
		metadata: { ever_product: 'gauzy' },
		items: { data: [{ price: { lookup_key: 'ever_gauzy_cloud_starter_annual' } }] },
		...overrides
	};
}

function teamsSub(overrides: Record<string, any> = {}) {
	return {
		id: 'sub_t',
		status: 'active',
		metadata: { ever_product: 'teams' },
		items: { data: [{ price: { lookup_key: 'ever_teams_cloud_starter_monthly' } }] },
		...overrides
	};
}

function completeSession(overrides: Record<string, any> = {}) {
	return {
		id: SESSION_TEST,
		status: 'complete',
		mode: 'subscription',
		created: Math.floor(Date.now() / 1000) - 120,
		customer: 'cus_1',
		customer_email: null,
		customer_details: { email: EMAIL },
		metadata: { ever_product: 'gauzy' },
		subscription: gauzySub(),
		...overrides
	};
}

/** Customers + subscriptions router for the email-based lookup. */
function customersRoute(customers: Record<string, any[]>): Route {
	return (path) => {
		if (path.startsWith('/customers?email=')) {
			return { body: { data: Object.keys(customers).map((id) => ({ id })), has_more: false } };
		}
		const m = /^\/subscriptions\?customer=([^&]+)&status=all/.exec(path);
		if (m) return { body: { data: customers[decodeURIComponent(m[1])] ?? [], has_more: false } };
		return undefined;
	};
}

const ENV_KEYS = ['STRIPE_SECRET_KEY', 'STRIPE_LIVE_MODE', 'DEMO', 'BILLING_PRODUCT', 'BILLING_SIGNUP_PAYWALL'];
const saved: Record<string, string | undefined> = {};
const realFetch = (global as any).fetch;

beforeEach(() => {
	for (const key of ENV_KEYS) saved[key] = process.env[key];
	process.env.STRIPE_SECRET_KEY = 'sk_test_billing_scope_fixture';
	delete process.env.STRIPE_LIVE_MODE;
	delete process.env.DEMO;
	delete process.env.BILLING_PRODUCT;
	delete process.env.BILLING_SIGNUP_PAYWALL;
	jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
	jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
});

afterEach(() => {
	for (const key of ENV_KEYS) {
		if (saved[key] === undefined) delete process.env[key];
		else process.env[key] = saved[key];
	}
	(global as any).fetch = realFetch;
	jest.restoreAllMocks();
});

describe('billing-product predicates', () => {
	it('BILLING_PRODUCT defaults to gauzy, is normalised, and an unusable value is reported, not replaced', () => {
		expect(resolveBillingProduct(undefined)).toEqual({ product: 'gauzy' });
		expect(resolveBillingProduct('  Teams ')).toEqual({ product: 'teams' });
		expect(resolveBillingProduct('ever teams!')).toEqual({ product: null, invalid: 'ever teams!' });
	});

	it('BILLING_SIGNUP_PAYWALL defaults to on; only an explicit off value turns it off', () => {
		expect(resolveSignupPaywall(undefined)).toBe(true);
		expect(resolveSignupPaywall('')).toBe(true);
		expect(resolveSignupPaywall('true')).toBe(true);
		expect(resolveSignupPaywall('flase')).toBe(true); // a typo keeps the stricter behaviour
		for (const off of ['false', 'FALSE', '0', 'no', 'off']) expect(resolveSignupPaywall(off)).toBe(false);
	});

	it('a subscription belongs to a product by metadata, or by its first price lookup key', () => {
		expect(subscriptionIsForProduct(gauzySub(), 'gauzy')).toBe(true);
		expect(subscriptionIsForProduct(gauzySub({ metadata: {} }), 'gauzy')).toBe(true);
		expect(subscriptionIsForProduct(teamsSub(), 'gauzy')).toBe(false);
		expect(subscriptionIsForProduct(teamsSub({ metadata: {} }), 'gauzy')).toBe(false);
		expect(subscriptionIsForProduct({ metadata: { kind: 'payg-subscription' } }, 'gauzy')).toBe(false);
		// `ever_gauzyx_` is not `ever_gauzy_`.
		expect(
			subscriptionIsForProduct({ items: { data: [{ price: { lookup_key: 'ever_gauzyx_cloud' } }] } }, 'gauzy')
		).toBe(false);
		expect(subscriptionIsForProduct(gauzySub(), null)).toBe(false);
	});

	it('a checkout session needs BOTH ever_product and subscription mode', () => {
		expect(
			checkoutSessionIsForProduct({ mode: 'subscription', metadata: { ever_product: 'gauzy' } }, 'gauzy')
		).toBe(true);
		expect(checkoutSessionIsForProduct({ mode: 'payment', metadata: { ever_product: 'gauzy' } }, 'gauzy')).toBe(
			false
		);
		expect(checkoutSessionIsForProduct({ mode: 'setup', metadata: { ever_product: 'gauzy' } }, 'gauzy')).toBe(
			false
		);
		expect(
			checkoutSessionIsForProduct({ mode: 'subscription', metadata: { ever_product: 'teams' } }, 'gauzy')
		).toBe(false);
		expect(checkoutSessionIsForProduct({ mode: 'subscription', metadata: { kind: 'plan' } }, 'gauzy')).toBe(false);
	});

	it('recognizes Checkout Session ids and nothing else', () => {
		expect(isCheckoutSessionId(SESSION_LIVE)).toBe(true);
		expect(isCheckoutSessionId(SESSION_TEST)).toBe(true);
		for (const bad of [
			'',
			'cs_live_',
			'cs_live_short',
			'sub_123456789012',
			'cs_live_abc/../../customers',
			'cs_prod_abcdefghijkl',
			42,
			null
		]) {
			expect(isCheckoutSessionId(bad)).toBe(false);
		}
	});
});

describe('StripeSubscriptionService — entitlement counts only this product', () => {
	it('a Teams subscriber is NOT entitled to Gauzy signup (the paywall no longer accepts any product)', async () => {
		stubStripe(customersRoute({ cus_t: [teamsSub()] }));
		const service = new StripeSubscriptionService();
		await expect(service.getEntitlement(EMAIL)).resolves.toBe(EntitlementResult.NOT_ENTITLED);
		await expect(service.findCustomerIdForEmail(EMAIL)).resolves.toBeNull();
	});

	it('a Gauzy subscriber is entitled, and the lazy link finds their Gauzy customer, not their Teams one', async () => {
		stubStripe(customersRoute({ cus_t: [teamsSub()], cus_g: [gauzySub()] }));
		const service = new StripeSubscriptionService();
		await expect(service.getEntitlement(EMAIL)).resolves.toBe(EntitlementResult.ENTITLED);
		await expect(service.findCustomerIdForEmail(EMAIL)).resolves.toBe('cus_g');
	});

	it('a Dashboard-made Gauzy subscription (no metadata, ever_gauzy_ price) counts', async () => {
		stubStripe(customersRoute({ cus_g: [gauzySub({ metadata: {} })] }));
		await expect(new StripeSubscriptionService().getEntitlement(EMAIL)).resolves.toBe(EntitlementResult.ENTITLED);
	});

	it('a cancelled Gauzy subscription does not count', async () => {
		stubStripe(customersRoute({ cus_g: [gauzySub({ status: 'canceled' })] }));
		await expect(new StripeSubscriptionService().getEntitlement(EMAIL)).resolves.toBe(
			EntitlementResult.NOT_ENTITLED
		);
	});

	it('on the Teams deployment the same lookup counts only Teams', async () => {
		process.env.BILLING_PRODUCT = 'teams';
		stubStripe(customersRoute({ cus_t: [teamsSub()], cus_g: [gauzySub()] }));
		await expect(new StripeSubscriptionService().findCustomerIdForEmail(EMAIL)).resolves.toBe('cus_t');
	});

	it('customerHasEntitlingSubscription throws when Stripe fails, so the webhook cannot read it as "no"', async () => {
		stubStripe((path) => (path.startsWith('/subscriptions') ? { status: 500, body: { error: {} } } : undefined));
		await expect(new StripeSubscriptionService().customerHasEntitlingSubscription('cus_1', 1000)).rejects.toThrow();
	});
});

describe('StripeSubscriptionService — switches', () => {
	it('an unusable BILLING_PRODUCT disables billing entirely', () => {
		process.env.BILLING_PRODUCT = 'gauzy teams';
		const service = new StripeSubscriptionService();
		expect(service.isBillingEnforced()).toBe(false);
		expect(service.isSignupPaywallEnabled()).toBe(false);
		expect(service.billingProduct).toBeNull();
	});

	it('BILLING_SIGNUP_PAYWALL=false keeps billing on but turns the paywall off', () => {
		process.env.BILLING_SIGNUP_PAYWALL = 'false';
		const service = new StripeSubscriptionService();
		expect(service.isBillingEnforced()).toBe(true);
		expect(service.isSignupPaywallEnabled()).toBe(false);
	});

	it('the paywall is on by default when billing is on, and off when billing is off', () => {
		expect(new StripeSubscriptionService().isSignupPaywallEnabled()).toBe(true);
		delete process.env.STRIPE_SECRET_KEY;
		expect(new StripeSubscriptionService().isSignupPaywallEnabled()).toBe(false);
	});
});

describe('StripeSubscriptionService.verifyCheckoutSession — proven identity', () => {
	const sessionRoute =
		(session: any, status = 200): Route =>
		(path) =>
			path.startsWith('/checkout/sessions/') ? { status, body: session } : undefined;

	it('accepts a complete Gauzy subscription session paid under the same address (any case)', async () => {
		stubStripe(sessionRoute(completeSession()));
		const result = await new StripeSubscriptionService().verifyCheckoutSession(SESSION_TEST, 'buyer@example.TEST');
		expect(result).toEqual({ ok: true, customerId: 'cus_1' });
		expect(fetchCalls).toEqual([`/checkout/sessions/${SESSION_TEST}?expand[]=subscription`]);
	});

	it.each<[string, Record<string, any>, string]>([
		['not complete', { status: 'open' }, 'incomplete'],
		['expired session object', { status: 'expired' }, 'incomplete'],
		['payment mode (a license, a credit pack)', { mode: 'payment' }, 'foreign-product'],
		['setup mode', { mode: 'setup' }, 'foreign-product'],
		['another product', { metadata: { ever_product: 'teams' } }, 'foreign-product'],
		['no ever_product (Ever Works, GitHands)', { metadata: { kind: 'plan' } }, 'foreign-product'],
		['paid under another address', { customer_details: { email: 'someone.else@example.test' } }, 'email-mismatch'],
		['no address on the session', { customer_details: null, customer_email: null }, 'email-mismatch'],
		['older than 14 days', { created: Math.floor(Date.now() / 1000) - 15 * 86400 }, 'expired'],
		['no customer', { customer: null }, 'no-customer'],
		['its subscription was cancelled', { subscription: gauzySub({ status: 'canceled' }) }, 'not-entitled'],
		['its subscription moved to another product', { subscription: teamsSub() }, 'not-entitled']
	])('declines a session that is %s', async (_label, overrides, reason) => {
		stubStripe(sessionRoute(completeSession(overrides)));
		const result = await new StripeSubscriptionService().verifyCheckoutSession(SESSION_TEST, EMAIL);
		expect(result).toEqual({ ok: false, reason });
	});

	it('declines without calling Stripe when the id is malformed', async () => {
		stubStripe(() => undefined);
		const result = await new StripeSubscriptionService().verifyCheckoutSession('cs_test_../../customers', EMAIL);
		expect(result).toEqual({ ok: false, reason: 'malformed' });
		expect(fetchCalls).toEqual([]);
	});

	it('declines without calling Stripe when a live session id meets a test key (and vice versa)', async () => {
		stubStripe(() => undefined);
		await expect(new StripeSubscriptionService().verifyCheckoutSession(SESSION_LIVE, EMAIL)).resolves.toEqual({
			ok: false,
			reason: 'mode-mismatch'
		});
		process.env.STRIPE_SECRET_KEY = 'sk_live_billing_scope_fixture';
		process.env.STRIPE_LIVE_MODE = 'true';
		await expect(new StripeSubscriptionService().verifyCheckoutSession(SESSION_TEST, EMAIL)).resolves.toEqual({
			ok: false,
			reason: 'mode-mismatch'
		});
		expect(fetchCalls).toEqual([]);
	});

	it('reports a missing session as not-found and a Stripe outage as stripe-unavailable', async () => {
		stubStripe(sessionRoute({ error: { message: 'No such checkout.session' } }, 404));
		await expect(new StripeSubscriptionService().verifyCheckoutSession(SESSION_TEST, EMAIL)).resolves.toEqual({
			ok: false,
			reason: 'not-found'
		});
		stubStripe(sessionRoute({ error: {} }, 503));
		await expect(new StripeSubscriptionService().verifyCheckoutSession(SESSION_TEST, EMAIL)).resolves.toEqual({
			ok: false,
			reason: 'stripe-unavailable'
		});
	});

	it('on the Teams deployment a Gauzy session is foreign', async () => {
		process.env.BILLING_PRODUCT = 'teams';
		stubStripe(sessionRoute(completeSession()));
		await expect(new StripeSubscriptionService().verifyCheckoutSession(SESSION_TEST, EMAIL)).resolves.toEqual({
			ok: false,
			reason: 'foreign-product'
		});
	});

	it('does nothing at all when billing is off', async () => {
		delete process.env.STRIPE_SECRET_KEY;
		stubStripe(() => undefined);
		await expect(new StripeSubscriptionService().verifyCheckoutSession(SESSION_TEST, EMAIL)).resolves.toEqual({
			ok: false,
			reason: 'billing-disabled'
		});
		expect(fetchCalls).toEqual([]);
	});
});
