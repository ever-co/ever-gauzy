/**
 * The plugin's metadata, read the way the platform reads it at boot (`getEntitiesFromPlugins`,
 * `getMigrationsFromPlugins`). A factory given for `entities` is not resolved by the platform, so the
 * ORMs never received the plugin's tables and the API stopped at boot with MikroORM's "Metadata for
 * entity EverWorksConnection not found" — only a real boot showed it. This pins the shape.
 */
// The module graph (controllers, services, core) is not needed to read the plugin's metadata.
jest.mock('./ever-works.module', () => {
	class EverWorksConnection {}
	class EverWorksModule {}
	class EverWorksTeamSubscriber {}
	return { EverWorksModule, EVER_WORKS_ENTITIES: [EverWorksConnection], EVER_WORKS_SUBSCRIBERS: [EverWorksTeamSubscriber] };
});
jest.mock('./database/migrations/1791000001100-CreateEverWorksConnection', () => ({
	CreateEverWorksConnection1791000001100: class CreateEverWorksConnection1791000001100 {}
}));

import 'reflect-metadata';
import { getEntitiesFromPlugins, getMigrationsFromPlugins, getSubscribersFromPlugins } from '@gauzy/plugin';
import { EVER_WORKS_ENTITIES, EVER_WORKS_SUBSCRIBERS } from './ever-works.module';
import { EVER_WORKS_MIGRATIONS, IntegrationEverWorksPlugin } from './integration-ever-works.plugin';

describe('IntegrationEverWorksPlugin metadata', () => {
	it('hands every entity to the platform (as the boot collects them)', () => {
		const entities = getEntitiesFromPlugins([IntegrationEverWorksPlugin]);
		expect(entities).toEqual(EVER_WORKS_ENTITIES);
		expect(entities.every((entity) => typeof entity === 'function' && entity.name !== '')).toBe(true);
	});

	it('hands every entity subscriber to the platform', () => {
		expect(getSubscribersFromPlugins([IntegrationEverWorksPlugin])).toEqual(EVER_WORKS_SUBSCRIBERS);
	});

	it('hands every migration to the platform', () => {
		expect(getMigrationsFromPlugins([IntegrationEverWorksPlugin])).toEqual(EVER_WORKS_MIGRATIONS);
	});
});
