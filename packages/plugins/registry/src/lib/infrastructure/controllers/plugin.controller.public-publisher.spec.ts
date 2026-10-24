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
import { publicPublisher, withPublicPublisher, withPublicPublishers } from './public-plugin-publisher';

/** A publisher's user row, as `relations[]=uploadedBy` loads it. */
function publisherRow() {
	return {
		id: 'user-1',
		firstName: 'Ada',
		lastName: 'Lovelace',
		name: 'Ada Lovelace',
		imageUrl: 'https://cdn.example.com/ada.png',
		email: 'ada@example.com',
		phoneNumber: '+44 20 7946 0000',
		username: 'ada',
		timeZone: 'Europe/London',
		lastLoginAt: new Date('2026-10-23T08:00:00Z'),
		uiPreferences: { theme: 'dark' },
		thirdPartyId: 'github-42',
		roleId: 'role-1',
		tenantId: 'tenant-1',
		defaultTeamId: 'team-1',
		lastOrganizationId: 'organization-1',
		imageId: 'image-1',
		image: { id: 'image-1', tenantId: 'tenant-1', organizationId: 'organization-1', url: 'ada.png' }
	};
}

/** What the marketplace shows of that publisher: who it is, the name on the badge and the avatar. */
const PUBLIC_PUBLISHER = {
	id: 'user-1',
	firstName: 'Ada',
	lastName: 'Lovelace',
	name: 'Ada Lovelace',
	imageUrl: 'https://cdn.example.com/ada.png'
};

/** The public controller over a store that answers `answer`, and the queries it ran. */
function publicController(answer: () => unknown) {
	const executed: Array<{ constructor: { name: string }; args: unknown[] }> = [];
	const queryBus = { execute: jest.fn(async (query) => (executed.push(query), answer())) };
	return { controller: new PluginController(queryBus as any), executed };
}

/**
 * `GET /plugins?relations[]=uploadedBy` and `GET /plugins/:id?relations[]=uploadedBy` are public, and the relation is
 * the publisher's whole user row: any visitor read every publisher's e-mail, phone number, username, last sign-in, UI
 * preferences, role, tenant and teams. The marketplace shows the publisher's name and checks its id.
 */
describe('the public plugin read shows the public fields of the publisher only', () => {
	it('keeps the id, the name and the avatar of a publisher, and nothing else', () => {
		expect(publicPublisher(publisherRow() as any)).toEqual(PUBLIC_PUBLISHER);
		expect(publicPublisher(null)).toBeNull();
		expect(publicPublisher(undefined)).toBeUndefined();
	});

	it('GET /plugins answers the public fields of the publisher of every plugin of the page', async () => {
		const { controller, executed } = publicController(() => ({
			items: [
				{ id: 'plugin-1', name: 'Timer', uploadedBy: publisherRow() },
				{ id: 'plugin-2', name: 'Camshot', uploadedBy: null },
				{ id: 'plugin-3', name: 'Soundshot' }
			],
			total: 3
		}));

		const page = await controller.findAll({ relations: ['versions', 'uploadedBy'] } as any);

		expect(executed[0].constructor.name).toBe('ListPluginsQuery');
		expect((executed[0].args[0] as { relations: string[] }).relations).toEqual(['versions', 'uploadedBy']);
		expect(page.items[0].uploadedBy).toEqual(PUBLIC_PUBLISHER);
		expect(page.items[1].uploadedBy).toBeNull();
		expect(page.items[2]).not.toHaveProperty('uploadedBy');
		expect(page.total).toBe(3);
		expect(JSON.stringify(page)).not.toContain('ada@example.com');
	});

	it('GET /plugins?search= does the same for the search', async () => {
		const { controller, executed } = publicController(() => ({
			items: [{ id: 'plugin-1', name: 'Timer', uploadedBy: publisherRow() }],
			total: 1
		}));

		const page = await controller.findAll({ search: 'timer', relations: ['uploadedBy'] } as any);

		expect(executed[0].constructor.name).toBe('SearchPluginsQuery');
		expect(page.items[0].uploadedBy).toEqual(PUBLIC_PUBLISHER);
	});

	it('GET /plugins/:id answers the public fields of its publisher, and the rest of the plugin as it was', async () => {
		const { controller } = publicController(() => ({
			id: 'plugin-1',
			name: 'Timer',
			uploadedById: 'user-1',
			uploadedBy: publisherRow()
		}));

		const plugin = await controller.findById('plugin-1', { relations: ['uploadedBy'] } as any);

		expect(plugin).toEqual({ id: 'plugin-1', name: 'Timer', uploadedById: 'user-1', uploadedBy: PUBLIC_PUBLISHER });
	});

	it('changes the plugin in place, so it keeps the entity class the serializer reads', () => {
		class PluginEntity {
			uploadedBy = publisherRow();
		}
		const plugin = new PluginEntity();

		expect(withPublicPublisher(plugin)).toBe(plugin);
		expect(plugin).toBeInstanceOf(PluginEntity);
		expect(plugin.uploadedBy).toEqual(PUBLIC_PUBLISHER);
		expect(withPublicPublishers({ items: [plugin], total: 1 }).items[0]).toBe(plugin);
	});

	it('leaves an answer that is not a page or a plugin as it came', () => {
		expect(withPublicPublishers(undefined as any)).toBeUndefined();
		expect(withPublicPublisher(null)).toBeNull();
	});
});

/**
 * `GET /plugins?withDeleted=true` listed the plugins their publishers had deleted, with their deleted versions and
 * sources, to any visitor. A public read answers live plugins; the flag is ignored rather than refused, so a client
 * sending `withDeleted=false` keeps working.
 */
describe('the public plugin read answers live plugins only', () => {
	it('GET /plugins ignores withDeleted', async () => {
		const { controller, executed } = publicController(() => ({ items: [], total: 0 }));

		await controller.findAll({ withDeleted: true, take: 10 } as any);

		const [params] = executed[0].args as [Record<string, unknown>];
		expect(executed[0].constructor.name).toBe('ListPluginsQuery');
		expect(params.withDeleted).toBeUndefined();
		expect(params.take).toBe(10);
	});

	it('GET /plugins?search= ignores it too', async () => {
		const { controller, executed } = publicController(() => ({ items: [], total: 0 }));

		await controller.findAll({ search: 'timer', withDeleted: 'true' } as any);

		const [filters] = executed[0].args as [Record<string, unknown>];
		expect(executed[0].constructor.name).toBe('SearchPluginsQuery');
		expect(filters.withDeleted).toBeUndefined();
		expect(filters.search).toBe('timer');
	});

	it('GET /plugins/:id ignores it', async () => {
		const { controller, executed } = publicController(() => ({ id: 'plugin-1' }));

		await controller.findById('plugin-1', { withDeleted: true, relations: ['versions'] } as any);

		const [id, options] = executed[0].args as [string, Record<string, unknown>];
		expect(id).toBe('plugin-1');
		expect(options.withDeleted).toBeUndefined();
		expect(options.relations).toEqual(['versions']);
	});
});
