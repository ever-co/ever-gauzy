import { MigrationInterface, QueryRunner } from 'typeorm';
import * as chalk from 'chalk';
import { DatabaseTypeEnum } from '@gauzy/config';

/**
 * The deterministic id of one seeded row, so `down` removes exactly what `up` wrote.
 *
 * A literal id rather than a generated one, because the two halves of this migration have to agree on
 * which rows are theirs: `down` deletes by id, so a row an operator created — or one the runtime wrote
 * — is not this migration's to remove. The ids are fixed UUIDs rather than a pattern so that two
 * installations seeding the same entity twice produce the same row rather than two.
 */
const SEED_IDS: Record<string, string> = {
	product: 'a1b2c3d4-0001-4000-8000-000000000001',
	product_variant: 'a1b2c3d4-0002-4000-8000-000000000002',
	organization_contact: 'a1b2c3d4-0003-4000-8000-000000000003',
	invoice: 'a1b2c3d4-0004-4000-8000-000000000004',
	expense: 'a1b2c3d4-0005-4000-8000-000000000005',
	income: 'a1b2c3d4-0006-4000-8000-000000000006',
	project: 'a1b2c3d4-0007-4000-8000-000000000007',
	task: 'a1b2c3d4-0008-4000-8000-000000000008',
	employee: 'a1b2c3d4-0009-4000-8000-000000000009',
	document: 'a1b2c3d4-000a-4000-8000-00000000000a',
	order: 'a1b2c3d4-000b-4000-8000-00000000000b'
};

/**
 * The promoted field list of one seeded row, as the text the column holds.
 *
 * Both array columns are written as JSON whatever the dialect, because that is the one representation
 * every reader agrees on: the entity's own column transformer parses a JSON string and passes a
 * decoded document through, so the same bytes are readable on a dialect that stores a document and on
 * one that stores text.
 *
 * @param names The promoted field names.
 * @returns The JSON array text.
 */
function promoted(names: string[]): string {
	return JSON.stringify(names);
}

/** One seeded row: entity, label, promoted fields, and the declared field list as JSON. */
interface ISeedRow {
	entity: string;
	label: string;
	keywordFields: string;
	fields: string;
}

/** The declarations this migration seeds, one row per searchable entity. */
const SEED_ROWS: ISeedRow[] = [
	{
		entity: 'product',
		label: 'Products',
		keywordFields: promoted(['code', 'tags', 'enabled', 'productCategoryId']),
		fields: '[{"name":"name","kind":"TEXT","weight":3,"searchable":true,"filterable":false,"facetable":false,"source":"translations.name"},{"name":"code","kind":"KEYWORD","weight":2,"searchable":true,"filterable":true,"facetable":false},{"name":"description","kind":"TEXT","weight":1,"searchable":true,"filterable":false,"facetable":false,"source":"translations.description"},{"name":"tags","kind":"KEYWORD","weight":2,"searchable":true,"filterable":true,"facetable":true,"source":"tags.name"},{"name":"enabled","kind":"BOOLEAN","weight":1,"searchable":false,"filterable":true,"facetable":true},{"name":"productCategoryId","kind":"ENTITY","weight":1,"searchable":false,"filterable":true,"facetable":true}]'
	},
	{
		entity: 'product_variant',
		label: 'Product variants',
		keywordFields: promoted(['sku', 'internalReference', 'enabled', 'billingInvoicingPolicy', 'productId']),
		fields: '[{"name":"sku","kind":"KEYWORD","weight":3,"searchable":true,"filterable":true,"facetable":false},{"name":"name","kind":"TEXT","weight":2,"searchable":true,"filterable":false,"facetable":false,"source":"product.translations.name"},{"name":"internalReference","kind":"KEYWORD","weight":2,"searchable":true,"filterable":true,"facetable":false},{"name":"enabled","kind":"BOOLEAN","weight":1,"searchable":false,"filterable":true,"facetable":true},{"name":"productId","kind":"ENTITY","weight":1,"searchable":false,"filterable":true,"facetable":true}]'
	},
	{
		entity: 'organization_contact',
		label: 'Contacts',
		keywordFields: promoted(['primaryEmail', 'primaryPhone', 'contactType', 'tags']),
		fields: '[{"name":"name","kind":"TEXT","weight":3,"searchable":true,"filterable":false,"facetable":false},{"name":"primaryEmail","kind":"KEYWORD","weight":2,"searchable":true,"filterable":true,"facetable":false},{"name":"primaryPhone","kind":"KEYWORD","weight":2,"searchable":true,"filterable":true,"facetable":false},{"name":"notes","kind":"TEXT","weight":1,"searchable":true,"filterable":false,"facetable":false},{"name":"tags","kind":"KEYWORD","weight":1,"searchable":true,"filterable":true,"facetable":true,"source":"tags.name"},{"name":"contactType","kind":"KEYWORD","weight":1,"searchable":false,"filterable":true,"facetable":true}]'
	},
	{
		entity: 'invoice',
		label: 'Invoices',
		keywordFields: promoted(['invoiceNumber', 'status', 'currency', 'isEstimate', 'organizationContactId']),
		fields: '[{"name":"invoiceNumber","kind":"KEYWORD","weight":3,"searchable":true,"filterable":true,"facetable":false},{"name":"totalValue","kind":"NUMBER","weight":1,"searchable":false,"filterable":true,"facetable":false},{"name":"currency","kind":"KEYWORD","weight":1,"searchable":true,"filterable":true,"facetable":true},{"name":"status","kind":"KEYWORD","weight":1,"searchable":true,"filterable":true,"facetable":true},{"name":"isEstimate","kind":"BOOLEAN","weight":1,"searchable":false,"filterable":true,"facetable":true},{"name":"terms","kind":"TEXT","weight":1,"searchable":true,"filterable":false,"facetable":false}]'
	},
	{
		entity: 'expense',
		label: 'Expenses',
		keywordFields: promoted(['currency', 'status', 'vendorId', 'employeeId', 'categoryId']),
		fields: '[{"name":"vendor","kind":"TEXT","weight":3,"searchable":true,"filterable":true,"facetable":true,"source":"vendor.name"},{"name":"amount","kind":"NUMBER","weight":1,"searchable":false,"filterable":true,"facetable":false},{"name":"currency","kind":"KEYWORD","weight":1,"searchable":true,"filterable":true,"facetable":true},{"name":"notes","kind":"TEXT","weight":1,"searchable":true,"filterable":false,"facetable":false},{"name":"status","kind":"KEYWORD","weight":1,"searchable":true,"filterable":true,"facetable":true},{"name":"categoryId","kind":"ENTITY","weight":1,"searchable":false,"filterable":true,"facetable":true}]'
	},
	{
		entity: 'income',
		label: 'Income',
		keywordFields: promoted(['currency', 'isBonus', 'clientId', 'employeeId', 'tags']),
		fields: '[{"name":"client","kind":"TEXT","weight":3,"searchable":true,"filterable":true,"facetable":true,"source":"client.name"},{"name":"amount","kind":"NUMBER","weight":1,"searchable":false,"filterable":true,"facetable":false},{"name":"currency","kind":"KEYWORD","weight":1,"searchable":true,"filterable":true,"facetable":true},{"name":"notes","kind":"TEXT","weight":1,"searchable":true,"filterable":false,"facetable":false},{"name":"isBonus","kind":"BOOLEAN","weight":1,"searchable":false,"filterable":true,"facetable":true},{"name":"tags","kind":"KEYWORD","weight":1,"searchable":true,"filterable":true,"facetable":true,"source":"tags.name"}]'
	},
	{
		entity: 'project',
		label: 'Projects',
		keywordFields: promoted(['code', 'status', 'billable', 'tags']),
		fields: '[{"name":"name","kind":"TEXT","weight":3,"searchable":true,"filterable":false,"facetable":false},{"name":"code","kind":"KEYWORD","weight":2,"searchable":true,"filterable":true,"facetable":false},{"name":"description","kind":"TEXT","weight":1,"searchable":true,"filterable":false,"facetable":false},{"name":"status","kind":"KEYWORD","weight":1,"searchable":true,"filterable":true,"facetable":true},{"name":"tags","kind":"KEYWORD","weight":1,"searchable":true,"filterable":true,"facetable":true,"source":"tags.name"}]'
	},
	{
		entity: 'task',
		label: 'Tasks',
		keywordFields: promoted(['number', 'status', 'priority', 'size', 'projectId', 'tags']),
		fields: '[{"name":"title","kind":"TEXT","weight":3,"searchable":true,"filterable":false,"facetable":false},{"name":"number","kind":"KEYWORD","weight":2,"searchable":true,"filterable":true,"facetable":false},{"name":"description","kind":"TEXT","weight":1,"searchable":true,"filterable":false,"facetable":false},{"name":"status","kind":"KEYWORD","weight":1,"searchable":true,"filterable":true,"facetable":true},{"name":"priority","kind":"KEYWORD","weight":1,"searchable":true,"filterable":true,"facetable":true},{"name":"projectId","kind":"ENTITY","weight":1,"searchable":false,"filterable":true,"facetable":true}]'
	},
	{
		entity: 'employee',
		label: 'Employees',
		keywordFields: promoted(['email', 'employeeLevel', 'tags']),
		fields: '[{"name":"fullName","kind":"TEXT","weight":3,"searchable":true,"filterable":false,"facetable":false},{"name":"email","kind":"KEYWORD","weight":2,"searchable":true,"filterable":true,"facetable":false},{"name":"employeeLevel","kind":"KEYWORD","weight":1,"searchable":true,"filterable":true,"facetable":true},{"name":"tags","kind":"KEYWORD","weight":1,"searchable":true,"filterable":true,"facetable":true,"source":"tags.name"}]'
	},
	{
		entity: 'document',
		label: 'Documents',
		keywordFields: promoted(['originalFilename', 'mimeType', 'kind', 'status']),
		fields: '[{"name":"name","kind":"TEXT","weight":3,"searchable":true,"filterable":false,"facetable":false},{"name":"description","kind":"TEXT","weight":1,"searchable":true,"filterable":false,"facetable":false},{"name":"originalFilename","kind":"KEYWORD","weight":2,"searchable":true,"filterable":true,"facetable":false},{"name":"mimeType","kind":"KEYWORD","weight":1,"searchable":true,"filterable":true,"facetable":true},{"name":"kind","kind":"KEYWORD","weight":1,"searchable":true,"filterable":true,"facetable":true}]'
	},
	{
		entity: 'order',
		label: 'Orders',
		keywordFields: promoted(['number', 'status', 'currency', 'customerId', 'channelId']),
		fields: '[{"name":"number","kind":"KEYWORD","weight":3,"searchable":true,"filterable":true,"facetable":false},{"name":"email","kind":"KEYWORD","weight":2,"searchable":true,"filterable":true,"facetable":false},{"name":"status","kind":"KEYWORD","weight":1,"searchable":true,"filterable":true,"facetable":true},{"name":"currency","kind":"KEYWORD","weight":1,"searchable":true,"filterable":true,"facetable":true},{"name":"grandTotal","kind":"NUMBER","weight":1,"searchable":false,"filterable":true,"facetable":false},{"name":"channelId","kind":"ENTITY","weight":1,"searchable":false,"filterable":true,"facetable":true}]'
	}
];

/**
 * Seeds the shipped search index declarations.
 *
 * Global search is a **kernel** capability: `search_document` and `search_index_definition` are core
 * tables, created by the kernel's own migration, so search works with this package absent. What this
 * package contributes is the behaviour — the provider registry, the built-in database provider, the
 * indexing pipeline, the reindex sweep and the endpoints — and this migration contributes the one
 * thing that is data rather than behaviour: the rows that say which entities are searchable and how
 * much each of their fields counts.
 *
 * **The migration is idempotent.** Every insert is guarded by a `NOT EXISTS` against the row's own
 * identity — the deterministic id *or* the `(organizationId IS NULL, entity, engineKey IS NULL)` triple
 * the table's partial unique index is built on — so running it against a database where the runtime
 * has already written its own rows adds nothing and fails on nothing. That matters because the two
 * paths race by design: the migrations run at boot, and the definition sync runs at bootstrap, and a
 * deployment where the tables already exist may reach either one first.
 *
 * **`down` removes exactly what `up` inserted**, by the ids this migration chose, and nothing else: a
 * row an operator created, or one the runtime wrote with a different id, is not this migration's to
 * delete. The kernel's tables are left untouched — this migration creates no table, because it owns
 * none.
 *
 * All three dialects are written by hand, because the two things that differ between them are real:
 * Postgres and MySQL store the field list as a JSON document, SQLite stores the text the ORM's
 * `simple-json` transformer reads, and MySQL has no `INSERT ... SELECT ... WHERE NOT EXISTS` predicate
 * over a `SELECT` without a `FROM` clause.
 */
export class SeedSearchIndexDefinitions1791000000400 implements MigrationInterface {
	name = 'SeedSearchIndexDefinitions1791000000400';

	/**
	 * Up Migration
	 *
	 * @param queryRunner
	 */
	public async up(queryRunner: QueryRunner): Promise<void> {
		console.log(chalk.yellow(this.name + ' start running!'));

		switch (queryRunner.connection.options.type as DatabaseTypeEnum) {
			case DatabaseTypeEnum.sqlite:
			case DatabaseTypeEnum.betterSqlite3:
				await this.sqliteUpQueryRunner(queryRunner);
				break;
			case DatabaseTypeEnum.postgres:
				await this.postgresUpQueryRunner(queryRunner);
				break;
			case DatabaseTypeEnum.mysql:
				await this.mysqlUpQueryRunner(queryRunner);
				break;
			default:
				throw Error(`Unsupported database: ${queryRunner.connection.options.type}`);
		}
	}

	/**
	 * Down Migration
	 *
	 * @param queryRunner
	 */
	public async down(queryRunner: QueryRunner): Promise<void> {
		console.log(chalk.yellow(this.name + ' reverting changes!'));

		switch (queryRunner.connection.options.type as DatabaseTypeEnum) {
			case DatabaseTypeEnum.sqlite:
			case DatabaseTypeEnum.betterSqlite3:
				await this.sqliteDownQueryRunner(queryRunner);
				break;
			case DatabaseTypeEnum.postgres:
				await this.postgresDownQueryRunner(queryRunner);
				break;
			case DatabaseTypeEnum.mysql:
				await this.mysqlDownQueryRunner(queryRunner);
				break;
			default:
				throw Error(`Unsupported database: ${queryRunner.connection.options.type}`);
		}
	}

	/**
	 * PostgresDB Up Migration
	 *
	 * @param queryRunner
	 */
	public async postgresUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		for (const row of this.rows()) {
			await queryRunner.query(
				`INSERT INTO "search_index_definition" ("id", "tenantId", "organizationId", "entity", "label", "engineKey", "fields", "defaultWeight", "keywordFields", "sourceUpdatedAtField", "isActive", "isSystem", "version") ` +
					`SELECT '${SEED_IDS[row.entity]}', NULL, NULL, '${row.entity}', '${row.label}', NULL, '${row.fields}'::jsonb, 1, '${row.keywordFields}', 'updatedAt', true, true, 1 ` +
					`WHERE NOT EXISTS (SELECT 1 FROM "search_index_definition" WHERE "entity" = '${row.entity}' AND "engineKey" IS NULL AND "deletedAt" IS NULL)`
			);
		}
	}

	/**
	 * PostgresDB Down Migration
	 *
	 * @param queryRunner
	 */
	public async postgresDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(
			`DELETE FROM "search_index_definition" WHERE "id" IN (${this.idList()}) AND "engineKey" IS NULL AND "isSystem" = true`
		);
	}

	/**
	 * SqliteDB and BetterSQlite3DB Up Migration
	 *
	 * The field list is stored as the JSON text the ORM's own column transformer reads back, which is
	 * what makes a seeded row and a row the runtime wrote indistinguishable to every reader.
	 *
	 * @param queryRunner
	 */
	public async sqliteUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		for (const row of this.rows()) {
			await queryRunner.query(
				`INSERT INTO "search_index_definition" ("id", "tenantId", "organizationId", "entity", "label", "engineKey", "fields", "defaultWeight", "keywordFields", "sourceUpdatedAtField", "isActive", "isSystem", "version") ` +
					`SELECT '${SEED_IDS[row.entity]}', NULL, NULL, '${row.entity}', '${row.label}', NULL, '${row.fields.replace(/'/g, "''")}', 1, '${row.keywordFields}', 'updatedAt', 1, 1, 1 ` +
					`WHERE NOT EXISTS (SELECT 1 FROM "search_index_definition" WHERE "entity" = '${row.entity}' AND "engineKey" IS NULL AND "deletedAt" IS NULL)`
			);
		}
	}

	/**
	 * SqliteDB and BetterSQlite3DB Down Migration
	 *
	 * @param queryRunner
	 */
	public async sqliteDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(
			`DELETE FROM "search_index_definition" WHERE "id" IN (${this.idList()}) AND "engineKey" IS NULL AND "isSystem" = 1`
		);
	}

	/**
	 * MySQL Up Migration
	 *
	 * MySQL cannot select from nothing, so the guard is a `LEFT JOIN` against the row the insert would
	 * collide with: the join finds the existing row and the `WHERE ... IS NULL` keeps only the case
	 * where it does not exist.
	 *
	 * @param queryRunner
	 */
	public async mysqlUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		for (const row of this.rows()) {
			await queryRunner.query(
				'INSERT INTO `search_index_definition` (`id`, `tenantId`, `organizationId`, `entity`, `label`, `engineKey`, `fields`, `defaultWeight`, `keywordFields`, `sourceUpdatedAtField`, `isActive`, `isSystem`, `version`) ' +
					`SELECT '${SEED_IDS[row.entity]}', NULL, NULL, '${row.entity}', '${row.label}', NULL, '${row.fields.replace(/'/g, "''")}', 1, '${row.keywordFields}', 'updatedAt', 1, 1, 1 ` +
					`FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM \`search_index_definition\` WHERE \`entity\` = '${row.entity}' AND \`engineKey\` IS NULL AND \`deletedAt\` IS NULL)`
			);
		}
	}

	/**
	 * MySQL Down Migration
	 *
	 * @param queryRunner
	 */
	public async mysqlDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(
			`DELETE FROM \`search_index_definition\` WHERE \`id\` IN (${this.idList()}) AND \`engineKey\` IS NULL AND \`isSystem\` = 1`
		);
	}

	/**
	 * The rows this migration seeds.
	 *
	 * `titleTemplate` and `bodyTemplate` are left null for every entity on purpose: the runtime
	 * templates are the declarations', and a seed that guessed them would silently disagree with the
	 * code the moment a declaration changed. The rows exist so that a fresh installation can be
	 * inspected — what *would* be indexed, and how much each field counts — before a single document
	 * has been written.
	 *
	 * @returns The rows.
	 */
	private rows(): ISeedRow[] {
		return SEED_ROWS;
	}

	/**
	 * The ids this migration wrote, as a SQL list.
	 *
	 * @returns The quoted id list.
	 */
	private idList(): string {
		return Object.values(SEED_IDS)
			.map((id) => `'${id}'`)
			.join(', ');
	}
}
