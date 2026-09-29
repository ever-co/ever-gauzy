// cspell:ignore whsec payg selfhosted
/**
 * 🛑 This import must stay FIRST, before any import that pulls a repository — the entity graph has to
 * finish initializing before the TypeORM repositories the controller imports are evaluated.
 */
import '../../core/entities/internal';
import { ForbiddenException, Logger } from '@nestjs/common';
import { createHmac } from 'crypto';
import { IsNull } from 'typeorm';
import { StripeWebhookController } from './stripe-webhook.controller';
import { StripeSubscriptionService } from './stripe-subscription.service';

/**
 * The Stripe webhook is registered on an account that EVERY Ever product sells through, so most of
 * what reaches it is somebody else's purchase. These tests drive the real controller with payloads
 * signed by Stripe's real scheme (`t=<unix>,v1=HMAC-SHA256("<t>." + body)`) and assert what it
 * decided, what it logged, and — the part that matters — that nothing except an administrator's
 * purchase of this deployment's product ever writes `tenant.stripeCustomerId`.
 *
 * No database and no network: the repositories are in-memory doubles that record every call, and
 * `fetch` (the only way the service reaches Stripe) is replaced by a router over fixture objects that
 * fails the test on any request it was not told about.
 */

const WEBHOOK_SECRET = 'whsec_test_billing_scope_fixture_secret';
const TENANT_ID = '11111111-1111-4111-8111-111111111111';
const OTHER_TENANT_ID = '22222222-2222-4222-8222-222222222222';
const USER_ID = '33333333-3333-4333-8333-333333333333';
const BUYER_EMAIL = 'Owner@Acme.test';

/* ------------------------------------------------------------------ fixtures */

function session(overrides: Record<string, any> = {}): Record<string, any> {
	return {
		id: 'cs_live_a1FixtureSessionForBillingScopeTests000000000000000000000',
		object: 'checkout.session',
		mode: 'subscription',
		status: 'complete',
		customer: 'cus_Buyer0000000001',
		customer_email: null,
		customer_details: { email: BUYER_EMAIL },
		subscription: 'sub_Buyer0000000001',
		client_reference_id: null,
		metadata: {
			ever_product: 'gauzy',
			ever_hosting: 'cloud',
			ever_tier: 'starter',
			ever_interval: 'annual',
			ever_lookup_key: 'ever_gauzy_cloud_starter_annual'
		},
		...overrides
	};
}

function subscription(overrides: Record<string, any> = {}): Record<string, any> {
	return {
		id: 'sub_Buyer0000000001',
		object: 'subscription',
		customer: 'cus_Buyer0000000001',
		status: 'trialing',
		metadata: { ever_product: 'gauzy' },
		items: { data: [{ id: 'si_1', price: { id: 'price_1', lookup_key: 'ever_gauzy_cloud_starter_annual' } }] },
		...overrides
	};
}

function event(type: string, object: Record<string, any>, id = 'evt_fixture_0000000001'): Record<string, any> {
	return { id, object: 'event', type, api_version: '2020-08-27', data: { object } };
}

/** Sign exactly as Stripe does. */
function signed(
	body: Record<string, any> | string,
	secret = WEBHOOK_SECRET,
	timestamp = Math.floor(Date.now() / 1000)
) {
	const raw = typeof body === 'string' ? body : JSON.stringify(body);
	const v1 = createHmac('sha256', secret).update(`${timestamp}.${raw}`).digest('hex');
	return { headers: { 'stripe-signature': `t=${timestamp},v1=${v1}` }, rawBody: Buffer.from(raw, 'utf8') };
}

/* ------------------------------------------------------------------ doubles */

interface Harness {
	controller: StripeWebhookController;
	users: any[];
	claimedBy: { id: string } | null;
	updateAffected: number;
	userQueries: Array<Record<string, any>>;
	tenantFindOne: jest.Mock;
	tenantUpdate: jest.Mock;
	createQueryBuilder: jest.Mock;
	stripe: {
		customers: Record<string, { email: string | null }>;
		subscriptions: Record<string, any[]>;
		failSubscriptions?: boolean;
	};
	fetchCalls: string[];
	logLines: string[];
	decisions: () => Array<Record<string, any>>;
}

function buildHarness(): Harness {
	const h = {
		users: [] as any[],
		claimedBy: null as { id: string } | null,
		updateAffected: 1,
		userQueries: [] as Array<Record<string, any>>,
		stripe: {
			customers: {} as Record<string, { email: string | null }>,
			subscriptions: {} as Record<string, any[]>,
			failSubscriptions: false
		},
		fetchCalls: [] as string[],
		logLines: [] as string[]
	} as Partial<Harness> as Harness;

	const queryBuilder: any = {};
	for (const method of ['leftJoin', 'select', 'andWhere', 'limit']) {
		queryBuilder[method] = jest.fn(() => queryBuilder);
	}
	queryBuilder.where = jest.fn((_sql: string, params: Record<string, any>) => {
		h.userQueries.push(params);
		return queryBuilder;
	});
	queryBuilder.getMany = jest.fn(async () => h.users);

	h.createQueryBuilder = jest.fn(() => queryBuilder);
	h.tenantFindOne = jest.fn(async () => h.claimedBy);
	h.tenantUpdate = jest.fn(async () => ({ affected: h.updateAffected }));

	const userRepository: any = { createQueryBuilder: h.createQueryBuilder };
	const tenantRepository: any = { findOne: h.tenantFindOne, update: h.tenantUpdate };

	h.controller = new StripeWebhookController(new StripeSubscriptionService(), tenantRepository, userRepository);

	(global as any).fetch = jest.fn(async (input: string) => {
		const url = String(input);
		h.fetchCalls.push(url);
		const path = url.replace('https://api.stripe.com/v1', '');

		const customer = /^\/customers\/([^/?]+)$/.exec(path);
		if (customer) {
			const found = h.stripe.customers[decodeURIComponent(customer[1])];
			return jsonResponse(
				found ? { id: customer[1], ...found } : { error: { message: 'No such customer' } },
				found ? 200 : 404
			);
		}

		const subs = /^\/subscriptions\?customer=([^&]+)&status=all/.exec(path);
		if (subs) {
			if (h.stripe.failSubscriptions) return jsonResponse({ error: { message: 'boom' } }, 500);
			return jsonResponse({ data: h.stripe.subscriptions[decodeURIComponent(subs[1])] ?? [], has_more: false });
		}

		throw new Error(`Unexpected Stripe request in test: ${path}`);
	});

	jest.spyOn(Logger.prototype, 'log').mockImplementation(function (message: any) {
		h.logLines.push(String(message));
	});
	jest.spyOn(Logger.prototype, 'warn').mockImplementation(function (message: any) {
		h.logLines.push(String(message));
	});
	jest.spyOn(Logger.prototype, 'error').mockImplementation(function (message: any) {
		h.logLines.push(String(message));
	});

	h.decisions = () =>
		h.logLines
			.filter((line) => line.startsWith('stripe-webhook '))
			.map((line) => JSON.parse(line.slice('stripe-webhook '.length)));

	return h;
}

function jsonResponse(body: any, status = 200) {
	return {
		ok: status >= 200 && status < 300,
		status,
		json: async () => body,
		text: async () => JSON.stringify(body)
	};
}

function admin(overrides: Record<string, any> = {}) {
	return {
		id: USER_ID,
		tenantId: TENANT_ID,
		emailVerifiedAt: new Date('2026-09-01T00:00:00Z'),
		role: { id: 'role-1', name: 'SUPER_ADMIN' },
		...overrides
	};
}

/* ------------------------------------------------------------------ environment */

const ENV_KEYS = [
	'STRIPE_SECRET_KEY',
	'STRIPE_WEBHOOK_SECRET',
	'STRIPE_LIVE_MODE',
	'DEMO',
	'BILLING_PRODUCT',
	'BILLING_SIGNUP_PAYWALL',
	'BILLING_WEBHOOK_LINKING'
];
const savedEnv: Record<string, string | undefined> = {};
const realFetch = (global as any).fetch;

beforeEach(() => {
	for (const key of ENV_KEYS) savedEnv[key] = process.env[key];
	process.env.STRIPE_SECRET_KEY = 'sk_test_billing_scope_fixture';
	process.env.STRIPE_WEBHOOK_SECRET = WEBHOOK_SECRET;
	delete process.env.STRIPE_LIVE_MODE;
	delete process.env.DEMO;
	delete process.env.BILLING_PRODUCT;
	delete process.env.BILLING_SIGNUP_PAYWALL;
	// Writing is off by default (see the "BILLING_WEBHOOK_LINKING unset" block). Everywhere else it is
	// ON, so every "must not link" case proves it writes nothing even when writing is allowed.
	process.env.BILLING_WEBHOOK_LINKING = 'true';
});

afterEach(() => {
	for (const key of ENV_KEYS) {
		if (savedEnv[key] === undefined) delete process.env[key];
		else process.env[key] = savedEnv[key];
	}
	(global as any).fetch = realFetch;
	jest.restoreAllMocks();
});

/* ------------------------------------------------------------------ tests */

describe('StripeWebhookController — signature', () => {
	it('rejects an unsigned request', async () => {
		const h = buildHarness();
		await expect(h.controller.handle({ headers: {}, rawBody: Buffer.from('{}') } as any)).rejects.toBeInstanceOf(
			ForbiddenException
		);
		expect(h.createQueryBuilder).not.toHaveBeenCalled();
	});

	it('rejects a payload signed with the wrong secret', async () => {
		const h = buildHarness();
		const request = signed(event('checkout.session.completed', session()), 'whsec_someone_else');
		await expect(h.controller.handle(request as any)).rejects.toThrow('Invalid Stripe signature.');
		expect(h.createQueryBuilder).not.toHaveBeenCalled();
		expect(h.tenantUpdate).not.toHaveBeenCalled();
	});

	it('rejects a correctly signed payload older than five minutes (replay)', async () => {
		const h = buildHarness();
		const stale = Math.floor(Date.now() / 1000) - 3600;
		const request = signed(event('checkout.session.completed', session()), WEBHOOK_SECRET, stale);
		await expect(h.controller.handle(request as any)).rejects.toThrow('Invalid Stripe signature.');
	});

	it('rejects a signed body that is JSON null instead of throwing a 500', async () => {
		const h = buildHarness();
		await expect(h.controller.handle(signed('null') as any)).rejects.toBeInstanceOf(ForbiddenException);
	});

	it('refuses everything when billing is not configured', async () => {
		const h = buildHarness();
		delete process.env.STRIPE_SECRET_KEY;
		await expect(
			h.controller.handle(signed(event('checkout.session.completed', session())) as any)
		).rejects.toThrow('Billing webhooks are not enabled on this deployment.');
	});
});

describe('StripeWebhookController — foreign events are acknowledged with no DB or Stripe access', () => {
	const foreign: Array<[string, string, Record<string, any>]> = [
		['ever.co Teams session', 'checkout.session.completed', session({ metadata: { ever_product: 'teams' } })],
		['ever.co Platform session', 'checkout.session.completed', session({ metadata: { ever_product: 'platform' } })],
		['ever.co Works session', 'checkout.session.completed', session({ metadata: { ever_product: 'works' } })],
		['ever.co Rec session', 'checkout.session.completed', session({ metadata: { ever_product: 'rec' } })],
		['ever.co Demand session', 'checkout.session.completed', session({ metadata: { ever_product: 'demand' } })],
		[
			'Ever Works own plan checkout (metadata.kind, no ever_product)',
			'checkout.session.completed',
			session({ customer: 'cus_Works', metadata: { kind: 'plan-subscription', organizationId: 'org-1' } })
		],
		[
			'Ever Works credit pack (payment mode)',
			'checkout.session.completed',
			session({ mode: 'payment', subscription: null, customer: 'cus_Works', metadata: { kind: 'credit-pack' } })
		],
		[
			'Ever Works card save (setup mode)',
			'checkout.session.completed',
			session({ mode: 'setup', subscription: null, customer: 'cus_Works', metadata: { kind: 'setup' } })
		],
		[
			'Ever Works PAYG subscription (metadata.kind only)',
			'customer.subscription.created',
			subscription({
				customer: 'cus_Works',
				status: 'active',
				metadata: { kind: 'payg-subscription' },
				items: { data: [{ id: 'si_w', price: { id: 'price_w', lookup_key: null } }] }
			})
		],
		[
			'ever.co lifetime license (payment mode, customer=null)',
			'checkout.session.completed',
			session({
				mode: 'payment',
				customer: null,
				subscription: null,
				metadata: {
					ever_product: 'gauzy',
					ever_hosting: 'selfhosted',
					ever_tier: 'small_business',
					ever_interval: 'lifetime'
				}
			})
		],
		[
			'Gauzy-branded session in payment mode (a gauzy product, but not a hosted plan)',
			'checkout.session.completed',
			session({ mode: 'payment', metadata: { ever_product: 'gauzy' } })
		],
		[
			'GitHands subscription checkout (client_reference_id, no ever_product)',
			'checkout.session.completed',
			session({ customer: 'cus_GitHands', client_reference_id: USER_ID, metadata: { plan: 'pro' } })
		],
		[
			'directory-site sponsor ad checkout',
			'checkout.session.completed',
			session({ customer: 'cus_Directory', metadata: { type: 'sponsor_ad', itemSlug: 'x' } })
		],
		[
			'Teams subscription with no metadata (Dashboard-made) on an ever_teams_ price',
			'customer.subscription.created',
			subscription({
				metadata: {},
				items: {
					data: [{ id: 'si_t', price: { id: 'price_t', lookup_key: 'ever_teams_cloud_starter_monthly' } }]
				}
			})
		],
		[
			'ever.co Gauzy SELF-HOSTED license session (subscription mode, ever_hosting=selfhosted)',
			'checkout.session.completed',
			session({
				metadata: {
					ever_product: 'gauzy',
					ever_hosting: 'selfhosted',
					ever_tier: 'enterprise',
					ever_interval: 'annual',
					ever_lookup_key: 'ever_gauzy_selfhosted_enterprise_annual'
				}
			})
		],
		[
			'Gauzy self-hosted license subscription (ever_hosting=selfhosted)',
			'customer.subscription.created',
			subscription({
				status: 'active',
				metadata: { ever_product: 'gauzy', ever_hosting: 'selfhosted' },
				items: {
					data: [
						{ id: 'si_s', price: { id: 'price_s', lookup_key: 'ever_gauzy_selfhosted_enterprise_annual' } }
					]
				}
			})
		],
		[
			'Gauzy self-hosted license subscription with no metadata (Dashboard-made) on an ever_gauzy_selfhosted_ price',
			'customer.subscription.created',
			subscription({
				status: 'active',
				metadata: {},
				items: {
					data: [
						{
							id: 'si_s',
							price: { id: 'price_s', lookup_key: 'ever_gauzy_selfhosted_small_business_monthly' }
						}
					]
				}
			})
		],
		[
			'ever_product=gauzy with no ever_hosting but a self-hosted plan price',
			'customer.subscription.created',
			subscription({
				status: 'active',
				metadata: { ever_product: 'gauzy' },
				items: {
					data: [
						{ id: 'si_s', price: { id: 'price_s', lookup_key: 'ever_gauzy_selfhosted_enterprise_monthly' } }
					]
				}
			})
		],
		[
			'subscription with neither metadata nor a lookup key',
			'customer.subscription.created',
			subscription({
				metadata: {},
				items: { data: [{ id: 'si_x', price: { id: 'price_x', lookup_key: null } }] }
			})
		]
	];

	it.each(foreign)('%s', async (_label, type, object) => {
		const h = buildHarness();
		// Even with a perfect admin match waiting, a foreign event must not get as far as looking.
		h.users = [admin()];

		const result = await h.controller.handle(signed(event(type, object)) as any);

		expect(result).toEqual({ received: true });
		expect(h.createQueryBuilder).not.toHaveBeenCalled();
		expect(h.tenantFindOne).not.toHaveBeenCalled();
		expect(h.tenantUpdate).not.toHaveBeenCalled();
		expect(h.fetchCalls).toEqual([]);
		expect(h.decisions()).toEqual([
			expect.objectContaining({ decision: 'skipped-foreign', product: 'gauzy', type })
		]);
	});

	it('logs no email address, only ids', async () => {
		const h = buildHarness();
		await h.controller.handle(
			signed(event('checkout.session.completed', session({ metadata: { ever_product: 'teams' } }))) as any
		);
		expect(h.logLines.join('\n')).not.toMatch(/@/);
		expect(h.decisions()[0]).toMatchObject({ event: 'evt_fixture_0000000001', eventProduct: 'teams' });
	});

	it('ignores non-linking events without logging or touching anything', async () => {
		const h = buildHarness();
		await h.controller.handle(signed(event('customer.subscription.updated', subscription())) as any);
		expect(h.decisions()).toEqual([]);
		expect(h.createQueryBuilder).not.toHaveBeenCalled();
		expect(h.fetchCalls).toEqual([]);
	});
});

describe('StripeWebhookController — Gauzy events that must NOT link', () => {
	const gauzyEvent = () => signed(event('checkout.session.completed', session()));

	beforeEach(() => undefined);

	it('no user has the address yet (buy-then-register) → no-user', async () => {
		const h = buildHarness();
		h.users = [];
		await h.controller.handle(gauzyEvent() as any);
		expect(h.tenantUpdate).not.toHaveBeenCalled();
		expect(h.decisions()).toEqual([
			expect.objectContaining({ decision: 'no-user', customer: 'cus_Buyer0000000001' })
		]);
		// The lookup is case-insensitive on our side, and the address never reaches the log.
		expect(h.userQueries).toEqual([{ email: BUYER_EMAIL.toLowerCase() }]);
	});

	it('the address exists in two tenants → multi', async () => {
		const h = buildHarness();
		h.users = [admin(), admin({ id: 'other-user', tenantId: OTHER_TENANT_ID })];
		await h.controller.handle(gauzyEvent() as any);
		expect(h.tenantUpdate).not.toHaveBeenCalled();
		expect(h.decisions()).toEqual([expect.objectContaining({ decision: 'multi' })]);
	});

	it.each([
		['EMPLOYEE (invite acceptance auto-verifies)', 'EMPLOYEE'],
		['MANAGER', 'MANAGER'],
		['client contact (VIEWER via /invite/contact)', 'VIEWER'],
		['CANDIDATE', 'CANDIDATE'],
		['DATA_ENTRY', 'DATA_ENTRY'],
		['user with no role', undefined]
	])('a verified %s → non-admin, the employer tenant is never bound', async (_label, roleName) => {
		const h = buildHarness();
		h.users = [admin({ role: roleName ? { id: 'r', name: roleName } : null })];
		h.stripe.subscriptions['cus_Buyer0000000001'] = [subscription()];
		await h.controller.handle(gauzyEvent() as any);
		expect(h.tenantUpdate).not.toHaveBeenCalled();
		expect(h.tenantFindOne).not.toHaveBeenCalled();
		expect(h.decisions()).toEqual([expect.objectContaining({ decision: 'non-admin', tenant: TENANT_ID })]);
	});

	it('an unverified SUPER_ADMIN → unverified', async () => {
		const h = buildHarness();
		h.users = [admin({ emailVerifiedAt: null })];
		await h.controller.handle(gauzyEvent() as any);
		expect(h.tenantUpdate).not.toHaveBeenCalled();
		expect(h.decisions()).toEqual([expect.objectContaining({ decision: 'unverified' })]);
	});

	it('the customer already belongs to another tenant → claimed', async () => {
		const h = buildHarness();
		h.users = [admin()];
		h.claimedBy = { id: OTHER_TENANT_ID };
		await h.controller.handle(gauzyEvent() as any);
		expect(h.tenantUpdate).not.toHaveBeenCalled();
		expect(h.decisions()).toEqual([
			expect.objectContaining({ decision: 'claimed', detail: `held-by:${OTHER_TENANT_ID}` })
		]);
	});

	it('the customer holds no entitling Gauzy subscription (only Teams, or cancelled) → not-entitled', async () => {
		const h = buildHarness();
		h.users = [admin()];
		h.stripe.subscriptions['cus_Buyer0000000001'] = [
			subscription({
				metadata: { ever_product: 'teams' },
				items: { data: [{ price: { lookup_key: 'ever_teams_cloud_starter_monthly' } }] }
			}),
			subscription({ status: 'canceled' }),
			subscription({ status: 'incomplete_expired' })
		];
		await h.controller.handle(gauzyEvent() as any);
		expect(h.tenantUpdate).not.toHaveBeenCalled();
		expect(h.decisions()).toEqual([expect.objectContaining({ decision: 'not-entitled' })]);
	});

	it('the customer holds only a Gauzy SELF-HOSTED license subscription → not-entitled', async () => {
		const h = buildHarness();
		h.users = [admin()];
		h.stripe.subscriptions['cus_Buyer0000000001'] = [
			subscription({
				status: 'active',
				metadata: { ever_product: 'gauzy', ever_hosting: 'selfhosted' },
				items: { data: [{ price: { lookup_key: 'ever_gauzy_selfhosted_enterprise_annual' } }] }
			})
		];
		await h.controller.handle(signed(event('checkout.session.completed', session())) as any);
		expect(h.tenantUpdate).not.toHaveBeenCalled();
		expect(h.decisions()).toEqual([expect.objectContaining({ decision: 'not-entitled' })]);
	});

	it('Stripe cannot confirm the subscription → stripe-unavailable, nothing written, still 200', async () => {
		const h = buildHarness();
		h.users = [admin()];
		h.stripe.failSubscriptions = true;
		const result = await h.controller.handle(gauzyEvent() as any);
		expect(result).toEqual({ received: true });
		expect(h.tenantUpdate).not.toHaveBeenCalled();
		expect(h.decisions()).toEqual([expect.objectContaining({ decision: 'stripe-unavailable' })]);
	});

	it('a database error is acknowledged, logged once as error, and writes nothing', async () => {
		const h = buildHarness();
		h.createQueryBuilder.mockImplementation(() => {
			throw new Error(`connection terminated while looking up ${BUYER_EMAIL}`);
		});
		const result = await h.controller.handle(gauzyEvent() as any);
		expect(result).toEqual({ received: true });
		expect(h.tenantUpdate).not.toHaveBeenCalled();
		expect(h.decisions()).toEqual([expect.objectContaining({ decision: 'error' })]);
		expect(h.logLines.join('\n')).not.toContain(BUYER_EMAIL);
	});
});

describe('StripeWebhookController — the one case that links', () => {
	it('a verified SUPER_ADMIN buying Gauzy links their own tenant, once, only where empty', async () => {
		const h = buildHarness();
		h.users = [admin()];
		h.stripe.subscriptions['cus_Buyer0000000001'] = [subscription()];

		const result = await h.controller.handle(signed(event('checkout.session.completed', session())) as any);

		expect(result).toEqual({ received: true });
		expect(h.tenantUpdate).toHaveBeenCalledTimes(1);
		expect(h.tenantUpdate).toHaveBeenCalledWith(
			{ id: TENANT_ID, stripeCustomerId: IsNull() },
			{ stripeCustomerId: 'cus_Buyer0000000001' }
		);
		expect(h.decisions()).toEqual([
			expect.objectContaining({
				decision: 'linked',
				tenant: TENANT_ID,
				customer: 'cus_Buyer0000000001',
				product: 'gauzy'
			})
		]);
	});

	it('a verified ADMIN also qualifies', async () => {
		const h = buildHarness();
		h.users = [admin({ role: { id: 'r', name: 'ADMIN' } })];
		h.stripe.subscriptions['cus_Buyer0000000001'] = [subscription({ status: 'active' })];
		await h.controller.handle(signed(event('checkout.session.completed', session())) as any);
		expect(h.tenantUpdate).toHaveBeenCalledTimes(1);
		expect(h.decisions()[0].decision).toBe('linked');
	});

	it('a Dashboard-made subscription with no metadata but an ever_gauzy_cloud_ price links (email from Stripe)', async () => {
		const h = buildHarness();
		h.users = [admin()];
		const sub = subscription({ metadata: {}, status: 'active' });
		h.stripe.customers['cus_Buyer0000000001'] = { email: BUYER_EMAIL };
		h.stripe.subscriptions['cus_Buyer0000000001'] = [sub];

		await h.controller.handle(signed(event('customer.subscription.created', sub)) as any);

		expect(h.tenantUpdate).toHaveBeenCalledTimes(1);
		expect(h.decisions()).toEqual([expect.objectContaining({ decision: 'linked', eventProduct: 'gauzy' })]);
		expect(h.fetchCalls.some((url) => url.endsWith('/customers/cus_Buyer0000000001'))).toBe(true);
	});

	it('a tenant that already has a customer is left alone → already-linked', async () => {
		const h = buildHarness();
		h.users = [admin()];
		h.updateAffected = 0;
		h.stripe.subscriptions['cus_Buyer0000000001'] = [subscription()];
		await h.controller.handle(signed(event('checkout.session.completed', session())) as any);
		// The conditional UPDATE ran (it is what refuses to repoint) and changed nothing.
		expect(h.tenantUpdate).toHaveBeenCalledWith(
			{ id: TENANT_ID, stripeCustomerId: IsNull() },
			{ stripeCustomerId: 'cus_Buyer0000000001' }
		);
		expect(h.decisions()).toEqual([expect.objectContaining({ decision: 'already-linked' })]);
	});
});

describe('StripeWebhookController — BILLING_WEBHOOK_LINKING unset (the default): checks run, nothing is written', () => {
	beforeEach(() => {
		delete process.env.BILLING_WEBHOOK_LINKING;
	});

	it('a purchase that passes every check → would-link, 0 tenant writes', async () => {
		const h = buildHarness();
		h.users = [admin()];
		h.stripe.subscriptions['cus_Buyer0000000001'] = [subscription()];

		const result = await h.controller.handle(signed(event('checkout.session.completed', session())) as any);

		expect(result).toEqual({ received: true });
		expect(h.tenantUpdate).not.toHaveBeenCalled();
		expect(h.decisions()).toEqual([
			expect.objectContaining({ decision: 'would-link', tenant: TENANT_ID, customer: 'cus_Buyer0000000001' })
		]);
	});

	it('a $0 Starter somebody else started under a verified SUPER_ADMIN address does not bind that tenant', async () => {
		// gauzy-code-02: nothing in the event tells the owner's purchase from one made in their name.
		const h = buildHarness();
		h.users = [admin()];
		h.stripe.subscriptions['cus_Attacker000001'] = [
			subscription({ id: 'sub_Attacker000001', customer: 'cus_Attacker000001', status: 'active' })
		];
		await h.controller.handle(
			signed(
				event(
					'checkout.session.completed',
					session({ customer: 'cus_Attacker000001', subscription: 'sub_Attacker000001' })
				)
			) as any
		);
		expect(h.tenantUpdate).not.toHaveBeenCalled();
		expect(h.decisions()).toEqual([expect.objectContaining({ decision: 'would-link' })]);
	});

	it('an existing admin who buys, then registers a NEW account, keeps the OLD tenant unlinked', async () => {
		// The event lands before the new registration. Writing here would bind the OLD tenant and leave
		// the new one's Checkout-Session link refused as "claimed"; with writing off, the customer stays
		// free for onboarding (tenant.service.billing-link.spec covers that side).
		const h = buildHarness();
		h.users = [admin({ tenantId: OTHER_TENANT_ID })];
		h.stripe.subscriptions['cus_Buyer0000000001'] = [subscription()];
		await h.controller.handle(signed(event('checkout.session.completed', session())) as any);
		expect(h.tenantUpdate).not.toHaveBeenCalled();
		expect(h.decisions()).toEqual([expect.objectContaining({ decision: 'would-link', tenant: OTHER_TENANT_ID })]);
	});

	it.each(['false', '0', 'no', 'off', '', 'enabled', 'TRUE-ish'])(
		'BILLING_WEBHOOK_LINKING=%p does not enable writing',
		async (value) => {
			process.env.BILLING_WEBHOOK_LINKING = value;
			const h = buildHarness();
			h.users = [admin()];
			h.stripe.subscriptions['cus_Buyer0000000001'] = [subscription()];
			await h.controller.handle(signed(event('checkout.session.completed', session())) as any);
			expect(h.tenantUpdate).not.toHaveBeenCalled();
			expect(h.decisions()[0].decision).toBe('would-link');
		}
	);

	it.each(['true', '1', 'yes', 'on', ' TRUE '])('BILLING_WEBHOOK_LINKING=%p enables writing', async (value) => {
		process.env.BILLING_WEBHOOK_LINKING = value;
		const h = buildHarness();
		h.users = [admin()];
		h.stripe.subscriptions['cus_Buyer0000000001'] = [subscription()];
		await h.controller.handle(signed(event('checkout.session.completed', session())) as any);
		expect(h.tenantUpdate).toHaveBeenCalledTimes(1);
		expect(h.decisions()[0].decision).toBe('linked');
	});
});

describe('StripeWebhookController — BILLING_PRODUCT=teams (the Ever Teams deployment)', () => {
	beforeEach(() => {
		process.env.BILLING_PRODUCT = 'teams';
	});

	it('links a Teams purchase by a Teams admin', async () => {
		const h = buildHarness();
		h.users = [admin()];
		h.stripe.subscriptions['cus_Buyer0000000001'] = [
			subscription({
				metadata: { ever_product: 'teams' },
				items: { data: [{ price: { lookup_key: 'ever_teams_cloud_starter_monthly' } }] }
			})
		];
		await h.controller.handle(
			signed(event('checkout.session.completed', session({ metadata: { ever_product: 'teams' } }))) as any
		);
		expect(h.tenantUpdate).toHaveBeenCalledTimes(1);
		expect(h.decisions()).toEqual([expect.objectContaining({ decision: 'linked', product: 'teams' })]);
	});

	it('skips a Gauzy purchase', async () => {
		const h = buildHarness();
		h.users = [admin()];
		await h.controller.handle(signed(event('checkout.session.completed', session())) as any);
		expect(h.createQueryBuilder).not.toHaveBeenCalled();
		expect(h.tenantUpdate).not.toHaveBeenCalled();
		expect(h.decisions()).toEqual([
			expect.objectContaining({ decision: 'skipped-foreign', product: 'teams', eventProduct: 'gauzy' })
		]);
	});

	it('a Teams customer whose only live subscription is Gauzy is not entitled here', async () => {
		const h = buildHarness();
		h.users = [admin()];
		h.stripe.subscriptions['cus_Buyer0000000001'] = [subscription()];
		await h.controller.handle(
			signed(event('checkout.session.completed', session({ metadata: { ever_product: 'teams' } }))) as any
		);
		expect(h.tenantUpdate).not.toHaveBeenCalled();
		expect(h.decisions()).toEqual([expect.objectContaining({ decision: 'not-entitled' })]);
	});
});

describe('StripeWebhookController — an unusable BILLING_PRODUCT', () => {
	it('disables billing (403) rather than falling back to gauzy', async () => {
		const h = buildHarness();
		process.env.BILLING_PRODUCT = 'ever teams!';
		await expect(
			h.controller.handle(signed(event('checkout.session.completed', session())) as any)
		).rejects.toThrow('Billing webhooks are not enabled on this deployment.');
		expect(h.createQueryBuilder).not.toHaveBeenCalled();
	});
});
