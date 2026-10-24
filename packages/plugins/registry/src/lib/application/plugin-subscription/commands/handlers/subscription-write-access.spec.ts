// `@gauzy/core` and the registry's barrels drag in the entity graph; the handlers only need the caller and the services.
const mockContext = { userId: 'user-a' as string | null };
jest.mock('@gauzy/core', () => ({
	RequestContext: {
		currentUserId: () => mockContext.userId,
		currentTenantId: () => 'tenant-a',
		currentOrganizationId: () => 'organization-a'
	}
}));
jest.mock('../../../../domain', () => ({
	PluginService: class PluginService {},
	PluginSubscriptionService: class PluginSubscriptionService {}
}));
jest.mock('../../../../domain/entities', () => ({ PluginSubscription: class PluginSubscription {} }));
jest.mock('../../../../shared', () => ({}));

import { PluginSubscriptionStatus } from '@gauzy/contracts';
import { NotFoundException } from '@nestjs/common';
import { RenewPluginSubscriptionCommand } from '../renew-plugin-subscription.command';
import { UpdatePluginSubscriptionCommand } from '../update-plugin-subscription.command';
import { RenewPluginSubscriptionCommandHandler } from './renew-plugin-subscription.handler';
import { UpdatePluginSubscriptionCommandHandler } from './update-plugin-subscription.handler';

const PLUGIN = 'plugin-1';
const PUBLISHER = 'publisher-user';
const SUBSCRIBER_ADMIN = 'user-a';

/** A pending paid subscription: what a purchase stores until the payment goes through. */
function storedSubscription(tenantId: string) {
	return {
		id: 'subscription-1',
		pluginId: PLUGIN,
		tenantId,
		subscriberId: SUBSCRIBER_ADMIN,
		status: PluginSubscriptionStatus.PENDING,
		endDate: new Date('2026-11-23'),
		autoRenew: true,
		metadata: { renewalCount: 2, paymentFailureCount: 1, note: 'old' },
		plan: { billingPeriod: 'monthly' },
		children: [],
		canBeRenewed: () => true,
		isInherited: () => false,
		calculateNextBillingDate: () => new Date('2026-12-23'),
		renew(endDate: Date) {
			this.status = PluginSubscriptionStatus.ACTIVE;
			this.endDate = endDate;
			return this;
		}
	};
}

/**
 * The services as the handlers see them. `inCallerTenant` says whether the scoped read finds the subscription (the
 * caller's own tenant holds it); a subscription of another tenant is only in `findOneInAnyTenant`.
 */
function services(subscription: ReturnType<typeof storedSubscription>, inCallerTenant: boolean) {
	const subscriptionService = {
		findOneOrFailByIdString: jest.fn(async () =>
			inCallerTenant
				? { success: true, record: subscription }
				: { success: false, error: new NotFoundException() }
		),
		findOneByIdString: jest.fn(async () => (inCallerTenant ? subscription : null)),
		findOneInAnyTenant: jest.fn(async () => subscription),
		update: jest.fn(async () => ({ affected: 1 })),
		updateInAnyTenant: jest.fn(async () => undefined),
		save: jest.fn(async (entity) => entity),
		saveInAnyTenant: jest.fn(async (entity) => entity)
	};
	const pluginService = {
		validatePluginOwnership: jest.fn(
			async (pluginId: string, userId: string) => pluginId === PLUGIN && userId === PUBLISHER
		)
	};
	return { subscriptionService, pluginService };
}

/** Every field a body may carry: the billing state, the subscriber's settings, and columns the route never offered. */
const WHOLE_BODY = {
	status: PluginSubscriptionStatus.ACTIVE,
	startDate: '2026-10-01T00:00:00.000Z',
	endDate: '2099-01-01T00:00:00.000Z',
	trialEndDate: '2099-01-01T00:00:00.000Z',
	planId: 'premium-plan',
	tenantId: 'tenant-b',
	subscriberId: 'someone-else',
	autoRenew: false,
	metadata: { note: 'new', renewalCount: 0, paymentFailureCount: 0 }
} as any;

describe('PUT /plugins/:pluginId/subscriptions/:id — who may change what', () => {
	beforeEach(() => {
		mockContext.userId = SUBSCRIBER_ADMIN;
	});

	it("writes only the subscriber's own settings for the subscriber's tenant, never the status, dates or plan", async () => {
		const subscription = storedSubscription('tenant-a');
		const { subscriptionService, pluginService } = services(subscription, true);

		await new UpdatePluginSubscriptionCommandHandler(subscriptionService as any, pluginService as any).execute(
			new UpdatePluginSubscriptionCommand(subscription.id, WHOLE_BODY, PLUGIN)
		);

		expect(subscriptionService.update).toHaveBeenCalledTimes(1);
		expect(subscriptionService.update).toHaveBeenCalledWith(subscription.id, {
			autoRenew: false,
			metadata: { note: 'new', renewalCount: 2, paymentFailureCount: 1 }
		});
		expect(subscriptionService.updateInAnyTenant).not.toHaveBeenCalled();
	});

	it('writes nothing when a subscriber asks only for billing state', async () => {
		const subscription = storedSubscription('tenant-a');
		const { subscriptionService, pluginService } = services(subscription, true);

		const result = await new UpdatePluginSubscriptionCommandHandler(
			subscriptionService as any,
			pluginService as any
		).execute(
			new UpdatePluginSubscriptionCommand(
				subscription.id,
				{ status: PluginSubscriptionStatus.ACTIVE, endDate: '2099-01-01T00:00:00.000Z' } as any,
				PLUGIN
			)
		);

		expect(subscriptionService.update).not.toHaveBeenCalled();
		expect(result).toBe(subscription);
		expect(result.status).toBe(PluginSubscriptionStatus.PENDING);
	});

	it("lets the plugin's publisher set the status and dates of another tenant's subscription, and nothing else", async () => {
		mockContext.userId = PUBLISHER;
		const subscription = storedSubscription('tenant-b');
		const { subscriptionService, pluginService } = services(subscription, false);

		await new UpdatePluginSubscriptionCommandHandler(subscriptionService as any, pluginService as any).execute(
			new UpdatePluginSubscriptionCommand(subscription.id, WHOLE_BODY, PLUGIN)
		);

		expect(subscriptionService.updateInAnyTenant).toHaveBeenCalledWith(subscription.id, {
			status: PluginSubscriptionStatus.ACTIVE,
			startDate: WHOLE_BODY.startDate,
			endDate: WHOLE_BODY.endDate,
			trialEndDate: WHOLE_BODY.trialEndDate
		});
		expect(subscriptionService.update).not.toHaveBeenCalled();
	});

	it('lets a publisher subscribed in their own tenant change both the settings and the billing state, but not the plan', async () => {
		mockContext.userId = PUBLISHER;
		const subscription = storedSubscription('tenant-a');
		const { subscriptionService, pluginService } = services(subscription, true);

		await new UpdatePluginSubscriptionCommandHandler(subscriptionService as any, pluginService as any).execute(
			new UpdatePluginSubscriptionCommand(subscription.id, WHOLE_BODY, PLUGIN)
		);

		expect(subscriptionService.update).toHaveBeenCalledWith(subscription.id, {
			autoRenew: false,
			metadata: { note: 'new', renewalCount: 2, paymentFailureCount: 1 },
			status: PluginSubscriptionStatus.ACTIVE,
			startDate: WHOLE_BODY.startDate,
			endDate: WHOLE_BODY.endDate,
			trialEndDate: WHOLE_BODY.trialEndDate
		});
	});

	it("answers 404 for another tenant's subscription to a plugin the caller did not publish, and writes nothing", async () => {
		const subscription = storedSubscription('tenant-b');
		const { subscriptionService, pluginService } = services(subscription, false);

		await expect(
			new UpdatePluginSubscriptionCommandHandler(subscriptionService as any, pluginService as any).execute(
				new UpdatePluginSubscriptionCommand(subscription.id, WHOLE_BODY, PLUGIN)
			)
		).rejects.toBeInstanceOf(NotFoundException);
		expect(subscriptionService.update).not.toHaveBeenCalled();
		expect(subscriptionService.updateInAnyTenant).not.toHaveBeenCalled();
	});

	it('answers 404 when the subscription belongs to another plugin than the route names', async () => {
		mockContext.userId = PUBLISHER;
		const subscription = { ...storedSubscription('tenant-a'), pluginId: 'plugin-2' };
		const { subscriptionService, pluginService } = services(subscription as any, true);

		await expect(
			new UpdatePluginSubscriptionCommandHandler(subscriptionService as any, pluginService as any).execute(
				new UpdatePluginSubscriptionCommand(subscription.id, WHOLE_BODY, PLUGIN)
			)
		).rejects.toBeInstanceOf(NotFoundException);
		expect(subscriptionService.update).not.toHaveBeenCalled();
	});
});

describe("PATCH /plugins/:pluginId/subscriptions/:id {status:'renewed'} — who may renew", () => {
	beforeEach(() => {
		mockContext.userId = SUBSCRIBER_ADMIN;
	});

	it("ignores a renewal by the subscriber's tenant: the paid period is not extended", async () => {
		const subscription = storedSubscription('tenant-a');
		const { subscriptionService, pluginService } = services(subscription, true);

		const result = await new RenewPluginSubscriptionCommandHandler(
			subscriptionService as any,
			pluginService as any
		).execute(new RenewPluginSubscriptionCommand(subscription.id, PLUGIN));

		expect(subscriptionService.save).not.toHaveBeenCalled();
		expect(subscriptionService.saveInAnyTenant).not.toHaveBeenCalled();
		expect(result.status).toBe(PluginSubscriptionStatus.PENDING);
		expect(result.endDate).toEqual(new Date('2026-11-23'));
	});

	it("lets the plugin's publisher renew another tenant's subscription, saved in that tenant", async () => {
		mockContext.userId = PUBLISHER;
		const subscription = storedSubscription('tenant-b');
		const { subscriptionService, pluginService } = services(subscription, false);

		await new RenewPluginSubscriptionCommandHandler(subscriptionService as any, pluginService as any).execute(
			new RenewPluginSubscriptionCommand(subscription.id, PLUGIN)
		);

		expect(subscriptionService.saveInAnyTenant).toHaveBeenCalledWith(
			expect.objectContaining({
				id: subscription.id,
				tenantId: 'tenant-b',
				status: PluginSubscriptionStatus.ACTIVE,
				endDate: new Date('2026-12-23')
			})
		);
		expect(subscriptionService.save).not.toHaveBeenCalled();
	});
});
