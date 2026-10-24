// `@gauzy/core` and the registry's services drag in the entity graph; the controller only needs the caller, the
// route decorators and the two services it is handed.
const mockCaller = { userId: 'subscriber-admin' as string | null, role: 'ADMIN' };
jest.mock('@gauzy/core', () => {
	const decorator = () => () => undefined;
	return {
		RequestContext: {
			currentUserId: () => mockCaller.userId,
			hasRole: (role: string) => mockCaller.role === role
		},
		Permissions: decorator,
		PermissionGuard: class PermissionGuard {},
		TenantPermissionGuard: class TenantPermissionGuard {},
		UseValidationPipe: decorator,
		UUIDValidationPipe: class UUIDValidationPipe {}
	};
});
jest.mock('../../domain/services/plugin-billing.service', () => ({
	PluginBillingService: class PluginBillingService {}
}));
jest.mock('../../domain/services/plugin.service', () => ({ PluginService: class PluginService {} }));

import { PluginBillingStatus } from '@gauzy/contracts';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { PluginBillingController } from './plugin-billing.controller';

const PLUGIN = 'plugin-1';
const SUBSCRIPTION = 'subscription-1';
const BILL = 'bill-1';
const PUBLISHER = 'publisher-user';
const OPERATOR = 'operator-user';

/** A bill the subscriber's tenant (`tenant-b`) owes the publisher of `plugin-1`. */
const subscription = { id: SUBSCRIPTION, pluginId: PLUGIN, tenantId: 'tenant-b', organizationId: 'organization-b' };
const bill = {
	id: BILL,
	subscriptionId: SUBSCRIPTION,
	tenantId: 'tenant-b',
	status: PluginBillingStatus.PENDING,
	metadata: { source: 'renewal' }
};

function controller(stored: { subscription?: object | null; bill?: object | null } = {}) {
	const billingService = {
		findSubscriptionInAnyTenant: jest.fn(async () =>
			'subscription' in stored ? stored.subscription : subscription
		),
		findOneInAnyTenant: jest.fn(async () => ('bill' in stored ? stored.bill : bill)),
		createForSubscription: jest.fn(async (input: object) => ({ id: 'bill-2', ...input })),
		updateInAnyTenant: jest.fn(async () => undefined),
		markAsPaidInAnyTenant: jest.fn(async () => undefined),
		markAsFailedInAnyTenant: jest.fn(async () => undefined),
		// The tenant-scoped writes the payment handling uses; no route may reach them
		create: jest.fn(async (input: object) => input),
		update: jest.fn(async () => ({ affected: 1 })),
		markAsPaid: jest.fn(async () => ({ affected: 1 })),
		markAsFailed: jest.fn(async () => ({ affected: 1 })),
		findOneByIdString: jest.fn(async () => bill)
	};
	const pluginService = {
		validatePluginOwnership: jest.fn(
			async (pluginId: string, userId: string) => pluginId === PLUGIN && userId === PUBLISHER
		)
	};
	return {
		billingService,
		routes: new PluginBillingController(billingService as any, pluginService as any)
	};
}

const PAID_BILL = {
	subscriptionId: SUBSCRIPTION,
	amount: 0,
	currency: 'USD',
	status: PluginBillingStatus.PAID,
	tenantId: 'tenant-a'
} as any;

/** No write of any kind reached the store. */
function expectNoWrite(billingService: ReturnType<typeof controller>['billingService']) {
	for (const write of [
		'createForSubscription',
		'updateInAnyTenant',
		'markAsPaidInAnyTenant',
		'markAsFailedInAnyTenant',
		'create',
		'update',
		'markAsPaid',
		'markAsFailed'
	] as const) {
		expect(billingService[write]).not.toHaveBeenCalled();
	}
}

describe('plugin bills: who may mark them paid', () => {
	const env = process.env.EVER_OPERATOR_USER_IDS;

	beforeEach(() => {
		mockCaller.userId = 'subscriber-admin';
		mockCaller.role = 'ADMIN';
		process.env.EVER_OPERATOR_USER_IDS = OPERATOR;
	});

	afterAll(() => {
		if (env === undefined) delete process.env.EVER_OPERATOR_USER_IDS;
		else process.env.EVER_OPERATOR_USER_IDS = env;
	});

	it("refuses the subscriber's admin marking its own bill paid, and writes nothing", async () => {
		const { billingService, routes } = controller();

		await expect(
			routes.updateStatus(PLUGIN, SUBSCRIPTION, BILL, { status: 'paid', paymentReference: 'self-paid' })
		).rejects.toMatchObject({ status: 403, response: { code: 'PLUGIN_BILLING_WRITE_FORBIDDEN' } });

		expectNoWrite(billingService);
	});

	it("refuses the subscriber's admin rewriting a bill as paid or filing a paid one", async () => {
		const { billingService, routes } = controller();

		await expect(
			routes.update(PLUGIN, SUBSCRIPTION, BILL, { status: PluginBillingStatus.PAID, amount: 0 } as any)
		).rejects.toBeInstanceOf(ForbiddenException);
		await expect(routes.create(PLUGIN, SUBSCRIPTION, PAID_BILL)).rejects.toBeInstanceOf(ForbiddenException);

		expectNoWrite(billingService);
	});

	it("lets the plugin's publisher mark a bill of another tenant paid, in that tenant", async () => {
		mockCaller.userId = PUBLISHER;
		const { billingService, routes } = controller();

		await routes.updateStatus(PLUGIN, SUBSCRIPTION, BILL, { status: 'paid', paymentReference: 'wire-42' });

		expect(billingService.markAsPaidInAnyTenant).toHaveBeenCalledWith(bill, 'wire-42');
		expect(billingService.markAsPaid).not.toHaveBeenCalled();
	});

	it("files the publisher's bill in the subscription's tenant, under the subscription the route names", async () => {
		mockCaller.userId = PUBLISHER;
		const { billingService, routes } = controller();

		await routes.create(PLUGIN, SUBSCRIPTION, PAID_BILL);

		expect(billingService.createForSubscription).toHaveBeenCalledWith(PAID_BILL, subscription);
	});

	it('lets the installation operator mark a bill paid: a super admin listed in EVER_OPERATOR_USER_IDS', async () => {
		mockCaller.userId = OPERATOR;
		mockCaller.role = 'SUPER_ADMIN';
		const { billingService, routes } = controller();

		await routes.updateStatus(PLUGIN, SUBSCRIPTION, BILL, { status: 'failed', reason: 'chargeback' });

		expect(billingService.markAsFailedInAnyTenant).toHaveBeenCalledWith(bill, 'chargeback');
	});

	it('refuses a listed user who is no longer a super admin, a super admin who is not listed, and everyone without a list', async () => {
		const attempts: Array<[string, string, string | undefined]> = [
			[OPERATOR, 'ADMIN', OPERATOR],
			['other-super-admin', 'SUPER_ADMIN', OPERATOR],
			[OPERATOR, 'SUPER_ADMIN', undefined]
		];
		for (const [userId, role, list] of attempts) {
			mockCaller.userId = userId;
			mockCaller.role = role;
			if (list === undefined) delete process.env.EVER_OPERATOR_USER_IDS;
			else process.env.EVER_OPERATOR_USER_IDS = list;
			const { billingService, routes } = controller();

			await expect(routes.updateStatus(PLUGIN, SUBSCRIPTION, BILL, { status: 'paid' })).rejects.toBeInstanceOf(
				ForbiddenException
			);
			expectNoWrite(billingService);
		}
	});

	it('answers 404 to the publisher for a bill of another subscription, or a subscription of another plugin', async () => {
		mockCaller.userId = PUBLISHER;

		const otherBill = controller({ bill: { ...bill, subscriptionId: 'subscription-2' } });
		await expect(
			otherBill.routes.updateStatus(PLUGIN, SUBSCRIPTION, BILL, { status: 'paid' })
		).rejects.toBeInstanceOf(NotFoundException);
		expectNoWrite(otherBill.billingService);

		const otherPlugin = controller({ subscription: { ...subscription, pluginId: 'plugin-2' } });
		await expect(otherPlugin.routes.create(PLUGIN, SUBSCRIPTION, PAID_BILL)).rejects.toBeInstanceOf(
			NotFoundException
		);
		expectNoWrite(otherPlugin.billingService);
	});
});
