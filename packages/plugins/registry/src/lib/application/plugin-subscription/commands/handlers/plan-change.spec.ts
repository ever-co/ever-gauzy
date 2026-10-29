// `@gauzy/core` and the registry domain drag in the whole entity graph: stand-ins are enough for these handlers.
const mockCaller = { userId: 'subscriber-1' as string | null };

jest.mock('@gauzy/core', () => {
	function stub(this: unknown) {
		return new.target ? undefined : () => undefined;
	}
	const target: Record<string, unknown> = {
		RequestContext: { currentUserId: () => mockCaller.userId }
	};
	return new Proxy(target, {
		get: (object, name: string) => (name in object ? object[name] : name === '__esModule' ? true : stub)
	});
});
jest.mock('../../../../domain', () => ({
	PluginService: class PluginService {},
	PluginSubscriptionPlanService: class PluginSubscriptionPlanService {},
	PluginSubscriptionService: class PluginSubscriptionService {}
}));
jest.mock('../../../../domain/entities', () => ({ PluginSubscription: class PluginSubscription {} }));

import { BadRequestException, HttpStatus, NotFoundException } from '@nestjs/common';
import { PluginBillingPeriod, PluginSubscriptionType } from '@gauzy/contracts';
import { DowngradePluginSubscriptionCommand } from '../downgrade-plugin-subscription.command';
import { UpgradePluginSubscriptionCommand } from '../upgrade-plugin-subscription.command';
import { DowngradePluginSubscriptionCommandHandler } from './downgrade-plugin-subscription.handler';
import { assertPlanChangeAllowed, PLAN_CHANGE_NEEDS_PAYMENT } from './plan-change';
import { UpgradePluginSubscriptionCommandHandler } from './upgrade-plugin-subscription.handler';

/**
 * `POST /plugins/:pluginId/subscriptions/:id/upgrade|downgrade` set any plan id: another plugin's plan, an inactive
 * one, or a paid one, with no payment step (the registry's payment gateway is not integrated). A plan change now
 * needs a plan of the subscription's plugin that is active, and may not raise what the subscriber pays unless the
 * plugin's publisher makes it.
 */

const PLUGIN = 'plugin-1';
const plan = (id: string, fields: Record<string, unknown> = {}) => ({
	id,
	pluginId: PLUGIN,
	isActive: true,
	type: PluginSubscriptionType.BASIC,
	price: 10,
	currency: 'USD',
	billingPeriod: PluginBillingPeriod.MONTHLY,
	...fields
});
const PLANS: Record<string, any> = {
	basic: plan('basic'),
	cheaper: plan('cheaper', { price: 5 }),
	premium: plan('premium', { type: PluginSubscriptionType.PREMIUM, price: 25 }),
	free: plan('free', { type: PluginSubscriptionType.FREE, price: 0 }),
	yearly: plan('yearly', { price: 5, billingPeriod: PluginBillingPeriod.YEARLY }),
	euro: plan('euro', { price: 5, currency: 'EUR' }),
	inactive: plan('inactive', { price: 0, type: PluginSubscriptionType.FREE, isActive: false }),
	foreign: plan('foreign', { pluginId: 'plugin-2', price: 0, type: PluginSubscriptionType.FREE })
};

function build(currentPlanId = 'basic') {
	const planService = {
		findOneOrFailByIdString: jest.fn(async (id: string) =>
			PLANS[id] ? { success: true, record: PLANS[id] } : { success: false }
		)
	};
	const pluginService = {
		validatePluginOwnership: jest.fn(async (pluginId: string, userId: string) => userId === 'publisher-1')
	};
	const subscription: any = {
		id: 'subscription-1',
		pluginId: PLUGIN,
		subscriberId: 'subscriber-1',
		planId: currentPlanId,
		plan: PLANS[currentPlanId],
		metadata: {},
		children: [],
		isInherited: () => false,
		canBeDowngraded: () => true,
		upgradeToPlan(planId: string) {
			this.planId = planId;
			return this;
		},
		downgradeToPlan(planId: string) {
			this.planId = planId;
			return this;
		}
	};
	return { planService, pluginService, subscription };
}

const status = async (promise: Promise<unknown>) => {
	try {
		await promise;
		return 'allowed';
	} catch (error) {
		return error?.getStatus?.() ?? error;
	}
};

beforeEach(() => {
	mockCaller.userId = 'subscriber-1';
});

describe('assertPlanChangeAllowed', () => {
	it.each([
		['to a free plan', 'free'],
		['to a cheaper plan in the same currency and billing period', 'cheaper']
	])('lets the subscriber move %s', async (_case, planId) => {
		const { planService, pluginService, subscription } = build();

		await expect(
			assertPlanChangeAllowed(planService as any, pluginService as any, subscription, planId, PLUGIN)
		).resolves.toEqual(PLANS[planId]);
	});

	it.each([
		['to a pricier plan', 'premium'],
		['to a plan of another billing period, which is not comparable', 'yearly'],
		['to a plan in another currency, which is not comparable', 'euro']
	])('asks for a payment (402) for a move %s', async (_case, planId) => {
		const { planService, pluginService, subscription } = build();

		const refusal = assertPlanChangeAllowed(planService as any, pluginService as any, subscription, planId, PLUGIN);

		await expect(refusal).rejects.toThrow(PLAN_CHANGE_NEEDS_PAYMENT);
		expect(await status(refusal)).toBe(HttpStatus.PAYMENT_REQUIRED);
	});

	it('asks for a payment for any paid plan when the current plan is free', async () => {
		const { planService, pluginService, subscription } = build('free');

		expect(
			await status(assertPlanChangeAllowed(planService as any, pluginService as any, subscription, 'cheaper'))
		).toBe(HttpStatus.PAYMENT_REQUIRED);
	});

	it('lets the plugin’s publisher move a subscriber to any plan of the plugin', async () => {
		mockCaller.userId = 'publisher-1';
		const { planService, pluginService, subscription } = build('free');

		await expect(
			assertPlanChangeAllowed(planService as any, pluginService as any, subscription, 'premium', PLUGIN)
		).resolves.toEqual(PLANS.premium);
		expect(pluginService.validatePluginOwnership).toHaveBeenCalledWith(PLUGIN, 'publisher-1');
	});

	it.each([
		['another plugin’s plan, even a free one', 'foreign'],
		['an inactive plan', 'inactive'],
		['a plan that does not exist', 'missing']
	])('refuses %s, even to the publisher', async (_case, planId) => {
		mockCaller.userId = 'publisher-1';
		const { planService, pluginService, subscription } = build();

		await expect(
			assertPlanChangeAllowed(planService as any, pluginService as any, subscription, planId, PLUGIN)
		).rejects.toThrow(BadRequestException);
	});

	it('does not find a subscription of another plugin than the route names', async () => {
		const { planService, pluginService, subscription } = build();

		await expect(
			assertPlanChangeAllowed(planService as any, pluginService as any, subscription, 'free', 'plugin-2')
		).rejects.toThrow(NotFoundException);
		expect(planService.findOneOrFailByIdString).not.toHaveBeenCalled();
	});
});

describe('upgrade and downgrade handlers', () => {
	function handlers(currentPlanId = 'basic') {
		const { planService, pluginService, subscription } = build(currentPlanId);
		const subscriptionService = {
			findOneOrFailByIdString: jest.fn(async () => ({ success: true, record: subscription })),
			findOneByIdString: jest.fn(async () => subscription),
			save: jest.fn(async (entity: unknown) => entity)
		};
		const upgrade = new UpgradePluginSubscriptionCommandHandler(
			subscriptionService as any,
			planService as any,
			pluginService as any
		);
		const downgrade = new DowngradePluginSubscriptionCommandHandler(
			subscriptionService as any,
			planService as any,
			pluginService as any
		);
		return { upgrade, downgrade, subscriptionService, subscription };
	}

	const upgradeTo = (planId: string, pluginId = PLUGIN) =>
		new UpgradePluginSubscriptionCommand(
			'subscription-1',
			planId,
			'tenant-1',
			'organization-1',
			'subscriber-1',
			pluginId
		);
	const downgradeTo = (planId: string, pluginId = PLUGIN) =>
		new DowngradePluginSubscriptionCommand(
			'subscription-1',
			planId,
			'tenant-1',
			'organization-1',
			'subscriber-1',
			pluginId
		);

	it('no longer upgrades a subscriber to a paid plan without a payment, and answers 402, not 400', async () => {
		const { upgrade, subscriptionService, subscription } = handlers();

		expect(await status(upgrade.execute(upgradeTo('premium')))).toBe(HttpStatus.PAYMENT_REQUIRED);
		expect(subscriptionService.save).not.toHaveBeenCalled();
		expect(subscription.planId).toBe('basic');
	});

	it('no longer moves a subscription onto another plugin’s plan', async () => {
		const { upgrade, downgrade, subscriptionService } = handlers();

		expect(await status(upgrade.execute(upgradeTo('foreign')))).toBe(HttpStatus.BAD_REQUEST);
		expect(await status(downgrade.execute(downgradeTo('foreign')))).toBe(HttpStatus.BAD_REQUEST);
		expect(subscriptionService.save).not.toHaveBeenCalled();
	});

	it('refuses a "downgrade" to a pricier plan, which is an upgrade without a payment', async () => {
		const { downgrade, subscriptionService } = handlers();

		expect(await status(downgrade.execute(downgradeTo('premium')))).toBe(HttpStatus.PAYMENT_REQUIRED);
		expect(subscriptionService.save).not.toHaveBeenCalled();
	});

	it('still downgrades to a cheaper plan', async () => {
		const { downgrade, subscriptionService } = handlers();

		await downgrade.execute(downgradeTo('cheaper'));

		expect(subscriptionService.save).toHaveBeenCalledWith(expect.objectContaining({ planId: 'cheaper' }));
	});

	it('still lets the publisher upgrade a subscriber to a paid plan (a comp)', async () => {
		mockCaller.userId = 'publisher-1';
		const { upgrade, subscriptionService } = handlers();

		await upgrade.execute(upgradeTo('premium'));

		expect(subscriptionService.save).toHaveBeenCalledWith(expect.objectContaining({ planId: 'premium' }));
	});

	it('does not find the subscription under another plugin’s route', async () => {
		const { upgrade, subscriptionService } = handlers();

		expect(await status(upgrade.execute(upgradeTo('free', 'plugin-2')))).toBe(HttpStatus.NOT_FOUND);
		expect(subscriptionService.save).not.toHaveBeenCalled();
	});
});
