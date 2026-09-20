import { MigrationInterface, QueryRunner } from 'typeorm';
import * as chalk from 'chalk';
import { DatabaseTypeEnum } from '@gauzy/config';

/**
 * Make `invoice.invoiceNumber` unique per tenant instead of per installation (GHSA-57hw-jqpj-ww97).
 *
 * The global UNIQUE("invoiceNumber") put every tenant on one shared number sequence: a tenant could
 * probe which numbers other tenants hold through unique-violation errors, and could push every other
 * tenant's "next number" by saving a huge one. `GET /invoices/highest` is now scoped to the caller's
 * tenant, so the constraint has to become tenant-local too, or a tenant's own max+1 would collide
 * with a number some other tenant already holds.
 *
 * Invoices and estimates share the table and the sequence, and the key is (tenantId, invoiceNumber):
 * organizations of one tenant keep sharing one sequence, exactly as before.
 *
 * Existing data always satisfies the new constraint, since globally unique numbers are unique within
 * any tenant. The reverse is not true: once two tenants hold the same number, the global constraint
 * cannot come back, so `down()` refuses with the list of clashing numbers rather than half-failing.
 *
 * Constraint names are the ones TypeORM's default naming strategy derives for the entity's
 * `@Unique(['tenantId', 'invoiceNumber'])`, so schema diffs stay quiet:
 *   - Postgres / SQLite: `UQ_d7bed97fb47876e03fd7d7c285a` → `UQ_205ce780e85433a0b705baa130d`
 *   - MySQL (unique index): `IDX_d7bed97fb47876e03fd7d7c285` → `IDX_205ce780e85433a0b705baa130`
 */
export class AlterInvoiceNumberUniquePerTenant1790000015400 implements MigrationInterface {
	name = 'AlterInvoiceNumberUniquePerTenant1790000015400';

	/** Global UNIQUE("invoiceNumber") as created by the initial schema (Postgres, SQLite). */
	private readonly globalConstraint = 'UQ_d7bed97fb47876e03fd7d7c285a';
	/** Tenant-local UNIQUE("tenantId", "invoiceNumber") (Postgres, SQLite). */
	private readonly tenantConstraint = 'UQ_205ce780e85433a0b705baa130d';
	/** MySQL keeps uniques as unique indexes, named by `indexName()` instead. */
	private readonly globalMysqlIndex = 'IDX_d7bed97fb47876e03fd7d7c285';
	private readonly tenantMysqlIndex = 'IDX_205ce780e85433a0b705baa130';
	/** Invoice numbers held by more than one row (Postgres and SQLite quoting). */
	private readonly duplicateNumbersSql = `SELECT "invoiceNumber" FROM "invoice" WHERE "invoiceNumber" IS NOT NULL GROUP BY "invoiceNumber" HAVING COUNT(*) > 1`;

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
	 * The composite constraint is added before the global one is dropped, inside the migration's
	 * transaction, so there is no moment without a uniqueness guarantee. The global constraint is
	 * looked up by definition (a single-column UNIQUE on "invoiceNumber"), not only by name, so an
	 * install whose constraint was named differently is converted too.
	 *
	 * @param queryRunner
	 */
	public async postgresUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await this.postgresLimitLockWait(queryRunner);
		await queryRunner.query(
			`ALTER TABLE "invoice" ADD CONSTRAINT "${this.tenantConstraint}" UNIQUE ("tenantId", "invoiceNumber")`
		);

		const constraints: Array<{ name: string }> = await queryRunner.query(
			`SELECT c."conname" AS "name" FROM "pg_constraint" c
			WHERE c."conrelid" = '"invoice"'::regclass AND c."contype" = 'u'
			AND c."conkey" = ARRAY[(SELECT a."attnum" FROM "pg_attribute" a WHERE a."attrelid" = c."conrelid" AND a."attname" = 'invoiceNumber')]`
		);
		for (const { name } of constraints ?? []) {
			await queryRunner.query(`ALTER TABLE "invoice" DROP CONSTRAINT "${name}"`);
		}
	}

	/**
	 * PostgresDB Down Migration
	 *
	 * @param queryRunner
	 */
	public async postgresDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await this.assertNoCrossTenantDuplicates(queryRunner, this.duplicateNumbersSql);
		await this.postgresLimitLockWait(queryRunner);
		await queryRunner.query(
			`ALTER TABLE "invoice" ADD CONSTRAINT "${this.globalConstraint}" UNIQUE ("invoiceNumber")`
		);
		await queryRunner.query(`ALTER TABLE "invoice" DROP CONSTRAINT "${this.tenantConstraint}"`);
	}

	/**
	 * Adding a UNIQUE constraint takes a lock on "invoice" that queues every later query on the table
	 * behind any long-running transaction. Give up after 5 s instead; the migration rolls back and runs
	 * again on the next start. `SET LOCAL` ends with this migration's transaction.
	 */
	private async postgresLimitLockWait(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`SET LOCAL lock_timeout = '5s'`);
	}

	/**
	 * SqliteDB and BetterSQlite3DB Up Migration
	 *
	 * @param queryRunner
	 */
	public async sqliteUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await this.sqliteRebuildInvoiceWithUnique(queryRunner, '"invoiceNumber"', {
			name: this.tenantConstraint,
			columns: '"tenantId", "invoiceNumber"'
		});
	}

	/**
	 * SqliteDB and BetterSQlite3DB Down Migration
	 *
	 * @param queryRunner
	 */
	public async sqliteDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await this.assertNoCrossTenantDuplicates(queryRunner, this.duplicateNumbersSql);
		await this.sqliteRebuildInvoiceWithUnique(queryRunner, '"tenantId", "invoiceNumber"', {
			name: this.globalConstraint,
			columns: '"invoiceNumber"'
		});
	}

	/**
	 * MySQL Up Migration
	 *
	 * The global unique index is found by its definition rather than assumed by name, so an install
	 * whose index carries another name (e.g. one created by `synchronize`) is still converted.
	 *
	 * @param queryRunner
	 */
	public async mysqlUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(
			`CREATE UNIQUE INDEX \`${this.tenantMysqlIndex}\` ON \`invoice\` (\`tenantId\`, \`invoiceNumber\`)`
		);

		const rows: Array<{ indexName: string }> = await queryRunner.query(
			`SELECT \`INDEX_NAME\` AS \`indexName\` FROM \`information_schema\`.\`STATISTICS\`
			WHERE \`TABLE_SCHEMA\` = DATABASE() AND \`TABLE_NAME\` = 'invoice' AND \`NON_UNIQUE\` = 0
			GROUP BY \`INDEX_NAME\`
			HAVING COUNT(*) = 1 AND MAX(\`COLUMN_NAME\`) = 'invoiceNumber'`
		);
		for (const { indexName } of rows ?? []) {
			await queryRunner.query(`DROP INDEX \`${indexName}\` ON \`invoice\``);
		}
	}

	/**
	 * MySQL Down Migration
	 *
	 * @param queryRunner
	 */
	public async mysqlDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await this.assertNoCrossTenantDuplicates(
			queryRunner,
			'SELECT `invoiceNumber` FROM `invoice` WHERE `invoiceNumber` IS NOT NULL GROUP BY `invoiceNumber` HAVING COUNT(*) > 1'
		);
		await queryRunner.query(`CREATE UNIQUE INDEX \`${this.globalMysqlIndex}\` ON \`invoice\` (\`invoiceNumber\`)`);
		await queryRunner.query(`DROP INDEX \`${this.tenantMysqlIndex}\` ON \`invoice\``);
	}

	/**
	 * Refuses to revert once two rows share an invoice number, which is legitimate after `up()`
	 * (different tenants) but would make the global constraint fail halfway through the revert.
	 */
	private async assertNoCrossTenantDuplicates(queryRunner: QueryRunner, duplicatesSql: string): Promise<void> {
		const duplicates: Array<{ invoiceNumber: string | number }> = await queryRunner.query(duplicatesSql);
		if (duplicates?.length) {
			const numbers = duplicates.map((row) => row.invoiceNumber).join(', ');
			throw new Error(
				`${this.name}: cannot restore the installation-wide unique invoice number, ` +
					`these numbers are used by more than one tenant: ${numbers}`
			);
		}
	}

	/**
	 * SQLite declares the unique inline in `CREATE TABLE`, and an inline constraint cannot be dropped,
	 * so the table is rebuilt: copy → drop → rename, then its indexes are recreated.
	 *
	 * The new DDL is derived from the table's CURRENT definition in `sqlite_master` (only the unique
	 * clause is swapped), not restated by hand: hand-restated rebuilds of big tables have silently
	 * dropped columns here before. Foreign keys are already off while TypeORM runs migrations
	 * (`beforeMigration`), so dropping the old table does not cascade into invoice items.
	 */
	private async sqliteRebuildInvoiceWithUnique(
		queryRunner: QueryRunner,
		removeColumns: string,
		addConstraint: { name: string; columns: string }
	): Promise<void> {
		const [table]: Array<{ sql: string }> = await queryRunner.query(
			`SELECT "sql" FROM "sqlite_master" WHERE "type" = 'table' AND "name" = 'invoice'`
		);
		if (!table?.sql) {
			throw new Error(`${this.name}: table "invoice" not found`);
		}

		// The clause to drop is identified by its COLUMNS, not its name: an install whose unique was
		// created by `synchronize` rather than by the migration chain carries a different name, and
		// leaving that one behind would keep the old scope in force.
		const columnPattern = removeColumns
			.split(',')
			.map((column) => column.trim())
			.join(',\\s*');
		const existing = new RegExp(`,\\s*CONSTRAINT "[^"]+" UNIQUE \\(${columnPattern}\\)`);
		const hasTarget = table.sql.includes(`CONSTRAINT "${addConstraint.name}" UNIQUE`);
		if (!existing.test(table.sql) && hasTarget) {
			return; // already in the requested shape
		}

		// Drop the old clause, then add the new one right after the column list's last entry.
		let definition = table.sql.replace(existing, '');
		if (!hasTarget) {
			const closing = definition.lastIndexOf(')');
			definition =
				definition.slice(0, closing) +
				`, CONSTRAINT "${addConstraint.name}" UNIQUE (${addConstraint.columns})` +
				definition.slice(closing);
		}
		definition = definition.replace(
			/^CREATE TABLE\s+(?:"invoice"|'invoice'|`invoice`|invoice)/i,
			'CREATE TABLE "temporary_invoice"'
		);

		const indexes: Array<{ sql: string }> = await queryRunner.query(
			`SELECT "sql" FROM "sqlite_master" WHERE "type" = 'index' AND "tbl_name" = 'invoice' AND "sql" IS NOT NULL`
		);
		const columns: Array<{ name: string }> = await queryRunner.query(`PRAGMA table_info("invoice")`);
		const columnList = columns.map(({ name }) => `"${name}"`).join(', ');

		await queryRunner.query(definition);
		await queryRunner.query(`INSERT INTO "temporary_invoice" (${columnList}) SELECT ${columnList} FROM "invoice"`);
		await queryRunner.query(`DROP TABLE "invoice"`);
		await queryRunner.query(`ALTER TABLE "temporary_invoice" RENAME TO "invoice"`);
		for (const { sql } of indexes) {
			await queryRunner.query(sql);
		}
	}
}
