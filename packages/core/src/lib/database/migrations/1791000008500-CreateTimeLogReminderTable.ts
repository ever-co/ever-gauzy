import { MigrationInterface, QueryRunner } from 'typeorm';
import * as chalk from 'chalk';
import { DatabaseTypeEnum } from '@gauzy/config';

/** The databases this migration runs on. Both SQLite drivers share one entry. */
type Dialect = 'postgres' | 'sqlite' | 'mysql';

const TABLE = 'time_log_reminder';

/** The key that lets one reminder of a log and level through, whatever the processes that send it. */
const TIME_LOG_REMINDER_UNIQUE_INDEX = {
	name: 'IDX_time_log_reminder_time_log_level',
	columns: ['timeLogId', 'level']
};

/**
 * The indexes the entity declares, under the names TypeORM gives them (`migration:generate` then sees nothing to add):
 * the base entity's columns. The log is indexed by the unique key, whose first column it is.
 */
const TIME_LOG_REMINDER_INDEXES: ReadonlyArray<{ name: string; columns: string[] }> = [
	{ name: 'IDX_78c3cdb11959415be06bf031c2', columns: ['createdByUserId'] },
	{ name: 'IDX_2c483ba315a455001e3e638d66', columns: ['updatedByUserId'] },
	{ name: 'IDX_c9d045ec02091d925ff60d60fb', columns: ['deletedByUserId'] },
	{ name: 'IDX_48c2e2ca4fd9fe3c874ef629e9', columns: ['isActive'] },
	{ name: 'IDX_092c734fa016ae3bb0d71d50cc', columns: ['isArchived'] },
	{ name: 'IDX_a97ed6d55bcafb7e0c554c84de', columns: ['tenantId'] },
	{ name: 'IDX_3dae1d9ba08b1118b37532417d', columns: ['organizationId'] }
];

/** The foreign keys, under the names TypeORM gives them. A reminder goes with its log. */
const TIME_LOG_REMINDER_FOREIGN_KEYS: ReadonlyArray<{
	name: string;
	column: string;
	references: string;
	onDelete: 'CASCADE';
	onUpdate: 'NO ACTION' | 'CASCADE';
}> = [
	{
		name: 'FK_78c3cdb11959415be06bf031c2e',
		column: 'createdByUserId',
		references: 'user',
		onDelete: 'CASCADE',
		onUpdate: 'NO ACTION'
	},
	{
		name: 'FK_2c483ba315a455001e3e638d66f',
		column: 'updatedByUserId',
		references: 'user',
		onDelete: 'CASCADE',
		onUpdate: 'NO ACTION'
	},
	{
		name: 'FK_c9d045ec02091d925ff60d60fb9',
		column: 'deletedByUserId',
		references: 'user',
		onDelete: 'CASCADE',
		onUpdate: 'NO ACTION'
	},
	{
		name: 'FK_a97ed6d55bcafb7e0c554c84de3',
		column: 'tenantId',
		references: 'tenant',
		onDelete: 'CASCADE',
		onUpdate: 'NO ACTION'
	},
	{
		name: 'FK_3dae1d9ba08b1118b37532417d5',
		column: 'organizationId',
		references: 'organization',
		onDelete: 'CASCADE',
		onUpdate: 'CASCADE'
	},
	{
		name: 'FK_6e3371fb69e9240e11b9410b7ef',
		column: 'timeLogId',
		references: 'time_log',
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
		`"level" integer NOT NULL`,
		`"employeeNotificationId" character varying NOT NULL`,
		`"claimedAt" TIMESTAMP NOT NULL`,
		`"filedAt" TIMESTAMP`,
		`"timeLogId" uuid NOT NULL`
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
		`"level" integer NOT NULL`,
		`"employeeNotificationId" varchar NOT NULL`,
		`"claimedAt" datetime NOT NULL`,
		`"filedAt" datetime`,
		`"timeLogId" varchar NOT NULL`
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
		'`level` int NOT NULL',
		'`employeeNotificationId` varchar(255) NOT NULL',
		'`claimedAt` datetime NOT NULL',
		'`filedAt` datetime NULL',
		'`timeLogId` varchar(255) NOT NULL'
	].join(', ')
};

/**
 * Creates `time_log_reminder`: the reminders the platform sent about a timer left running (ever-co/ever-teams#5022),
 * one row per time log and level (1 at the employee's threshold, 2 at twice it). The timer reminder sweep inserts the
 * row before it files the notification, and the unique key on the log and the level is what lets a single insert
 * through when several processes sweep at once, so each reminder is filed once. The row names the id the notification
 * is filed under and when it was filed, so a claim a stopped process left unfiled is filed later, under that id.
 *
 * Safe on a live database: one new, empty table with its indexes and foreign keys; no existing table, column or row is
 * changed, and nothing is backfilled (a timer already past its threshold is reminded of once, at the first sweep).
 * Every statement is guarded (`IF NOT EXISTS`, or a check of the catalogue for the foreign keys), so running `up`
 * twice is harmless; an advisory lock (a named lock on MySQL) makes two API processes that boot together run it one
 * after the other.
 *
 * `down` drops the table (its indexes and foreign keys go with it).
 */
export class CreateTimeLogReminderTable1791000008500 implements MigrationInterface {
	name = 'CreateTimeLogReminderTable1791000008500';

	/** Advisory lock key that serialises concurrent runs of this migration on Postgres. */
	private readonly advisoryLockKey = 1791000008500;

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
			`CREATE TABLE IF NOT EXISTS "${TABLE}" (${COLUMNS.postgres}, CONSTRAINT "PK_3ca5564de91c4f1af780293eda2" PRIMARY KEY ("id"))`
		);
		for (const index of TIME_LOG_REMINDER_INDEXES) {
			await queryRunner.query(
				`CREATE INDEX IF NOT EXISTS "${index.name}" ON "${TABLE}" (${columnList('postgres', index.columns)})`
			);
		}
		await queryRunner.query(
			`CREATE UNIQUE INDEX IF NOT EXISTS "${TIME_LOG_REMINDER_UNIQUE_INDEX.name}" ON "${TABLE}" (${columnList('postgres', TIME_LOG_REMINDER_UNIQUE_INDEX.columns)})`
		);
		for (const fk of TIME_LOG_REMINDER_FOREIGN_KEYS) {
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
			...TIME_LOG_REMINDER_INDEXES.map(
				(index) => `INDEX \`${index.name}\` (${columnList('mysql', index.columns)})`
			),
			`UNIQUE INDEX \`${TIME_LOG_REMINDER_UNIQUE_INDEX.name}\` (${columnList('mysql', TIME_LOG_REMINDER_UNIQUE_INDEX.columns)})`
		];
		await queryRunner.query(
			`CREATE TABLE IF NOT EXISTS \`${TABLE}\` (${COLUMNS.mysql}, ${indexes.join(', ')}, PRIMARY KEY (\`id\`)) ENGINE=InnoDB`
		);
		const table = await queryRunner.getTable(TABLE);
		for (const fk of TIME_LOG_REMINDER_FOREIGN_KEYS) {
			if (table?.foreignKeys.some((existing) => existing.name === fk.name)) continue;
			await queryRunner.query(
				`ALTER TABLE \`${TABLE}\` ADD CONSTRAINT \`${fk.name}\` FOREIGN KEY (\`${fk.column}\`) REFERENCES \`${fk.references}\`(\`id\`) ON DELETE ${fk.onDelete} ON UPDATE ${fk.onUpdate}`
			);
		}
	}

	/** SQLite declares the foreign keys with the table: it cannot add one to an existing table. */
	private async sqliteUp(queryRunner: QueryRunner): Promise<void> {
		const foreignKeys = TIME_LOG_REMINDER_FOREIGN_KEYS.map(
			(fk) =>
				`CONSTRAINT "${fk.name}" FOREIGN KEY ("${fk.column}") REFERENCES "${fk.references}" ("id") ON DELETE ${fk.onDelete} ON UPDATE ${fk.onUpdate}`
		);
		await queryRunner.query(`CREATE TABLE IF NOT EXISTS "${TABLE}" (${COLUMNS.sqlite}, ${foreignKeys.join(', ')})`);
		for (const index of TIME_LOG_REMINDER_INDEXES) {
			await queryRunner.query(
				`CREATE INDEX IF NOT EXISTS "${index.name}" ON "${TABLE}" (${columnList('sqlite', index.columns)})`
			);
		}
		await queryRunner.query(
			`CREATE UNIQUE INDEX IF NOT EXISTS "${TIME_LOG_REMINDER_UNIQUE_INDEX.name}" ON "${TABLE}" (${columnList('sqlite', TIME_LOG_REMINDER_UNIQUE_INDEX.columns)})`
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
	return dialect === 'mysql' ? `\`${identifier}\`` : `"${identifier}"`;
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
