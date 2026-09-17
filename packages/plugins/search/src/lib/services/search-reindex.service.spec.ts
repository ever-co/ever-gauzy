/**
 * `@gauzy/core` boots the whole application graph from its barrel — configuration, the ORM, the job
 * registry, the module scanner — none of which a reindex sweep needs and none of which is available
 * outside a running application. The seam is therefore doubled at the module boundary and **the sweep
 * under test is the real one**, running the real indexer over an in-memory connection and an in-memory
 * document table — so "a rebuild writes one document per source row" and "a deleted source row loses
 * its document" are statements about the pipeline rather than about a mock.
 *
 * `@gauzy/config` is read at import time by the provider's dialect detection, so it is doubled too.
 */
jest.mock('@gauzy/core', () => {
	/** A no-op decorator factory: the entities are declared but never mapped onto a database here. */
	const decorator = () => () => undefined;

	class BaseEntity {}

	return {
		TenantAwareCrudService: class {},
		CrudService: class {},
		BaseEntity,
		TenantBaseEntity: BaseEntity,
		TenantOrganizationBaseEntity: BaseEntity,
		TenantOrganizationBaseDTO: class {},
		MikroOrmBaseEntityRepository: class {},
		ColumnIndex: decorator,
		MultiORMColumn: decorator,
		MultiORMEntity: decorator,
		MultiORMManyToOne: decorator,
		MultiORMOneToMany: decorator,
		JsonColumn: decorator,
		IsSecret: decorator,
		BaseEvent: class {},
		EventBus: class {},
		EventOutboxService: class {},
		Money: jest.requireActual('@gauzy/core/src/lib/money/money').Money,
		isUniqueViolation: (error: any) => Boolean(error?.code === '23505'),
		SearchDocument: class {},
		SearchIndexDefinition: class {},
		SearchModule: class {},
		TypeOrmSearchDocumentRepository: class {},
		TypeOrmSearchIndexDefinitionRepository: class {},
		MikroOrmSearchIndexDefinitionRepository: class {},
		RequestContext: {
			currentUser: () => null,
			currentUserId: () => null,
			currentTenantId: () => null,
			currentOrganizationId: () => null,
			currentEmployeeId: () => null,
			hasPermission: () => false
		}
	};
});

jest.mock('@gauzy/config', () => ({
	DatabaseTypeEnum: {
		mongodb: 'mongodb',
		sqlite: 'sqlite',
		betterSqlite3: 'better-sqlite3',
		postgres: 'postgres',
		mysql: 'mysql'
	}
}));

import { BadRequestException } from '@nestjs/common';
import { ISearchIndexRegistration, SearchFieldKind, SearchReindexScope } from '@gauzy/contracts';
import { RequestContext } from '@gauzy/core';
import { SearchIndexRegistry } from '../registry/search-index.registry';
import { DatabaseSearchProvider } from '../providers/database-search.provider';
import { SearchProviderRegistry } from '../providers/search-provider.registry';
import { SearchIndexerService } from './search-indexer.service';
import { SearchReindexService } from './search-reindex.service';

/**
 * The reindex job: rebuild the index from the source rows, in batches, without stopping the API
 * (doc 12, doc 05 §3.18, implementation W25).
 *
 * The specification states three properties that make the sweep usable, and each is pinned here:
 *
 * - **it is idempotent by construction** — a document is keyed by `(tenant, entity, entityId, engine)`,
 *   so writing it twice writes the same row with the same content and a run that is killed mid-batch
 *   corrupts nothing;
 * - **it is version-driven** — a document whose `definitionVersion` is behind its declaration's is
 *   rebuilt, so a re-weighting takes effect without an operator asking for a full rebuild;
 * - **it removes what no longer exists** — a document whose source row has been hard-deleted is not
 *   reachable by any event, so the sweep is the only path that removes it, and that is why a
 *   document's `entityId` deliberately carries no foreign key.
 *
 * It also pins what the sweep refuses: a reindex that names no scope, a scope whose required member is
 * missing, and an entity no declaration describes.
 */

const TENANT = '00000000-0000-4000-8000-000000000001';
const ORG = '00000000-0000-4000-8000-000000000002';
const CHANNEL = 'channel-1';

type Row = Record<string, any>;

/** The subset of conditions the service states, matched the way the database would. */
function matches(row: Row, where: any = {}): boolean {
	return Object.entries(where).every(([field, expected]) => {
		if (expected === undefined) {
			return true;
		}

		if (expected === null) {
			return row[field] === null || row[field] === undefined;
		}

		if (expected && typeof expected === 'object' && '_type' in (expected as Row)) {
			const operator = expected as Row;

			switch (operator._type) {
				case 'in':
					return (operator._value as unknown[]).some((value) => String(row[field] ?? '') === String(value));
				case 'isNull':
					return row[field] === null || row[field] === undefined;
				case 'moreThanOrEqual':
					return (
						row[field] !== undefined && new Date(row[field]).getTime() >= new Date(operator._value as any).getTime()
					);
				default:
					throw new Error(`the in-memory double does not implement the "${operator._type}" operator`);
			}
		}

		return String(row[field] ?? '') === String(expected);
	});
}

/** The declarations the fixture registers: one channel-scoped entity and one that is not. */
const VARIANT: ISearchIndexRegistration = {
	entity: 'product_variant',
	label: 'Product variants',
	permission: 'ORG_INVENTORY_VIEW' as never,
	titleTemplate: '{{sku}}',
	keywordFields: ['sku'],
	sourceUpdatedAtField: 'updatedAt',
	channels: 'product_variant_channel',
	fields: [{ name: 'sku', kind: SearchFieldKind.KEYWORD, weight: 1, searchable: true, filterable: true, facetable: false }]
};
const CONTACT: ISearchIndexRegistration = {
	entity: 'organization_contact',
	label: 'Parties',
	permission: 'ORG_CONTACT_VIEW' as never,
	titleTemplate: '{{name}}',
	sourceUpdatedAtField: 'updatedAt',
	fields: [{ name: 'name', kind: SearchFieldKind.TEXT, weight: 1, searchable: true, filterable: false, facetable: false }]
};

/** A source row of the channel-scoped declaration. */
const variantRow = (id: string, overrides: Row = {}) => ({
	id,
	tenantId: TENANT,
	organizationId: ORG,
	sku: `SKU-${id}`,
	updatedAt: new Date('2026-01-15T00:00:00.000Z'),
	...overrides
});

/** A source row of the declaration that is not channel scoped. */
const contactRow = (id: string, overrides: Row = {}) => ({
	id,
	tenantId: TENANT,
	organizationId: ORG,
	name: `Party ${id}`,
	updatedAt: new Date('2026-01-15T00:00:00.000Z'),
	...overrides
});

/**
 * Builds the sweep over an in-memory connection and an in-memory document table.
 *
 * @param seed What the fixture holds, and what the persisted definitions say.
 */
function reindexFixture(
	seed: {
		variants?: Row[];
		contacts?: Row[];
		documents?: Row[];
		definitions?: Row[];
	} = {}
) {
	let sequence = 0;
	const tables = {
		product_variant: [...(seed.variants ?? [variantRow('v1'), variantRow('v2')])],
		organization_contact: [...(seed.contacts ?? [contactRow('c1')])],
		product_variant_channel: [{ id: 'pivot-1', productVariantId: 'v1', channelId: CHANNEL }],
		search_document: [...(seed.documents ?? [])]
	};

	const targets = {
		product_variant: { name: 'ProductVariant' },
		organization_contact: { name: 'OrganizationContact' },
		product_variant_channel: { name: 'ProductVariantChannel' }
	};
	const metadata = (tableName: keyof typeof targets, extra: Row = {}): any => ({
		tableName,
		name: targets[tableName].name,
		targetName: targets[tableName].name,
		target: targets[tableName],
		columns: [{ propertyName: 'id' }, { propertyName: 'updatedAt' }, { propertyName: 'tenantId' }, { propertyName: 'organizationId' }],
		relations: [],
		...extra
	});

	const dataSource: any = {
		entityMetadatas: [
			metadata('product_variant'),
			metadata('organization_contact'),
			metadata('product_variant_channel', {
				columns: [{ propertyName: 'productVariantId' }, { propertyName: 'channelId' }],
				relations: [
					{
						inverseEntityMetadata: { tableName: 'product_variant' },
						joinColumns: [{ propertyName: 'productVariantId' }]
					}
				]
			})
		],
		getRepository: (target: unknown) => {
			const tableOf = (): Row[] => {
				if (target === targets.product_variant) {
					return tables.product_variant;
				}
				if (target === targets.organization_contact) {
					return tables.organization_contact;
				}

				return tables.product_variant_channel;
			};

			return {
				find: async ({ where, order, skip, take }: any = {}) => {
					let found = tableOf().filter((row) => matches(row, where));

					if (order?.updatedAt === 'ASC' || order?.id === 'ASC') {
						found = [...found].sort((left, right) =>
							String(left.id) < String(right.id) ? -1 : String(left.id) > String(right.id) ? 1 : 0
						);
					}

					if (skip) {
						found = found.slice(skip);
					}

					return take ? found.slice(0, take) : found;
				},
				count: async ({ where }: any = {}) => tableOf().filter((row) => matches(row, where)).length
			};
		}
	};

	const documentRepository: any = {
		manager: { connection: { options: { type: 'better-sqlite3' } } },
		create: () => ({}),
		find: async ({ where, withDeleted, order, skip, take }: any = {}) => {
			let found = tables.search_document.filter((row) => (withDeleted || !row.deletedAt) && matches(row, where));

			if (order?.indexedAt === 'DESC') {
				found = [...found].sort(
					(left, right) => new Date(right.indexedAt ?? 0).getTime() - new Date(left.indexedAt ?? 0).getTime()
				);
			}

			if (skip) {
				found = found.slice(skip);
			}

			return take ? found.slice(0, take) : found;
		},
		findOne: async ({ where, order }: any = {}) => {
			const found = tables.search_document.filter((row) => matches(row, where));

			if (order?.indexedAt === 'DESC') {
				return (
					[...found].sort(
						(left, right) => new Date(right.indexedAt ?? 0).getTime() - new Date(left.indexedAt ?? 0).getTime()
					)[0] ?? null
				);
			}

			return found[0] ?? null;
		},
		count: async ({ where }: any = {}) => tables.search_document.filter((row) => matches(row, where)).length,
		save: async (rowOrRows: any) => {
			const list = Array.isArray(rowOrRows) ? rowOrRows : [rowOrRows];

			for (const row of list) {
				const index = row.id ? tables.search_document.findIndex((candidate) => candidate.id === row.id) : -1;

				if (index >= 0) {
					tables.search_document[index] = { ...tables.search_document[index], ...row };
					continue;
				}

				row.id = row.id ?? `document-${++sequence}`;
				tables.search_document.push(row);
			}

			return Array.isArray(rowOrRows) ? list : list[0];
		},
		softDelete: async (criteria: any) => {
			let affected = 0;

			for (const row of tables.search_document) {
				if (matches(row, criteria) && !row.deletedAt) {
					row.deletedAt = new Date();
					affected += 1;
				}
			}

			return { affected };
		}
	};

	const indexRegistry = new SearchIndexRegistry(dataSource);

	indexRegistry.register(VARIANT);
	indexRegistry.register(CONTACT);

	const provider = new DatabaseSearchProvider(documentRepository, indexRegistry);
	const providerRegistry = new SearchProviderRegistry(provider);
	const indexer = new SearchIndexerService(dataSource, indexRegistry, providerRegistry, { findOne: async () => null } as never);
	const definitionService = {
		findFor: async (entity: string) => (seed.definitions ?? []).find((row) => row.entity === entity) ?? null
	};

	const service = new SearchReindexService(indexer, indexRegistry, definitionService as never, documentRepository);

	return {
		service,
		indexer,
		registry: indexRegistry,
		tables,
		documents: () => tables.search_document.filter((row) => !row.deletedAt),
		allDocuments: () => tables.search_document
	};
}

describe('SearchReindexService — the scope a request states (doc 12)', () => {
	beforeEach(() => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(ORG);
	});

	afterEach(() => jest.restoreAllMocks());

	it('rebuilds every registered entity for a whole-installation scope', async () => {
		const fixture = reindexFixture();

		const runs = await fixture.service.run({ scope: SearchReindexScope.ALL } as never);

		expect(runs.map((run) => run.entity)).toEqual(['product_variant', 'organization_contact']);
		expect(runs.reduce((total, run) => total + run.indexed, 0)).toBe(3);
		expect(fixture.documents()).toHaveLength(3);
	});

	it('rebuilds one entity for an entity scope, and refuses one nothing declares', async () => {
		const fixture = reindexFixture();

		const runs = await fixture.service.run({ scope: SearchReindexScope.ENTITY, entity: 'organization_contact' } as never);

		expect(runs).toHaveLength(1);
		expect(runs[0]).toMatchObject({ entity: 'organization_contact', indexed: 1, batches: 1 });
		expect(fixture.documents().map((document) => document.entity)).toEqual(['organization_contact']);

		await expect(
			fixture.service.run({ scope: SearchReindexScope.ENTITY, entity: 'nothing_declares_this' } as never)
		).rejects.toBeInstanceOf(BadRequestException);
	});

	it('covers only the declarations that are channel scoped for a channel scope', async () => {
		// "an entity that is not published into one is indexed exactly once and is not rebuilt per channel".
		const fixture = reindexFixture();

		const runs = await fixture.service.run({ scope: SearchReindexScope.CHANNEL, channelId: CHANNEL } as never);

		expect(runs.map((run) => run.entity)).toEqual(['product_variant']);
	});

	it.each([
		['a scope it does not state', { }],
		['an entity scope with no entity', { scope: SearchReindexScope.ENTITY }],
		['a channel scope with no channel', { scope: SearchReindexScope.CHANNEL }]
	])('refuses %s', async (_label, request) => {
		const fixture = reindexFixture();

		await expect(fixture.service.run(request as never)).rejects.toBeInstanceOf(BadRequestException);
		await expect(fixture.service.plan(request as never)).rejects.toBeInstanceOf(BadRequestException);
	});
});

describe('SearchReindexService — the plan (doc 12)', () => {
	beforeEach(() => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(ORG);
	});

	afterEach(() => jest.restoreAllMocks());

	it('counts the source rows the scope covers rather than guessing them', async () => {
		// "a request that is about to scan five million rows should say so before it starts, not after".
		const fixture = reindexFixture();

		expect(await fixture.service.plan({ scope: SearchReindexScope.ALL } as never)).toMatchObject({
			queued: true,
			estimatedCount: 3
		});
		expect(await fixture.service.plan({ scope: SearchReindexScope.ENTITY, entity: 'product_variant' } as never)).toMatchObject({
			entity: 'product_variant',
			estimatedCount: 2
		});
	});
});

describe('SearchReindexService — the run (doc 12, doc 05 §3.18)', () => {
	beforeEach(() => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(ORG);
	});

	afterEach(() => jest.restoreAllMocks());

	it('is idempotent: running the sweep twice produces the same documents', async () => {
		// "Upsert by `(tenantId, entity, entityId, engineKey)`. Running the job twice produces the same
		// content."
		const fixture = reindexFixture();

		await fixture.service.run({ scope: SearchReindexScope.ALL } as never);
		const again = await fixture.service.run({ scope: SearchReindexScope.ALL } as never);

		expect(again.reduce((total, run) => total + run.indexed, 0)).toBe(3);
		expect(fixture.documents()).toHaveLength(3);
		expect(fixture.allDocuments()).toHaveLength(3);
	});

	it('removes the document of a source row that no longer exists, which no event can reach', async () => {
		// "A document whose source row has been hard-deleted is not reachable by any event, so the sweep is
		// the only path that removes it."
		const fixture = reindexFixture();

		await fixture.service.run({ scope: SearchReindexScope.ENTITY, entity: 'product_variant' } as never);
		expect(fixture.documents()).toHaveLength(2);

		fixture.tables.product_variant = fixture.tables.product_variant.filter((row) => row.id !== 'v2');

		const runs = await fixture.service.run({ scope: SearchReindexScope.ENTITY, entity: 'product_variant' } as never);

		expect(runs[0].removed).toBe(1);
		expect(fixture.documents().map((document) => document.entityId)).toEqual(['v1']);
	});

	it('reports what a document was stamped with, so a re-weighting is a rebuild rather than a full reindex', async () => {
		// The document carries the definition version it was built at, and the sweep stamps the version the
		// persisted definition is at — which is what makes a rebuilt declaration take effect.
		const fixture = reindexFixture({ definitions: [{ entity: 'product_variant', version: 4, isActive: true }] });

		await fixture.service.run({ scope: SearchReindexScope.ENTITY, entity: 'product_variant' } as never);

		expect(fixture.documents().every((document) => document.definitionVersion === 4)).toBe(true);
	});

	it('drops the documents of an inactive definition so re-activating it starts from a clean index', async () => {
		const fixture = reindexFixture({ definitions: [{ entity: 'product_variant', version: 1, isActive: false }] });

		await fixture.service.run({ scope: SearchReindexScope.ALL } as never);

		const runs = await fixture.service.run({ scope: SearchReindexScope.ALL } as never);

		expect(runs.find((run) => run.entity === 'product_variant')).toMatchObject({ indexed: 0, batches: 0 });
		expect(fixture.documents().map((document) => document.entity)).toEqual(['organization_contact']);
	});

	it('carries on with the other entities when one declaration cannot be swept', async () => {
		// "One entity that cannot be swept must not abandon the others: the run reports what it did and the
		// failure is visible where the entity is, rather than only in a summary."
		const fixture = reindexFixture();

		fixture.indexer.index = async (entity: string) => {
			if (entity === 'product_variant') {
				throw new Error('the source table is unreachable');
			}

			return { entity, indexed: 1, removed: 0, skipped: 0, providerKey: 'database' };
		};
		fixture.indexer.readSourceRows = async () => [];

		const runs = await fixture.service.run({ scope: SearchReindexScope.ALL } as never);

		expect(runs.find((run) => run.entity === 'product_variant')).toMatchObject({ indexed: 0, batches: 0 });
		expect(runs.find((run) => run.entity === 'organization_contact')).toMatchObject({ indexed: 1 });
	});
});

describe('SearchReindexService — the freshness report (doc 12)', () => {
	beforeEach(() => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(ORG);
	});

	afterEach(() => jest.restoreAllMocks());

	it('distinguishes an index that holds nothing from one that is behind', async () => {
		// "the first is an indexed count of zero, the second a pending count that is not zero, and they call
		// for different actions".
		const fixture = reindexFixture({ contacts: [] });

		const before = await fixture.service.status(['product_variant']);

		expect(before[0]).toMatchObject({ entity: 'product_variant', indexedCount: 0, pendingCount: 2 });
		expect(before[0].lastIndexedAt).toBeUndefined();

		await fixture.service.run({ scope: SearchReindexScope.ENTITY, entity: 'product_variant' } as never);

		const after = await fixture.service.status(['product_variant']);

		expect(after[0].indexedCount).toBe(2);
		expect(after[0].lastIndexedAt).toBeInstanceOf(Date);
		expect(after[0].lagSeconds).toBeGreaterThanOrEqual(0);
	});

	it('reports every registered entity when none is named', async () => {
		const fixture = reindexFixture();

		expect((await fixture.service.status()).map((status) => status.entity)).toEqual([
			'product_variant',
			'organization_contact'
		]);
	});
});

describe('SearchReindexService — dropping an index (doc 12)', () => {
	beforeEach(() => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(ORG);
	});

	afterEach(() => jest.restoreAllMocks());

	it('drops one entity’s documents and leaves the others alone', async () => {
		const fixture = reindexFixture();

		await fixture.service.run({ scope: SearchReindexScope.ALL } as never);

		const dropped = await fixture.service.drop('product_variant');

		expect(dropped.deletedCount).toBe(2);
		expect(fixture.documents().map((document) => document.entity)).toEqual(['organization_contact']);
		// The rows are soft-deleted rather than destroyed: the next reindex revives them.
		expect(fixture.allDocuments()).toHaveLength(3);
	});

	it('drops one channel’s documents by their promoted token rather than by a column', async () => {
		// The document table has no channel column, so the channel is carried as a promoted token and the
		// drop reads it from there.
		const fixture = reindexFixture();

		await fixture.service.run({ scope: SearchReindexScope.ALL } as never);

		const dropped = await fixture.service.drop('product_variant', CHANNEL);

		expect(dropped.deletedCount).toBe(1);
		// The other declaration's documents are untouched: a drop is scoped to one entity and one channel.
		expect(fixture.documents().map((document) => document.entityId).sort()).toEqual(['c1', 'v2']);
	});

	it('refuses to drop an entity nothing declares', async () => {
		const fixture = reindexFixture();

		await expect(fixture.service.drop('nothing_declares_this')).rejects.toThrow(/holds no documents/);
	});
});
