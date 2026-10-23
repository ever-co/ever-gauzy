// `@gauzy/core` and the registry's barrels drag in the entity graph; the handler and the service method only need the
// repository they read through.
jest.mock('@gauzy/core', () => ({ parseFindOptionsRelations: (relations: unknown) => relations }));
jest.mock('../../../../domain', () => ({ PluginSubscriptionService: class PluginSubscriptionService {} }));
jest.mock('../../../../shared', () => ({}));
jest.mock('../../../../domain/services/registry-crud.service', () => ({
	RegistryTenantAwareCrudService: class RegistryTenantAwareCrudService {
		constructor(readonly typeOrmRepository: unknown) {}
	}
}));
jest.mock('../../../../domain/entities', () => ({ PluginSubscription: class PluginSubscription {} }));
jest.mock('../../../../domain/repositories', () => ({}));

import { PluginSubscriptionService } from '../../../../domain/services/plugin-subscription.service';
import { GetPublisherPluginSubscriptionsQuery } from '../get-publisher-plugin-subscriptions.query';
import { GetPublisherPluginSubscriptionsQueryHandler } from './get-publisher-plugin-subscriptions.handler';

/**
 * The public plugin read no longer lists a plugin's subscriptions; its publisher reads every tenant's from
 * `GET /plugins/:pluginId/subscriptions/publisher`, which `PluginOwnerGuard` keeps to the publisher.
 */
describe("the publisher's list of a plugin's subscriptions", () => {
	it('reads every subscription to the plugin, in every tenant, with its plan', async () => {
		const rows = [
			{ id: 's-b', tenantId: 'tenant-b' },
			{ id: 's-c', tenantId: 'tenant-c' }
		];
		const findAndCount = jest.fn(async () => [rows, 2]);
		const service = new PluginSubscriptionService({ findAndCount } as any, {} as any);

		const result = await new GetPublisherPluginSubscriptionsQueryHandler(service).execute(
			new GetPublisherPluginSubscriptionsQuery('plugin-1')
		);

		expect(findAndCount).toHaveBeenCalledWith({
			where: { pluginId: 'plugin-1' },
			relations: { plan: true },
			order: { createdAt: 'DESC' }
		});
		expect(result).toEqual({ items: rows, total: 2 });
	});
});
