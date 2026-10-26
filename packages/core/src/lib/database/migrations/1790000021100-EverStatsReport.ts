import { MigrationInterface, QueryRunner } from 'typeorm';
import * as chalk from 'chalk';
import { DatabaseTypeEnum } from '@gauzy/config';

/**
 * Creates the two tables of the anonymous usage statistics plugin (`@gauzy/plugin-ever-stats`):
 *
 * - `ever_stats_report`: the last reports this installation built, each with the exact bytes it
 *   signed and sent (`payload` is `TEXT`, not a JSON type, so the bytes are stored unchanged), the
 *   result and the HTTP status. The plugin keeps the last 12.
 * - `ever_stats_lease`: one row that lets only one API process send at a time when several share
 *   the database.
 *
 * Times are epoch milliseconds. The migration lives in core because plugins cannot carry migrations
 * yet; the plugin's `MIGRATIONS.md` lists it. The tables exist whether or not the plugin is loaded;
 * nothing reads them when it is not.
 *
 * Safe to run on a live database: it creates two new, empty tables and an index on one of them, and
 * changes nothing else. No foreign key, so no lock on an existing table; no statement per tenant or
 * per row. Every statement is `IF NOT EXISTS`, so running `up` twice is harmless. On Postgres a
 * transaction-scoped advisory lock serialises two API processes that boot at the same time.
 *
 * `down` drops both tables (and the index with them).
 */
export class EverStatsReport1790000021100 implements MigrationInterface {
	name = 'EverStatsReport1790000021100';

	/** Advisory lock key that serialises concurrent runs of this migration on Postgres. */
	private readonly advisoryLockKey = 1790000021100;

	/** The tables, in the order `down` drops them. */
	private readonly tables = ['ever_stats_lease', 'ever_stats_report'];

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
				throw new Error(`Unsupported database: ${queryRunner.connection.options.type}`);
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
			case DatabaseTypeEnum.postgres:
				for (const table of this.tables) {
					await queryRunner.query(`DROP TABLE IF EXISTS "${table}"`);
				}
				break;
			case DatabaseTypeEnum.mysql:
				for (const table of this.tables) {
					await queryRunner.query(`DROP TABLE IF EXISTS \`${table}\``);
				}
				break;
			default:
				throw new Error(`Unsupported database: ${queryRunner.connection.options.type}`);
		}
	}

	/**
	 * PostgresDB Up Migration
	 *
	 * @param queryRunner
	 */
	public async postgresUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		if (queryRunner.isTransactionActive) {
			await queryRunner.query(`SELECT pg_advisory_xact_lock($1)`, [this.advisoryLockKey]);
		}
		await queryRunner.query(
			`CREATE TABLE IF NOT EXISTS "ever_stats_report" ("id" character varying(36) NOT NULL, "period" character varying(7) NOT NULL, "payload" text, "status" character varying(16) NOT NULL, "httpStatus" integer, "attempts" integer NOT NULL DEFAULT 0, "lastError" character varying(255), "sentAt" bigint, "createdAt" bigint NOT NULL, CONSTRAINT "PK_ever_stats_report_id" PRIMARY KEY ("id"))`
		);
		await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_ever_stats_report_created_at" ON "ever_stats_report" ("createdAt")`);
		await queryRunner.query(
			`CREATE TABLE IF NOT EXISTS "ever_stats_lease" ("id" character varying(16) NOT NULL, "leasedBy" character varying(64), "leaseUntil" bigint, "lastSentAt" bigint, CONSTRAINT "PK_ever_stats_lease_id" PRIMARY KEY ("id"))`
		);
	}

	/**
	 * MySQL Up Migration
	 *
	 * @param queryRunner
	 */
	public async mysqlUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(
			`CREATE TABLE IF NOT EXISTS \`ever_stats_report\` (\`id\` varchar(36) NOT NULL, \`period\` varchar(7) NOT NULL, \`payload\` text NULL, \`status\` varchar(16) NOT NULL, \`httpStatus\` int NULL, \`attempts\` int NOT NULL DEFAULT 0, \`lastError\` varchar(255) NULL, \`sentAt\` bigint NULL, \`createdAt\` bigint NOT NULL, INDEX \`IDX_ever_stats_report_created_at\` (\`createdAt\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`
		);
		await queryRunner.query(
			`CREATE TABLE IF NOT EXISTS \`ever_stats_lease\` (\`id\` varchar(16) NOT NULL, \`leasedBy\` varchar(64) NULL, \`leaseUntil\` bigint NULL, \`lastSentAt\` bigint NULL, PRIMARY KEY (\`id\`)) ENGINE=InnoDB`
		);
	}

	/**
	 * SqliteDB and BetterSQlite3DB Up Migration
	 *
	 * @param queryRunner
	 */
	public async sqliteUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(
			`CREATE TABLE IF NOT EXISTS "ever_stats_report" ("id" varchar(36) PRIMARY KEY NOT NULL, "period" varchar(7) NOT NULL, "payload" text, "status" varchar(16) NOT NULL, "httpStatus" integer, "attempts" integer NOT NULL DEFAULT (0), "lastError" varchar(255), "sentAt" bigint, "createdAt" bigint NOT NULL)`
		);
		await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_ever_stats_report_created_at" ON "ever_stats_report" ("createdAt")`);
		await queryRunner.query(
			`CREATE TABLE IF NOT EXISTS "ever_stats_lease" ("id" varchar(16) PRIMARY KEY NOT NULL, "leasedBy" varchar(64), "leaseUntil" bigint, "lastSentAt" bigint)`
		);
	}
}
