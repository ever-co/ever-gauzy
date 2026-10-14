/**
 * The module boundaries are doubled for the reason this package's other suites state: `@gauzy/core`
 * boots the whole application graph from its barrel and `@gauzy/config` reads the environment at import
 * time. What is real here is everything between a source row and a page of hits: the shipped document
 * declaration, the document builder, the built-in provider and the SQL it states, executed by an
 * in-memory better-sqlite3 database through a real TypeORM repository.
 */
jest.mock('@gauzy/core', () => {
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

import { DataSource, EntitySchema } from 'typeorm';
import { ISearchIndexRegistration } from '@gauzy/contracts';
import { RequestContext } from '@gauzy/core';
import { DOCUMENT_INDEX } from '../definitions/document.definition';
import { SearchIndexRegistry } from '../registry/search-index.registry';
import { buildDocument, isRowVisible, visibleRowTokens } from '../services/search-document.builder';
import { DatabaseSearchProvider } from './database-search.provider';

/**
 * Search must not find a document the documents API refuses to show (review R7-05).
 *
 * A `PRIVATE` document is readable by its creator, an administrator and the people it is shared with,
 * never by every holder of `DOCS_READ`, and `DOCS_READ` + `SEARCH_VIEW` are employee defaults. The search
 * index held every document and scoped a query by tenant, organization and entity permission only, so any
 * employee found a colleague's private documents by name, description and file name, in the page, the
 * total, the suggestions and the facets.
 *
 * Three documents of one tenant and one organization, all matching "salary":
 * - an organization-wide one, indexed under the shipped declaration — the one hit there should be;
 * - a private one indexed **before** the row rule existed (no visibility token at all), as every
 *   installation that ran search before this change holds it;
 * - a private one whose stored tokens say so, as a document whose row became private after it was
 *   indexed would hold it.
 */
class SearchDocumentRow {}

const SEARCH_DOCUMENT_SCHEMA = new EntitySchema<any>({
	name: 'SearchDocument',
	target: SearchDocumentRow,
	tableName: 'search_document',
	columns: {
		id: { type: 'varchar', primary: true, generated: 'uuid' },
		createdAt: { type: 'datetime', createDate: true },
		updatedAt: { type: 'datetime', updateDate: true },
		deletedAt: { type: 'datetime', nullable: true, deleteDate: true },
		tenantId: { type: 'varchar', nullable: true },
		organizationId: { type: 'varchar', nullable: true },
		entity: { type: 'varchar' },
		entityId: { type: 'varchar' },
		title: { type: 'varchar' },
		body: { type: 'text', nullable: true },
		keywords: { type: 'simple-json', nullable: true },
		attributes: { type: 'simple-json', nullable: true },
		sourceUpdatedAt: { type: 'datetime', nullable: true },
		indexedAt: { type: 'datetime', nullable: true },
		engineKey: { type: 'varchar', nullable: true },
		definitionVersion: { type: 'int', default: 1 }
	}
});

const TENANT = '00000000-0000-4000-8000-000000000001';
const ORG = '00000000-0000-4000-8000-000000000002';

/** A source row of the documents table, as the indexer reads it. */
const documentRow = (id: string, name: string, visibility: string) => ({
	id,
	tenantId: TENANT,
	organizationId: ORG,
	name,
	description: 'salary review notes',
	originalFilename: `${name.toLowerCase().replace(/\s+/g, '-')}.pdf`,
	mimeType: 'application/pdf',
	kind: 'FILE',
	status: 'ACTIVE',
	visibility,
	tags: [],
	updatedAt: new Date('2026-10-01T10:00:00.000Z')
});

const ORGANIZATION_DOCUMENT = documentRow('00000000-0000-4000-8000-00000000000a', 'Salary bands 2026', 'ORGANIZATION');
const PRIVATE_BEFORE_THE_RULE = documentRow('00000000-0000-4000-8000-00000000000b', 'Salary of Alice', 'PRIVATE');
const PRIVATE_WITH_TOKENS = documentRow('00000000-0000-4000-8000-00000000000c', 'Salary of Bob', 'PRIVATE');

/** The document declaration as it stood before it carried a row rule. */
function declarationBeforeTheRule(): ISearchIndexRegistration {
	const { visibleWhen: _rule, ...rest } = DOCUMENT_INDEX as ISearchIndexRegistration & { visibleWhen?: unknown };

	return {
		...rest,
		keywordFields: (rest.keywordFields ?? []).filter((name) => name !== 'visibility'),
		fields: rest.fields.filter((field) => field.name !== 'visibility')
	};
}

describe('search does not show PRIVATE documents (R7-05), on a real database', () => {
	let dataSource: DataSource;
	let provider: DatabaseSearchProvider;

	beforeAll(async () => {
		dataSource = new DataSource({
			type: 'better-sqlite3',
			database: ':memory:',
			entities: [SEARCH_DOCUMENT_SCHEMA],
			synchronize: true,
			logging: false
		});
		await dataSource.initialize();

		const registry = new SearchIndexRegistry(dataSource);
		registry.register(DOCUMENT_INDEX);
		provider = new DatabaseSearchProvider(dataSource.getRepository(SearchDocumentRow) as any, registry);

		const scope = { tenantId: TENANT, organizationId: ORG, channelIds: [] };
		await provider.index([
			buildDocument(DOCUMENT_INDEX, ORGANIZATION_DOCUMENT, scope),
			buildDocument(declarationBeforeTheRule(), PRIVATE_BEFORE_THE_RULE, scope),
			buildDocument(DOCUMENT_INDEX, PRIVATE_WITH_TOKENS, scope)
		]);
	});

	afterAll(async () => {
		await dataSource?.destroy();
	});

	beforeEach(() => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(ORG);
	});

	afterEach(() => jest.restoreAllMocks());

	it('CONTROL: all three documents are stored and match the text', async () => {
		const stored = await dataSource.query(
			`SELECT "entityId", "title" FROM "search_document" WHERE "deletedAt" IS NULL`
		);

		expect(stored).toHaveLength(3);
		expect(stored.every((row: { title: string }) => /salary/i.test(row.title))).toBe(true);
	});

	it('answers only the organization-wide document, and counts only it', async () => {
		const result = await provider.query({ q: 'salary', organizationId: ORG }, ['document']);

		expect(result.items.map((hit) => hit.entityId)).toEqual([ORGANIZATION_DOCUMENT.id]);
		// The total is what the caller may see: a total of 3 beside one hit would be the leak itself.
		expect(result.total).toBe(1);
	});

	it('suggests only the organization-wide document', async () => {
		const suggestions = await provider.suggest({ q: 'salary', organizationId: ORG }, ['document'], 10);

		expect(JSON.stringify(suggestions)).toContain('Salary bands 2026');
		expect(JSON.stringify(suggestions)).not.toMatch(/Alice|Bob/);
	});

	it('counts only the organization-wide document in a facet', async () => {
		const result = await provider.query({ q: 'salary', organizationId: ORG, facets: ['kind'] }, ['document']);
		const counted = JSON.stringify(result.facets);

		expect(counted).toContain('"count":1');
		expect(counted).not.toContain('"count":3');
	});
});

describe('a declaration row rule (R7-05)', () => {
	const registryOf = () => new SearchIndexRegistry({ entityMetadatas: [] } as unknown as DataSource);

	it('the shipped document declaration admits ORGANIZATION documents only, over a promoted field', () => {
		expect(DOCUMENT_INDEX.visibleWhen).toEqual({ field: 'visibility', values: ['ORGANIZATION'] });
		expect(DOCUMENT_INDEX.keywordFields).toContain('visibility');
		expect(visibleRowTokens(DOCUMENT_INDEX)).toEqual(['visibility:organization']);
		expect(isRowVisible(DOCUMENT_INDEX, ORGANIZATION_DOCUMENT)).toBe(true);
		expect(isRowVisible(DOCUMENT_INDEX, PRIVATE_WITH_TOKENS)).toBe(false);
		// A row with no value is outside the rule: closed, not open.
		expect(isRowVisible(DOCUMENT_INDEX, { ...ORGANIZATION_DOCUMENT, visibility: null })).toBe(false);
	});

	it('is refused over a field that is not promoted, since no query could apply it', () => {
		const { keywordFields, ...rest } = DOCUMENT_INDEX;

		expect(() =>
			registryOf().register({
				...rest,
				keywordFields: (keywordFields ?? []).filter((name) => name !== 'visibility')
			})
		).toThrow(/not promoted/);
	});

	it('is refused when it admits no value, since no row could ever be found', () => {
		expect(() =>
			registryOf().register({ ...DOCUMENT_INDEX, visibleWhen: { field: 'visibility', values: [] } })
		).toThrow(/admits no value/);
	});
});
