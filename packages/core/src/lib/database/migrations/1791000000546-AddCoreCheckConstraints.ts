import { MigrationInterface, QueryRunner } from 'typeorm';
import * as chalk from 'chalk';
import { DatabaseTypeEnum } from '@gauzy/config';
import { addCheckConstraint, dropCheckConstraint, ICheckConstraintDefinition } from '../check-constraint.helper';

/**
 * Adds the rule the kernel's chapter states about a table this migration set does not create.
 *
 * ## Why a tick of its own
 *
 * `tenant_setting` is a columns-added table as far as this programme is concerned:
 * `1791000000095-AlterCoreTablesForExtensions` extends it with the scope columns. A rule about a
 * populated table cannot ride along with the migration that adds the column — the rows that already
 * exist are exactly the rows the rule may not assume anything about — so it is stated here, on its own
 * tick, after the columns are in place.
 *
 * ## The rule
 *
 * **`CHK_tenant_setting_scope_channel` — a setting is channel-scoped exactly when it names a channel.**
 * `scope` is the address of a setting and `channelId` is the narrower address inside it, so a row that
 * says `CHANNEL` and names no channel is a setting nothing can resolve, and a row that names a channel
 * while claiming a tenant or organization scope is a setting that would be read by a resolution it does
 * not belong to. The backfill of `1791000000095` sets `scope = 'TENANT'` and leaves `channelId` null, so
 * it satisfies the rule and the constraint can be added to the populated table.
 *
 * **The second rule this chapter promises, and why it is not here.** `CHK_operation_status_terminal` —
 * "a terminal operation holds no lease" — reads `lockedAt`, one of the lease columns §3.14 declares and
 * the durable-operation runtime has yet to grow: today the lease lives inside `operation.state`, where no
 * `CHECK` can reach it. A statement for a column no installation carries would be a migration that runs
 * everywhere and constrains nothing, so the rule is deliberately left to the change that moves the lease
 * into columns, and the gate `tools/scripts/constraint-parity-check.mjs` carries it in its `DEFERRED`
 * list — with the column it is waiting for — so the promise is visible rather than missing.
 *
 * The probes, the dialect choice and the embedded dialect's documented no-op are the shared helper's;
 * this class states only what is being added.
 */
export class AddCoreCheckConstraints1791000000546 implements MigrationInterface {
	name = 'AddCoreCheckConstraints1791000000546';

	/** The one rule this tick carries. */
	private static readonly CONSTRAINTS: readonly ICheckConstraintDefinition[] = [
		{
			table: 'tenant_setting',
			name: 'CHK_tenant_setting_scope_channel',
			columns: ['scope', 'channelId'],
			postgres: `ALTER TABLE "tenant_setting" ADD CONSTRAINT "CHK_tenant_setting_scope_channel" CHECK (("scope" = 'CHANNEL') = ("channelId" IS NOT NULL))`,
			mysql: `ALTER TABLE \`tenant_setting\` ADD CONSTRAINT \`CHK_tenant_setting_scope_channel\` CHECK ((\`scope\` = 'CHANNEL') = (\`channelId\` IS NOT NULL))`
		}
	];

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
	 * SqliteDB Up Migration
	 *
	 * @param queryRunner
	 */
	public async sqliteUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await this.addAll(queryRunner);
	}

	/**
	 * SqliteDB Down Migration
	 *
	 * @param queryRunner
	 */
	public async sqliteDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await this.dropAll(queryRunner);
	}

	/**
	 * PostgresDB Up Migration
	 *
	 * @param queryRunner
	 */
	public async postgresUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await this.addAll(queryRunner);
	}

	/**
	 * PostgresDB Down Migration
	 *
	 * @param queryRunner
	 */
	public async postgresDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await this.dropAll(queryRunner);
	}

	/**
	 * MySQL Up Migration
	 *
	 * @param queryRunner
	 */
	public async mysqlUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await this.addAll(queryRunner);
	}

	/**
	 * MySQL Down Migration
	 *
	 * @param queryRunner
	 */
	public async mysqlDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await this.dropAll(queryRunner);
	}

	/**
	 * Adds every rule this tick carries.
	 *
	 * @param queryRunner The runner the migration is executing on.
	 */
	private async addAll(queryRunner: QueryRunner): Promise<void> {
		for (const constraint of AddCoreCheckConstraints1791000000546.CONSTRAINTS) {
			await addCheckConstraint(queryRunner, constraint, this.name);
		}
	}

	/**
	 * Drops every rule this tick carries.
	 *
	 * @param queryRunner The runner the migration is executing on.
	 */
	private async dropAll(queryRunner: QueryRunner): Promise<void> {
		for (const constraint of AddCoreCheckConstraints1791000000546.CONSTRAINTS) {
			await dropCheckConstraint(queryRunner, constraint);
		}
	}
}
