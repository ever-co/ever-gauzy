// `@gauzy/core` and the registry's barrels drag in the entity graph; the route's decorators are what is checked.
jest.mock('@gauzy/core', () => ({
	PermissionGuard: class PermissionGuard {},
	Permissions: () => () => undefined,
	RequestContext: {},
	TenantPermissionGuard: class TenantPermissionGuard {}
}));
jest.mock('../../core', () => ({ PluginOwnerGuard: class PluginOwnerGuard {} }));
jest.mock('../../application', () => {
	class Message {
		constructor(...args: unknown[]) {
			Object.assign(this, { args });
		}
	}
	return {
		CancelPluginSubscriptionCommand: class extends Message {},
		DeletePluginSubscriptionCommand: class extends Message {},
		DowngradePluginSubscriptionCommand: class extends Message {},
		GetActivePluginSubscriptionQuery: class extends Message {},
		GetPluginSubscriptionByIdQuery: class extends Message {},
		GetPluginSubscriptionsByPluginIdQuery: class extends Message {},
		GetPluginSubscriptionsBySubscriberIdQuery: class extends Message {},
		GetPublisherPluginSubscriptionsQuery: class GetPublisherPluginSubscriptionsQuery extends Message {},
		PurchasePluginSubscriptionCommand: class extends Message {},
		RenewPluginSubscriptionCommand: class extends Message {},
		UpdatePluginSubscriptionCommand: class extends Message {},
		UpgradePluginSubscriptionCommand: class extends Message {}
	};
});
jest.mock('../../domain', () => ({ PluginSubscription: class PluginSubscription {} }));
jest.mock('../../shared', () => ({
	PluginSubscriptionQueryDTO: class PluginSubscriptionQueryDTO {},
	PurchasePluginSubscriptionDTO: class PurchasePluginSubscriptionDTO {},
	UpdatePluginSubscriptionDTO: class UpdatePluginSubscriptionDTO {}
}));

import { GUARDS_METADATA } from '@nestjs/common/constants';
import { PluginOwnerGuard } from '../../core';
import { PluginSubscriptionController } from './plugin-subscription.controller';

describe('GET /plugins/:pluginId/subscriptions/publisher', () => {
	it("is kept to the plugin's publisher by PluginOwnerGuard", () => {
		expect(
			Reflect.getMetadata(GUARDS_METADATA, PluginSubscriptionController.prototype.findAllForPublisher)
		).toContain(PluginOwnerGuard);
	});

	it("asks for every subscription to the route's plugin", async () => {
		const queryBus = { execute: jest.fn(async () => ({ items: [], total: 0 })) };
		const controller = new PluginSubscriptionController({} as any, queryBus as any);

		await controller.findAllForPublisher('plugin-1');

		const [query] = queryBus.execute.mock.calls[0] as unknown as [
			{ constructor: { name: string }; args: unknown[] }
		];
		expect(query.constructor.name).toBe('GetPublisherPluginSubscriptionsQuery');
		expect(query.args).toEqual(['plugin-1']);
	});
});
