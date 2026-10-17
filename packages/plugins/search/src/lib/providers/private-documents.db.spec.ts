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
import { buildDocument, isRowVisible } from '../services/search-document.builder';
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
 * Four indexed documents of one tenant and one organization, all matching "salary", and their source
 * rows in the documents table:
 * - A, organization-wide, indexed under the shipped declaration — a hit;
 * - B, private, indexed before the row rule existed, as every installation that ran search holds it;
 * - C, organization-wide when it was indexed and made private since, before the change event reached
 *   the indexer — the stored document still says what it said then;
 * - D, organization-wide, indexed before the row rule existed — still a hit, with no reindex needed.
 */
class SearchDocumentRow {}
class DocumentRow {}

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

/** The documents table the rule is read from: the columns the predicate touches. */
const DOCUMENT_SCHEMA = new EntitySchema<any>({
	name: 'Document',
	target: DocumentRow,
	tableName: 'document',
	columns: {
		id: { type: 'varchar', primary: true },
		deletedAt: { type: 'datetime', nullable: true, deleteDate: true },
		tenantId: { type: 'varchar', nullable: true },
		organizationId: { type: 'varchar', nullable: true },
		name: { type: 'varchar' },
		visibility: { type: 'varchar', length: 16, default: 'ORGANIZATION' }
	}
});

const TENANT = '00000000-0000-4000-8000-000000000001';
const OTHER_TENANT = '00000000-0000-4000-8000-000000000009';
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

const A = documentRow('00000000-0000-4000-8000-00000000000a', 'Salary bands 2026', 'ORGANIZATION');
const B = documentRow('00000000-0000-4000-8000-00000000000b', 'Salary of Alice', 'PRIVATE');
const C = documentRow('00000000-0000-4000-8000-00000000000c', 'Salary of Bob', 'ORGANIZATION');
const D = documentRow('00000000-0000-4000-8000-00000000000d', 'Salary policy', 'ORGANIZATION');

/** The document declaration as it stood before it carried a row rule. */
function declarationBeforeTheRule(): ISearchIndexRegistration {
	const { visibleWhen: _rule, ...rest } = DOCUMENT_INDEX as ISearchIndexRegistration & { visibleWhen?: unknown };

	return { ...rest, fields: rest.fields.filter((field) => field.name !== 'visibility') };
}

describe('search does not show PRIVATE documents (R7-05), on a real database', () => {
	let dataSource: DataSource;
	let provider: DatabaseSearchProvider;

	beforeAll(async () => {
		dataSource = new DataSource({
			type: 'better-sqlite3',
			database: ':memory:',
			entities: [SEARCH_DOCUMENT_SCHEMA, DOCUMENT_SCHEMA],
			synchronize: true,
			logging: false
		});
		await dataSource.initialize();

		const registry = new SearchIndexRegistry(dataSource);
		registry.register(DOCUMENT_INDEX);
		provider = new DatabaseSearchProvider(dataSource.getRepository(SearchDocumentRow) as any, registry);

		const scope = { tenantId: TENANT, organizationId: ORG, channelIds: [] };
		await provider.index([
			buildDocument(DOCUMENT_INDEX, A, scope),
			buildDocument(declarationBeforeTheRule(), B, scope),
			buildDocument(DOCUMENT_INDEX, C, scope),
			buildDocument(declarationBeforeTheRule(), D, scope)
		]);

		const documents = dataSource.getRepository(DocumentRow);
		for (const row of [A, B, C, D]) {
			await documents.insert({
				id: row.id,
				tenantId: row.tenantId,
				organizationId: row.organizationId,
				name: row.name,
				visibility: row.visibility
			});
		}
		// C is made private after it was indexed; the change event has not reached the indexer yet.
		await documents.update({ id: C.id }, { visibility: 'PRIVATE' });
		// Another tenant's row that happens to carry A's id must not decide A's visibility, nor vice versa.
		await documents.insert({
			id: 'other-tenant-row',
			tenantId: OTHER_TENANT,
			name: 'x',
			visibility: 'ORGANIZATION'
		});
	});

	afterAll(async () => {
		await dataSource?.destroy();
	});

	beforeEach(() => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(ORG);
	});

	afterEach(() => jest.restoreAllMocks());

	it('CONTROL: all four documents are stored and match the text', async () => {
		const stored = await dataSource.query(
			`SELECT "entityId", "title" FROM "search_document" WHERE "deletedAt" IS NULL`
		);

		expect(stored).toHaveLength(4);
		expect(stored.every((row: { title: string }) => /salary/i.test(row.title))).toBe(true);
	});

	it('answers only the documents whose row is organization-wide now, and counts only them', async () => {
		const result = await provider.query({ q: 'salary', organizationId: ORG }, ['document']);

		expect(result.items.map((hit) => hit.entityId).sort()).toEqual([A.id, D.id].sort());
		// The total is what the caller may see: a total of 4 beside two hits would be the leak itself.
		expect(result.total).toBe(2);
	});

	it('suggests only those documents', async () => {
		const suggestions = JSON.stringify(
			await provider.suggest({ q: 'salary', organizationId: ORG }, ['document'], 10)
		);

		expect(suggestions).toContain('Salary bands 2026');
		expect(suggestions).toContain('Salary policy');
		expect(suggestions).not.toMatch(/Alice|Bob/);
	});

	it('counts only those documents in a facet', async () => {
		const result = await provider.query({ q: 'salary', organizationId: ORG, facets: ['kind'] }, ['document']);

		expect(result.facets).toEqual([{ attribute: 'kind', values: [{ value: 'file', count: 2 }] }]);
	});

	it('compares the rule without regard to case, as the declaration promises and the indexer does', async () => {
		// A rule spelled in lower case admits the rows the column stores in upper case, on every dialect:
		// PostgreSQL and SQLite compare text case-sensitively, so a bare IN refused rows the indexer wrote.
		const rule = { ...DOCUMENT_INDEX, visibleWhen: { field: 'visibility', values: ['organization'] } };
		const registry = new SearchIndexRegistry(dataSource);
		registry.register(rule);
		const lowerCased = new DatabaseSearchProvider(dataSource.getRepository(SearchDocumentRow) as any, registry);

		const result = await lowerCased.query({ q: 'salary', organizationId: ORG }, ['document']);

		expect(isRowVisible(rule, A)).toBe(true);
		expect(result.items.map((hit) => hit.entityId).sort()).toEqual([A.id, D.id].sort());
	});

	it('hides a document whose row was deleted, and one whose row belongs to another tenant', async () => {
		await dataSource.getRepository(DocumentRow).softDelete({ id: D.id });
		await dataSource.query(`UPDATE "document" SET "tenantId" = ? WHERE "id" = ?`, [OTHER_TENANT, A.id]);

		const result = await provider.query({ q: 'salary', organizationId: ORG }, ['document']);

		expect(result.items).toEqual([]);
		expect(result.total).toBe(0);
	});
});

describe('a declaration row rule (R7-05)', () => {
	const registryOf = () => new SearchIndexRegistry({ entityMetadatas: [] } as unknown as DataSource);

	it('the shipped document declaration admits ORGANIZATION documents only', () => {
		expect(DOCUMENT_INDEX.visibleWhen).toEqual({ field: 'visibility', values: ['ORGANIZATION'] });
		expect(isRowVisible(DOCUMENT_INDEX, A)).toBe(true);
		expect(isRowVisible(DOCUMENT_INDEX, B)).toBe(false);
		// A row with no value is outside the rule: closed, not open.
		expect(isRowVisible(DOCUMENT_INDEX, { ...A, visibility: null })).toBe(false);
	});

	it('is refused over a field read through a relation path, or one that is not declared', () => {
		const viaRelation = DOCUMENT_INDEX.fields.map((field) =>
			field.name === 'visibility' ? { ...field, source: 'folder.visibility' } : field
		);

		expect(() => registryOf().register({ ...DOCUMENT_INDEX, fields: viaRelation })).toThrow(
			/column of the source row/
		);
		expect(() =>
			registryOf().register({ ...DOCUMENT_INDEX, visibleWhen: { field: 'nothing', values: ['ORGANIZATION'] } })
		).toThrow(/column of the source row/);
	});

	it('is refused when it admits no value, since no row could ever be found', () => {
		expect(() =>
			registryOf().register({ ...DOCUMENT_INDEX, visibleWhen: { field: 'visibility', values: [] } })
		).toThrow(/admits no value/);
	});
});
