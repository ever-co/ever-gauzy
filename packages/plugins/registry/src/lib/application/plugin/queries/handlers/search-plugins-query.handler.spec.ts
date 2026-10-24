// The registry's domain and shared barrels drag in the entity graph through `@gauzy/core`. The handler only
// needs the ORM enum, the LIKE operator (as resolved on a non-PostgreSQL database) and the sort allowlists.
jest.mock('@gauzy/core', () => ({
	LIKE_OPERATOR: 'LIKE',
	MultiORMEnum: { TypeORM: 'typeorm', MikroORM: 'mikro-orm' }
}));
jest.mock('../../../../domain', () => ({ PluginService: class PluginService {} }));
jest.mock('../../../../shared', () => ({
	PLUGIN_SORTABLE_FIELDS: ['name', 'author', 'uploadedAt', 'lastDownloadedAt', 'downloadCount', 'createdAt', 'updatedAt'],
	PLUGIN_SORT_DIRECTIONS: ['ASC', 'DESC']
}));

import { SearchPluginsQuery } from '../search-plugins.query';
import { SearchPluginsQueryHandler } from './search-plugins-query.handler';

/**
 * A chainable stand-in for a query builder: every call is recorded and answers the builder itself, and
 * awaiting it answers `result`. `where(fn)` runs the grouped callback against the builder, as Knex does.
 */
function recordingBuilder(result: unknown) {
	const calls: [string, unknown[]][] = [];
	const builder: any = new Proxy(
		{} as Record<string, unknown>,
		{
			get: (target, name: string) => {
				if (name in target) {
					return target[name];
				}
				if (name === 'then') {
					return (resolve: (value: unknown) => void) => resolve(result);
				}
				return (...args: unknown[]) => {
					calls.push([name, args]);
					if (typeof args[0] === 'function') {
						args[0].call(builder);
					}
					return builder;
				};
			}
		}
	);
	return { builder, calls };
}

const FILTERS = { search: 'time', description: 'track', author: 'ever', license: 'mit' } as any;

describe('SearchPluginsQueryHandler text filters', () => {
	it('builds the TypeORM conditions with LIKE_OPERATOR instead of a hard-coded ILIKE', async () => {
		const { builder, calls } = recordingBuilder(undefined);
		builder.getManyAndCount = jest.fn().mockResolvedValue([[], 0]);
		const pluginService = {
			ormType: 'typeorm',
			typeOrmPluginRepository: { createQueryBuilder: () => builder }
		};

		await new SearchPluginsQueryHandler(pluginService as any).execute(new SearchPluginsQuery(FILTERS));

		const conditions = calls.filter(([name]) => name === 'andWhere').map(([, [condition]]) => condition);
		expect(conditions).toEqual([
			'(plugin.name LIKE :search OR plugin.description LIKE :search OR plugin.author LIKE :search)',
			'plugin.description LIKE :description',
			'plugin.author LIKE :author',
			'plugin.license LIKE :license'
		]);
	});

	it('builds the Knex conditions with LIKE_OPERATOR instead of a hard-coded ILIKE', async () => {
		const { builder, calls } = recordingBuilder([]);
		const knex = jest.fn(() => builder);
		const pluginService = {
			ormType: 'mikro-orm',
			mikroOrmPluginRepository: { getKnex: () => knex }
		};

		await new SearchPluginsQueryHandler(pluginService as any).execute(new SearchPluginsQuery(FILTERS));

		const operators = calls
			.filter(([name, args]) => ['where', 'orWhere', 'andWhere'].includes(name) && args.length === 3)
			.map(([, [column, operator]]) => [column, operator]);
		expect(operators).toEqual([
			['plugins.name', 'LIKE'],
			['plugins.description', 'LIKE'],
			['plugins.author', 'LIKE'],
			['plugins.description', 'LIKE'],
			['plugins.author', 'LIKE'],
			['plugins.license', 'LIKE']
		]);
	});
});
