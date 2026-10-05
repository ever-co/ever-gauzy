import { MigrationInterface, QueryRunner } from 'typeorm';
import * as chalk from 'chalk';
import { DatabaseTypeEnum } from '@gauzy/config';

/**
 * Creates `ever_instance`, the one-row identity of this installation used by the anonymous usage
 * statistics plugin (`@gauzy/plugin-ever-instance`, `@gauzy/plugin-ever-stats`): a random id, the
 * statistics key (its private part encrypted), the operator switch, and columns reserved for the Ever
 * Platform connection. Times are epoch milliseconds.
 *
 * The migration lives in core because plugins cannot carry migrations yet; the plugin's
 * `MIGRATIONS.md` lists it so it can move with the plugin later. The table exists whether or not the
 * plugin is loaded; it stays empty until the plugin runs.
 *
 * Safe to run on a live database: it creates one new, empty table and changes nothing else. It has no
 * foreign key, so it takes no lock on an existing table, and it runs no statement per tenant or per
 * row. `CREATE TABLE IF NOT EXISTS` makes running `up` twice harmless. On Postgres a
 * transaction-scoped advisory lock makes two API processes that boot at the same time against one
 * database run it one after the other.
 *
 * `down` drops the table.
 */
export class EverInstance1790000021000 implements MigrationInterface {
	name = 'EverInstance1790000021000';

	/** Advisory lock key that serialises concurrent runs of this migration on Postgres. */
	private readonly advisoryLockKey = 1790000021000;

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
				await queryRunner.query(`DROP TABLE IF EXISTS "ever_instance"`);
				break;
			case DatabaseTypeEnum.mysql:
				await queryRunner.query(`DROP TABLE IF EXISTS \`ever_instance\``);
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
			`CREATE TABLE IF NOT EXISTS "ever_instance" ("id" character varying(16) NOT NULL, "instanceId" character varying(36) NOT NULL, "statsPublicKey" character varying(64) NOT NULL, "statsPrivateKeyEncrypted" text NOT NULL, "statsKeyId" character varying(16) NOT NULL, "operatorUserId" character varying(36), "statsEnabledUi" boolean NOT NULL DEFAULT true, "resetCount" integer NOT NULL DEFAULT 0, "connectPublicKey" character varying(64), "connectPrivateKeyEncrypted" text, "connectKeyId" character varying(16), "jwksCache" text, "jwksFetchedAt" bigint, "createdAt" bigint NOT NULL, "updatedAt" bigint NOT NULL, CONSTRAINT "PK_ever_instance_id" PRIMARY KEY ("id"))`
		);
	}

	/**
	 * MySQL Up Migration
	 *
	 * @param queryRunner
	 */
	public async mysqlUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(
			`CREATE TABLE IF NOT EXISTS \`ever_instance\` (\`id\` varchar(16) NOT NULL, \`instanceId\` varchar(36) NOT NULL, \`statsPublicKey\` varchar(64) NOT NULL, \`statsPrivateKeyEncrypted\` text NOT NULL, \`statsKeyId\` varchar(16) NOT NULL, \`operatorUserId\` varchar(36) NULL, \`statsEnabledUi\` tinyint NOT NULL DEFAULT 1, \`resetCount\` int NOT NULL DEFAULT 0, \`connectPublicKey\` varchar(64) NULL, \`connectPrivateKeyEncrypted\` text NULL, \`connectKeyId\` varchar(16) NULL, \`jwksCache\` text NULL, \`jwksFetchedAt\` bigint NULL, \`createdAt\` bigint NOT NULL, \`updatedAt\` bigint NOT NULL, PRIMARY KEY (\`id\`)) ENGINE=InnoDB`
		);
	}

	/**
	 * SqliteDB and BetterSQlite3DB Up Migration
	 *
	 * @param queryRunner
	 */
	public async sqliteUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(
			`CREATE TABLE IF NOT EXISTS "ever_instance" ("id" varchar(16) PRIMARY KEY NOT NULL, "instanceId" varchar(36) NOT NULL, "statsPublicKey" varchar(64) NOT NULL, "statsPrivateKeyEncrypted" text NOT NULL, "statsKeyId" varchar(16) NOT NULL, "operatorUserId" varchar(36), "statsEnabledUi" boolean NOT NULL DEFAULT (1), "resetCount" integer NOT NULL DEFAULT (0), "connectPublicKey" varchar(64), "connectPrivateKeyEncrypted" text, "connectKeyId" varchar(16), "jwksCache" text, "jwksFetchedAt" bigint, "createdAt" bigint NOT NULL, "updatedAt" bigint NOT NULL)`
		);
	}
}
