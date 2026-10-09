import { DataSource, DataSourceOptions, EntitySchema, Repository } from 'typeorm';
import { AccountingTemplateTypeEnum, LanguagesEnum } from '@gauzy/contracts';
import { globalAccountingTemplateWhere, tenantAccountingTemplateWhere } from './accounting-template.criteria';

/**
 * Regression suite for GHSA-44pv-34gx-q9p4 — cross-tenant accounting-template disclosure.
 *
 * `GET /accounting-template/template` falls back to the GLOBAL template (tenantId IS NULL AND
 * organizationId IS NULL) when the caller's tenant has none. That fallback used to be spelled with a
 * literal `null`, which TypeORM silently dropped from the SQL, so "the global template" became "any
 * tenant's template with this language and type" — another tenant's invoice/estimate/receipt HTML.
 *
 * These are the criteria the service actually runs — imported, not re-declared. They are exercised
 * against a real better-sqlite3 database under BOTH the fixed connection setting and the pre-fix
 * `null: 'ignore'` one, because the criteria must be safe regardless of what the connection is
 * configured to do with a null. Every "the fix works" test is paired with a CONTROL running the
 * pre-fix shape so the suite is proven to discriminate.
 */

const AccountingTemplateSchema = new EntitySchema({
	name: 'AccountingTemplate',
	tableName: 'accounting_template',
	columns: {
		id: { primary: true, type: 'varchar', generated: 'uuid' },
		name: { type: 'varchar' },
		languageCode: { type: 'varchar' },
		templateType: { type: 'varchar' },
		mjml: { type: 'text', nullable: true },
		tenantId: { type: 'varchar', nullable: true },
		organizationId: { type: 'varchar', nullable: true }
	}
});

const TENANT_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const TENANT_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const ORG_A1 = 'a1a1a1a1-a1a1-4a1a-8a1a-a1a1a1a1a1a1';
const ORG_A2 = 'a2a2a2a2-a2a2-4a2a-8a2a-a2a2a2a2a2a2';
const ORG_B1 = 'b1b1b1b1-b1b1-4b1b-8b1b-b1b1b1b1b1b1';

const { INVOICE } = AccountingTemplateTypeEnum;
const { ENGLISH, BULGARIAN } = LanguagesEnum;

async function openDataSource(invalidWhereValuesBehavior: DataSourceOptions['invalidWhereValuesBehavior']) {
	const dataSource = new DataSource({
		type: 'better-sqlite3',
		database: ':memory:',
		entities: [AccountingTemplateSchema],
		synchronize: true,
		logging: false,
		invalidWhereValuesBehavior
	});
	await dataSource.initialize();
	const templates: Repository<any> = dataSource.getRepository('AccountingTemplate');
	await templates.save([
		// The seeded global template — the only row a cross-tenant fallback may ever return.
		{ name: 'global-en-invoice', languageCode: ENGLISH, templateType: INVOICE, tenantId: null, organizationId: null },
		// Tenant A customized its English invoice for one organization.
		{ name: 'a1-en-invoice', languageCode: ENGLISH, templateType: INVOICE, tenantId: TENANT_A, organizationId: ORG_A1 },
		// Tenant B has a Bulgarian invoice template. There is NO global Bulgarian invoice template.
		{ name: 'b1-bg-invoice', languageCode: BULGARIAN, templateType: INVOICE, tenantId: TENANT_B, organizationId: ORG_B1 },
		{ name: 'b-bg-invoice', languageCode: BULGARIAN, templateType: INVOICE, tenantId: TENANT_B, organizationId: null }
	]);
	return { dataSource, templates };
}

/** The pre-fix criteria shape (commit 51e22b7c22): literal null shared with the MikroORM branch. */
const preFixGlobalWhere = (languageCode: string, templateType: string) => ({
	languageCode,
	templateType,
	organizationId: null as any,
	tenantId: null as any
});

describe('accounting-template criteria (GHSA-44pv-34gx-q9p4)', () => {
	let fixed: { dataSource: DataSource; templates: Repository<any> };
	let ignore: { dataSource: DataSource; templates: Repository<any> };

	beforeAll(async () => {
		fixed = await openDataSource({ null: 'sql-null', undefined: 'ignore' }); // what @gauzy/config ships now
		ignore = await openDataSource({ null: 'ignore', undefined: 'ignore' }); // what it shipped before
	});

	afterAll(async () => {
		for (const ds of [fixed?.dataSource, ignore?.dataSource]) {
			if (ds?.isInitialized) await ds.destroy();
		}
	});

	describe('globalAccountingTemplateWhere — the cross-tenant fallback', () => {
		it('returns the seeded global row when one exists', async () => {
			const row = await fixed.templates.findOneBy(globalAccountingTemplateWhere({ languageCode: ENGLISH, templateType: INVOICE }));
			expect(row?.name).toBe('global-en-invoice');
		});

		it("the advisory scenario: tenant A asks for Bulgarian, no global exists -> must NOT get tenant B's template", async () => {
			const row = await fixed.templates.findOneBy(globalAccountingTemplateWhere({ languageCode: BULGARIAN, templateType: INVOICE }));
			expect(row).toBeNull();
		});

		it('is safe even under the pre-fix "ignore" connection setting, because IsNull() is explicit', async () => {
			const row = await ignore.templates.findOneBy(globalAccountingTemplateWhere({ languageCode: BULGARIAN, templateType: INVOICE }));
			expect(row).toBeNull();
			const global = await ignore.templates.findOneBy(globalAccountingTemplateWhere({ languageCode: ENGLISH, templateType: INVOICE }));
			expect(global?.name).toBe('global-en-invoice');
		});

		it("CONTROL: the pre-fix literal-null criteria under the pre-fix setting DO leak tenant B's template", async () => {
			const row = await ignore.templates.findOneBy(preFixGlobalWhere(BULGARIAN, INVOICE));
			expect(row).not.toBeNull();
			expect(row.tenantId).toBe(TENANT_B); // this is the disclosure the advisory reported
		});

		it('the new connection setting alone also closes the pre-fix criteria (defense in depth)', async () => {
			const row = await fixed.templates.findOneBy(preFixGlobalWhere(BULGARIAN, INVOICE));
			expect(row).toBeNull();
		});
	});

	describe('tenantAccountingTemplateWhere — the in-tenant lookups', () => {
		it('never crosses tenants', async () => {
			const rows = await fixed.templates.findBy(
				tenantAccountingTemplateWhere({ languageCode: BULGARIAN, templateType: INVOICE, tenantId: TENANT_A })
			);
			expect(rows).toHaveLength(0);
		});

		it('with an organizationId matches only that organization', async () => {
			const row = await fixed.templates.findOneBy(
				tenantAccountingTemplateWhere({ languageCode: ENGLISH, templateType: INVOICE, tenantId: TENANT_A, organizationId: ORG_A1 })
			);
			expect(row?.name).toBe('a1-en-invoice');
			const other = await fixed.templates.findOneBy(
				tenantAccountingTemplateWhere({ languageCode: ENGLISH, templateType: INVOICE, tenantId: TENANT_A, organizationId: ORG_A2 })
			);
			expect(other).toBeNull();
		});

		it('without an organizationId (undefined OR null) matches any organization in the tenant — the long-standing behavior', async () => {
			for (const organizationId of [undefined, null as any]) {
				const rows = await fixed.templates.findBy(
					tenantAccountingTemplateWhere({ languageCode: BULGARIAN, templateType: INVOICE, tenantId: TENANT_B, organizationId })
				);
				expect(rows.map((r) => r.name).sort()).toEqual(['b-bg-invoice', 'b1-bg-invoice']);
			}
		});
	});
});
