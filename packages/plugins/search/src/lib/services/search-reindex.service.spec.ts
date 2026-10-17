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
			hasPermission: () => false,
			hasRoles: () => false
		},
		// The source connection asks which ORM is configured before it reads; the double answers
		// TypeORM, which is the arm these suites exercise through their in-memory connection.
		MultiORMEnum: { TypeORM: 'typeorm', MikroORM: 'mikro-orm' },
		getORMType: () => 'typeorm'
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
import { SearchSourceConnection } from './search-source.connection';
import { SearchReindexService } from './search-reindex.service';
import { SEARCH_SETTING_DEFAULTS } from '../search.settings';

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
				case 'lessThan':
					// The stale-document count compares the definition version a document was stamped with
					// against the one the sweep wrote, which is the one read the version column exists for.
					return row[field] !== undefined && Number(row[field]) < Number(operator._value);
				case 'moreThan':
					// The sweeps page by a cursor on the row's own id rather than by an offset, because the
					// set an offset counts into is the set they are shrinking.
					return row[field] !== undefined && String(row[field]) > String(operator._value);
				case 'not':
					// `NOT IN` never matches a NULL, as in SQL: the drop that keeps some organizations states
					// the unowned documents in a statement of their own.
					return (
						row[field] !== null && row[field] !== undefined && !matches(row, { [field]: operator._value })
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
		// The stale count's one grouped read: live documents of an entity behind a version, per organization and
		// version (the builder states exactly these predicates).
		createQueryBuilder: () => {
			const params: Row = {};
			const builder: any = {
				select: () => builder,
				addSelect: () => builder,
				where: (_sql: string, values: Row = {}) => (Object.assign(params, values), builder),
				andWhere: (_sql: string, values: Row = {}) => (Object.assign(params, values), builder),
				groupBy: () => builder,
				addGroupBy: () => builder,
				getRawMany: async () => {
					const groups = new Map<string, Row>();

					for (const row of tables.search_document) {
						if (
							row.deletedAt ||
							row.entity !== params.entity ||
							!(Number(row.definitionVersion) < Number(params.ceiling)) ||
							(params.tenantId && row.tenantId !== params.tenantId)
						) {
							continue;
						}

						const key = `${row.organizationId ?? ''}|${row.definitionVersion}`;
						const group = groups.get(key) ?? {
							organizationId: row.organizationId ?? null,
							definitionVersion: row.definitionVersion,
							count: 0
						};

						group.count += 1;
						groups.set(key, group);
					}

					return [...groups.values()];
				}
			};

			return builder;
		},
		find: async ({ where, withDeleted, order, skip, take }: any = {}) => {
			let found = tables.search_document.filter((row) => (withDeleted || !row.deletedAt) && matches(row, where));

			if (order?.indexedAt === 'DESC') {
				found = [...found].sort(
					(left, right) => new Date(right.indexedAt ?? 0).getTime() - new Date(left.indexedAt ?? 0).getTime()
				);
			}

			if (order?.id === 'ASC') {
				// The order the cursor paging depends on: a cursor is only monotonic over a total order.
				found = [...found].sort((left, right) => String(left.id).localeCompare(String(right.id)));
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
	// The indexer reads the persisted definitions itself: the shipped row for the engine and the switch, and the
	// organizations' own copies for the rows of a batch (Q16).
	const definitionRepository = {
		findOne: async ({ where }: any = {}) =>
			(seed.definitions ?? []).find((row) => row.entity === where?.entity && !row.organizationId) ?? null,
		find: async ({ where }: any = {}) => (seed.definitions ?? []).filter((row) => matches(row, where))
	};
	const indexer = new SearchIndexerService(
		new SearchSourceConnection(dataSource),
		indexRegistry,
		providerRegistry,
		definitionRepository as never
	);
	const definitionService = {
		platformDefinitionOf: async (entity: string) =>
			(seed.definitions ?? []).find((row) => row.entity === entity && !row.organizationId) ?? null,
		organizationCopies: async (entity: string, tenantId?: string | null) =>
			(seed.definitions ?? []).filter(
				(row) => row.entity === entity && !!row.organizationId && (!tenantId || row.tenantId === tenantId)
			),
		// The caller's organization's own row wins and the platform row is the fallback, as `findFor` resolves them.
		findFor: async (entity: string) => {
			const rows = (seed.definitions ?? []).filter((row) => row.entity === entity);
			const organization = RequestContext.currentOrganizationId();

			return (
				rows.find((row) => !!organization && row.organizationId === organization) ??
				rows.find((row) => !row.organizationId) ??
				null
			);
		},
		inactiveOrganizationCopies: async (entity: string, tenantId?: string | null) =>
			(seed.definitions ?? []).filter(
				(row) =>
					row.entity === entity &&
					!!row.organizationId &&
					row.isActive === false &&
					(!tenantId || row.tenantId === tenantId)
			)
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

	it('leaves another tenant’s documents of the same entity alone', async () => {
		// The defect: neither the read nor the `softDelete` carried a tenant, so an operator in tenant A
		// dropping an entity's index emptied tenant B's index for the same entity.
		const fixture = reindexFixture();

		await fixture.service.run({ scope: SearchReindexScope.ALL } as never);
		fixture.tables.search_document.push(foreignDocument());

		const dropped = await fixture.service.drop('product_variant');

		expect(dropped.deletedCount).toBe(2);
		expect(fixture.documents().some((document) => document.id === 'foreign')).toBe(true);
	});

	it('leaves another tenant’s documents alone when one channel is dropped', async () => {
		const fixture = reindexFixture();

		await fixture.service.run({ scope: SearchReindexScope.ALL } as never);
		fixture.tables.search_document.push(foreignDocument());

		const dropped = await fixture.service.drop('product_variant', CHANNEL);

		expect(dropped.deletedCount).toBe(1);
		expect(fixture.documents().some((document) => document.id === 'foreign')).toBe(true);
	});
});

/**
 * One document of another tenant, carrying the same entity, the same source id and the same channel
 * token as the fixture's own — which is exactly the row an unscoped drop used to take with it.
 *
 * @returns The document row.
 */
function foreignDocument(): Row {
	return {
		id: 'foreign',
		entity: 'product_variant',
		entityId: 'v1',
		title: 'A document of another tenant',
		body: null,
		keywords: [`channelid:${CHANNEL}`],
		attributes: null,
		tenantId: 'another-tenant',
		organizationId: ORG,
		definitionVersion: 1,
		indexedAt: new Date('2026-01-01T00:00:00.000Z')
	};
}

/**
 * Runs a body with a smaller reindex batch, so a paging defect is reproducible in a handful of rows
 * rather than in five hundred.
 *
 * The settings object is the documented fallback the services are written against, and a test that
 * needs a different page size has to state it somewhere; overriding it here and restoring it
 * afterwards keeps the override out of every other suite.
 *
 * @param size The batch size to run with.
 * @param body The test body.
 */
async function withBatchSize(size: number, body: () => Promise<void>): Promise<void> {
	const original = SEARCH_SETTING_DEFAULTS.reindexBatchSize;

	Object.defineProperty(SEARCH_SETTING_DEFAULTS, 'reindexBatchSize', {
		value: size,
		configurable: true,
		writable: true
	});

	try {
		await body();
	} finally {
		Object.defineProperty(SEARCH_SETTING_DEFAULTS, 'reindexBatchSize', {
			value: original,
			configurable: true,
			writable: true
		});
	}
}

describe('SearchReindexService — what a paged sweep must not do to the documents it just wrote', () => {
	beforeEach(() => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(ORG);
	});

	afterEach(() => jest.restoreAllMocks());

	it('keeps the documents of an id-scoped run whose id set fills exactly one batch', async () => {
		// The defect: the sweep paged an id-scoped run and re-passed the whole id set on every iteration,
		// so the second iteration read zero rows — which the indexer reads as "the sources are gone" and
		// answers by removing the documents the first iteration had just written. A request naming
		// exactly `reindexBatchSize` ids indexed them all and then deleted them all, and reported
		// `{ indexed: n, removed: 0 }` while doing it.
		await withBatchSize(2, async () => {
			const fixture = reindexFixture();

			const runs = await fixture.service.run({
				scope: SearchReindexScope.ENTITY,
				entity: 'product_variant',
				ids: ['v1', 'v2']
			} as never);

			expect(runs[0]).toMatchObject({ indexed: 2, removed: 0 });
			expect(
				fixture
					.documents()
					.map((document) => document.entityId)
					.sort()
			).toEqual(['v1', 'v2']);
		});
	});

	it('examines every document when removing orphans, including the ones a shrinking page pushed back', async () => {
		// The defect: the orphan sweep paged with an offset over a set it was simultaneously shrinking. A
		// page that soft-deleted rows dropped them out of the `deletedAt IS NULL` predicate, so the next
		// offset stepped over exactly that many unexamined documents — whose sources could be long gone
		// while they kept being returned as hits.
		await withBatchSize(2, async () => {
			const fixture = reindexFixture({
				variants: [variantRow('v1'), variantRow('v2'), variantRow('v3'), variantRow('v4')]
			});

			await fixture.service.run({ scope: SearchReindexScope.ENTITY, entity: 'product_variant' } as never);
			expect(fixture.documents()).toHaveLength(4);

			// The first two sources disappear, so the first page is entirely orphans and everything after
			// it shifts back by two.
			fixture.tables.product_variant = fixture.tables.product_variant.filter(
				(row) => row.id !== 'v1' && row.id !== 'v2'
			);

			const runs = await fixture.service.run({
				scope: SearchReindexScope.ENTITY,
				entity: 'product_variant'
			} as never);

			expect(runs[0].removed).toBe(2);
			expect(
				fixture
					.documents()
					.map((document) => document.entityId)
					.sort()
			).toEqual(['v3', 'v4']);
		});
	});

	it('reports the removals a sweep performed rather than dropping them on the floor', async () => {
		const fixture = reindexFixture();

		await fixture.service.run({ scope: SearchReindexScope.ENTITY, entity: 'product_variant' } as never);
		fixture.tables.product_variant = fixture.tables.product_variant.filter((row) => row.id !== 'v2');

		const runs = await fixture.service.run({ scope: SearchReindexScope.ENTITY, entity: 'product_variant' } as never);

		expect(runs[0].removed).toBe(1);
	});

	it('reads the version column it stamps, so a finished rebuild is distinguishable from a half-finished one', async () => {
		// `definitionVersion` was written by every writer and compared by nothing, and the schema carries
		// `(entity, definitionVersion, indexedAt)` for exactly this read.
		const fixture = reindexFixture({
			definitions: [{ entity: 'product_variant', version: 4, isActive: true }]
		});

		const runs = await fixture.service.run({ scope: SearchReindexScope.ENTITY, entity: 'product_variant' } as never);

		expect(runs[0].stale).toBe(0);
		expect(fixture.documents().every((document) => document.definitionVersion === 4)).toBe(true);
	});
});

/**
 * Greptile on #10655: a change to a shipped definition lands on an organization's own copy (SEC-B-04), and switching
 * that copy off made the organization's next reindex drop the entity's documents for the whole tenant — every other
 * organization, still on the active shipped definition, lost its search for the entity. The drop is the organization's.
 */
describe('SearchReindexService — an organization’s own definition switched off', () => {
	const OTHER_ORG = '00000000-0000-4000-8000-000000000003';

	beforeEach(() => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(ORG);
	});

	afterEach(() => jest.restoreAllMocks());

	it('drops that organization’s documents and leaves every other organization’s alone', async () => {
		const own: Row = {
			entity: 'product_variant',
			version: 2,
			isActive: true,
			tenantId: TENANT,
			organizationId: ORG
		};
		const fixture = reindexFixture({
			variants: [variantRow('v1'), variantRow('v2', { organizationId: OTHER_ORG })],
			definitions: [own]
		});
		const variants = () => fixture.documents().filter((document) => document.entity === 'product_variant');

		await fixture.service.run({ scope: SearchReindexScope.ENTITY, entity: 'product_variant' } as never);
		expect(variants()).toHaveLength(2);

		own.isActive = false;

		const runs = await fixture.service.run({
			scope: SearchReindexScope.ENTITY,
			entity: 'product_variant'
		} as never);

		// The sweep is the tenant's (Q16): OTHER_ORG's row is rebuilt under the shipped definition it is on, and ORG's
		// is removed rather than written.
		expect(runs[0]).toMatchObject({ indexed: 1, removed: 1 });
		expect(variants().map((document) => [document.entityId, document.organizationId])).toEqual([['v2', OTHER_ORG]]);
	});

	it('still drops the whole tenant’s documents when the shipped definition itself is off', async () => {
		const shipped: Row = {
			entity: 'product_variant',
			version: 1,
			isActive: true,
			tenantId: null,
			organizationId: null
		};
		const fixture = reindexFixture({
			variants: [variantRow('v1'), variantRow('v2', { organizationId: OTHER_ORG })],
			definitions: [shipped]
		});

		await fixture.service.run({ scope: SearchReindexScope.ENTITY, entity: 'product_variant' } as never);

		shipped.isActive = false;

		const runs = await fixture.service.run({
			scope: SearchReindexScope.ENTITY,
			entity: 'product_variant'
		} as never);

		expect(runs[0]).toMatchObject({ indexed: 0, removed: 2 });
		expect(fixture.documents().filter((document) => document.entity === 'product_variant')).toEqual([]);
	});

	it('does not leave a switched-off organization’s documents rebuilt by a sweep on the shipped definition (CodeRabbit)', async () => {
		// ORG switched its own copy off; OTHER_ORG, still on the active shipped definition, sweeps the tenant, and the
		// sweep reads ORG's rows too — writing back the documents ORG's switch had dropped.
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(OTHER_ORG);

		const shipped: Row = {
			entity: 'product_variant',
			version: 1,
			isActive: true,
			tenantId: null,
			organizationId: null
		};
		const own: Row = {
			entity: 'product_variant',
			version: 2,
			isActive: false,
			tenantId: TENANT,
			organizationId: ORG
		};
		const fixture = reindexFixture({
			variants: [variantRow('v1'), variantRow('v2', { organizationId: OTHER_ORG })],
			definitions: [shipped, own]
		});

		const runs = await fixture.service.run({
			scope: SearchReindexScope.ENTITY,
			entity: 'product_variant'
		} as never);

		// ORG's row is never written (Q16), so there is nothing of it to drop afterwards.
		expect(runs[0]).toMatchObject({ indexed: 1, removed: 0 });
		expect(
			fixture
				.documents()
				.filter((document) => document.entity === 'product_variant')
				.map((document) => [document.entityId, document.organizationId])
		).toEqual([['v2', OTHER_ORG]]);
	});
});

/**
 * Q16 (2) and (3): a sweep reads every organization's rows of the tenant, and used to resolve ONE definition for all of
 * them — the copy of whichever organization the operator had selected, else the shipped row. Every organization's
 * documents were stamped with that one version, and a shipped definition switched off dropped the whole tenant's
 * documents, including those of an organization whose own copy is on.
 */
describe('SearchReindexService — a sweep partitioned by organization (Q16)', () => {
	const OTHER_ORG = '00000000-0000-4000-8000-000000000003';
	const shipped = (overrides: Row = {}): Row => ({
		entity: 'product_variant',
		version: 2,
		isActive: true,
		tenantId: null,
		organizationId: null,
		...overrides
	});
	const ownCopy = (overrides: Row = {}): Row => ({
		entity: 'product_variant',
		version: 6,
		isActive: true,
		tenantId: TENANT,
		organizationId: ORG,
		...overrides
	});
	const versions = (fixture: ReturnType<typeof reindexFixture>) =>
		fixture
			.documents()
			.filter((document) => document.entity === 'product_variant')
			.map((document) => [document.entityId, document.organizationId, document.definitionVersion])
			.sort();

	beforeEach(() => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(ORG);
	});

	afterEach(() => jest.restoreAllMocks());

	it('stamps each organization’s documents with its own definition’s version', async () => {
		const fixture = reindexFixture({
			variants: [variantRow('v1'), variantRow('v2', { organizationId: OTHER_ORG })],
			definitions: [shipped(), ownCopy()]
		});

		const runs = await fixture.service.run({
			scope: SearchReindexScope.ENTITY,
			entity: 'product_variant'
		} as never);

		expect(runs[0]).toMatchObject({ indexed: 2, stale: 0 });
		expect(versions(fixture)).toEqual([
			['v1', ORG, 6],
			['v2', OTHER_ORG, 2]
		]);
	});

	it('gives the same versions when the operator has another organization selected', async () => {
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(OTHER_ORG);

		const fixture = reindexFixture({
			variants: [variantRow('v1'), variantRow('v2', { organizationId: OTHER_ORG })],
			definitions: [shipped(), ownCopy()]
		});

		await fixture.service.run({ scope: SearchReindexScope.ENTITY, entity: 'product_variant' } as never);

		expect(versions(fixture)).toEqual([
			['v1', ORG, 6],
			['v2', OTHER_ORG, 2]
		]);
	});

	it('counts an organization’s documents as stale against its own copy’s version', async () => {
		const fixture = reindexFixture({
			variants: [],
			definitions: [shipped(), ownCopy()],
			documents: [
				// ORG's copy is at 6, so a document of ORG built at 3 is stale; OTHER_ORG's at 2 is current.
				{
					id: 'd-1',
					entity: 'product_variant',
					entityId: 'gone-1',
					tenantId: TENANT,
					organizationId: ORG,
					definitionVersion: 3
				},
				{
					id: 'd-2',
					entity: 'product_variant',
					entityId: 'gone-2',
					tenantId: TENANT,
					organizationId: OTHER_ORG,
					definitionVersion: 2
				}
			]
		});
		const stale = await (fixture.service as any).staleCount('product_variant', 2, [ownCopy()]);

		expect(stale).toBe(1);
	});

	it('keeps an organization’s documents when the shipped definition is off but its own copy is on', async () => {
		const definitions = [shipped(), ownCopy()];
		const fixture = reindexFixture({
			variants: [variantRow('v1'), variantRow('v2', { organizationId: OTHER_ORG })],
			definitions
		});

		await fixture.service.run({ scope: SearchReindexScope.ENTITY, entity: 'product_variant' } as never);
		expect(versions(fixture)).toHaveLength(2);

		definitions[0].isActive = false;

		const runs = await fixture.service.run({
			scope: SearchReindexScope.ENTITY,
			entity: 'product_variant'
		} as never);

		expect(runs[0]).toMatchObject({ removed: 1, stale: 0 });
		expect(versions(fixture)).toEqual([['v1', ORG, 6]]);
	});

	it('drops the documents that carry no organization when the shipped definition is off', async () => {
		const fixture = reindexFixture({
			variants: [variantRow('v1')],
			definitions: [shipped({ isActive: false }), ownCopy()],
			documents: [
				{
					id: 'd-unowned',
					entity: 'product_variant',
					entityId: 'x',
					tenantId: TENANT,
					organizationId: null,
					definitionVersion: 2
				},
				{
					id: 'd-other',
					entity: 'product_variant',
					entityId: 'y',
					tenantId: TENANT,
					organizationId: OTHER_ORG,
					definitionVersion: 2
				}
			]
		});

		await fixture.service.run({ scope: SearchReindexScope.ENTITY, entity: 'product_variant' } as never);

		expect(versions(fixture)).toEqual([['v1', ORG, 6]]);
	});

	it('CONTROL: a shipped definition that is off, with no organization’s copy on, still drops the whole tenant', async () => {
		const fixture = reindexFixture({
			variants: [variantRow('v1'), variantRow('v2', { organizationId: OTHER_ORG })],
			definitions: [shipped({ isActive: false }), ownCopy({ isActive: false })]
		});

		const runs = await fixture.service.run({
			scope: SearchReindexScope.ENTITY,
			entity: 'product_variant'
		} as never);

		expect(runs[0]).toMatchObject({ indexed: 0, batches: 0 });
		expect(versions(fixture)).toEqual([]);
	});

	it('removes only the caller’s tenant’s documents for ids an id-scoped run cannot read (CodeRabbit)', async () => {
		const foreign = {
			id: 'd-foreign',
			entity: 'product_variant',
			entityId: 'x-1',
			tenantId: 'another-tenant',
			organizationId: 'another-org',
			definitionVersion: 1
		};

		for (const definitions of [[shipped({ isActive: false }), ownCopy()], [shipped(), ownCopy()]]) {
			const fixture = reindexFixture({ variants: [variantRow('v1')], definitions, documents: [{ ...foreign }] });

			await fixture.service.run({
				scope: SearchReindexScope.ENTITY,
				entity: 'product_variant',
				ids: ['x-1']
			} as never);

			expect(fixture.documents().map((document) => document.id)).toEqual(['d-foreign']);
		}
	});

	it('reads past a page full of rows of an organization that switched the entity off', async () => {
		await withBatchSize(2, async () => {
			const fixture = reindexFixture({
				variants: [
					variantRow('v1'),
					variantRow('v2'),
					variantRow('v3', { organizationId: OTHER_ORG }),
					variantRow('v4', { organizationId: OTHER_ORG })
				],
				definitions: [shipped(), ownCopy({ isActive: false })]
			});

			await fixture.service.run({ scope: SearchReindexScope.ENTITY, entity: 'product_variant' } as never);

			expect(versions(fixture).map(([id]) => id)).toEqual(['v3', 'v4']);
		});
	});
});
