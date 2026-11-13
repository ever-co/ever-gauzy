import { MigrationInterface, QueryRunner } from 'typeorm';
import * as chalk from 'chalk';
import { DatabaseTypeEnum } from '@gauzy/config';

/** The databases this migration runs on. Both SQLite drivers share one entry. */
type Dialect = 'postgres' | 'sqlite' | 'mysql';

const TABLE = 'saved_report';

/** The key a link is read by: one digest opens one report. Several reports without a link share the null. */
const SHARE_TOKEN_UNIQUE_INDEX = { name: 'IDX_a80ec2517727b41dbf03a0a294', columns: ['shareTokenHash'] };

/**
 * The indexes the entity declares, under the names TypeORM gives them (`migration:generate` then sees nothing to add):
 * the base entity's columns, and the author, whose reports are listed by it.
 */
const SAVED_REPORT_INDEXES: ReadonlyArray<{ name: string; columns: string[] }> = [
	{ name: 'IDX_19992c3c67e7ad3f096abe518a', columns: ['createdByUserId'] },
	{ name: 'IDX_cd067fe8e6be08044f1b531838', columns: ['updatedByUserId'] },
	{ name: 'IDX_0ca834b793392ebd8f26fbe023', columns: ['deletedByUserId'] },
	{ name: 'IDX_f8e82e8b9b1c3692a969778add', columns: ['isActive'] },
	{ name: 'IDX_1c9a1594eab7178311cb417291', columns: ['isArchived'] },
	{ name: 'IDX_9fba82cd8c7962f9aa6699958b', columns: ['tenantId'] },
	{ name: 'IDX_fe9b65c384a9a35fb4b42a20e6', columns: ['organizationId'] },
	{ name: 'IDX_f795e53cc50d7d7a3e7f6bdd54', columns: ['authorId'] }
];

/** The foreign keys, under the names TypeORM gives them. A report goes with its author, its organization and tenant. */
const SAVED_REPORT_FOREIGN_KEYS: ReadonlyArray<{
	name: string;
	column: string;
	references: string;
	onDelete: 'CASCADE';
	onUpdate: 'NO ACTION' | 'CASCADE';
}> = [
	{
		name: 'FK_19992c3c67e7ad3f096abe518a2',
		column: 'createdByUserId',
		references: 'user',
		onDelete: 'CASCADE',
		onUpdate: 'NO ACTION'
	},
	{
		name: 'FK_cd067fe8e6be08044f1b531838d',
		column: 'updatedByUserId',
		references: 'user',
		onDelete: 'CASCADE',
		onUpdate: 'NO ACTION'
	},
	{
		name: 'FK_0ca834b793392ebd8f26fbe0233',
		column: 'deletedByUserId',
		references: 'user',
		onDelete: 'CASCADE',
		onUpdate: 'NO ACTION'
	},
	{
		name: 'FK_9fba82cd8c7962f9aa6699958be',
		column: 'tenantId',
		references: 'tenant',
		onDelete: 'CASCADE',
		onUpdate: 'NO ACTION'
	},
	{
		name: 'FK_fe9b65c384a9a35fb4b42a20e60',
		column: 'organizationId',
		references: 'organization',
		onDelete: 'CASCADE',
		onUpdate: 'CASCADE'
	},
	{
		name: 'FK_f795e53cc50d7d7a3e7f6bdd54e',
		column: 'authorId',
		references: 'user',
		onDelete: 'CASCADE',
		onUpdate: 'NO ACTION'
	}
];

/** The columns per dialect, as TypeORM creates them for the entity. */
const COLUMNS: Record<Dialect, string> = {
	postgres: [
		`"deletedAt" TIMESTAMP`,
		`"createdAt" TIMESTAMP NOT NULL DEFAULT now()`,
		`"updatedAt" TIMESTAMP NOT NULL DEFAULT now()`,
		`"createdByUserId" uuid`,
		`"updatedByUserId" uuid`,
		`"deletedByUserId" uuid`,
		`"id" uuid NOT NULL DEFAULT uuid_generate_v4()`,
		`"isActive" boolean DEFAULT true`,
		`"isArchived" boolean DEFAULT false`,
		`"archivedAt" TIMESTAMP`,
		`"tenantId" uuid`,
		`"organizationId" uuid`,
		`"name" character varying(100) NOT NULL`,
		`"kind" character varying NOT NULL DEFAULT 'TIME_AND_ACTIVITY'`,
		`"periodRule" character varying`,
		`"startDate" character varying(10)`,
		`"endDate" character varying(10)`,
		`"timeZone" character varying`,
		`"filters" jsonb`,
		`"grouping" character varying`,
		`"includeAmounts" boolean NOT NULL DEFAULT false`,
		`"shareTokenHash" character varying(64)`,
		`"sharedAt" TIMESTAMP`,
		`"shareExpiresAt" TIMESTAMP`,
		`"authorId" uuid NOT NULL`
	].join(', '),
	sqlite: [
		`"deletedAt" datetime`,
		`"createdAt" datetime NOT NULL DEFAULT (datetime('now'))`,
		`"updatedAt" datetime NOT NULL DEFAULT (datetime('now'))`,
		`"createdByUserId" varchar`,
		`"updatedByUserId" varchar`,
		`"deletedByUserId" varchar`,
		`"id" varchar PRIMARY KEY NOT NULL`,
		`"isActive" boolean DEFAULT (1)`,
		`"isArchived" boolean DEFAULT (0)`,
		`"archivedAt" datetime`,
		`"tenantId" varchar`,
		`"organizationId" varchar`,
		`"name" varchar(100) NOT NULL`,
		`"kind" varchar NOT NULL DEFAULT ('TIME_AND_ACTIVITY')`,
		`"periodRule" varchar`,
		`"startDate" varchar(10)`,
		`"endDate" varchar(10)`,
		`"timeZone" varchar`,
		`"filters" text`,
		`"grouping" varchar`,
		`"includeAmounts" boolean NOT NULL DEFAULT (0)`,
		`"shareTokenHash" varchar(64)`,
		`"sharedAt" datetime`,
		`"shareExpiresAt" datetime`,
		`"authorId" varchar NOT NULL`
	].join(', '),
	mysql: [
		'`deletedAt` datetime(6) NULL',
		'`createdAt` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6)',
		'`updatedAt` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6)',
		'`createdByUserId` varchar(255) NULL',
		'`updatedByUserId` varchar(255) NULL',
		'`deletedByUserId` varchar(255) NULL',
		'`id` varchar(36) NOT NULL',
		'`isActive` tinyint NULL DEFAULT 1',
		'`isArchived` tinyint NULL DEFAULT 0',
		'`archivedAt` datetime NULL',
		'`tenantId` varchar(255) NULL',
		'`organizationId` varchar(255) NULL',
		'`name` varchar(100) NOT NULL',
		"`kind` varchar(255) NOT NULL DEFAULT 'TIME_AND_ACTIVITY'",
		'`periodRule` varchar(255) NULL',
		'`startDate` varchar(10) NULL',
		'`endDate` varchar(10) NULL',
		'`timeZone` varchar(255) NULL',
		'`filters` json NULL',
		'`grouping` varchar(255) NULL',
		'`includeAmounts` tinyint NOT NULL DEFAULT 0',
		'`shareTokenHash` varchar(64) NULL',
		'`sharedAt` datetime NULL',
		'`shareExpiresAt` datetime NULL',
		'`authorId` varchar(255) NOT NULL'
	].join(', ')
};

/**
 * Creates `saved_report`: the reports members save with their period (a rule or fixed days), filters and grouping
 * (ever-co/ever-gauzy#11912). A report's author may turn on a read-only link: only the SHA-256 digest of its token is
 * stored, under a unique key, so a copy of the database opens no report.
 *
 * Safe on a live database: one new, empty table with its indexes and foreign keys; no existing table, column or row is
 * changed, and nothing is backfilled. Every statement is guarded (`IF NOT EXISTS`, or a check of the catalogue for the
 * foreign keys), so running `up` twice is harmless; an advisory lock (a named lock on MySQL) makes two API processes
 * that boot together run it one after the other.
 *
 * `down` drops the table (its indexes and foreign keys go with it).
 */
export class CreateSavedReportTable1791000009600 implements MigrationInterface {
	name = 'CreateSavedReportTable1791000009600';

	/** Advisory lock key that serialises concurrent runs of this migration on Postgres. */
	private readonly advisoryLockKey = 1791000009600;

	/** The MySQL named lock of this migration. MySQL refuses lock names over 64 characters. */
	readonly mysqlLockName = `gauzy:migration:${this.advisoryLockKey}`;

	public async up(queryRunner: QueryRunner): Promise<void> {
		console.log(chalk.yellow(this.name + ' start running!'));

		const dialect = dialectOf(queryRunner);
		switch (dialect) {
			case 'postgres':
				if (queryRunner.isTransactionActive) {
					await queryRunner.query(`SELECT pg_advisory_xact_lock($1)`, [this.advisoryLockKey]);
				}
				await this.postgresUp(queryRunner);
				break;
			case 'mysql':
				await withMysqlNamedLock(queryRunner, this.mysqlLockName, () => this.mysqlUp(queryRunner));
				break;
			default:
				await this.sqliteUp(queryRunner);
		}
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		console.log(chalk.yellow(this.name + ' reverting changes!'));

		const dialect = dialectOf(queryRunner);
		await queryRunner.query(`DROP TABLE IF EXISTS ${quoted(dialect, TABLE)}`);
	}

	private async postgresUp(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(
			`CREATE TABLE IF NOT EXISTS "${TABLE}" (${COLUMNS.postgres}, CONSTRAINT "PK_a4084cc0d67105892a1e40aa166" PRIMARY KEY ("id"))`
		);
		for (const index of SAVED_REPORT_INDEXES) {
			await queryRunner.query(
				`CREATE INDEX IF NOT EXISTS "${index.name}" ON "${TABLE}" (${columnList('postgres', index.columns)})`
			);
		}
		await queryRunner.query(
			`CREATE UNIQUE INDEX IF NOT EXISTS "${SHARE_TOKEN_UNIQUE_INDEX.name}" ON "${TABLE}" (${columnList('postgres', SHARE_TOKEN_UNIQUE_INDEX.columns)})`
		);
		for (const fk of SAVED_REPORT_FOREIGN_KEYS) {
			const existing = await queryRunner.query(
				`SELECT 1 FROM pg_constraint WHERE conname = $1 AND conrelid = to_regclass($2)`,
				[fk.name, TABLE]
			);
			if (existing.length > 0) continue;
			await queryRunner.query(
				`ALTER TABLE "${TABLE}" ADD CONSTRAINT "${fk.name}" FOREIGN KEY ("${fk.column}") REFERENCES "${fk.references}"("id") ON DELETE ${fk.onDelete} ON UPDATE ${fk.onUpdate}`
			);
		}
	}

	private async mysqlUp(queryRunner: QueryRunner): Promise<void> {
		const indexes = [
			...SAVED_REPORT_INDEXES.map((index) => `INDEX \`${index.name}\` (${columnList('mysql', index.columns)})`),
			`UNIQUE INDEX \`${SHARE_TOKEN_UNIQUE_INDEX.name}\` (${columnList('mysql', SHARE_TOKEN_UNIQUE_INDEX.columns)})`
		];
		await queryRunner.query(
			`CREATE TABLE IF NOT EXISTS \`${TABLE}\` (${COLUMNS.mysql}, ${indexes.join(', ')}, PRIMARY KEY (\`id\`)) ENGINE=InnoDB`
		);
		const table = await queryRunner.getTable(TABLE);
		for (const fk of SAVED_REPORT_FOREIGN_KEYS) {
			if (table?.foreignKeys.some((existing) => existing.name === fk.name)) continue;
			await queryRunner.query(
				`ALTER TABLE \`${TABLE}\` ADD CONSTRAINT \`${fk.name}\` FOREIGN KEY (\`${fk.column}\`) REFERENCES \`${fk.references}\`(\`id\`) ON DELETE ${fk.onDelete} ON UPDATE ${fk.onUpdate}`
			);
		}
	}

	/** SQLite declares the foreign keys with the table: it cannot add one to an existing table. */
	private async sqliteUp(queryRunner: QueryRunner): Promise<void> {
		const foreignKeys = SAVED_REPORT_FOREIGN_KEYS.map(
			(fk) =>
				`CONSTRAINT "${fk.name}" FOREIGN KEY ("${fk.column}") REFERENCES "${fk.references}" ("id") ON DELETE ${fk.onDelete} ON UPDATE ${fk.onUpdate}`
		);
		await queryRunner.query(`CREATE TABLE IF NOT EXISTS "${TABLE}" (${COLUMNS.sqlite}, ${foreignKeys.join(', ')})`);
		for (const index of SAVED_REPORT_INDEXES) {
			await queryRunner.query(
				`CREATE INDEX IF NOT EXISTS "${index.name}" ON "${TABLE}" (${columnList('sqlite', index.columns)})`
			);
		}
		await queryRunner.query(
			`CREATE UNIQUE INDEX IF NOT EXISTS "${SHARE_TOKEN_UNIQUE_INDEX.name}" ON "${TABLE}" (${columnList('sqlite', SHARE_TOKEN_UNIQUE_INDEX.columns)})`
		);
	}
}

/** The dialect of the connection's driver. Throws before any statement runs on any other database. */
function dialectOf(queryRunner: QueryRunner): Dialect {
	switch (queryRunner.connection.options.type as DatabaseTypeEnum) {
		case DatabaseTypeEnum.postgres:
			return 'postgres';
		case DatabaseTypeEnum.sqlite:
		case DatabaseTypeEnum.betterSqlite3:
			return 'sqlite';
		case DatabaseTypeEnum.mysql:
			return 'mysql';
		default:
			throw new Error(`Unsupported database: ${queryRunner.connection.options.type}`);
	}
}

/** An identifier quoted for the dialect. */
function quoted(dialect: Dialect, identifier: string): string {
	if (dialect === 'mysql') {
		return `\`${identifier}\``;
	}
	return `"${identifier}"`;
}

/** Quoted column names, comma-separated. */
function columnList(dialect: Dialect, columns: string[]): string {
	return columns.map((column) => quoted(dialect, column)).join(', ');
}

/**
 * Runs `work` while holding a MySQL named lock (`GET_LOCK`), so that two processes running the same migration
 * concurrently run its check and DDL one after the other. The lock is session-level and released in `finally`.
 */
async function withMysqlNamedLock(
	queryRunner: QueryRunner,
	lockName: string,
	work: () => Promise<void>
): Promise<void> {
	const [row] = (await queryRunner.query(`SELECT GET_LOCK(?, 30) AS acquired`, [lockName])) as Array<{
		acquired: number | string | null;
	}>;
	if (Number(row?.acquired) !== 1) {
		throw new Error(`Could not acquire the MySQL lock ${lockName} for the migration.`);
	}
	try {
		await work();
	} finally {
		await queryRunner.query(`SELECT RELEASE_LOCK(?)`, [lockName]);
	}
}
