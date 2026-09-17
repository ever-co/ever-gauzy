/**
 * `@gauzy/core` boots the whole application graph from its barrel — configuration, the ORM, the job
 * registry, the module scanner — none of which a query service needs and none of which is available
 * outside a running application. The seam is therefore doubled at the module boundary and **the query
 * path under test is the real one**: the real query service, the real declaration registry, the real
 * provider registry and the real built-in provider, querying a real in-memory document table through a
 * query-builder double that evaluates the predicates the provider actually builds.
 *
 * That double is the reason the cases below are about behaviour rather than about prose: it records
 * every fragment the provider states and answers each document by evaluating them, so "two filters
 * narrow together" and "one filter is a union across entity types" are assertions about results, not
 * about a call log.
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
import {
	ISearchIndexRegistration,
	SearchFieldKind,
	SearchFilterOperator,
	SearchMatchMode
} from '@gauzy/contracts';
import { RequestContext } from '@gauzy/core';
import { SearchIndexRegistry } from '../registry/search-index.registry';
import { DatabaseSearchProvider } from '../providers/database-search.provider';
import { SearchProviderRegistry } from '../providers/search-provider.registry';
import { SearchIndexerService } from './search-indexer.service';
import { SearchService, decodeCursor, encodeCursor } from './search.service';

/**
 * The read half of search: one request, every entity the caller may see, one ranked page (doc 05
 * §3.18, implementation W26).
 *
 * Two rules shape everything here, and both are pinned:
 *
 * - **permission filtering happens before the merge, per entity type** — an entity the caller may not
 *   read is removed from the query rather than filtered out of its answer, so `total` counts what the
 *   caller may see and never reveals how many rows were withheld;
 * - **a hit is re-read from the entity that owns it** (I-72): the index supplied the match and the
 *   page takes the values it renders from the source rows, dropping a hit whose row is gone.
 *
 * The filter contract is asserted where it actually differs:
 *
 * - **a text query's terms compose the way the request asked** — a union under `ANY` and a
 *   conjunction under `ALL` (and a phrase as one term under `PHRASE`);
 * - **two filters narrow together**, because each one is its own predicate, while **one filter that
 *   several declarations can answer is a union across their entity types**, because a filter names a
 *   field and a field belongs to a declaration;
 * - a filter naming a field no declaration declares, or one whose declaration does not mark it
 *   filterable, is **refused** rather than answered with an empty page — a filter that silently
 *   matches nothing is indistinguishable from a filter that is spelled wrong.
 */

const TENANT = '00000000-0000-4000-8000-000000000001';
const ORG = '00000000-0000-4000-8000-000000000002';
const VISIBLE = 'ORG_INVENTORY_VIEW';
const HIDDEN = 'ORG_FINANCE_VIEW';

type Row = Record<string, any>;

/** Splits an expression on a top-level operator, respecting parentheses. */
function splitTopLevel(expression: string, operator: string): string[] {
	let depth = 0;
	const parts: string[] = [];
	let current = '';

	for (let index = 0; index < expression.length; index += 1) {
		const character = expression[index];

		if (character === '(') {
			depth += 1;
		}

		if (character === ')') {
			depth -= 1;
		}

		if (depth === 0 && expression.startsWith(operator, index)) {
			parts.push(current);
			current = '';
			index += operator.length - 1;
			continue;
		}

		current += character;
	}

	parts.push(current);

	return parts.map((part) => part.trim()).filter(Boolean);
}

/** The index of the parenthesis that closes the one opened at `start`. */
function closingIndex(expression: string, start: number): number {
	let depth = 0;

	for (let index = start; index < expression.length; index += 1) {
		if (expression[index] === '(') {
			depth += 1;
		}

		if (expression[index] === ')') {
			depth -= 1;

			if (depth === 0) {
				return index;
			}
		}
	}

	return -1;
}

/** The text a document holds in one of the columns a token predicate reads. */
function textOf(doc: Row, column: string): string {
	const value = doc[column];

	return Array.isArray(value) ? value.join(',') : String(value ?? '');
}

/** A `LIKE` pattern, as the provider builds it. */
function like(value: string, pattern: string): boolean {
	const expression = String(pattern ?? '')
		.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
		.replace(/%/g, '.*');

	return new RegExp(`^${expression}$`).test(String(value ?? '').toLowerCase());
}

/**
 * Evaluates one predicate the provider stated against one document.
 *
 * @param sql The fragment.
 * @param doc The document row.
 * @param params The statement's parameter bag.
 * @returns True when the document satisfies the fragment.
 * @throws Error when the fragment is one this double does not model, rather than answering wrongly.
 */
function evaluate(sql: string, doc: Row, params: Row): boolean {
	const expression = sql.trim();

	if (/^doc\.deletedAt IS NULL$/.test(expression)) {
		return !doc.deletedAt;
	}

	if (/^doc\.entity IN \(:\.\.\.scopedEntities\)$/.test(expression)) {
		return ((params.scopedEntities as string[]) ?? []).includes(String(doc.entity));
	}

	let match = /^doc\.tenantId = :(\w+)$/.exec(expression);

	if (match) {
		return String(doc.tenantId) === String(params[match[1]]);
	}

	match = /^\(doc\.organizationId = :(\w+) OR doc\.organizationId IS NULL\)$/.exec(expression);

	if (match) {
		return String(doc.organizationId) === String(params[match[1]]) || !doc.organizationId;
	}

	if (expression.startsWith('NOT (') && closingIndex(expression, 3) === expression.length - 1) {
		return !evaluate(expression.slice(5, -1), doc, params);
	}

	if (expression.startsWith('(') && closingIndex(expression, 0) === expression.length - 1) {
		const inner = expression.slice(1, -1);
		const union = splitTopLevel(inner, ' OR ');

		if (union.length > 1) {
			return union.some((part) => evaluate(part, doc, params));
		}

		const intersection = splitTopLevel(inner, ' AND ');

		if (intersection.length > 1) {
			return intersection.every((part) => evaluate(part, doc, params));
		}

		return evaluate(inner, doc, params);
	}

	match = /^LOWER\((doc\.\w+)\) LIKE :(\w+)$/.exec(expression);

	if (match) {
		return like(textOf(doc, match[1].replace('doc.', '')), params[match[2]]);
	}

	match = /^LOWER\((doc\.\w+)\) = :(\w+)$/.exec(expression);

	if (match) {
		return textOf(doc, match[1].replace('doc.', '')).toLowerCase() === String(params[match[2]]).toLowerCase();
	}

	match = /^doc\.entity = :(\w+)$/.exec(expression);

	if (match) {
		return String(doc.entity) === String(params[match[1]]);
	}

	throw new Error(`the in-memory double cannot evaluate the predicate "${expression}"`);
}

/** Two declarations, both answering a filter on `sku` — which is what makes that filter a union. */
const VARIANT: ISearchIndexRegistration = {
	entity: 'product_variant',
	label: 'Product variants',
	permission: VISIBLE as never,
	titleTemplate: '{{name}}',
	keywordFields: ['sku', 'enabled'],
	sourceUpdatedAtField: 'updatedAt',
	fields: [
		{ name: 'sku', kind: SearchFieldKind.KEYWORD, weight: 3, searchable: true, filterable: true, facetable: true },
		{ name: 'name', kind: SearchFieldKind.TEXT, weight: 2, searchable: true, filterable: false, facetable: false },
		{ name: 'enabled', kind: SearchFieldKind.BOOLEAN, weight: 1, searchable: false, filterable: true, facetable: true }
	]
};
const PRODUCT: ISearchIndexRegistration = {
	entity: 'product',
	label: 'Products',
	permission: VISIBLE as never,
	titleTemplate: '{{name}}',
	keywordFields: ['sku'],
	sourceUpdatedAtField: 'updatedAt',
	fields: [
		{ name: 'sku', kind: SearchFieldKind.KEYWORD, weight: 3, searchable: true, filterable: true, facetable: true },
		{ name: 'name', kind: SearchFieldKind.TEXT, weight: 2, searchable: true, filterable: false, facetable: false },
		// Declared and indexed, but not filterable: a filter naming it must be refused.
		{ name: 'internalNote', kind: SearchFieldKind.TEXT, weight: 1, searchable: true, filterable: false, facetable: false }
	]
};
const SECRET: ISearchIndexRegistration = {
	entity: 'secret_ledger',
	label: 'Secret ledger',
	permission: HIDDEN as never,
	titleTemplate: '{{name}}',
	keywordFields: ['sku'],
	sourceUpdatedAtField: 'updatedAt',
	fields: [{ name: 'sku', kind: SearchFieldKind.KEYWORD, weight: 3, searchable: true, filterable: true, facetable: true }]
};

/** One source row of a declaration. */
const sourceRow = (id: string, overrides: Row = {}) => ({
	id,
	tenantId: TENANT,
	organizationId: ORG,
	sku: `SKU-${id}`,
	name: `Row ${id}`,
	enabled: true,
	updatedAt: new Date('2026-01-15T00:00:00.000Z'),
	...overrides
});

/**
 * Builds the query path over an in-memory connection and an in-memory document table.
 *
 * @param seed What the fixture holds.
 */
function searchFixture(
	seed: {
		variants?: Row[];
		products?: Row[];
		secrets?: Row[];
		permissions?: string[];
	} = {}
) {
	let sequence = 0;
	const tables = {
		product_variant: [
			...(seed.variants ?? [
				sourceRow('v1', { sku: 'SKU-V1', name: 'Blue widget' }),
				sourceRow('v2', { sku: 'SKU-V2', name: 'Red gizmo' })
			])
		],
		product: [...(seed.products ?? [sourceRow('p1', { sku: 'SKU-P1', name: 'Blue widget deluxe' })])],
		secret_ledger: [...(seed.secrets ?? [sourceRow('s1', { sku: 'SKU-S1', name: 'Blue widget ledger' })])],
		search_document: [] as Row[]
	};
	const permissions = new Set(seed.permissions ?? [VISIBLE]);

	const targets: Row = {
		product_variant: { name: 'ProductVariant' },
		product: { name: 'Product' },
		secret_ledger: { name: 'SecretLedger' }
	};
	/** The table each metadata target reads, so a repository answers for the entity it was asked about. */
	const tableByTarget = new Map<unknown, Row[]>([
		[targets.product_variant, tables.product_variant],
		[targets.product, tables.product],
		[targets.secret_ledger, tables.secret_ledger]
	]);
	const dataSource: any = {
		entityMetadatas: Object.entries(targets).map(([tableName, target]) => ({
			tableName,
			name: (target as Row).name,
			targetName: (target as Row).name,
			target,
			columns: [{ propertyName: 'id' }, { propertyName: 'updatedAt' }, { propertyName: 'tenantId' }, { propertyName: 'organizationId' }],
			relations: []
		})),
		getRepository: (target: unknown) => ({
			find: async ({ take }: any = {}) => {
				const table = tableByTarget.get(target) ?? [];

				return take ? table.slice(0, take) : table;
			},
			count: async () => tableByTarget.get(target)?.length ?? 0
		})
	};

	/**
	 * The query builder: it records the fragments the provider states and answers by evaluating them,
	 * so every assertion below is about which documents a query selects.
	 */
	const createQueryBuilder = (): any => {
		const fragments: Array<{ sql: string; params: Row }> = [];
		const state: { skip?: number; take?: number; order: Array<[string, string]>; grouping?: string } = { order: [] };

		const bag = (): Row => fragments.reduce<Row>((all, fragment) => ({ ...all, ...fragment.params }), {});
		const matched = (): Row[] => tables.search_document.filter((doc) => fragments.every((fragment) => evaluate(fragment.sql, doc, bag())));
		const page = (rows: Row[]): Row[] => {
			const from = state.skip && state.skip > 0 ? state.skip : 0;
			const sliced = rows.slice(from);

			return state.take ? sliced.slice(0, state.take) : sliced;
		};
		const ordered = (rows: Row[]): Row[] => {
			if (!state.order.length) {
				return rows;
			}

			return [...rows].sort((left, right) => {
				for (const [column, direction] of state.order) {
					const a = String(left[column.replace('doc.', '')] ?? '');
					const b = String(right[column.replace('doc.', '')] ?? '');

					if (a !== b) {
						return (a > b ? 1 : -1) * (direction === 'DESC' ? -1 : 1);
					}
				}

				return 0;
			});
		};

		const query: any = {
			where: (sql: string, params: Row = {}) => {
				fragments.push({ sql, params });

				return query;
			},
			andWhere: (sql: string, params: Row = {}) => {
				fragments.push({ sql, params });

				return query;
			},
			select: () => query,
			addSelect: () => query,
			groupBy: (expression: string) => {
				state.grouping = expression;

				return query;
			},
			orderBy: (column: string, direction: string) => {
				state.order.push([column, direction]);

				return query;
			},
			addOrderBy: (column: string, direction: string) => {
				state.order.push([column, direction]);

				return query;
			},
			skip: (value: number) => {
				state.skip = value;

				return query;
			},
			take: (value: number) => {
				state.take = value;

				return query;
			},
			limit: (value: number) => {
				state.take = value;

				return query;
			},
			getCount: async () => matched().length,
			getMany: async () => page(ordered(matched())),
			getRawAndEntities: async () => {
				const rows = page(ordered(matched()));

				return { entities: rows, raw: rows.map(() => ({ score: 1 })) };
			},
			getRawMany: async () => {
				if (state.grouping && state.grouping.includes('keywords')) {
					const buckets = new Map<string, number>();

					for (const doc of matched()) {
						const key = textOf(doc, 'keywords');

						buckets.set(key, (buckets.get(key) ?? 0) + 1);
					}

					return Array.from(buckets.entries()).map(([bucket, count]) => ({ bucket, count }));
				}

				if (state.grouping) {
					const buckets = new Map<string, number>();

					for (const doc of matched()) {
						const key = String(doc.attributes?.[state.grouping!.replace(/^.*'\$\.|'.*$/g, '')] ?? '');

						if (key) {
							buckets.set(key, (buckets.get(key) ?? 0) + 1);
						}
					}

					return Array.from(buckets.entries()).map(([bucket, count]) => ({ bucket, count }));
				}

				throw new Error('the in-memory double only groups a facet query');
			}
		};

		return query;
	};

	const documentRepository: any = {
		manager: { connection: { options: { type: 'better-sqlite3' } } },
		createQueryBuilder,
		create: () => ({}),
		find: async ({ where, withDeleted }: any = {}) =>
			tables.search_document.filter((row) => (withDeleted || !row.deletedAt) && matchesWhere(row, where)),
		findOne: async () => null,
		count: async ({ where }: any = {}) => tables.search_document.filter((row) => matchesWhere(row, where)).length,
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
				if (matchesWhere(row, criteria) && !row.deletedAt) {
					row.deletedAt = new Date();
					affected += 1;
				}
			}

			return { affected };
		}
	};

	const indexRegistry = new SearchIndexRegistry(dataSource);

	indexRegistry.register(VARIANT);
	indexRegistry.register(PRODUCT);
	indexRegistry.register(SECRET);

	const provider = new DatabaseSearchProvider(documentRepository, indexRegistry);
	const providerRegistry = new SearchProviderRegistry(provider);
	const indexer = new SearchIndexerService(dataSource, indexRegistry, providerRegistry, { findOne: async () => null } as never);
	const reindex = {
		status: async (entities: string[]) => entities.map((entity) => ({ entity, indexedCount: tables.search_document.length, pendingCount: 0 }))
	};

	const service = new SearchService(indexRegistry, providerRegistry, indexer, reindex as never);

	return { service, indexer, registry: indexRegistry, tables };
}

/** The subset of conditions the document repository states. */
function matchesWhere(row: Row, where: any = {}): boolean {
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
				default:
					throw new Error(`the in-memory double does not implement the "${operator._type}" operator`);
			}
		}

		return String(row[field] ?? '') === String(expected);
	});
}

/** Indexes every source row of every declaration, so a query has something to answer from. */
async function indexAll(fixture: ReturnType<typeof searchFixture>): Promise<void> {
	await fixture.indexer.index('product_variant');
	await fixture.indexer.index('product');
	await fixture.indexer.index('secret_ledger');
}

describe('SearchService — what a request must carry (doc 06 §6.15)', () => {
	beforeEach(() => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(ORG);
		jest.spyOn(RequestContext, 'hasPermission').mockImplementation((permission: never) => permission === (VISIBLE as never));
	});

	afterEach(() => jest.restoreAllMocks());

	it('refuses a request that carries neither text nor a filter', async () => {
		// "A search with no text and no filter is not a search: it is an unbounded listing of everything the
		// caller may see, and the resource endpoints answer that question."
		const fixture = searchFixture();

		await expect(fixture.service.search({})).rejects.toThrow(/SEARCH_QUERY_INVALID/);
		await expect(fixture.service.search({ entities: ['product_variant'] })).rejects.toBeInstanceOf(BadRequestException);
	});

	it('refuses a suggestion request with no text to complete', async () => {
		const fixture = searchFixture();

		await expect(fixture.service.suggest({})).rejects.toThrow(/must carry the text it is completing/);
	});

	it('admits a request bounded by a filter alone', async () => {
		const fixture = searchFixture();

		await indexAll(fixture);

		const page = await fixture.service.search({
			filters: [{ attribute: 'sku', operator: SearchFilterOperator.EQ, value: 'SKU-V1' }]
		});

		expect(page.items.map((hit) => hit.entityId)).toEqual(['v1']);
	});
});

describe('SearchService — which entities a caller may search (doc 05 §3.18)', () => {
	beforeEach(() => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(ORG);
	});

	afterEach(() => jest.restoreAllMocks());

	it('removes an entity the caller may not read from the query rather than from its answer', async () => {
		// "`total` therefore counts what the caller may see and never reveals how many rows were withheld."
		const fixture = searchFixture({ permissions: [VISIBLE] });
		const seen: string[] = [];

		jest.spyOn(RequestContext, 'hasPermission').mockImplementation((permission: never) => {
			seen.push(permission as unknown as string);

			return permission === (VISIBLE as never);
		});

		await indexAll(fixture);

		const page = await fixture.service.search({ q: 'blue' });

		expect(fixture.service.permittedEntities()).toEqual(['product_variant', 'product']);
		expect(seen).toContain(HIDDEN);
		expect(page.items.map((hit) => hit.entity)).toEqual(['product_variant', 'product']);
		expect(page.items.some((hit) => hit.entity === 'secret_ledger')).toBe(false);
		// The withheld entity's row is not counted either.
		expect(page.total).toBe(2);
	});

	it('answers a page and not an error when a request names only entities the caller may not read', async () => {
		const fixture = searchFixture({ permissions: [VISIBLE] });

		jest.spyOn(RequestContext, 'hasPermission').mockReturnValue(false as never);

		await indexAll(fixture);

		const page = await fixture.service.search({ q: 'blue', entities: ['secret_ledger'] });

		expect(page).toMatchObject({ items: [], total: 0, facets: [], searchedEntities: [] });
		expect(page.pageInfo).toMatchObject({ hasNextPage: false, hasPreviousPage: false, startCursor: null });
	});

	it('never widens the permitted set with the entities a request names', async () => {
		const fixture = searchFixture({ permissions: [VISIBLE] });

		jest.spyOn(RequestContext, 'hasPermission').mockImplementation((permission: never) => permission === (VISIBLE as never));

		expect(fixture.service.permittedEntities({ entities: ['secret_ledger'] })).toEqual([]);
		expect(fixture.service.permittedEntities({ entities: ['product'] })).toEqual(['product']);
	});

	it('reports the freshness of the index through the reindex service', async () => {
		const fixture = searchFixture();

		jest.spyOn(RequestContext, 'hasPermission').mockImplementation((permission: never) => permission === (VISIBLE as never));

		expect((await fixture.service.indexStatus(['product'])).map((status) => status.entity)).toEqual(['product']);
	});
});

describe('SearchService — how a text query’s terms compose (doc 05 §3.18)', () => {
	beforeEach(() => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(ORG);
		jest.spyOn(RequestContext, 'hasPermission').mockImplementation((permission: never) => permission === (VISIBLE as never));
	});

	afterEach(() => jest.restoreAllMocks());

	it('selects the documents that match and no others, and answers an empty page when nothing matches', async () => {
		const fixture = searchFixture();

		await indexAll(fixture);

		const matching = await fixture.service.search({ q: 'blue', entities: ['product_variant'] });

		expect(matching.items.map((hit) => hit.entityId)).toEqual(['v1']);
		expect(matching.total).toBe(1);

		const nothing = await fixture.service.search({ q: 'chartreuse', entities: ['product_variant'] });

		expect(nothing).toMatchObject({ items: [], total: 0 });
	});

	it('unions the terms under ANY and intersects them under ALL', async () => {
		// The one difference the request states, and the only place the two modes part company.
		const fixture = searchFixture();

		await indexAll(fixture);

		const any = await fixture.service.search({
			q: 'gizmo blue',
			matchMode: SearchMatchMode.ANY,
			entities: ['product_variant']
		});
		const all = await fixture.service.search({
			q: 'gizmo blue',
			matchMode: SearchMatchMode.ALL,
			entities: ['product_variant']
		});

		expect(any.items.map((hit) => hit.entityId).sort()).toEqual(['v1', 'v2']);
		// No single variant carries both words, so the conjunction selects nothing.
		expect(all.items).toEqual([]);
	});

	it('reads a phrase as one term rather than as a union of its words', async () => {
		const fixture = searchFixture();

		await indexAll(fixture);

		const page = await fixture.service.search({
			q: 'blue widget',
			matchMode: SearchMatchMode.PHRASE,
			entities: ['product_variant']
		});

		expect(page.items.map((hit) => hit.entityId)).toEqual(['v1']);
	});

	it('matches a promoted token as well as the title and the body', async () => {
		// The promoted field is what gives the dialects without a JSON index an index-served filter path,
		// and it is searchable text as well: a SKU typed into the box finds its row.
		const fixture = searchFixture();

		await indexAll(fixture);

		const page = await fixture.service.search({ q: 'sku-v2', entities: ['product_variant'] });

		expect(page.items.map((hit) => hit.entityId)).toEqual(['v2']);
	});

	it('scopes the answer to the caller’s tenant and to its own organization or a global document', async () => {
		const fixture = searchFixture();

		await indexAll(fixture);
		fixture.tables.search_document.push({
			id: 'foreign',
			entity: 'product_variant',
			entityId: 'v9',
			title: 'Blue widget of another tenant',
			body: null,
			keywords: ['sku:sku-v9'],
			attributes: null,
			tenantId: 'another-tenant',
			organizationId: ORG
		});

		const page = await fixture.service.search({ q: 'blue', entities: ['product_variant'] });

		expect(page.items.some((hit) => hit.entityId === 'v9')).toBe(false);
	});
});

describe('SearchService — how filters compose (doc 05 §3.18, §3.17)', () => {
	beforeEach(() => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(ORG);
		jest.spyOn(RequestContext, 'hasPermission').mockImplementation((permission: never) => permission === (VISIBLE as never));
	});

	afterEach(() => jest.restoreAllMocks());

	it('narrows with every filter a request carries, because each one is its own predicate', async () => {
		// The AND path: two filters that one document does not both satisfy select nothing, while one of
		// them alone selects it.
		const fixture = searchFixture();

		await indexAll(fixture);

		const wide = await fixture.service.search({
			filters: [{ attribute: 'sku', operator: SearchFilterOperator.EQ, value: 'SKU-V1' }],
			entities: ['product_variant']
		});
		const narrow = await fixture.service.search({
			filters: [
				{ attribute: 'sku', operator: SearchFilterOperator.EQ, value: 'SKU-V1' },
				{ attribute: 'enabled', operator: SearchFilterOperator.EQ, value: false }
			],
			entities: ['product_variant']
		});

		expect(wide.items.map((hit) => hit.entityId)).toEqual(['v1']);
		expect(narrow.items).toEqual([]);
	});

	it('unions the declarations that can answer one filter, and keeps each to its own entity type', async () => {
		// The OR path: `sku` is declared by two entity types, so the predicate is a union of two
		// entity-scoped branches — and a document of one type never satisfies the other's branch.
		const fixture = searchFixture({
			products: [sourceRow('p1', { sku: 'SKU-V1', name: 'A product sharing a variant’s code' })]
		});

		await indexAll(fixture);

		const page = await fixture.service.search({
			filters: [{ attribute: 'sku', operator: SearchFilterOperator.EQ, value: 'SKU-V1' }],
			entities: ['product_variant', 'product']
		});

		expect(page.items.map((hit) => hit.entity).sort()).toEqual(['product', 'product_variant']);
		expect(page.total).toBe(2);

		// Narrow the filter to one entity and the other's document is gone, even though it satisfies the
		// same value: a filter names a field, and a field belongs to a declaration.
		const productOnly = await fixture.service.search({
			filters: [{ attribute: 'sku', operator: SearchFilterOperator.EQ, value: 'SKU-V1', entity: 'product' }],
			entities: ['product_variant', 'product']
		});

		expect(productOnly.items.map((hit) => hit.entity)).toEqual(['product']);
	});

	it('refuses a filter no declaration in scope declares a field for', async () => {
		// "a filter that silently matches nothing is indistinguishable from a filter that is spelled wrong".
		const fixture = searchFixture();

		await indexAll(fixture);

		await expect(
			fixture.service.search({
				filters: [{ attribute: 'colour', operator: SearchFilterOperator.EQ, value: 'red' }],
				entities: ['product_variant']
			})
		).rejects.toThrow(/No index definition declares the field "colour"/);
	});

	it('refuses a filter on a declared field whose declaration does not mark it filterable', async () => {
		const fixture = searchFixture();

		await indexAll(fixture);

		await expect(
			fixture.service.search({
				filters: [{ attribute: 'name', operator: SearchFilterOperator.EQ, value: 'Blue widget' }],
				entities: ['product_variant']
			})
		).rejects.toThrow(/is not filterable/);
	});

	it('answers a filter whose value matches nothing with an empty page rather than an error', async () => {
		const fixture = searchFixture();

		await indexAll(fixture);

		const page = await fixture.service.search({
			filters: [{ attribute: 'sku', operator: SearchFilterOperator.EQ, value: 'SKU-NOPE' }],
			entities: ['product_variant']
		});

		expect(page).toMatchObject({ items: [], total: 0 });
	});

	it('counts a facet value over the documents the page’s own predicate selected', async () => {
		// "The facets come from the same call that produces the page, so a facet can never describe a
		// different result set than the one it is shown beside."
		const fixture = searchFixture();

		await indexAll(fixture);

		const facets = await fixture.service.facets({
			q: 'blue',
			facets: ['sku'],
			entities: ['product_variant']
		});

		// Exactly one variant carries the word, so its token occurs once.
		expect(facets).toEqual([{ attribute: 'sku', values: [{ value: 'sku-v1', count: 1 }] }]);
		// A facet the request names but no declaration marks facetable is absent rather than zero.
		expect(
			await fixture.service.facets({ q: 'blue', facets: ['name'], entities: ['product_variant'] })
		).toEqual([]);
	});

	// The defect: `computeFacets` walks the entity types in scope and calls the aggregation once for each
	// declaration that answers the field, but every one of those calls counts over the *whole* scope
	// rather than over its own entity type — so a facet's counts are multiplied by the number of
	// declarations that answer it. Two entity types that both declare a facetable `sku` report every
	// value twice, and a count that is not the number of documents is not a count: "A facet value's count
	// is a real aggregation over the documents the same predicate selects."
	// (`database-search.provider.ts`, the `for (const entity of context.entities)` loop in `computeFacets`
	// around its `countKeywordFacet` / `countAttributeFacet` calls.)
	it.failing('[DEFECT] counts each facet value once however many declarations answer the facet', async () => {
		const fixture = searchFixture();

		await indexAll(fixture);

		const facets = await fixture.service.facets({
			q: 'blue',
			facets: ['sku'],
			entities: ['product_variant', 'product']
		});
		const counted = new Map(facets[0].values.map((value: Row) => [value.value, value.count]));

		expect(counted.get('sku-v1')).toBe(1);
		expect(counted.get('sku-p1')).toBe(1);
	});
});

describe('SearchService — re-reading a hit from the entity that owns it (I-72, doc 05 §3.18)', () => {
	beforeEach(() => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(ORG);
		jest.spyOn(RequestContext, 'hasPermission').mockImplementation((permission: never) => permission === (VISIBLE as never));
	});

	afterEach(() => jest.restoreAllMocks());

	it('drops a hit whose source row is gone instead of returning a skeleton', async () => {
		// The index is disposable and never authoritative: a row that has since been deleted disappears from
		// the page rather than being returned as something nothing can be done with.
		const fixture = searchFixture();

		await indexAll(fixture);
		// The row is removed from the table itself rather than from the fixture's reference to it, because
		// the source read goes through the table.
		fixture.tables.product_variant.splice(
			fixture.tables.product_variant.findIndex((row) => row.id === 'v2'),
			1
		);

		const page = await fixture.service.search({ q: 'gizmo', entities: ['product_variant'] });

		expect(page.items).toEqual([]);
		// The document is still in the index, which is exactly why the read re-reads the source.
		expect(fixture.tables.search_document.some((document) => document.entityId === 'v2')).toBe(true);
	});

	it('renders the attributes of a hit from the source row rather than from the index', async () => {
		const fixture = searchFixture();

		await indexAll(fixture);

		const hits = await fixture.service.materialise([
			{ entity: 'product_variant', entityId: 'v1', title: 'stale title', score: 1 }
		] as never);

		expect(hits).toHaveLength(1);
		expect(hits[0].attributes).toMatchObject({ sku: 'SKU-V1', enabled: true, _weight: 2.5 });
	});

	it('keeps the hits the index answered when a source cannot be read at all', async () => {
		// "A source that cannot be read at all is reported and the hits are kept: a transient read failure
		// must not empty a page the index answered correctly."
		const fixture = searchFixture();

		await indexAll(fixture);
		fixture.indexer.readSourceRows = async () => {
			throw new Error('the source table blinked');
		};

		const hits = await fixture.service.materialise([
			{ entity: 'product_variant', entityId: 'v1', title: 'from the index', score: 1 }
		] as never);

		expect(hits).toEqual([{ entity: 'product_variant', entityId: 'v1', title: 'from the index', score: 1 }]);
	});

	it('drops a hit whose declaration is gone, because there is nothing to re-read it from', async () => {
		const fixture = searchFixture();
		const registry = fixture.registry;

		await indexAll(fixture);

		const original = registry.get('product_variant');

		registry.clear();
		registry.register(PRODUCT);

		const hits = await fixture.service.materialise([
			{ entity: 'product_variant', entityId: 'v1', title: 'orphan', score: 1 }
		] as never);

		expect(hits).toEqual([]);
		expect(original?.entity).toBe('product_variant');
	});
});

describe('SearchService — the page it answers with (doc 05 §3.18)', () => {
	beforeEach(() => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(ORG);
		jest.spyOn(RequestContext, 'hasPermission').mockImplementation((permission: never) => permission === (VISIBLE as never));
	});

	afterEach(() => jest.restoreAllMocks());

	it('bounds the page size whatever the request asks for, and treats a negative offset as none', async () => {
		const fixture = searchFixture({
			variants: Array.from({ length: 5 }, (_value, index) => sourceRow(`v${index}`, { name: `Blue widget ${index}` }))
		});

		await indexAll(fixture);

		const page = await fixture.service.search({ q: 'blue', entities: ['product_variant'], take: 2, skip: -5 });

		expect(page.items).toHaveLength(2);
		expect(page.total).toBe(5);
		expect(page.pageInfo).toMatchObject({ hasNextPage: true, hasPreviousPage: false });
	});

	it('walks a result set with its cursors, which carry the offset they resume at', async () => {
		const fixture = searchFixture({
			variants: Array.from({ length: 5 }, (_value, index) => sourceRow(`v${index}`, { name: `Blue widget ${index}` }))
		});

		await indexAll(fixture);

		const first = await fixture.service.search({ q: 'blue', entities: ['product_variant'], take: 2 });
		const second = await fixture.service.search({
			q: 'blue',
			entities: ['product_variant'],
			take: 2,
			skip: decodeCursor(first.pageInfo.endCursor ?? undefined)
		});

		expect(decodeCursor(first.pageInfo.endCursor ?? undefined)).toBe(2);
		expect(second.pageInfo.hasPreviousPage).toBe(true);
		expect(second.items.map((hit) => hit.entityId)).not.toEqual(first.items.map((hit) => hit.entityId));
		// The codec is a round trip, and a cursor that carries nothing resumes at the beginning.
		expect(decodeCursor(encodeCursor(7))).toBe(7);
		expect(decodeCursor('not-a-cursor')).toBe(0);
		expect(decodeCursor()).toBe(0);
	});

	it('suggests indexed titles, bounded by the configured limit', async () => {
		const fixture = searchFixture();

		await indexAll(fixture);

		const suggestions = await fixture.service.suggest({ q: 'blue', entities: ['product_variant', 'product'] }, 1);

		expect(suggestions).toHaveLength(1);
		expect(suggestions[0]).toMatchObject({ entity: 'product_variant' });
		expect(suggestions[0].text).toContain('Blue widget');
	});
});
