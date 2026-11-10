/**
 * `@gauzy/core` boots the whole application graph from its barrel, so it is doubled as in this package's other
 * suites. The relation converter is the real one: what it returns is what this suite is about.
 */
jest.mock('@gauzy/core', () => ({
	MultiORMEnum: { TypeORM: 'typeorm', MikroORM: 'mikro-orm' },
	getORMType: () => 'typeorm',
	parseFindOptionsRelations: jest.requireActual('@gauzy/core/src/lib/core/utils').parseFindOptionsRelations
}));

// Read at import time by the converter's module, so it is doubled too.
jest.mock('@gauzy/config', () => ({
	DatabaseTypeEnum: { sqlite: 'sqlite', betterSqlite3: 'better-sqlite3', postgres: 'postgres', mysql: 'mysql' }
}));

import { DataSource, FindOptionsUtils } from 'typeorm';
import { ISearchSourceEntity, SearchSourceConnection } from './search-source.connection';

class Product {}

const entity = {
	target: Product,
	tableName: 'product',
	className: 'Product',
	properties: new Set<string>()
} as unknown as ISearchSourceEntity;

/** A data source whose repository refuses what TypeORM refuses, and remembers what it was asked. */
function dataSourceRecording(asked: Array<Record<string, unknown>>): DataSource {
	return {
		getRepository: () => ({
			find: async (options: Record<string, unknown>) => {
				// The check TypeORM 1 runs on every find: the string-array form throws, an empty array included.
				FindOptionsUtils.rejectStringArrayRelations(options as never);
				asked.push(options);
				return [];
			}
		})
	} as unknown as DataSource;
}

/**
 * The indexer reads its source rows through this connection. It handed TypeORM the relations as the string array the
 * declarations use, which TypeORM 1 refuses ("String-array "relations" syntax has been removed"): every read threw,
 * nothing was indexed, and each event a declaration listens to (`chat_message.created`, `task.updated`, …) was
 * retried and then marked failed by the `subscriber:search-index` consumer.
 */
describe('SearchSourceConnection.find (TypeORM)', () => {
	it('names the relations as an object, nested paths included', async () => {
		const asked: Array<Record<string, unknown>> = [];
		const connection = new SearchSourceConnection(dataSourceRecording(asked));

		await expect(
			connection.find(entity, { relations: ['product', 'product.translations', 'tags'] })
		).resolves.toEqual([]);

		expect(asked).toHaveLength(1);
		expect(asked[0].relations).toEqual({ product: { translations: true }, tags: true });
	});

	it('names no relations at all when a declaration preloads none', async () => {
		const asked: Array<Record<string, unknown>> = [];
		const connection = new SearchSourceConnection(dataSourceRecording(asked));

		await expect(connection.find(entity, {})).resolves.toEqual([]);
		await expect(connection.find(entity, { relations: [] })).resolves.toEqual([]);

		expect(asked.map((options) => options.relations)).toEqual([undefined, undefined]);
	});

	it('still passes the selection, the order and the page', async () => {
		const asked: Array<Record<string, unknown>> = [];
		const connection = new SearchSourceConnection(dataSourceRecording(asked));

		await connection.find(entity, {
			equals: { tenantId: 't1' },
			relations: ['tags'],
			order: [{ field: 'updatedAt', direction: 'DESC' }],
			skip: 20,
			take: 10
		});

		expect(asked[0]).toMatchObject({
			where: { tenantId: 't1' },
			relations: { tags: true },
			order: { updatedAt: 'DESC' },
			skip: 20,
			take: 10
		});
	});
});
