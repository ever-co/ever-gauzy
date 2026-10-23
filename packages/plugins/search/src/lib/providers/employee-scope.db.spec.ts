/**
 * The module boundaries are doubled for the reason this package's other suites state: `@gauzy/core` boots the whole
 * application graph from its barrel and `@gauzy/config` reads the environment at import time. What is real here is
 * everything between a source row and a page of hits: the shipped income declaration, the document builder, the
 * built-in provider and the SQL it states, executed by an in-memory better-sqlite3 database through a real TypeORM
 * repository.
 */
const mockCaller = { employeeId: null as string | null, changesEmployee: false };
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
			currentTenantId: () => '00000000-0000-4000-8000-000000000001',
			currentOrganizationId: () => '00000000-0000-4000-8000-000000000002',
			currentEmployeeId: () => mockCaller.employeeId,
			hasPermission: (permission: string) =>
				permission === 'CHANGE_SELECTED_EMPLOYEE' && mockCaller.changesEmployee,
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
import { INCOME_INDEX } from '../definitions/income.definition';
import { SearchIndexRegistry } from '../registry/search-index.registry';
import { buildDocument } from '../services/search-document.builder';
import { DatabaseSearchProvider } from './database-search.provider';

/**
 * An income belongs to an employee, and `TenantAwareCrudService` shows a caller without CHANGE_SELECTED_EMPLOYEE only
 * their own employee's incomes. Search scoped incomes by tenant, organization and entity permission alone, so a role
 * holding `ORG_INCOMES_VIEW` and `SEARCH_VIEW` but not CHANGE_SELECTED_EMPLOYEE found every colleague's income —
 * client, amount, notes, bonus flag — in the page, the total, the suggestions and the facets.
 *
 * Two incomes of one tenant and one organization, both matching "bonus": one of employee E1, one of employee E2; and
 * another tenant's income of an employee with E1's id, which must not decide anything.
 */
class SearchDocumentRow {}
class IncomeRow {}

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

/** The incomes table the owner is read from: the columns the predicate touches. */
const INCOME_SCHEMA = new EntitySchema<any>({
	name: 'Income',
	target: IncomeRow,
	tableName: 'income',
	columns: {
		id: { type: 'varchar', primary: true },
		tenantId: { type: 'varchar', nullable: true },
		organizationId: { type: 'varchar', nullable: true },
		employeeId: { type: 'varchar', nullable: true }
	}
});

const TENANT = '00000000-0000-4000-8000-000000000001';
const OTHER_TENANT = '00000000-0000-4000-8000-000000000009';
const ORG = '00000000-0000-4000-8000-000000000002';
const E1 = '00000000-0000-4000-8000-0000000000e1';
const E2 = '00000000-0000-4000-8000-0000000000e2';

/** A source row of the incomes table, as the indexer reads it. */
const incomeRow = (id: string, employeeId: string, client: string, amount: number) => ({
	id,
	tenantId: TENANT,
	organizationId: ORG,
	employeeId,
	client: { name: client },
	clientId: null,
	amount,
	currency: 'USD',
	notes: 'annual bonus',
	reference: null,
	isBonus: true,
	valueDate: new Date('2026-10-01T00:00:00.000Z'),
	tags: [],
	updatedAt: new Date('2026-10-01T10:00:00.000Z')
});

const OWN = incomeRow('00000000-0000-4000-8000-0000000000a1', E1, 'Acme', 1000);
const COLLEAGUE = incomeRow('00000000-0000-4000-8000-0000000000a2', E2, 'Globex', 9000);

describe('search keeps an employee to their own incomes, as the income routes do, on a real database', () => {
	let dataSource: DataSource;
	let provider: DatabaseSearchProvider;

	beforeAll(async () => {
		dataSource = new DataSource({
			type: 'better-sqlite3',
			database: ':memory:',
			entities: [SEARCH_DOCUMENT_SCHEMA, INCOME_SCHEMA],
			synchronize: true,
			logging: false
		});
		await dataSource.initialize();

		const registry = new SearchIndexRegistry(dataSource);
		registry.register(INCOME_INDEX);
		provider = new DatabaseSearchProvider(dataSource.getRepository(SearchDocumentRow) as any, registry);

		const scope = { tenantId: TENANT, organizationId: ORG, channelIds: [] };
		await provider.index([buildDocument(INCOME_INDEX, OWN, scope), buildDocument(INCOME_INDEX, COLLEAGUE, scope)]);

		const incomes = dataSource.getRepository(IncomeRow);
		for (const row of [OWN, COLLEAGUE]) {
			await incomes.insert({ id: row.id, tenantId: TENANT, organizationId: ORG, employeeId: row.employeeId });
		}
		// Another tenant's income of an employee with E1's id decides nothing here.
		await dataSource.query(`INSERT INTO "income" ("id", "tenantId", "employeeId") VALUES (?, ?, ?)`, [
			'other-tenant-income',
			OTHER_TENANT,
			E1
		]);
	});

	afterAll(async () => {
		await dataSource?.destroy();
	});

	beforeEach(() => {
		mockCaller.employeeId = null;
		mockCaller.changesEmployee = false;
	});

	const hits = async () =>
		(await provider.query({ q: 'bonus', organizationId: ORG }, ['income'])).items.map((hit) => hit.entityId).sort();

	it('answers an employee without CHANGE_SELECTED_EMPLOYEE their own income only, and counts only it', async () => {
		mockCaller.employeeId = E1;

		const result = await provider.query({ q: 'bonus', organizationId: ORG }, ['income']);

		expect(result.items.map((hit) => hit.entityId)).toEqual([OWN.id]);
		expect(result.total).toBe(1);
	});

	it('suggests and counts in a facet their own income only', async () => {
		mockCaller.employeeId = E1;

		const suggestions = JSON.stringify(await provider.suggest({ q: 'bonus', organizationId: ORG }, ['income'], 10));
		const faceted = await provider.query({ q: 'bonus', organizationId: ORG, facets: ['currency'] }, ['income']);

		expect(suggestions).toContain(OWN.id);
		expect(suggestions).not.toContain(COLLEAGUE.id);
		expect(suggestions).not.toContain('9000');
		expect(faceted.facets).toEqual([{ attribute: 'currency', values: [{ value: 'usd', count: 1 }] }]);
	});

	it('CONTROL: answers every income to a caller who may act for other employees', async () => {
		mockCaller.employeeId = E1;
		mockCaller.changesEmployee = true;

		expect(await hits()).toEqual([OWN.id, COLLEAGUE.id].sort());
	});

	it('CONTROL: keeps the tenant-wide scope for a caller with no employee record, as the income routes do', async () => {
		expect(await hits()).toEqual([OWN.id, COLLEAGUE.id].sort());
	});
});
