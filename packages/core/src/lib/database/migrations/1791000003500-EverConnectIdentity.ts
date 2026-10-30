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
 * The tables of Sign in with Ever ID and personal-data requests in the Ever Platform connection
 * plugin (`@gauzy/plugin-ever-connect`). Times are epoch milliseconds.
 */
const TABLES: Table[] = [
	{
		// One row per Ever ID link or unlink to report to Ever Platform, kept until it was sent (or
		// given up after a day of retries). Identifiers only: never an e-mail or a person's name.
		name: 'ever_connect_person_link_report',
		columns: [
			varchar('id', 36, true),
			varchar('op', 8, true),
			varchar('userId', 64, true),
			varchar('tenantId', 64),
			varchar('tenantName', 120),
			varchar('issuer', 255, true),
			varchar('subject', 128, true),
			varchar('subjectHash', 64, true),
			varchar('linkMethod', 16),
			varchar('state', 16, true),
			integer('attempts', 0),
			bigint('nextAttemptAt'),
			varchar('lastError', 64),
			bigint('sentAt'),
			integer('seq', 0),
			bigint('createdAt', true),
			bigint('updatedAt', true)
		],
		indexes: [
			{ name: 'IDX_ever_connect_person_link_report_due', columns: ['state', 'nextAttemptAt'] },
			{ name: 'IDX_ever_connect_person_link_report_subject', columns: ['subjectHash'] },
			{ name: 'IDX_ever_connect_person_link_report_user', columns: ['userId', 'state'] }
		]
	},
	{
		// One row per deletion or export request received from Ever Platform (its event id), with the
		// answer sent back: a request read twice is answered once.
		name: 'ever_connect_person_request',
		columns: [
			varchar('id', 32, true),
			varchar('kind', 16, true),
			varchar('jobId', 32, true),
			bigint('respondBy'),
			text('subjectHashes'),
			text('userIds'),
			varchar('claimedBy', 36),
			bigint('claimedUntil'),
			varchar('result', 32),
			varchar('reasonCode', 64),
			varchar('legalBasis', 200),
			text('exportUrlEncrypted'),
			varchar('state', 16, true),
			integer('attempts', 0),
			bigint('nextAttemptAt'),
			varchar('lastError', 64),
			bigint('answeredAt'),
			bigint('createdAt', true),
			bigint('updatedAt', true)
		],
		indexes: [
			{ name: 'IDX_ever_connect_person_request_due', columns: ['state', 'nextAttemptAt'] },
			{ name: 'IDX_ever_connect_person_request_job', columns: ['jobId'] }
		]
	}
];

/** Added to `ever_connect_connection`: until when this installation's address check is pending. */
const CHECK_COLUMN = bigint('publicUrlCheckUntil');

/**
 * Sign in with Ever ID and personal-data requests for `@gauzy/plugin-ever-connect`:
 *
 * - `ever_connect_person_link_report`: the Ever ID links and unlinks waiting to be reported to Ever
 *   Platform, with their attempts (a retry table);
 * - `ever_connect_person_request`: the deletion and export requests received, and the answer given;
 * - `ever_connect_connection.publicUrlCheckUntil`: until when `/.well-known/ever-connect` answers
 *   (empty: it answers 404).
 *
 * The migration lives in core because plugins cannot carry migrations yet; the plugin's
 * `MIGRATIONS.md` lists it. The tables exist whether or not the plugin is loaded.
 *
 * Safe to run on a live database: two new, empty tables with their indexes and one nullable column
 * on the plugin's own one-row table. No foreign key, no statement per tenant or per row. Every
 * statement is `IF NOT EXISTS` (the column is added only when missing), so running `up` twice is
 * harmless. On Postgres a transaction-scoped advisory lock serialises two API processes that boot
 * at the same time.
 *
 * `down` drops the two tables and the column.
 */
export class EverConnectIdentity1791000003500 implements MigrationInterface {
	name = 'EverConnectIdentity1791000003500';

	/** Advisory lock key that serialises concurrent runs of this migration on Postgres. */
	private readonly advisoryLockKey = 1791000003500;

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
		const type = queryRunner.connection.options.type as DatabaseTypeEnum;
		switch (type) {
			case DatabaseTypeEnum.sqlite:
			case DatabaseTypeEnum.betterSqlite3:
			case DatabaseTypeEnum.postgres:
				for (const table of tables) {
					await queryRunner.query(`DROP TABLE IF EXISTS "${table}"`);
				}
				if (await this.hasCheckColumn(queryRunner)) {
					await queryRunner.query(`ALTER TABLE "ever_connect_connection" DROP COLUMN "${CHECK_COLUMN.name}"`);
				}
				break;
			case DatabaseTypeEnum.mysql:
				for (const table of tables) {
					await queryRunner.query(`DROP TABLE IF EXISTS \`${table}\``);
				}
				if (await this.hasCheckColumn(queryRunner)) {
					await queryRunner.query(`ALTER TABLE \`ever_connect_connection\` DROP COLUMN \`${CHECK_COLUMN.name}\``);
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
		await queryRunner.query(
			`ALTER TABLE "ever_connect_connection" ADD COLUMN IF NOT EXISTS "${CHECK_COLUMN.name}" ${CHECK_COLUMN.postgres}`
		);
	}

	/**
	 * MySQL Up Migration (MySQL has no `CREATE INDEX IF NOT EXISTS` and no `ADD COLUMN IF NOT EXISTS`:
	 * the indexes are part of the table, and the column is added only when missing).
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
		if (!(await this.hasCheckColumn(queryRunner))) {
			await queryRunner.query(
				`ALTER TABLE \`ever_connect_connection\` ADD \`${CHECK_COLUMN.name}\` ${CHECK_COLUMN.mysql} NULL`
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
		if (!(await this.hasCheckColumn(queryRunner))) {
			await queryRunner.query(
				`ALTER TABLE "ever_connect_connection" ADD COLUMN "${CHECK_COLUMN.name}" ${CHECK_COLUMN.sqlite}`
			);
		}
	}

	/** Whether `ever_connect_connection` already has the address-check column. */
	private async hasCheckColumn(queryRunner: QueryRunner): Promise<boolean> {
		return queryRunner.hasColumn('ever_connect_connection', CHECK_COLUMN.name);
	}
}
