import { ForbiddenException, Logger } from '@nestjs/common';
import { StripeSubscriptionService } from '../billing/stripe-subscription.service';
import { paywallCheckoutUrl, SubscriptionRequiredGuard } from './subscription-required.guard';

/**
 * The signup paywall on `POST /auth/register`: only a subscription to THIS deployment's product opens
 * it, a completed Checkout Session for that product is accepted as proof directly, and a deployment
 * can bill without a paywall at all (`BILLING_SIGNUP_PAYWALL=false`, the Ever Teams deployment).
 */

const EMAIL = 'buyer@example.test';
const SESSION = 'cs_test_a1FixtureSessionForBillingScopeTests000000000000000000000';

let paths: string[] = [];
function stubStripe(answer: (path: string) => any) {
	paths = [];
	(global as any).fetch = jest.fn(async (input: string) => {
		const path = String(input).replace('https://api.stripe.com/v1', '');
		paths.push(path);
		const body = answer(path);
		if (body === undefined) throw new Error(`Unexpected Stripe request in test: ${path}`);
		return { ok: true, status: 200, json: async () => body, text: async () => JSON.stringify(body) };
	});
}

const gauzySub = { id: 'sub_g', status: 'trialing', metadata: { ever_product: 'gauzy' } };
const teamsSub = {
	id: 'sub_t',
	status: 'active',
	metadata: { ever_product: 'teams' },
	items: { data: [{ price: { lookup_key: 'ever_teams_cloud_starter_monthly' } }] }
};

/** One customer with the given subscriptions, found by email. */
const byEmail = (subscriptions: any[]) => (path: string) => {
	if (path.startsWith('/customers?email=')) return { data: [{ id: 'cus_1' }], has_more: false };
	if (path.startsWith('/subscriptions?customer=cus_1')) return { data: subscriptions, has_more: false };
	return undefined;
};

function context(body: any, user?: any) {
	return { switchToHttp: () => ({ getRequest: () => ({ body, user }) }) } as any;
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
	jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
	jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
});

afterEach(() => {
	for (const key of ENV_KEYS) {
		if (saved[key] === undefined) delete process.env[key];
		else process.env[key] = saved[key];
	}
	(global as any).fetch = realFetch;
	jest.restoreAllMocks();
});

const guard = () => new SubscriptionRequiredGuard(new StripeSubscriptionService());

describe('SubscriptionRequiredGuard', () => {
	it('lets a Gauzy subscriber register', async () => {
		stubStripe(byEmail([gauzySub]));
		await expect(guard().canActivate(context({ user: { email: EMAIL } }))).resolves.toBe(true);
	});

	it('no longer lets a Teams (or any other product) subscriber through the Gauzy paywall', async () => {
		stubStripe(byEmail([teamsSub]));
		await expect(guard().canActivate(context({ user: { email: EMAIL } }))).rejects.toBeInstanceOf(
			ForbiddenException
		);
	});

	it('the checkout link names a plan the shared checkout can resolve (a bare ?email= was a 400)', async () => {
		stubStripe(byEmail([teamsSub]));
		const err = await guard()
			.canActivate(context({ user: { email: ' Buyer@Example.test ' } }))
			.catch((e) => e);
		expect(err).toBeInstanceOf(ForbiddenException);
		const url = new URL((err as ForbiddenException).getResponse()['checkoutUrl']);
		expect(url.origin + url.pathname).toBe('https://ever.co/checkout');
		expect(Object.fromEntries(url.searchParams)).toEqual({
			product: 'gauzy',
			hosting: 'cloud',
			tier: 'starter',
			period: 'annual',
			email: 'Buyer@Example.test'
		});
	});

	it('the checkout link follows BILLING_PRODUCT', () => {
		process.env.BILLING_PRODUCT = 'teams';
		expect(new URL(paywallCheckoutUrl('a@b.test')).searchParams.get('product')).toBe('teams');
	});

	it('BILLING_SIGNUP_PAYWALL=false: signup is open and Stripe is never asked', async () => {
		process.env.BILLING_SIGNUP_PAYWALL = 'false';
		stubStripe(() => undefined);
		await expect(guard().canActivate(context({ user: { email: EMAIL } }))).resolves.toBe(true);
		expect(paths).toEqual([]);
	});

	it("accepts the buyer's own completed Checkout Session as proof, without an email lookup", async () => {
		stubStripe((path) =>
			path.startsWith('/checkout/sessions/')
				? {
						id: SESSION,
						status: 'complete',
						mode: 'subscription',
						created: Math.floor(Date.now() / 1000),
						customer: 'cus_1',
						customer_details: { email: EMAIL.toUpperCase() },
						metadata: { ever_product: 'gauzy' },
						subscription: gauzySub
					}
				: undefined
		);
		await expect(
			guard().canActivate(context({ user: { email: EMAIL }, stripeCheckoutSessionId: SESSION }))
		).resolves.toBe(true);
		expect(paths).toEqual([`/checkout/sessions/${SESSION}?expand[]=subscription`]);
	});

	it('a session paid under another address proves nothing: falls back to the email lookup', async () => {
		stubStripe((path) => {
			if (path.startsWith('/checkout/sessions/')) {
				return {
					status: 'complete',
					mode: 'subscription',
					created: Math.floor(Date.now() / 1000),
					customer: 'cus_victim',
					customer_details: { email: 'victim@example.test' },
					metadata: { ever_product: 'gauzy' },
					subscription: gauzySub
				};
			}
			return byEmail([])(path);
		});
		await expect(
			guard().canActivate(context({ user: { email: EMAIL }, stripeCheckoutSessionId: SESSION }))
		).rejects.toBeInstanceOf(ForbiddenException);
		expect(paths.some((p) => p.startsWith('/customers?email='))).toBe(true);
	});

	it('a malformed session id is ignored rather than sent to Stripe', async () => {
		stubStripe(byEmail([gauzySub]));
		await expect(
			guard().canActivate(context({ user: { email: EMAIL }, stripeCheckoutSessionId: 'cs_test_../../x' }))
		).resolves.toBe(true);
		expect(paths.some((p) => p.startsWith('/checkout/sessions/'))).toBe(false);
	});

	it('an authenticated admin creating a user is never asked for a subscription', async () => {
		stubStripe(() => undefined);
		await expect(guard().canActivate(context({ user: { email: EMAIL } }, { id: 'admin' }))).resolves.toBe(true);
		expect(paths).toEqual([]);
	});
});
