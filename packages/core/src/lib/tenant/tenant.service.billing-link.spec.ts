/**
 * 🛑 This import must stay FIRST, before any import that pulls a core service — the entity graph has
 * to finish initializing before TenantService (and the repositories it imports) are evaluated.
 */
import '../core/entities/internal';
import { Logger } from '@nestjs/common';
import { StripeSubscriptionService } from '../shared/billing/stripe-subscription.service';
import { TenantService } from './tenant.service';

/**
 * Proven-identity linking at tenant onboarding.
 *
 * The ever.co checkout forwards the buyer's Checkout Session id to the register form; the web app
 * carries it into `POST /tenant`. There, once the tenant exists and its creator is SUPER_ADMIN, the
 * tenant is linked to the session's Stripe customer — but only after Stripe confirms the session is
 * complete, is a subscription to THIS product, and was paid under the creator's own address. These
 * tests drive the real TenantService methods with an in-memory repository and a fixture Stripe.
 */

const TENANT_ID = '11111111-1111-4111-8111-111111111111';
const OTHER_TENANT_ID = '22222222-2222-4222-8222-222222222222';
const USER_ID = '33333333-3333-4333-8333-333333333333';
const EMAIL = 'founder@newco.test';
const SESSION = 'cs_test_a1FixtureSessionForBillingScopeTests000000000000000000000';

function completeSession(overrides: Record<string, any> = {}) {
	return {
		id: SESSION,
		status: 'complete',
		mode: 'subscription',
		created: Math.floor(Date.now() / 1000) - 60,
		customer: 'cus_new',
		customer_details: { email: 'Founder@NewCo.test' },
		metadata: { ever_product: 'gauzy' },
		subscription: { id: 'sub_new', status: 'trialing', metadata: { ever_product: 'gauzy' } },
		...overrides
	};
}

let stripePaths: string[] = [];
function stubStripe(session: any, extra: (path: string) => any = () => undefined) {
	stripePaths = [];
	(global as any).fetch = jest.fn(async (input: string) => {
		const path = String(input).replace('https://api.stripe.com/v1', '');
		stripePaths.push(path);
		const body = path.startsWith('/checkout/sessions/') ? session : extra(path);
		if (body === undefined) throw new Error(`Unexpected Stripe request in test: ${path}`);
		return { ok: true, status: 200, json: async () => body, text: async () => JSON.stringify(body) };
	});
}

function buildService(claimedBy: { id: string } | null = null) {
	const service: any = Object.create(TenantService.prototype);
	service.stripeSubscriptionService = new StripeSubscriptionService();
	service.billingLogger = new Logger('TenantBillingLink');
	service.typeOrmTenantRepository = { findOne: jest.fn(async () => claimedBy) };
	service.update = jest.fn(async () => ({ affected: 1 }));
	return service as TenantService & { update: jest.Mock; typeOrmTenantRepository: { findOne: jest.Mock } };
}

const tenant = () => ({ id: TENANT_ID, name: 'NewCo' }) as any;
const creator = (overrides: Record<string, any> = {}) =>
	({ id: USER_ID, email: EMAIL, emailVerifiedAt: null, ...overrides }) as any;

const ENV_KEYS = ['STRIPE_SECRET_KEY', 'STRIPE_LIVE_MODE', 'DEMO', 'BILLING_PRODUCT'];
const saved: Record<string, string | undefined> = {};
const realFetch = (global as any).fetch;
let logLines: string[] = [];

beforeEach(() => {
	for (const key of ENV_KEYS) saved[key] = process.env[key];
	process.env.STRIPE_SECRET_KEY = 'sk_test_billing_scope_fixture';
	delete process.env.STRIPE_LIVE_MODE;
	delete process.env.DEMO;
	delete process.env.BILLING_PRODUCT;
	logLines = [];
	for (const level of ['log', 'warn', 'error'] as const) {
		jest.spyOn(Logger.prototype, level).mockImplementation((message: any) => {
			logLines.push(String(message));
		});
	}
});

afterEach(() => {
	for (const key of ENV_KEYS) {
		if (saved[key] === undefined) delete process.env[key];
		else process.env[key] = saved[key];
	}
	(global as any).fetch = realFetch;
	jest.restoreAllMocks();
});

const linkDecisions = () =>
	logLines.filter((l) => l.startsWith('stripe-link ')).map((l) => JSON.parse(l.slice('stripe-link '.length)));

describe('TenantService.linkStripeCustomerFromCheckoutSession', () => {
	it('links the new tenant to the session customer — no verified email needed', async () => {
		stubStripe(completeSession());
		const service = buildService();
		const t = tenant();

		await expect(service.linkStripeCustomerFromCheckoutSession(t, creator(), SESSION)).resolves.toBe('cus_new');

		expect(service.update).toHaveBeenCalledTimes(1);
		expect(service.update).toHaveBeenCalledWith(TENANT_ID, { stripeCustomerId: 'cus_new' });
		expect(t.stripeCustomerId).toBe('cus_new');
		expect(linkDecisions()).toEqual([
			expect.objectContaining({
				decision: 'session-linked',
				tenant: TENANT_ID,
				customer: 'cus_new',
				product: 'gauzy'
			})
		]);
		expect(logLines.join('\n')).not.toMatch(/@/);
	});

	it.each<[string, Record<string, any>, string]>([
		[
			'paid under another address (a replayed or leaked session id)',
			{ customer_details: { email: 'victim@corp.test' } },
			'email-mismatch'
		],
		['for another product', { metadata: { ever_product: 'teams' } }, 'foreign-product'],
		['a payment-mode license', { mode: 'payment' }, 'foreign-product'],
		['not complete', { status: 'open' }, 'incomplete'],
		['too old', { created: Math.floor(Date.now() / 1000) - 30 * 86400 }, 'expired']
	])('does not link from a session that is %s', async (_label, overrides, reason) => {
		stubStripe(completeSession(overrides));
		const service = buildService();
		await expect(service.linkStripeCustomerFromCheckoutSession(tenant(), creator(), SESSION)).resolves.toBeNull();
		expect(service.update).not.toHaveBeenCalled();
		expect(linkDecisions()).toEqual([expect.objectContaining({ decision: 'session-declined', detail: reason })]);
	});

	it('never adopts a customer another tenant already bills through', async () => {
		stubStripe(completeSession());
		const service = buildService({ id: OTHER_TENANT_ID });
		await expect(service.linkStripeCustomerFromCheckoutSession(tenant(), creator(), SESSION)).resolves.toBeNull();
		expect(service.update).not.toHaveBeenCalled();
		expect(linkDecisions()).toEqual([expect.objectContaining({ decision: 'claimed' })]);
	});

	it('does nothing, and asks Stripe nothing, when billing is off', async () => {
		delete process.env.STRIPE_SECRET_KEY;
		stubStripe(completeSession());
		const service = buildService();
		await expect(service.linkStripeCustomerFromCheckoutSession(tenant(), creator(), SESSION)).resolves.toBeNull();
		expect(stripePaths).toEqual([]);
		expect(service.update).not.toHaveBeenCalled();
	});
});

describe('TenantService.linkStripeCustomerAtOnboarding', () => {
	it('falls back to the verified-email path when the session is declined — and that path still needs verification', async () => {
		stubStripe(completeSession({ customer_details: { email: 'victim@corp.test' } }));
		const service = buildService();
		await expect(service.linkStripeCustomerAtOnboarding(tenant(), creator(), SESSION)).resolves.toBeNull();
		expect(service.update).not.toHaveBeenCalled();
	});

	it('never fails onboarding: a write error (e.g. the unique index losing a race) is logged and swallowed', async () => {
		stubStripe(completeSession());
		const service = buildService();
		service.update.mockRejectedValueOnce(new Error('duplicate key value violates unique constraint'));
		await expect(service.linkStripeCustomerAtOnboarding(tenant(), creator(), SESSION)).resolves.toBeNull();
		expect(logLines.some((l) => l.includes('Could not link tenant'))).toBe(true);
	});
});

describe('TenantService.onboardTenant — the session id is proof, not a tenant field', () => {
	it('keeps it out of the created entity and links only after the creator is SUPER_ADMIN', async () => {
		const service: any = buildService();
		const order: string[] = [];
		service.create = jest.fn(async (input: any) => {
			order.push('create');
			return { id: TENANT_ID, ...input };
		});
		service.commandBus = { execute: jest.fn(async () => undefined) };
		service.executeTenantUpdateTasks = jest.fn();
		service.typeOrmRoleRepository = { findOneBy: jest.fn(async () => ({ id: 'role-super-admin' })) };
		service.typeOrmUserRepository = {
			update: jest.fn(async () => {
				order.push('assign-super-admin');
				return { affected: 1 };
			})
		};
		service.importRecords = jest.fn(async () => undefined);
		service.linkStripeCustomerAtOnboarding = jest.fn(async () => {
			order.push('link');
			return 'cus_new';
		});
		jest.spyOn(console, 'time').mockImplementation(() => undefined);
		jest.spyOn(console, 'timeEnd').mockImplementation(() => undefined);

		await service.onboardTenant({ name: 'NewCo', stripeCheckoutSessionId: SESSION }, creator());

		expect(service.create).toHaveBeenCalledWith({ name: 'NewCo' });
		expect(service.linkStripeCustomerAtOnboarding).toHaveBeenCalledWith(
			expect.objectContaining({ id: TENANT_ID }),
			expect.objectContaining({ id: USER_ID }),
			SESSION
		);
		expect(order).toEqual(['create', 'assign-super-admin', 'link']);
	});
});
