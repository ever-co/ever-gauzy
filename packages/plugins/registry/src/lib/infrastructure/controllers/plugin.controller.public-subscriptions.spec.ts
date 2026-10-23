// The registry's barrels drag in the entity graph through `@gauzy/core`; the public controller only needs its
// decorators and the queries it hands its options to.
jest.mock('@gauzy/common', () => ({ Public: () => () => undefined }));
jest.mock('@gauzy/core', () => ({
	UseValidationPipe: () => () => undefined,
	UUIDValidationPipe: class UUIDValidationPipe {}
}));
jest.mock('../../application', () => {
	class Query {
		constructor(...args: unknown[]) {
			Object.assign(this, { args });
		}
	}
	return {
		GetPluginQuery: class GetPluginQuery extends Query {},
		ListPluginsQuery: class ListPluginsQuery extends Query {},
		SearchPluginsQuery: class SearchPluginsQuery extends Query {}
	};
});
jest.mock('../../domain', () => ({ Plugin: class Plugin {} }));
jest.mock('../../shared', () => ({
	PluginQueryOptions: class PluginQueryOptions {},
	PluginSearchFilterDTO: class PluginSearchFilterDTO {}
}));

import { PluginController } from './plugin.controller';

/** The public controller, and the options of the last query it ran. */
function publicController() {
	const executed: Array<{ constructor: { name: string }; args: unknown[] }> = [];
	const queryBus = { execute: jest.fn(async (query) => (executed.push(query), {})) };
	return { controller: new PluginController(queryBus as any), executed };
}

/**
 * `GET /plugins/:id?relations[]=subscriptions` and `GET /plugins?relations[subscriptions]=…` are public: any visitor
 * read every tenant's subscriptions to a plugin (tenant, subscriber, status, dates and plan), and their ids opened
 * the billing routes of those tenants. A caller reads their own subscription from the signed-in `.../subscriptions/me`.
 */
describe('the public plugin read leaves out every subscription', () => {
	it('does not load subscriptions, or anything under them, on a read by id', async () => {
		const { controller, executed } = publicController();

		await controller.findById('plugin-1', {
			relations: [
				'versions',
				'subscriptions',
				'subscriptions.plan',
				'subscriptions.subscriber',
				' subscriptions.billings',
				'category'
			]
		} as any);

		const [id, options] = executed[0].args as [string, { relations: string[] }];
		expect(executed[0].constructor.name).toBe('GetPluginQuery');
		expect(id).toBe('plugin-1');
		expect(options.relations).toEqual(['versions', 'category']);
	});

	it('does not filter a read by id on a subscription, which would tell whether a hidden one matches', async () => {
		const { controller, executed } = publicController();

		await controller.findById('plugin-1', {
			where: { subscriptions: { subscriberId: 'user-of-tenant-b' }, name: 'Timer' }
		} as any);

		const [, options] = executed[0].args as [string, { where: Record<string, unknown> }];
		expect(options.where).toEqual({ name: 'Timer' });
	});

	it('does not load subscriptions on the list, in the object form the query DTO gives its relations', async () => {
		const { controller, executed } = publicController();

		await controller.findAll({
			relations: { versions: { sources: true }, subscriptions: { plan: true, billings: true } },
			where: [{ subscriptions: { tenantId: 'tenant-b' } }, { name: 'Timer' }]
		} as any);

		const [params] = executed[0].args as [{ relations: object; where: object[] }];
		expect(executed[0].constructor.name).toBe('ListPluginsQuery');
		expect(params.relations).toEqual({ versions: { sources: true } });
		expect(params.where).toEqual([{}, { name: 'Timer' }]);
	});

	it('still loads the relations the marketplace shows', async () => {
		const { controller, executed } = publicController();

		await controller.findById('plugin-1', {
			relations: ['versions', 'versions.sources', 'category', 'uploadedBy']
		} as any);

		const [, options] = executed[0].args as [string, { relations: string[] }];
		expect(options.relations).toEqual(['versions', 'versions.sources', 'category', 'uploadedBy']);
	});
});
