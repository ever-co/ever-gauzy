/**
 * `@gauzy/core` boots the whole application graph from its barrel — configuration, the ORM, the job
 * registry, the module scanner — none of which the built-in provider needs and none of which is
 * available outside a running application. The seam is doubled at the module boundary and **the
 * provider under test is the real one**: what is substituted is the query builder, which records the
 * statement the provider states rather than executing it.
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
		MikroOrmBaseEntityRepository: class {},
		ColumnIndex: decorator,
		MultiORMColumn: decorator,
		MultiORMEntity: decorator,
		JsonColumn: decorator,
		SearchDocument: class {},
		SearchIndexDefinition: class {},
		SearchModule: class {},
		TypeOrmSearchDocumentRepository: class {},
		TypeOrmSearchIndexDefinitionRepository: class {},
		RequestContext: {
			currentUser: () => null,
			currentUserId: () => null,
			currentTenantId: () => null,
			currentOrganizationId: () => null,
			currentEmployeeId: () => null,
			hasPermission: () => false,
			hasRoles: () => false
		},
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

import { ISearchIndexRegistration, SearchFieldKind, SearchFilterOperator, SearchSortDirection } from '@gauzy/contracts';
import { RequestContext } from '@gauzy/core';
import { SearchIndexRegistry } from '../registry/search-index.registry';
import { DatabaseSearchProvider } from './database-search.provider';

/**
 * The statement the built-in provider writes, per dialect.
 *
 * The branch was verified on SQLite alone, and SQLite is the one dialect on which every one of these
 * defects is invisible: its `keywords` column really is text, and its `CAST(… AS NUMERIC)` answers
 * zero for anything that is not a number rather than refusing the statement. So this suite asserts the
 * **SQL**, on each of the three dialect families, for the four things that differ:
 *
 * - **the token list is JSON on every dialect**, so a keyword predicate renders the column as text
 *   before it lowercases it — Postgres has no `lower(jsonb)` — and matches one element by its quotes
 *   rather than by a comma, which no JSON array ever contains between two tokens;
 * - **an attribute expression is built for the field's declared kind**: a decimal cast for a number, a
 *   normalised 0/1 for a boolean and the raw text extraction for text, keywords, entity ids and dates,
 *   because ISO-8601 text is what the document holds and what compares chronologically;
 * - **a caller's `%` is a character and not a wildcard**, so every pattern built from request text is
 *   escaped and carries its escape clause;
 * - **a degraded capability expires and cannot be triggered by a request-shaped failure**, so one
 *   malformed filter cannot switch JSON-path ranking off for every tenant of the process.
 */

type Fragment = { sql: string; params: Record<string, unknown> };

/** One declaration: `sku` is promoted, the rest live in the attribute map. */
const DECLARATION: ISearchIndexRegistration = {
	entity: 'product',
	label: 'Products',
	permission: 'ORG_INVENTORY_VIEW' as never,
	titleTemplate: '{{name}}',
	keywordFields: ['sku'],
	sourceUpdatedAtField: 'updatedAt',
	defaultWeight: 1,
	fields: [
		{ name: 'sku', kind: SearchFieldKind.KEYWORD, weight: 3, searchable: true, filterable: true, facetable: true },
		{ name: 'name', kind: SearchFieldKind.TEXT, weight: 2, searchable: true, filterable: true, facetable: false },
		{ name: 'tags', kind: SearchFieldKind.KEYWORD, weight: 2, searchable: true, filterable: true, facetable: true },
		{ name: 'publishedAt', kind: SearchFieldKind.DATE, weight: 1, searchable: false, filterable: true, facetable: true },
		{ name: 'price', kind: SearchFieldKind.NUMBER, weight: 1, searchable: false, filterable: true, facetable: true },
		{ name: 'enabled', kind: SearchFieldKind.BOOLEAN, weight: 1, searchable: false, filterable: true, facetable: true }
	]
};

/**
 * Builds the provider over a query builder that records rather than executes.
 *
 * @param dialect The connection's dialect, as TypeORM spells it.
 * @param failWith A failure the page query raises the first time it is run, so the degrade-and-retry
 * path can be exercised.
 */
function providerFixture(dialect: string, failWith?: string) {
	const statements: Fragment[][] = [];
	const orderings: Array<[string, string]> = [];
	let attempts = 0;

	const createQueryBuilder = (): any => {
		const fragments: Fragment[] = [];

		statements.push(fragments);

		const query: any = {
			where: (sql: string, params: Record<string, unknown> = {}) => {
				fragments.push({ sql, params });

				return query;
			},
			andWhere: (sql: string, params: Record<string, unknown> = {}) => {
				fragments.push({ sql, params });

				return query;
			},
			select: () => query,
			addSelect: (expression: string, alias?: string) => {
				fragments.push({ sql: `SELECT ${expression} AS ${alias ?? ''}`, params: {} });

				return query;
			},
			groupBy: (expression: string) => {
				fragments.push({ sql: `GROUP BY ${expression}`, params: {} });

				return query;
			},
			orderBy: (column: string, direction: string) => {
				orderings.push([column, direction]);

				return query;
			},
			addOrderBy: (column: string, direction: string) => {
				orderings.push([column, direction]);

				return query;
			},
			skip: () => query,
			take: () => query,
			limit: () => query,
			getCount: async () => {
				attempts += 1;

				if (failWith && attempts === 1) {
					throw new Error(failWith);
				}

				// One hit, so the page query — and with it the ranking expression and the ordering — is
				// actually built. A count of zero short-circuits it, and the ranking is half of what this
				// suite is about.
				return 1;
			},
			getMany: async () => {
				attempts += 1;

				if (failWith && attempts === 1) {
					throw new Error(failWith);
				}

				return [];
			},
			getRawAndEntities: async () => ({ entities: [], raw: [] }),
			getRawMany: async () => []
		};

		return query;
	};

	const repository: any = {
		manager: { connection: { options: { type: dialect } } },
		createQueryBuilder,
		softDelete: async (criteria: Record<string, unknown>) => {
			statements.push([{ sql: 'SOFT DELETE', params: criteria }]);

			return { affected: 1 };
		}
	};

	const registry = new SearchIndexRegistry({ entityMetadatas: [{ tableName: 'product' }] } as never);

	registry.register(DECLARATION);

	return {
		provider: new DatabaseSearchProvider(repository, registry),
		/** Every fragment of every statement the provider stated, flattened. */
		sql: () => statements.flat().map((fragment) => fragment.sql),
		/** Every parameter value the provider bound, flattened. */
		values: () =>
			statements
				.flat()
				.flatMap((fragment) => Object.values(fragment.params))
				.map((value) => String(value)),
		orderings,
		statements
	};
}

describe('DatabaseSearchProvider — the promoted token list is a JSON array on every dialect', () => {
	beforeEach(() => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue('tenant-1' as never);
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(null);
	});

	afterEach(() => jest.restoreAllMocks());

	it.each([
		['postgres', 'CAST(doc.keywords AS TEXT)'],
		['mysql', 'CAST(doc.keywords AS CHAR)'],
		['better-sqlite3', 'doc.keywords']
	])('renders the token column as text before lowercasing it on %s', async (dialect, expression) => {
		// `lower(jsonb)` does not exist on Postgres, and the column is `jsonb` there and `json` on MySQL.
		// Every keyword predicate used to run `LOWER(doc.keywords)` directly, which aborted the whole
		// statement — so type-ahead, channel-scoped search and every promoted filter answered 500.
		const fixture = providerFixture(dialect);

		await fixture.provider.suggest({ q: 'wid' } as never, ['product'], 5);

		expect(fixture.sql().some((sql) => sql.includes(`LOWER(${expression})`))).toBe(true);
	});

	it.each([['postgres'], ['mysql']])(
		'never applies LOWER to the JSON column itself on %s',
		async (dialect) => {
			const fixture = providerFixture(dialect);

			await fixture.provider.suggest({ q: 'wid' } as never, ['product'], 5);

			expect(fixture.sql().some((sql) => /LOWER\(doc\.keywords\)/.test(sql))).toBe(false);
		}
	);

	it('matches one element of the encoded array rather than a comma-joined string', async () => {
		// `buildKeywords` returns `['sku:abc']` and the column holds `["sku:abc"]`. The old predicate
		// compared against `x`, `x,%`, `%,x` and `%,x,%` — none of which a JSON array can satisfy, which
		// is why every channel-scoped search and every promoted `EQ` filter matched no row at all.
		const fixture = providerFixture('better-sqlite3');

		await fixture.provider.query(
			{ filters: [{ attribute: 'sku', operator: SearchFilterOperator.EQ, value: 'SKU-1' }] } as never,
			['product']
		);

		expect(fixture.values()).toContain('%"sku:sku-1"%');
		expect(fixture.values().some((value) => value.includes('sku:sku-1,'))).toBe(false);
	});

	it('scopes a channel-scoped search on the channel token, matched the same way', async () => {
		const fixture = providerFixture('better-sqlite3');

		await fixture.provider.query({ q: 'widget', channelId: 'Channel-9' } as never, ['product']);

		expect(fixture.values()).toContain('%"channelid:channel-9"%');
	});
});

describe('DatabaseSearchProvider — an attribute expression is built for the declared kind', () => {
	beforeEach(() => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue('tenant-1' as never);
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(null);
	});

	afterEach(() => jest.restoreAllMocks());

	it.each([
		['postgres', `doc.attributes ->> 'publishedAt'`],
		['mysql', `JSON_UNQUOTE(JSON_EXTRACT(doc.attributes, '$.publishedAt'))`],
		['better-sqlite3', `json_extract(doc.attributes, '$.publishedAt')`]
	])('compares a date as text on %s rather than casting it to a decimal', async (dialect, expression) => {
		// The other half of the comparison is the ISO-8601 string the document holds, and ISO-8601 text
		// compares chronologically. A decimal cast raises `22P02` on Postgres, truncates to zero on MySQL
		// and evaluates `'2024-01-01T…'` as `2024` on SQLite — so every date in one year compared equal
		// and the range filter returned the wrong rows with no error anywhere.
		const fixture = providerFixture(dialect);

		await fixture.provider.query(
			{
				filters: [
					{
						attribute: 'publishedAt',
						operator: SearchFilterOperator.BETWEEN,
						value: ['2024-01-01T00:00:00.000Z', '2024-12-31T00:00:00.000Z']
					}
				]
			} as never,
			['product']
		);

		expect(fixture.sql().some((sql) => sql.includes(`${expression} >=`))).toBe(true);
		// No numeric cast anywhere near the date. The document's own weight is still a number and is
		// still cast, which is why the assertion is about the fragments that mention the field.
		expect(
			fixture
				.sql()
				.filter((sql) => sql.includes('publishedAt'))
				.every((sql) => !/DECIMAL|AS NUMERIC/.test(sql))
		).toBe(true);
	});

	it('keeps the decimal cast for a number, which really is compared as one', async () => {
		const fixture = providerFixture('postgres');

		await fixture.provider.query(
			{ filters: [{ attribute: 'price', operator: SearchFilterOperator.GTE, value: 10 }] } as never,
			['product']
		);

		expect(
			fixture.sql().some((sql) => sql.includes(`CAST(doc.attributes ->> 'price' AS DECIMAL(20,6)) >=`))
		).toBe(true);
	});

	it('normalises a boolean to one or zero, because the three dialects extract a JSON true differently', async () => {
		// Postgres and MySQL yield the string `'true'`; SQLite's `json_extract` yields the integer `1`.
		// `comparable` produces 1 or 0 for the value, so the column has to produce 1 or 0 as well.
		const fixture = providerFixture('better-sqlite3');

		await fixture.provider.query(
			{ filters: [{ attribute: 'enabled', operator: SearchFilterOperator.EQ, value: true }] } as never,
			['product']
		);

		expect(fixture.sql().some((sql) => /CASE WHEN .* IN \('true', '1', 't', 'yes'\) THEN 1 ELSE 0 END/.test(sql))).toBe(
			true
		);
	});

	it('matches a member of a multi-valued keyword attribute as well as a scalar one', async () => {
		// `buildAttributes` writes `["urgent","legal"]` for a list-valued field, so equality against the
		// scalar alone matches none of its members.
		const fixture = providerFixture('postgres');

		await fixture.provider.query(
			{ filters: [{ attribute: 'tags', operator: SearchFilterOperator.EQ, value: 'urgent' }] } as never,
			['product']
		);

		expect(fixture.values()).toContain('%"urgent"%');
	});

	it('orders by the text extraction of a date rather than by a decimal cast of it', async () => {
		const fixture = providerFixture('postgres');

		await fixture.provider.query(
			{
				q: 'widget',
				sort: { attribute: 'publishedAt', direction: SearchSortDirection.ASC }
			} as never,
			['product']
		);

		expect(fixture.orderings.some(([column]) => column === `doc.attributes ->> 'publishedAt'`)).toBe(true);
	});
});

describe('DatabaseSearchProvider — a caller’s wildcard is a character, not a wildcard', () => {
	beforeEach(() => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue('tenant-1' as never);
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(null);
	});

	afterEach(() => jest.restoreAllMocks());

	it('escapes the wildcards of a term and states the escape character', async () => {
		// `q=%` produced `LIKE '%%%'`, which matches every document the caller may see: the term filter
		// was bypassed wholesale and the index could be enumerated one page at a time.
		const fixture = providerFixture('better-sqlite3');

		await fixture.provider.query({ q: '%widget_1' } as never, ['product']);

		expect(fixture.values()).toContain('%!%widget!_1%');
		expect(fixture.sql().some((sql) => sql.includes(`ESCAPE '!'`))).toBe(true);
	});

	it('keeps a punctuation-only term away from the text-search parser rather than handing it over', async () => {
		// `to_tsquery('simple', ',')` raises `syntax error in tsquery`, which is a 500 produced by a
		// search box. The term is not discarded either — that would answer a different question from the
		// one the caller asked — so the whole query falls back to the portable path, which can match any
		// character.
		const fixture = providerFixture('postgres');

		await fixture.provider.query({ q: ', widget' } as never, ['product']);

		expect(fixture.sql().some((sql) => sql.includes('to_tsquery'))).toBe(false);
		expect(fixture.values()).toContain('%,%');
		expect(fixture.values()).toContain('%widget%');
	});

	it('still uses the text-search capability when every term is one its parser can read', async () => {
		const fixture = providerFixture('postgres');

		await fixture.provider.query({ q: 'blue widget' } as never, ['product']);

		expect(fixture.sql().some((sql) => sql.includes('to_tsquery'))).toBe(true);
		// The lexemes are quoted inside the tsquery, so a term that still carries a separator character
		// cannot be read as one by the parser.
		expect(fixture.values()).toContain(`'blue' | 'widget'`);
	});

	it('strips MySQL’s boolean-mode prefix operators, which the ALL branch prefixes its own onto', async () => {
		// `q=-foo` built `AGAINST ('+-foo*' IN BOOLEAN MODE)`, which the server refuses outright.
		const fixture = providerFixture('mysql');

		await fixture.provider.query({ q: '-foo', matchMode: 'ALL' } as never, ['product']);

		expect(fixture.values().some((value) => value.includes('+-foo'))).toBe(false);
		expect(fixture.values()).toContain('+foo*');
	});
});

describe('DatabaseSearchProvider — a degraded capability is scoped in time and in cause', () => {
	beforeEach(() => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue('tenant-1' as never);
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(null);
	});

	afterEach(() => jest.restoreAllMocks());

	it('does not degrade a capability over a failure the request’s own values produced', async () => {
		// `operator does not exist` used to be enough to switch JSON-path ranking off — and that is the
		// exact wording Postgres uses for an ordinary type mismatch between a column and a parameter. One
		// malformed filter therefore disabled weighted ranking and every attribute facet for every tenant
		// of the process, permanently.
		const fixture = providerFixture('postgres', 'invalid input syntax for type numeric: "abc"');

		await expect(fixture.provider.query({ q: 'widget' } as never, ['product'])).rejects.toThrow(
			/invalid input syntax/
		);

		// Nothing was switched off on this provider: the next query through the same instance still ranks
		// by the document's own weight rather than by the constant the degraded path falls back to.
		await fixture.provider.query({ q: 'widget' } as never, ['product']);

		expect(fixture.sql().some((sql) => sql.includes(`doc.attributes ->> '_weight'`))).toBe(true);
	});

	it('degrades and retries when the failure names the JSON capability itself', async () => {
		const fixture = providerFixture('postgres', 'function jsonb_path_query does not exist');

		await fixture.provider.query({ q: 'widget' } as never, ['product']);

		// Two attempts: the failing one and the retry, and the retry ranks by the constant weight.
		expect(fixture.statements.length).toBeGreaterThan(1);
	});

	it('gives type-ahead the same degrade-and-retry the page query has', async () => {
		// `suggest` had no recovery at all, so a capability the connection had just proved unusable
		// surfaced as a 500 on every keystroke while the search box beside it recovered.
		const fixture = providerFixture('postgres', 'function json_extract does not exist');

		await expect(fixture.provider.suggest({ q: 'wid' } as never, ['product'], 5)).resolves.toEqual([]);
	});
});

describe('DatabaseSearchProvider — a scope that does not resolve narrows the read', () => {
	afterEach(() => jest.restoreAllMocks());

	it('selects only the genuinely tenant-less rows when no tenant resolves', async () => {
		// The predicate used to be omitted entirely, so a call that reached the provider outside a
		// request — a sweep, an outbox consumer — matched every tenant's documents.
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(null);
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(null);

		const fixture = providerFixture('better-sqlite3');

		await fixture.provider.query({ q: 'widget' } as never, ['product']);

		expect(fixture.sql()).toContain('doc.tenantId IS NULL');
	});

	it('removes only the copies of a document the caller’s tenant and engine own', async () => {
		// The row is keyed by `(tenant, entity, entityId, engine)`; a removal keyed on two of those four
		// took out every tenant's copy and an external engine's rows for the same source.
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue('tenant-1' as never);

		const fixture = providerFixture('better-sqlite3');

		await fixture.provider.delete('product', ['p1'], { tenantId: 'tenant-1' as never, engineKey: null });

		const criteria = fixture.statements.flat().find((fragment) => fragment.sql === 'SOFT DELETE')?.params ?? {};

		expect(criteria).toMatchObject({ entity: 'product', tenantId: 'tenant-1' });
		expect(Object.keys(criteria)).toContain('engineKey');
	});

	it('keeps the two-argument removal working, so a caller that means every copy still gets one', async () => {
		const fixture = providerFixture('better-sqlite3');

		await fixture.provider.delete('product', ['p1']);

		const criteria = fixture.statements.flat().find((fragment) => fragment.sql === 'SOFT DELETE')?.params ?? {};

		expect(Object.keys(criteria)).toEqual(['entity', 'entityId']);
	});
});
