import { MigrationInterface, QueryRunner } from 'typeorm';
import * as chalk from 'chalk';
import { DatabaseTypeEnum } from '@gauzy/config';

/**
 * Scopes the two idempotency tuples by tenant, so each lock agrees with the read it guards.
 *
 * ## The hole
 *
 * `UQ_idempotency_org_scope_key` is `(COALESCE("organizationId", <zero uuid>), "scope", "key")` among the
 * live rows. The fold is what stops a caller with no organization from escaping the lock, and it is also
 * what put every such caller **of every tenant** onto one tuple: the index carries no `tenantId`, while
 * `IdempotencyService.findByKey` reads by tenant *and* organization. A second tenant presenting a key the
 * first had already used therefore saw no row, inserted, was refused by a row it may not see, read again,
 * still saw nothing — and the driver's unique violation surfaced as a server error on an ordinary write.
 * One tenant's retry key made another tenant's request unanswerable, and whether it did told the second
 * tenant that somebody else had used that key.
 *
 * `UQ_operation_idem` has the same shape — `(COALESCE("organizationId", <zero uuid>), "type",
 * "idempotencyKey")` while a key is set — and the same gap: `OperationService` reads a submission's key by
 * tenant and organization, so a second tenant with no organization found nothing, lost the insert to the
 * first tenant's row, and was answered `409` for a key it had never used.
 *
 * An organization belongs to one tenant, so a tuple that names an organization was never shared across
 * tenants. Both collisions need `organizationId` to be null, which is every service account, integration
 * and token issued without `lastOrganizationId`.
 *
 * ## The fix
 *
 * `UQ_idempotency_tenant_org_scope_key` and `UQ_operation_tenant_idem` fold the tenant exactly as the
 * organization is folded, so the tuple each index enforces is the tuple its read selects by. Postgres and
 * SQLite index the `COALESCE` expressions under the original predicates. MySQL has neither expression nor
 * filtered indexes, so it indexes stored generated columns instead: each table gains a `tenantKey` beside
 * the `organizationKey` and `deletedKey` it was created with — a bare nullable `tenantId` in a MySQL unique
 * index would exempt every row whose tenant is null, which is the defect `constraint-parity-check` exists
 * to catch.
 *
 * `UQ_operation_aggregate_live` is left as it is. Its tuple is `(aggregateType, aggregateId)`, and an
 * aggregate id is the id of one row of one tenant, so two tenants cannot hold a live operation on the same
 * aggregate in the first place; a tenant member would change nothing for a real aggregate and would only
 * admit a second live operation on an id named from outside its tenant.
 *
 * ## Why it builds on live data
 *
 * Each new tuple is its old one plus a column. Two live rows that agree on the new tuple agree on the old
 * one, which the old index refused, so the new index cannot fail to build. Each is created **before** the
 * old one is dropped, so a key is locked at every instant of the migration — including on MySQL, where DDL
 * is not transactional.
 *
 * ## Down
 *
 * Restores each old index before dropping the new one. That is meant to fail once two tenants without an
 * organization hold the same key under the same scope or type: the old tuple is coarser, and the rows this
 * fix admits are exactly the ones it refuses. Release or sweep one of them first.
 */
export class ScopeIdempotencyKeyByTenant1791000000557 implements MigrationInterface {
	name = 'ScopeIdempotencyKeyByTenant1791000000557';

	/** The retry lock of the whole API. */
	private static readonly IDEMPOTENCY_TABLE = 'idempotency_key';

	/** The durable-operation runtime, whose submissions carry an idempotency key of their own. */
	private static readonly OPERATION_TABLE = 'operation';

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
	 * `IF NOT EXISTS` and `IF EXISTS` rather than a caught error: the migration runs inside a transaction
	 * here, and a statement that fails aborts it even when the failure is caught.
	 *
	 * @param queryRunner
	 */
	public async postgresUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		if (await queryRunner.hasTable(ScopeIdempotencyKeyByTenant1791000000557.IDEMPOTENCY_TABLE)) {
			await queryRunner.query(
				`CREATE UNIQUE INDEX IF NOT EXISTS "UQ_idempotency_tenant_org_scope_key" ON "idempotency_key" (COALESCE("tenantId", '00000000-0000-0000-0000-000000000000'), COALESCE("organizationId", '00000000-0000-0000-0000-000000000000'), "scope", "key") WHERE "deletedAt" IS NULL`
			);
			await queryRunner.query(`DROP INDEX IF EXISTS "UQ_idempotency_org_scope_key"`);
		}

		if (await queryRunner.hasTable(ScopeIdempotencyKeyByTenant1791000000557.OPERATION_TABLE)) {
			await queryRunner.query(
				`CREATE UNIQUE INDEX IF NOT EXISTS "UQ_operation_tenant_idem" ON "operation" (COALESCE("tenantId", '00000000-0000-0000-0000-000000000000'), COALESCE("organizationId", '00000000-0000-0000-0000-000000000000'), "type", "idempotencyKey") WHERE "idempotencyKey" IS NOT NULL AND "deletedAt" IS NULL`
			);
			await queryRunner.query(`DROP INDEX IF EXISTS "UQ_operation_idem"`);
		}
	}

	/**
	 * PostgresDB Down Migration
	 *
	 * @param queryRunner
	 */
	public async postgresDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		if (await queryRunner.hasTable(ScopeIdempotencyKeyByTenant1791000000557.OPERATION_TABLE)) {
			await queryRunner.query(
				`CREATE UNIQUE INDEX IF NOT EXISTS "UQ_operation_idem" ON "operation" (COALESCE("organizationId", '00000000-0000-0000-0000-000000000000'), "type", "idempotencyKey") WHERE "idempotencyKey" IS NOT NULL AND "deletedAt" IS NULL`
			);
			await queryRunner.query(`DROP INDEX IF EXISTS "UQ_operation_tenant_idem"`);
		}

		if (await queryRunner.hasTable(ScopeIdempotencyKeyByTenant1791000000557.IDEMPOTENCY_TABLE)) {
			await queryRunner.query(
				`CREATE UNIQUE INDEX IF NOT EXISTS "UQ_idempotency_org_scope_key" ON "idempotency_key" (COALESCE("organizationId", '00000000-0000-0000-0000-000000000000'), "scope", "key") WHERE "deletedAt" IS NULL`
			);
			await queryRunner.query(`DROP INDEX IF EXISTS "UQ_idempotency_tenant_org_scope_key"`);
		}
	}

	/**
	 * SqliteDB and BetterSQlite3DB Up Migration
	 *
	 * SQLite has expression and partial indexes, so the indexes are the Postgres ones verbatim. Nothing
	 * about either table itself changes, so nothing is rebuilt.
	 *
	 * @param queryRunner
	 */
	public async sqliteUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		if (await queryRunner.hasTable(ScopeIdempotencyKeyByTenant1791000000557.IDEMPOTENCY_TABLE)) {
			await queryRunner.query(
				`CREATE UNIQUE INDEX IF NOT EXISTS "UQ_idempotency_tenant_org_scope_key" ON "idempotency_key" (COALESCE("tenantId", '00000000-0000-0000-0000-000000000000'), COALESCE("organizationId", '00000000-0000-0000-0000-000000000000'), "scope", "key") WHERE "deletedAt" IS NULL`
			);
			await queryRunner.query(`DROP INDEX IF EXISTS "UQ_idempotency_org_scope_key"`);
		}

		if (await queryRunner.hasTable(ScopeIdempotencyKeyByTenant1791000000557.OPERATION_TABLE)) {
			await queryRunner.query(
				`CREATE UNIQUE INDEX IF NOT EXISTS "UQ_operation_tenant_idem" ON "operation" (COALESCE("tenantId", '00000000-0000-0000-0000-000000000000'), COALESCE("organizationId", '00000000-0000-0000-0000-000000000000'), "type", "idempotencyKey") WHERE "idempotencyKey" IS NOT NULL AND "deletedAt" IS NULL`
			);
			await queryRunner.query(`DROP INDEX IF EXISTS "UQ_operation_idem"`);
		}
	}

	/**
	 * SqliteDB and BetterSQlite3DB Down Migration
	 *
	 * @param queryRunner
	 */
	public async sqliteDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		if (await queryRunner.hasTable(ScopeIdempotencyKeyByTenant1791000000557.OPERATION_TABLE)) {
			await queryRunner.query(
				`CREATE UNIQUE INDEX IF NOT EXISTS "UQ_operation_idem" ON "operation" (COALESCE("organizationId", '00000000-0000-0000-0000-000000000000'), "type", "idempotencyKey") WHERE "idempotencyKey" IS NOT NULL AND "deletedAt" IS NULL`
			);
			await queryRunner.query(`DROP INDEX IF EXISTS "UQ_operation_tenant_idem"`);
		}

		if (await queryRunner.hasTable(ScopeIdempotencyKeyByTenant1791000000557.IDEMPOTENCY_TABLE)) {
			await queryRunner.query(
				`CREATE UNIQUE INDEX IF NOT EXISTS "UQ_idempotency_org_scope_key" ON "idempotency_key" (COALESCE("organizationId", '00000000-0000-0000-0000-000000000000'), "scope", "key") WHERE "deletedAt" IS NULL`
			);
			await queryRunner.query(`DROP INDEX IF EXISTS "UQ_idempotency_tenant_org_scope_key"`);
		}
	}

	/**
	 * MySQL Up Migration
	 *
	 * `tenantKey` is the tenant folded to the zero uuid, as a **stored** generated column — the form the
	 * two key columns beside it already take on both tables, and the one the rest of the set uses in place
	 * of an expression index. `deletedKey` carries the soft-delete predicate in the form
	 * `CreateSequenceTable1791000000000` documents for the whole set.
	 *
	 * `operation.idempotencyKey` stays raw, as it did in the index this one replaces: it is already a member
	 * of the tuple, so MySQL's own null rule excuses the operations that carry no key — which is what
	 * `WHERE "idempotencyKey" IS NOT NULL` states on the other two dialects.
	 *
	 * @param queryRunner
	 */
	public async mysqlUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		if (await queryRunner.hasTable(ScopeIdempotencyKeyByTenant1791000000557.IDEMPOTENCY_TABLE)) {
			if (!(await queryRunner.hasColumn(ScopeIdempotencyKeyByTenant1791000000557.IDEMPOTENCY_TABLE, 'tenantKey'))) {
				await queryRunner.query(
					`ALTER TABLE \`idempotency_key\` ADD \`tenantKey\` varchar(36) GENERATED ALWAYS AS (IFNULL(\`tenantId\`, '00000000-0000-0000-0000-000000000000')) STORED`
				);
			}

			await this.createMySqlIndex(
				queryRunner,
				`CREATE UNIQUE INDEX \`UQ_idempotency_tenant_org_scope_key\` ON \`idempotency_key\` (\`tenantKey\`, \`organizationKey\`, \`scope\`, \`key\`, \`deletedKey\`)`
			);
			await this.dropMySqlIndex(queryRunner, `DROP INDEX \`UQ_idempotency_org_scope_key\` ON \`idempotency_key\``);
		}

		if (await queryRunner.hasTable(ScopeIdempotencyKeyByTenant1791000000557.OPERATION_TABLE)) {
			if (!(await queryRunner.hasColumn(ScopeIdempotencyKeyByTenant1791000000557.OPERATION_TABLE, 'tenantKey'))) {
				await queryRunner.query(
					`ALTER TABLE \`operation\` ADD \`tenantKey\` varchar(36) GENERATED ALWAYS AS (IFNULL(\`tenantId\`, '00000000-0000-0000-0000-000000000000')) STORED`
				);
			}

			await this.createMySqlIndex(
				queryRunner,
				`CREATE UNIQUE INDEX \`UQ_operation_tenant_idem\` ON \`operation\` (\`tenantKey\`, \`organizationKey\`, \`type\`, \`idempotencyKey\`, \`deletedKey\`)`
			);
			await this.dropMySqlIndex(queryRunner, `DROP INDEX \`UQ_operation_idem\` ON \`operation\``);
		}
	}

	/**
	 * MySQL Down Migration
	 *
	 * @param queryRunner
	 */
	public async mysqlDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		if (await queryRunner.hasTable(ScopeIdempotencyKeyByTenant1791000000557.OPERATION_TABLE)) {
			await this.createMySqlIndex(
				queryRunner,
				`CREATE UNIQUE INDEX \`UQ_operation_idem\` ON \`operation\` (\`organizationKey\`, \`type\`, \`idempotencyKey\`, \`deletedKey\`)`
			);
			await this.dropMySqlIndex(queryRunner, `DROP INDEX \`UQ_operation_tenant_idem\` ON \`operation\``);

			if (await queryRunner.hasColumn(ScopeIdempotencyKeyByTenant1791000000557.OPERATION_TABLE, 'tenantKey')) {
				await queryRunner.query(`ALTER TABLE \`operation\` DROP COLUMN \`tenantKey\``);
			}
		}

		if (await queryRunner.hasTable(ScopeIdempotencyKeyByTenant1791000000557.IDEMPOTENCY_TABLE)) {
			await this.createMySqlIndex(
				queryRunner,
				`CREATE UNIQUE INDEX \`UQ_idempotency_org_scope_key\` ON \`idempotency_key\` (\`organizationKey\`, \`scope\`, \`key\`, \`deletedKey\`)`
			);
			await this.dropMySqlIndex(
				queryRunner,
				`DROP INDEX \`UQ_idempotency_tenant_org_scope_key\` ON \`idempotency_key\``
			);

			if (await queryRunner.hasColumn(ScopeIdempotencyKeyByTenant1791000000557.IDEMPOTENCY_TABLE, 'tenantKey')) {
				await queryRunner.query(`ALTER TABLE \`idempotency_key\` DROP COLUMN \`tenantKey\``);
			}
		}
	}

	/**
	 * Creates a MySQL index, tolerating one that is already there.
	 *
	 * MySQL has no `CREATE INDEX IF NOT EXISTS`, and a migration runs inside the platform's retry wrapper:
	 * a statement that throws on the second attempt is a set that can never record itself. Only the
	 * duplicate is tolerated — any other failure leaves the old index in place and must be seen.
	 *
	 * @param queryRunner The runner the migration is executing on.
	 * @param statement The `CREATE UNIQUE INDEX`.
	 */
	private async createMySqlIndex(queryRunner: QueryRunner, statement: string): Promise<void> {
		try {
			await queryRunner.query(statement);
		} catch (error) {
			if (!/Duplicate key name/i.test(String((error as Error)?.message))) {
				throw error;
			}
		}
	}

	/**
	 * Drops a MySQL index, tolerating its absence.
	 *
	 * @param queryRunner The runner the migration is executing on.
	 * @param statement The `DROP INDEX`.
	 */
	private async dropMySqlIndex(queryRunner: QueryRunner, statement: string): Promise<void> {
		try {
			await queryRunner.query(statement);
		} catch (error) {
			if (!/check that (column\/key|it) exists|Can't DROP/i.test(String((error as Error)?.message))) {
				throw error;
			}
		}
	}
}
