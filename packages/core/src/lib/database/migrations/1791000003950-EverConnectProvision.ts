import { MigrationInterface, QueryRunner } from 'typeorm';
import * as chalk from 'chalk';
import { DatabaseTypeEnum } from '@gauzy/config';

/** A column: name, type per database, and whether it may be empty / its default. */
interface Column {
	name: string;
	postgres: string;
	mysql: string;
	sqlite: string;
	notNull?: boolean;
	default?: { postgres: string; mysql: string; sqlite: string };
}

/** A table: its columns (the first is the primary key) and its indexes. */
interface Table {
	name: string;
	columns: Column[];
	indexes: Array<{ name: string; columns: string[]; unique?: boolean }>;
}

const varchar = (name: string, length: number, notNull = false): Column => ({
	name,
	postgres: `character varying(${length})`,
	mysql: `varchar(${length})`,
	sqlite: `varchar(${length})`,
	notNull
});
const bigint = (name: string, notNull = false): Column => ({
	name,
	postgres: 'bigint',
	mysql: 'bigint',
	sqlite: 'bigint',
	notNull
});
const text = (name: string): Column => ({ name, postgres: 'text', mysql: 'text', sqlite: 'text' });
const integer = (name: string, defaultValue: number): Column => ({
	name,
	postgres: 'integer',
	mysql: 'int',
	sqlite: 'integer',
	notNull: true,
	default: { postgres: `${defaultValue}`, mysql: `${defaultValue}`, sqlite: `(${defaultValue})` }
});

/**
 * The tables of creating a workspace from Ever in the Ever Platform connection plugin
 * (`@gauzy/plugin-ever-connect`). Times are epoch milliseconds.
 */
const TABLES: Table[] = [
	{
		// One row per signed request received from Ever Platform to create a workspace (its `jti`): the
		// verified claims (ids and public names only, never an e-mail), the digest of the one-time key
		// the browser holds while the person signs in and confirms, and until when it is valid.
		name: 'ever_connect_provision_intent',
		columns: [
			varchar('jti', 32, true),
			text('intent'),
			varchar('keyHash', 64, true),
			varchar('idempotencyKey', 200, true),
			varchar('status', 16, true),
			text('result'),
			bigint('receivedAt', true),
			bigint('expiresAt', true),
			bigint('updatedAt', true)
		],
		indexes: [
			{ name: 'IDX_ever_connect_provision_intent_key', columns: ['keyHash'], unique: true },
			{ name: 'IDX_ever_connect_provision_intent_expires', columns: ['expiresAt'] }
		]
	},
	{
		// One row per idempotency key of a workspace creation: who is creating it (a claim with an end),
		// the ids it created so far, how it ended, and the completion report to Ever Platform with its
		// retries.
		name: 'ever_connect_provision_result',
		columns: [
			varchar('idempotencyKey', 200, true),
			varchar('jti', 32, true),
			varchar('status', 16, true),
			varchar('everOrgId', 32),
			// The Ever organization while this creation holds it (pending or created; empty once it failed):
			// unique, so one Ever organization is never created twice under two keys at once.
			varchar('everOrgKey', 32),
			varchar('productTenantId', 64),
			varchar('productOrgId', 64),
			varchar('productUserId', 64),
			varchar('employeeId', 64),
			varchar('teamId', 64),
			varchar('integrationTenantId', 64),
			varchar('errorCode', 64),
			varchar('claimedBy', 36),
			bigint('claimedUntil'),
			varchar('completionState', 16),
			integer('completionAttempts', 0),
			bigint('completionNextAt'),
			varchar('completionError', 64),
			bigint('completedAt'),
			varchar('tenantLinkId', 64),
			bigint('createdAt', true),
			bigint('updatedAt', true)
		],
		indexes: [
			{ name: 'IDX_ever_connect_provision_result_jti', columns: ['jti'], unique: true },
			{ name: 'IDX_ever_connect_provision_result_org', columns: ['everOrgKey'], unique: true },
			{ name: 'IDX_ever_connect_provision_result_completion', columns: ['completionState', 'completionNextAt'] }
		]
	}
];

/**
 * Creating a workspace from Ever, for `@gauzy/plugin-ever-connect`:
 *
 * - `ever_connect_provision_intent`: the signed requests received, by `jti`, while the person signs in
 *   and confirms (pending, then accepted, rejected or expired);
 * - `ever_connect_provision_result`: one row per idempotency key: the workspace created for it, and the
 *   completion report to Ever Platform (a retry table).
 *
 * The migration lives in core because plugins cannot carry migrations yet; the plugin's `MIGRATIONS.md`
 * lists it. The tables exist whether or not the plugin is loaded, and stay empty unless
 * `EVER_CONNECT_PROVISION_ENABLED=true`.
 *
 * Safe to run on a live database: two new, empty tables with their indexes. No foreign key, no change
 * to an existing table, no statement per tenant or per row. Every statement is `IF NOT EXISTS`, so
 * running `up` twice is harmless. On Postgres a transaction-scoped advisory lock serialises two API
 * processes that boot at the same time.
 *
 * `down` drops the two tables.
 */
export class EverConnectProvision1791000003950 implements MigrationInterface {
	name = 'EverConnectProvision1791000003950';

	/** Advisory lock key that serialises concurrent runs of this migration on Postgres. */
	private readonly advisoryLockKey = 1791000003950;

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

		const tables = [...TABLES].reverse().map((table) => table.name);
		switch (queryRunner.connection.options.type as DatabaseTypeEnum) {
			case DatabaseTypeEnum.sqlite:
			case DatabaseTypeEnum.betterSqlite3:
			case DatabaseTypeEnum.postgres:
				for (const table of tables) {
					await queryRunner.query(`DROP TABLE IF EXISTS "${table}"`);
				}
				break;
			case DatabaseTypeEnum.mysql:
				for (const table of tables) {
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
		for (const table of TABLES) {
			const columns = table.columns.map((column) => {
				const nullability = column.notNull ? ' NOT NULL' : '';
				const fallback = column.default ? ` DEFAULT ${column.default.postgres}` : '';
				return `"${column.name}" ${column.postgres}${nullability}${fallback}`;
			});
			await queryRunner.query(
				`CREATE TABLE IF NOT EXISTS "${table.name}" (${columns.join(', ')}, CONSTRAINT "PK_${table.name}" PRIMARY KEY ("${table.columns[0].name}"))`
			);
			for (const index of table.indexes) {
				await queryRunner.query(
					`CREATE ${index.unique ? 'UNIQUE ' : ''}INDEX IF NOT EXISTS "${index.name}" ON "${table.name}" (${index.columns.map((c) => `"${c}"`).join(', ')})`
				);
			}
		}
	}

	/**
	 * MySQL Up Migration (MySQL has no `CREATE INDEX IF NOT EXISTS`: the indexes are part of the table).
	 *
	 * @param queryRunner
	 */
	public async mysqlUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		for (const table of TABLES) {
			const columns = table.columns.map((column) => {
				const nullability = column.notNull ? ' NOT NULL' : ' NULL';
				const fallback = column.default ? ` DEFAULT ${column.default.mysql}` : '';
				return `\`${column.name}\` ${column.mysql}${nullability}${fallback}`;
			});
			const indexes = table.indexes.map(
				(index) =>
					`${index.unique ? 'UNIQUE ' : ''}INDEX \`${index.name}\` (${index.columns.map((c) => `\`${c}\``).join(', ')})`
			);
			await queryRunner.query(
				`CREATE TABLE IF NOT EXISTS \`${table.name}\` (${[...columns, ...indexes, `PRIMARY KEY (\`${table.columns[0].name}\`)`].join(', ')}) ENGINE=InnoDB`
			);
		}
	}

	/**
	 * SqliteDB and BetterSQlite3DB Up Migration
	 *
	 * @param queryRunner
	 */
	public async sqliteUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		for (const table of TABLES) {
			const columns = table.columns.map((column, at) => {
				const key = at === 0 ? ' PRIMARY KEY' : '';
				const nullability = column.notNull ? ' NOT NULL' : '';
				const fallback = column.default ? ` DEFAULT ${column.default.sqlite}` : '';
				return `"${column.name}" ${column.sqlite}${key}${nullability}${fallback}`;
			});
			await queryRunner.query(`CREATE TABLE IF NOT EXISTS "${table.name}" (${columns.join(', ')})`);
			for (const index of table.indexes) {
				await queryRunner.query(
					`CREATE ${index.unique ? 'UNIQUE ' : ''}INDEX IF NOT EXISTS "${index.name}" ON "${table.name}" (${index.columns.map((c) => `"${c}"`).join(', ')})`
				);
			}
		}
	}
}
