/**
 * `@gauzy/core` boots the whole application graph from its barrel — configuration, the ORM, the job
 * registry, the module scanner — none of which an indexer needs and none of which is available
 * outside a running application. The seam is therefore doubled at the module boundary and **the
 * pipeline under test is the real one**: the real indexer, the real document builder, the real
 * declaration registry and the real built-in provider. Only the connection and the two kernel
 * repositories are substituted, and the document repository is a real (if tiny) table with the
 * uniqueness the schema gives it — which is what makes the "indexed twice, one document" case below a
 * statement about the pipeline rather than about a mock.
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
import { ISearchDocument, ISearchIndexRegistration, SearchFieldKind } from '@gauzy/contracts';
import { RequestContext } from '@gauzy/core';
import { SearchIndexRegistry } from '../registry/search-index.registry';
import { DatabaseSearchProvider } from '../providers/database-search.provider';
import { SearchProviderRegistry } from '../providers/search-provider.registry';
import { SearchIndexerService } from './search-indexer.service';

/**
 * The write half of the index: a platform event, or a range of source rows, becomes documents
 * (doc 05 §3.18, doc 12).
 *
 * The specification fixes the pipeline's properties, and each is pinned here as behaviour:
 *
 * - **the index is disposable and never authoritative** (I-72, §3.18): a document carries an entity
 *   type, an id and display text, and the same source row and the same declaration always produce the
 *   same document, which is what makes a rebuild reproducible;
 * - **one row per `(tenantId, entity, entityId, engineKey)`** (§3.18): indexing the same source row
 *   again writes one document rather than two, which is what makes a redelivered event a no-op;
 * - **an absent source row is success, not an error** (§3.18, doc 12): the row was deleted between the
 *   event and the run, and the document that describes it is removed rather than left stale;
 * - **one unreadable row must not fail the batch**: it is counted and reported, and the next run picks
 *   it up again;
 * - **the channel a row is published to is carried as a promoted token**, because the document table
 *   has no channel column of its own (§3.17–§3.18) — and a pivot that cannot be read is a warning
 *   rather than a failure;
 * - **a definition written for an engine must be written by that engine**: quietly falling back to the
 *   built-in index would put the rows where the read path is not looking.
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
					return row[field] !== undefined && new Date(row[field]).getTime() >= new Date(operator._value as any).getTime();
				default:
					throw new Error(`the in-memory double does not implement the "${operator._type}" operator`);
			}
		}

		return String(row[field] ?? '') === String(expected);
	});
}

/** The declaration this suite indexes through: the shape a package registers for its own entity. */
const DECLARATION: ISearchIndexRegistration = {
	entity: 'product_variant',
	label: 'Product variants',
	permission: 'ORG_INVENTORY_VIEW' as never,
	titleTemplate: '{{sku}} — {{name}}',
	bodyTemplate: '{{internalReference}}',
	keywordFields: ['sku', 'enabled'],
	sourceUpdatedAtField: 'updatedAt',
	channels: 'product_variant_channel',
	defaultWeight: 1,
	fields: [
		{ name: 'sku', kind: SearchFieldKind.KEYWORD, weight: 3, searchable: true, filterable: true, facetable: false },
		{
			name: 'name',
			kind: SearchFieldKind.TEXT,
			weight: 2,
			searchable: true,
			filterable: false,
			facetable: false,
			source: 'product.translations.name'
		},
		{ name: 'internalReference', kind: SearchFieldKind.KEYWORD, weight: 1, searchable: true, filterable: true, facetable: false },
		{ name: 'enabled', kind: SearchFieldKind.BOOLEAN, weight: 1, searchable: false, filterable: true, facetable: true },
		{ name: 'productId', kind: SearchFieldKind.ENTITY, weight: 1, searchable: false, filterable: true, facetable: true }
	]
};

/** One source row, as the catalogue would hand it to the indexer. */
const sourceRow = (id: string, overrides: Row = {}) => ({
	id,
	tenantId: TENANT,
	organizationId: ORG,
	sku: `SKU-${id}`,
	name: `Widget ${id}`,
	internalReference: `REF-${id}`,
	enabled: true,
	productId: 'product-1',
	updatedAt: new Date('2026-01-15T00:00:00.000Z'),
	product: { translations: [{ name: `Widget ${id}` }] },
	...overrides
});

/**
 * Builds the pipeline over an in-memory connection and an in-memory document table.
 *
 * @param seed What the fixture holds.
 */
function searchFixture(seed: { rows?: Row[]; documents?: Row[]; channels?: Row[]; engineKey?: string | null; mapPivot?: boolean } = {}) {
	let sequence = 0;
	const tables = {
		product_variant: [...(seed.rows ?? [sourceRow('v1')])],
		product_variant_channel: [...(seed.channels ?? [{ id: 'pivot-1', productVariantId: 'v1', channelId: CHANNEL }])],
		search_document: [...(seed.documents ?? [])]
	};

	const sourceTarget = { name: 'ProductVariant' };
	const pivotTarget = { name: 'ProductVariantChannel' };
	const sourceMetadata: any = {
		tableName: 'product_variant',
		name: 'ProductVariant',
		targetName: 'ProductVariant',
		target: sourceTarget,
		columns: [
			{ propertyName: 'id' },
			{ propertyName: 'updatedAt' },
			{ propertyName: 'tenantId' },
			{ propertyName: 'organizationId' },
			{ propertyName: 'sku' }
		],
		relations: []
	};
	const pivotMetadata: any = {
		tableName: 'product_variant_channel',
		name: 'ProductVariantChannel',
		targetName: 'ProductVariantChannel',
		target: pivotTarget,
		columns: [{ propertyName: 'productVariantId' }, { propertyName: 'channelId' }],
		relations: [
			{
				inverseEntityMetadata: { tableName: 'product_variant' },
				joinColumns: [{ propertyName: 'productVariantId' }]
			}
		]
	};

	const dataSource: any = {
		entityMetadatas: seed.mapPivot === false ? [sourceMetadata] : [sourceMetadata, pivotMetadata],
		getRepository: (target: unknown) => ({
			find: async ({ where, order, skip, take }: any = {}) => {
				const table = target === pivotTarget ? tables.product_variant_channel : tables.product_variant;
				let found = table.filter((row) => matches(row, where));

				if (order?.updatedAt === 'ASC') {
					found = [...found].sort(
						(left, right) => new Date(left.updatedAt ?? 0).getTime() - new Date(right.updatedAt ?? 0).getTime()
					);
				}

				if (skip) {
					found = found.slice(skip);
				}

				return take ? found.slice(0, take) : found;
			},
			count: async ({ where }: any = {}) =>
				(target === pivotTarget ? tables.product_variant_channel : tables.product_variant).filter((row) =>
					matches(row, where)
				).length
		})
	};

	const documentRepository: any = {
		manager: { connection: { options: { type: 'better-sqlite3' } } },
		create: () => ({}),
		find: async ({ where, withDeleted }: any = {}) =>
			tables.search_document.filter((row) => (withDeleted || !row.deletedAt) && matches(row, where)),
		findOne: async ({ where }: any = {}) => tables.search_document.find((row) => matches(row, where)) ?? null,
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
			const table = tables.search_document;
			let affected = 0;

			for (const row of table) {
				if (matches(row, criteria) && !row.deletedAt) {
					row.deletedAt = new Date();
					affected += 1;
				}
			}

			return { affected };
		}
	};
	const definitionRepository: any = {
		findOne: async () => (seed.engineKey ? { entity: 'product_variant', engineKey: seed.engineKey } : null)
	};

	const indexRegistry = new SearchIndexRegistry(dataSource);
	const provider = new DatabaseSearchProvider(documentRepository, indexRegistry);
	const providerRegistry = new SearchProviderRegistry(provider);

	indexRegistry.register(DECLARATION);

	const indexer = new SearchIndexerService(dataSource, indexRegistry, providerRegistry, definitionRepository);

	return {
		indexer,
		registry: indexRegistry,
		providerRegistry,
		dataSource,
		tables,
		documents: () => tables.search_document.filter((row) => !row.deletedAt),
		allDocuments: () => tables.search_document
	};
}

describe('SearchIndexerService — one row becomes one document (doc 05 §3.18, I-72)', () => {
	beforeEach(() => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(ORG);
	});

	afterEach(() => jest.restoreAllMocks());

	it('renders the declaration’s templates, weights and promoted tokens onto the document', async () => {
		const fixture = searchFixture();

		const outcome = await fixture.indexer.index('product_variant');

		expect(outcome).toMatchObject({ entity: 'product_variant', indexed: 1, removed: 0, skipped: 0, providerKey: 'database' });

		const document = fixture.documents()[0];

		expect(document).toMatchObject({
			entity: 'product_variant',
			entityId: 'v1',
			tenantId: TENANT,
			organizationId: ORG,
			body: 'REF-v1'
		});
		// The title is built from the declaration's template, from the row's own values.
		expect(document.title).toContain('SKU-v1');
		expect(document.title).toContain('Widget v1');
		// The keywords are the declaration's promoted fields plus the channel the row is published to.
		expect(document.keywords).toEqual(expect.arrayContaining(['sku:sku-v1', 'enabled:true', `channelid:${CHANNEL}`]));
		// The weight is the average declared weight of the searchable fields the row actually filled, so a
		// six-field entity does not outrank a two-field one carrying the same information.
		expect(document.attributes).toMatchObject({ sku: 'SKU-v1', name: 'Widget v1', enabled: true, _weight: 2 });
	});

	it('writes one document rather than two when the same source row is indexed again', async () => {
		// The unique key is `(tenantId, entity, entityId, engineKey)` (§3.18): the outbox delivers at least
		// once, and a consumer that needs no bookkeeping of its own is the point of the key.
		const fixture = searchFixture();

		await fixture.indexer.index('product_variant');
		const second = await fixture.indexer.index('product_variant');

		expect(fixture.allDocuments()).toHaveLength(1);
		expect(second.indexed).toBe(1);
		// And the re-index did not fork the row: the document still names the same source.
		expect(fixture.documents()[0].entityId).toBe('v1');
	});

	it('revives a document the index had removed rather than inserting a second row beside it', async () => {
		const fixture = searchFixture();

		await fixture.indexer.index('product_variant');
		await fixture.indexer.remove('product_variant', ['v1']);

		expect(fixture.documents()).toHaveLength(0);
		// The soft-deleted row is still there: the index is a projection, and nothing is gained by losing
		// the record of what was indexed.
		expect(fixture.allDocuments()).toHaveLength(1);

		await fixture.indexer.index('product_variant');

		expect(fixture.documents()).toHaveLength(1);
		expect(fixture.allDocuments()).toHaveLength(1);
	});

	it('indexes only the rows the caller named, and scopes them to the tenant and organization it was given', async () => {
		const fixture = searchFixture({
			rows: [sourceRow('v1'), sourceRow('v2'), sourceRow('v3', { organizationId: 'another-org' })]
		});

		const outcome = await fixture.indexer.index('product_variant', { ids: ['v1'], organizationId: ORG });

		expect(outcome.indexed).toBe(1);
		expect(fixture.documents().map((document) => document.entityId)).toEqual(['v1']);
	});

	it('counts a row it cannot render and carries on with the rest of the batch', async () => {
		// "One unreadable row must not fail the batch: it is counted and reported, and the next run picks it
		// up again." A row with no identity is exactly that case — a document without an id could not be
		// keyed and would be written again on every run.
		const fixture = searchFixture({ rows: [sourceRow('v1'), { id: null, sku: 'SKU-X' }] });

		const outcome = await fixture.indexer.index('product_variant');

		expect(outcome).toMatchObject({ indexed: 1, skipped: 1 });
		expect(fixture.documents()).toHaveLength(1);
	});

	it('carries no channel token when the publication pivot cannot be read, and still writes the documents', async () => {
		// "A pivot that cannot be read is a warning and not a failure: the documents are still written,
		// without channel tokens, which is the same state as an entity that is not channel scoped."
		const fixture = searchFixture({ mapPivot: false });

		await fixture.indexer.index('product_variant');

		expect(fixture.documents()).toHaveLength(1);
		expect(fixture.documents()[0].keywords).not.toEqual(expect.arrayContaining([`channelid:${CHANNEL}`]));
	});

	it('refuses an entity nothing declares, and one whose table this installation does not map', async () => {
		const fixture = searchFixture();

		await expect(fixture.indexer.index('nothing_declares_this')).rejects.toBeInstanceOf(BadRequestException);
		expect(() => fixture.indexer.definitionFor('nothing_declares_this')).toThrow(
			/No index definition is registered for "nothing_declares_this"/
		);
	});
});

describe('SearchIndexerService — removing a document (doc 05 §3.18)', () => {
	beforeEach(() => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(ORG);
	});

	afterEach(() => jest.restoreAllMocks());

	it('removes the document of a source row that is gone, and answers nothing for an empty id list', async () => {
		const fixture = searchFixture();

		await fixture.indexer.index('product_variant');

		expect(await fixture.indexer.remove('product_variant', [])).toBe(0);
		expect(await fixture.indexer.remove('product_variant', ['v1'])).toBe(1);
		expect(fixture.documents()).toEqual([]);
	});

	it('removes the document when the source row has been deleted and the run re-indexes it', async () => {
		// An absent source row is success, not an error: the row was deleted between the event and this
		// run, and the document that describes it is removed rather than left stale.
		const fixture = searchFixture();

		await fixture.indexer.index('product_variant');
		expect(fixture.documents()).toHaveLength(1);

		fixture.tables.product_variant.length = 0;

		const outcome = await fixture.indexer.index('product_variant', { ids: ['v1'] });

		expect(outcome).toMatchObject({ indexed: 0, removed: 1 });
		expect(fixture.documents()).toEqual([]);
	});
});

describe('SearchIndexerService — the event seam (doc 12, doc 05 §3.18)', () => {
	beforeEach(() => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(ORG);
	});

	afterEach(() => jest.restoreAllMocks());

	it('re-reads the row an update event names rather than trusting the event’s payload', async () => {
		// "Everything a document contains is re-read from the source at that moment, so an event is a hint
		// and never the content — which is what keeps a redelivered event a no-op write of the same
		// document."
		const fixture = searchFixture();

		const outcome = await fixture.indexer.handleEvent({
			name: 'product_variant.updated',
			aggregate: { type: 'ProductVariant', id: 'v1' },
			tenantId: TENANT,
			organizationId: ORG
		} as never);

		expect(outcome).toMatchObject({ entity: 'product_variant', indexed: 1 });
		expect(fixture.documents()[0].title).toContain('SKU-v1');
	});

	it('drops the separator a template kept for a placeholder whose path carried nothing', async () => {
		// "A placeholder whose path carries nothing is removed along with the separator that was there for
		// it, so a row missing its code does not produce a title that trails a dash." A variant whose own
		// name and whose product's translation both carry nothing is exactly that row.
		const fixture = searchFixture({ rows: [sourceRow('v1', { name: null, product: { translations: [] } })] });

		await fixture.indexer.index('product_variant');

		expect(fixture.documents()[0].title).toBe('SKU-v1');
	});

	// The defect: the tidying pass removes *every* separator that stands between two spaces, whether or
	// not the placeholder beside it carried anything, so a title template that renders both of its
	// placeholders loses the punctuation that joined them. Doc 05 §3.17 gives `{{name}} — {{code}}` as
	// the worked example of a title template and every shipped declaration uses that shape, so what a
	// person sees in a result list is a run-together string rather than the title the declaration asked
	// for. (`search-document.builder.ts`, the `tidy` call at the end of `renderTemplate`.)
	it.failing('[DEFECT] keeps the separator between two placeholders that both carried a value', async () => {
		const fixture = searchFixture();

		await fixture.indexer.index('product_variant');

		expect(fixture.documents()[0].title).toBe('SKU-v1 — Widget v1');
	});

	it('removes the document a deletion event names', async () => {
		const fixture = searchFixture();

		await fixture.indexer.index('product_variant');

		const outcome = await fixture.indexer.handleEvent({
			name: 'product_variant.deleted',
			aggregate: { type: 'ProductVariant', id: 'v1' }
		} as never);

		expect(outcome).toMatchObject({ indexed: 0, removed: 1 });
		expect(fixture.documents()).toEqual([]);
	});

	it('answers nothing for an event that names an entity nothing indexes or carries no aggregate id', async () => {
		const fixture = searchFixture();

		expect(
			await fixture.indexer.handleEvent({ name: 'invoice.updated', aggregate: { type: 'Invoice', id: 'i1' } } as never)
		).toBeUndefined();
		expect(
			await fixture.indexer.handleEvent({ name: 'product_variant.updated', aggregate: { type: 'ProductVariant' } } as never)
		).toBeUndefined();
	});
});

describe('SearchIndexerService — turning an aggregate name into an entity key (doc 05 §3.17)', () => {
	beforeEach(() => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(ORG);
	});

	afterEach(() => jest.restoreAllMocks());

	it.each([
		['the registered entity key', 'product_variant'],
		['the table name', 'product_variant'],
		['the class name', 'ProductVariant']
	])('maps %s onto the declaration’s own key', (_label, value) => {
		// A platform event names its aggregate in PascalCase and a declaration names it by the table it
		// lives in, and the translation is read from the live metadata rather than from a table of names.
		expect(searchFixture().indexer.entityKeyOf(value)).toBe('product_variant');
	});

	it('answers nothing for a name nothing maps, and for an empty one', () => {
		const fixture = searchFixture();

		expect(fixture.indexer.entityKeyOf('Invoice')).toBeUndefined();
		expect(fixture.indexer.entityKeyOf('')).toBeUndefined();
		expect(fixture.indexer.entityKeyOf(undefined as never)).toBeUndefined();
	});
});

describe('SearchIndexerService — reading the source rows one declaration describes (doc 05 §3.18)', () => {
	beforeEach(() => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(ORG);
	});

	afterEach(() => jest.restoreAllMocks());

	it('pages by the identity of the rows and orders them by the declaration’s own source timestamp', async () => {
		const fixture = searchFixture({
			rows: [
				sourceRow('late', { updatedAt: new Date('2026-02-01T00:00:00.000Z') }),
				sourceRow('early', { updatedAt: new Date('2026-01-01T00:00:00.000Z') })
			]
		});

		const rows = await fixture.indexer.readSourceRows(DECLARATION, { take: 1 });

		expect(rows.map((row) => row.id)).toEqual(['early']);
	});

	it('selects only the rows that moved on or after the instant it was given', async () => {
		const fixture = searchFixture({
			rows: [
				sourceRow('old', { updatedAt: new Date('2026-01-01T00:00:00.000Z') }),
				sourceRow('new', { updatedAt: new Date('2026-02-01T00:00:00.000Z') })
			]
		});

		const rows = await fixture.indexer.readSourceRows(DECLARATION, { since: new Date('2026-01-15T00:00:00.000Z') });

		expect(rows.map((row) => row.id)).toEqual(['new']);
	});

	it('refuses a declaration whose table nothing maps and counts its rows as none', async () => {
		const fixture = searchFixture();
		const unknown = { ...DECLARATION, entity: 'nothing_here' };

		await expect(fixture.indexer.readSourceRows(unknown, {})).rejects.toThrow(/Nothing maps the table/);
		// A table nothing maps counts as zero rather than failing: the request is about the entity, and the
		// entity is absent.
		expect(await fixture.indexer.countSourceRows(unknown, {})).toBe(0);
	});

	it('counts the rows a declaration describes', async () => {
		const fixture = searchFixture({ rows: [sourceRow('v1'), sourceRow('v2')] });

		expect(await fixture.indexer.countSourceRows(DECLARATION, {})).toBe(2);
	});
});

describe('SearchIndexerService — the provider a definition is written by (doc 12)', () => {
	beforeEach(() => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(ORG);
	});

	afterEach(() => jest.restoreAllMocks());

	it('writes through the built-in provider when no engine is named', async () => {
		const fixture = searchFixture();

		const outcome = await fixture.indexer.index('product_variant');

		expect(outcome.providerKey).toBe('database');
	});

	it('refuses to write when the definition names an engine nothing registered', async () => {
		// Selection is strict here, unlike a read: quietly falling back to the built-in index would put the
		// rows in a place the read path is not looking, and the failure would surface as "search returns
		// nothing" long after the cause.
		const fixture = searchFixture({ engineKey: 'an-engine-that-is-not-installed' });

		await expect(fixture.indexer.index('product_variant')).rejects.toThrow(
			/is written for the engine "an-engine-that-is-not-installed"/
		);
		expect(fixture.allDocuments()).toEqual([]);
	});
});
