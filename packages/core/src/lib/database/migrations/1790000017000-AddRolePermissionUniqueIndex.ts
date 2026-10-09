import { MigrationInterface, QueryRunner } from 'typeorm';
import * as chalk from 'chalk';
import { DatabaseTypeEnum } from '@gauzy/config';

/**
 * Make `role_permission` unique on (tenantId, roleId, permission).
 *
 * Nothing stopped a role from holding the same permission twice. The `*RolePermissionsReload*`
 * migrations read which permissions a role lacks and then insert them, so two API processes running
 * them at the same time against one database both saw a permission as missing and both inserted it.
 * Any install that ever ran two instances through those migrations can hold millions of such
 * duplicate rows.
 * With the index in place `RolePermissionUtils` inserts with an ignore-duplicates clause, so that
 * race now costs nothing.
 *
 * The index is simply built first. If that works there were no duplicates, and the build was the
 * only pass over the table. If it fails on a duplicate key, the duplicates are removed and the index
 * is built again. The clean-up keeps exactly ONE row per (tenantId, roleId, permission):
 *   - a row that actually grants the permission (enabled, active, not archived, not soft-deleted —
 *     the predicate `RolePermissionService.checkRolePermission` applies), so no role loses a
 *     permission it holds today;
 *   - otherwise a row the application can still see (not soft-deleted);
 *   - then an enabled row, then the oldest `createdAt`, then the smallest id, so the choice is
 *     deterministic.
 * Rows with a NULL tenantId are left alone: every dialect treats NULLs as distinct in a unique index,
 * so they can never violate it.
 *
 * Postgres. The index is built inside the migration's transaction, not CONCURRENTLY. A plain build
 * blocks INSERT/UPDATE/DELETE on `role_permission` until the migration commits, but never SELECT, so
 * the pods still serving keep answering permission checks. Measured on PostgreSQL 16 with default
 * settings: 2,000,000 rows without duplicates hold the lock for about 5 s (a concurrent SELECT took
 * 11 ms, a concurrent INSERT waited the 5 s), so roughly 25-30 s at production's ~9M rows. The table
 * is written only when tenants, roles or permission settings change, and those requests wait that
 * long once. CONCURRENTLY would avoid the pause, but it cannot run in a transaction, it first waits
 * for every older transaction in the whole database, and any failure (a killed pod, a duplicate
 * inserted mid-build) leaves an INVALID index behind that `IF NOT EXISTS` would accept as done. A
 * plain build that fails simply rolls back and runs again on the next start.
 *
 * The lock is taken up front, SHARE ROW EXCLUSIVE: reads pass, writers wait, and so does a second
 * copy of this migration. So no duplicate can slip in between the clean-up and the build, and two
 * processes starting together (two replicas, or two API deployments sharing one database) cannot run
 * it at the same time. `lock_timeout` keeps any wait short: the loser gives up after 5 s instead of
 * queueing every writer behind it, fails that boot, and on restart finds the index in place.
 *
 * MySQL commits DDL on its own, so a crash cannot roll the index back: the index is looked up by name
 * before it is built, and again when the build fails, so a retry — or a second process — never dies
 * on `Duplicate key name`. SQLite runs the whole migration in its transaction.
 */
export class AddRolePermissionUniqueIndex1790000017000 implements MigrationInterface {
	name = 'AddRolePermissionUniqueIndex1790000017000';

	/** The name `RolePermission` declares for this index, so schema diffs stay quiet. */
	private readonly indexName = 'IDX_role_permission_unique';

	/**
	 * Up Migration
	 *
	 * @param queryRunner
	 */
	public async up(queryRunner: QueryRunner): Promise<void> {
		console.log(chalk.yellow(`${this.name} start running!`));
		const type = this.databaseType(queryRunner);

		if (await this.indexExists(queryRunner, type)) {
			console.log(chalk.green(`${this.name}: ${this.indexName} already exists, nothing to do`));
			return;
		}

		if (type === DatabaseTypeEnum.postgres && queryRunner.isTransactionActive) {
			await queryRunner.query(`SET LOCAL lock_timeout = '5s'`);
			await queryRunner.query(`LOCK TABLE "role_permission" IN SHARE ROW EXCLUSIVE MODE`);

			// Another process may have finished this migration while we waited for the lock.
			if (await this.indexExists(queryRunner, type)) {
				console.log(chalk.green(`${this.name}: ${this.indexName} was created meanwhile, nothing to do`));
				return;
			}
		}

		if (await this.tryCreateIndex(queryRunner, type)) {
			return;
		}

		await this.removeDuplicates(queryRunner, type);

		if (!(await this.tryCreateIndex(queryRunner, type))) {
			throw new Error(`${this.name}: duplicate role permissions remain after the clean-up`);
		}
	}

	/**
	 * Down Migration
	 *
	 * Drops the index only. The duplicate rows `up()` removed are not restored: they granted nothing
	 * the surviving row does not.
	 *
	 * @param queryRunner
	 */
	public async down(queryRunner: QueryRunner): Promise<void> {
		console.log(chalk.yellow(`${this.name} reverting changes!`));
		const type = this.databaseType(queryRunner);

		switch (type) {
			case DatabaseTypeEnum.postgres:
				// DROP INDEX locks the table against reads too, so never queue behind a long transaction.
				if (queryRunner.isTransactionActive) {
					await queryRunner.query(`SET LOCAL lock_timeout = '5s'`);
				}
				await queryRunner.query(`DROP INDEX IF EXISTS "${this.indexName}"`);
				break;
			case DatabaseTypeEnum.mysql:
				if (await this.indexExists(queryRunner, type)) {
					await queryRunner.query(`DROP INDEX \`${this.indexName}\` ON \`role_permission\``);
				}
				break;
			default:
				await queryRunner.query(`DROP INDEX IF EXISTS "${this.indexName}"`);
				break;
		}
	}

	/** The connection's dialect, refusing the ones this migration has no SQL for. */
	private databaseType(queryRunner: QueryRunner): DatabaseTypeEnum {
		const type = queryRunner.connection.options.type as DatabaseTypeEnum;
		const supported = [
			DatabaseTypeEnum.sqlite,
			DatabaseTypeEnum.betterSqlite3,
			DatabaseTypeEnum.postgres,
			DatabaseTypeEnum.mysql
		];
		if (!supported.includes(type)) {
			throw new Error(`Unsupported database: ${type}`);
		}
		return type;
	}

	/** Writes identifiers with MySQL's backticks instead of double quotes. */
	private sql(type: DatabaseTypeEnum, text: string): string {
		return type === DatabaseTypeEnum.mysql ? text.replace(/"/g, '`') : text;
	}

	/**
	 * Whether the index is already in place.
	 *
	 * On Postgres an index of that name that is not a valid unique index (an interrupted CREATE INDEX
	 * CONCURRENTLY run by hand leaves an INVALID one) is refused rather than accepted: treating it as
	 * done would record the migration with no uniqueness enforced, and dropping it here would lock the
	 * table against reads until the migration commits.
	 */
	private async indexExists(queryRunner: QueryRunner, type: DatabaseTypeEnum): Promise<boolean> {
		switch (type) {
			case DatabaseTypeEnum.postgres: {
				const rows: Array<{ valid: boolean; unique: boolean }> = await queryRunner.query(
					`SELECT i."indisvalid" AS "valid", i."indisunique" AS "unique" FROM "pg_index" i WHERE i."indexrelid" = to_regclass($1)`,
					[`"${this.indexName}"`]
				);
				if (!rows?.length) {
					return false;
				}
				if (!rows[0].valid || !rows[0].unique) {
					throw new Error(
						`${this.name}: index "${this.indexName}" exists but is not a valid unique index. ` +
							`Remove it with DROP INDEX CONCURRENTLY "${this.indexName}" and restart.`
					);
				}
				return true;
			}
			case DatabaseTypeEnum.mysql: {
				const rows: unknown[] = await queryRunner.query(
					`SELECT \`INDEX_NAME\` FROM \`information_schema\`.\`STATISTICS\` WHERE \`TABLE_SCHEMA\` = DATABASE() AND \`TABLE_NAME\` = 'role_permission' AND \`INDEX_NAME\` = ?`,
					[this.indexName]
				);
				return !!rows?.length;
			}
			default: {
				const rows: unknown[] = await queryRunner.query(
					`SELECT "name" FROM "sqlite_master" WHERE "type" = 'index' AND "tbl_name" = 'role_permission' AND "name" = ?`,
					[this.indexName]
				);
				return !!rows?.length;
			}
		}
	}

	/**
	 * Builds the unique index. Returns false, having changed nothing, when duplicates stop the build.
	 *
	 * A failed statement aborts the whole transaction on Postgres, so there the build runs under a
	 * savepoint that is rolled back on failure; SQLite undoes just the failed statement, and MySQL
	 * commits DDL on its own anyway.
	 */
	private async tryCreateIndex(queryRunner: QueryRunner, type: DatabaseTypeEnum): Promise<boolean> {
		const savepoint = type === DatabaseTypeEnum.postgres && queryRunner.isTransactionActive;
		if (savepoint) {
			await queryRunner.query(`SAVEPOINT "role_permission_unique"`);
		}
		try {
			await queryRunner.query(
				this.sql(
					type,
					`CREATE UNIQUE INDEX "${this.indexName}" ON "role_permission" ("tenantId", "roleId", "permission")`
				)
			);
		} catch (error) {
			if (savepoint) {
				await queryRunner.query(`ROLLBACK TO SAVEPOINT "role_permission_unique"`);
			}
			if (this.isDuplicateKeyError(error)) {
				return false;
			}
			// MySQL: another process built it between our lookup and our build.
			if (type === DatabaseTypeEnum.mysql && (await this.indexExists(queryRunner, type))) {
				console.log(chalk.green(`${this.name}: ${this.indexName} was created meanwhile, nothing to do`));
				return true;
			}
			throw error;
		}
		if (savepoint) {
			await queryRunner.query(`RELEASE SAVEPOINT "role_permission_unique"`);
		}
		return true;
	}

	/**
	 * A unique violation, as each driver reports it: Postgres 23505; MySQL 1062, or 1859 when an online
	 * index build cannot name the duplicate value; SQLite a UNIQUE constraint failure.
	 */
	private isDuplicateKeyError(error: any): boolean {
		const code = String(error?.code ?? error?.driverError?.code ?? '');
		return (
			code === '23505' ||
			code === 'ER_DUP_ENTRY' ||
			code === 'ER_DUP_UNKNOWN_IN_INDEX' ||
			(code.startsWith('SQLITE_CONSTRAINT') && /UNIQUE/i.test(String(error?.message)))
		);
	}

	/**
	 * Deletes every duplicate (tenantId, roleId, permission) row but the one to keep (see the class
	 * comment for the order) in one statement, and logs how many rows went. It runs only after a build
	 * has failed on a duplicate, and on Postgres while writers are locked out, so no extra pass over the
	 * table is spent counting first.
	 */
	private async removeDuplicates(queryRunner: QueryRunner, type: DatabaseTypeEnum): Promise<void> {
		// `true`/`false` literals, not 1/0: Postgres has real booleans, and MySQL and SQLite read
		// TRUE/FALSE as 1/0. The derived table is what lets MySQL delete from the table it reads.
		const { affected } = await queryRunner.query(
			this.sql(
				type,
				`DELETE FROM "role_permission" WHERE "id" IN (
					SELECT "id" FROM (
						SELECT "id", ROW_NUMBER() OVER (
							PARTITION BY "tenantId", "roleId", "permission"
							ORDER BY
								CASE
									WHEN "deletedAt" IS NOT NULL THEN 2
									WHEN "enabled" = true AND "isActive" = true AND "isArchived" = false THEN 0
									ELSE 1
								END,
								CASE WHEN "enabled" = true THEN 0 ELSE 1 END,
								"createdAt",
								"id"
						) AS "rowNumber"
						FROM "role_permission"
						WHERE "tenantId" IS NOT NULL
					) AS "ranked"
					WHERE "rowNumber" > 1
				)`
			),
			[],
			true
		);
		console.log(
			chalk.magenta(
				`${this.name}: removed ${affected ?? 'an unknown number of'} duplicate role permission row(s), ` +
					`keeping one row per (tenantId, roleId, permission)`
			)
		);
	}
}
