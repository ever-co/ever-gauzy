import { MigrationInterface, QueryRunner } from 'typeorm';
import * as chalk from 'chalk';
import { DatabaseTypeEnum } from '@gauzy/config';

/** The databases this migration runs on. Both SQLite drivers share one entry. */
type Dialect = 'postgres' | 'sqlite' | 'mysql';

const TABLE = 'employee_appointment_reminder';

/**
 * The key that lets one reminder of a meeting, employee, level and start through, whatever the processes that file it.
 */
const REMINDER_UNIQUE_INDEX = {
	name: 'IDX_employee_appointment_reminder_key',
	columns: ['employeeAppointmentId', 'employeeId', 'level', 'startDateTime']
};

/**
 * The indexes the entity declares, under the names TypeORM gives them (`migration:generate` then sees nothing to add):
 * the base entity's columns and the employee. The meeting is indexed by the unique key, whose first column it is.
 */
const REMINDER_INDEXES: ReadonlyArray<{ name: string; columns: string[] }> = [
	{ name: 'IDX_1ebb82be1fc6e4714f687f5866', columns: ['createdByUserId'] },
	{ name: 'IDX_550a5dcf87f208721af1d574e9', columns: ['updatedByUserId'] },
	{ name: 'IDX_d185d2367a7f728ee88babec30', columns: ['deletedByUserId'] },
	{ name: 'IDX_12baaae471ca9751a1ec2cfe76', columns: ['isActive'] },
	{ name: 'IDX_877dc2f847c8da3c43fbfce22c', columns: ['isArchived'] },
	{ name: 'IDX_78a41d1044c5855ee24e90c9c3', columns: ['tenantId'] },
	{ name: 'IDX_6939fdfb5ec1ce1d2581c15a50', columns: ['organizationId'] },
	{ name: 'IDX_0b73a6ba073d2f7b010f06a8b1', columns: ['employeeId'] }
];

/** The foreign keys, under the names TypeORM gives them. A reminder goes with its meeting, and with its employee. */
const REMINDER_FOREIGN_KEYS: ReadonlyArray<{
	name: string;
	column: string;
	references: string;
	onDelete: 'CASCADE';
	onUpdate: 'NO ACTION' | 'CASCADE';
}> = [
	{
		name: 'FK_1ebb82be1fc6e4714f687f58669',
		column: 'createdByUserId',
		references: 'user',
		onDelete: 'CASCADE',
		onUpdate: 'NO ACTION'
	},
	{
		name: 'FK_550a5dcf87f208721af1d574e90',
		column: 'updatedByUserId',
		references: 'user',
		onDelete: 'CASCADE',
		onUpdate: 'NO ACTION'
	},
	{
		name: 'FK_d185d2367a7f728ee88babec30e',
		column: 'deletedByUserId',
		references: 'user',
		onDelete: 'CASCADE',
		onUpdate: 'NO ACTION'
	},
	{
		name: 'FK_78a41d1044c5855ee24e90c9c30',
		column: 'tenantId',
		references: 'tenant',
		onDelete: 'CASCADE',
		onUpdate: 'NO ACTION'
	},
	{
		name: 'FK_6939fdfb5ec1ce1d2581c15a50c',
		column: 'organizationId',
		references: 'organization',
		onDelete: 'CASCADE',
		onUpdate: 'CASCADE'
	},
	{
		name: 'FK_2216d6675b9b7058392a63cca85',
		column: 'employeeAppointmentId',
		references: 'employee_appointment',
		onDelete: 'CASCADE',
		onUpdate: 'NO ACTION'
	},
	{
		name: 'FK_0b73a6ba073d2f7b010f06a8b17',
		column: 'employeeId',
		references: 'employee',
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
		`"startDateTime" TIMESTAMP NOT NULL`,
		`"employeeNotificationId" character varying NOT NULL`,
		`"claimedAt" TIMESTAMP NOT NULL`,
		`"filedAt" TIMESTAMP`,
		`"employeeAppointmentId" uuid NOT NULL`,
		`"employeeId" uuid NOT NULL`
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
		`"startDateTime" datetime NOT NULL`,
		`"employeeNotificationId" varchar NOT NULL`,
		`"claimedAt" datetime NOT NULL`,
		`"filedAt" datetime`,
		`"employeeAppointmentId" varchar NOT NULL`,
		`"employeeId" varchar NOT NULL`
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
		'`startDateTime` datetime NOT NULL',
		'`employeeNotificationId` varchar(255) NOT NULL',
		'`claimedAt` datetime NOT NULL',
		'`filedAt` datetime NULL',
		'`employeeAppointmentId` varchar(255) NOT NULL',
		'`employeeId` varchar(255) NOT NULL'
	].join(', ')
};

/**
 * Creates `employee_appointment_reminder` (ever-co/ever-teams#5022): the reminders the platform filed about a meeting for
 * its host and its invitees, one row per meeting, employee, level (1 at their lead before the start, 2 when it is about
 * to start) and start. The meeting reminder sweep inserts the row before it files the notification, and the unique key
 * on the four is what lets a single insert through when several processes sweep at once, so each reminder is filed
 * once. A meeting moved to another time is reminded of again at its new time.
 *
 * Safe on a live database: one new, empty table with its indexes and foreign keys; no existing table, column or row is
 * changed, and nothing is backfilled. Every statement is guarded (`IF NOT EXISTS`, or a check of the catalogue for the
 * foreign keys), so running `up` twice is harmless; an advisory lock (a named lock on MySQL) makes two API processes
 * that boot together run it one after the other.
 *
 * `down` drops the table (its indexes and foreign keys go with it).
 */
export class CreateEmployeeAppointmentReminderTable1791000018640 implements MigrationInterface {
	name = 'CreateEmployeeAppointmentReminderTable1791000018640';

	/** Advisory lock key that serialises concurrent runs of this migration on Postgres. */
	private readonly advisoryLockKey = 1791000018640;

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
			`CREATE TABLE IF NOT EXISTS "${TABLE}" (${COLUMNS.postgres}, CONSTRAINT "PK_8ab0051edd4b6cf7ce3af1a2f57" PRIMARY KEY ("id"))`
		);
		for (const index of REMINDER_INDEXES) {
			await queryRunner.query(
				`CREATE INDEX IF NOT EXISTS "${index.name}" ON "${TABLE}" (${columnList('postgres', index.columns)})`
			);
		}
		await queryRunner.query(
			`CREATE UNIQUE INDEX IF NOT EXISTS "${REMINDER_UNIQUE_INDEX.name}" ON "${TABLE}" (${columnList('postgres', REMINDER_UNIQUE_INDEX.columns)})`
		);
		for (const fk of REMINDER_FOREIGN_KEYS) {
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
			...REMINDER_INDEXES.map(
				(index) => `INDEX \`${index.name}\` (${columnList('mysql', index.columns)})`
			),
			`UNIQUE INDEX \`${REMINDER_UNIQUE_INDEX.name}\` (${columnList('mysql', REMINDER_UNIQUE_INDEX.columns)})`
		];
		await queryRunner.query(
			`CREATE TABLE IF NOT EXISTS \`${TABLE}\` (${COLUMNS.mysql}, ${indexes.join(', ')}, PRIMARY KEY (\`id\`)) ENGINE=InnoDB`
		);
		const table = await queryRunner.getTable(TABLE);
		for (const fk of REMINDER_FOREIGN_KEYS) {
			if (table?.foreignKeys.some((existing) => existing.name === fk.name)) continue;
			await queryRunner.query(
				`ALTER TABLE \`${TABLE}\` ADD CONSTRAINT \`${fk.name}\` FOREIGN KEY (\`${fk.column}\`) REFERENCES \`${fk.references}\`(\`id\`) ON DELETE ${fk.onDelete} ON UPDATE ${fk.onUpdate}`
			);
		}
	}

	/** SQLite declares the foreign keys with the table: it cannot add one to an existing table. */
	private async sqliteUp(queryRunner: QueryRunner): Promise<void> {
		const foreignKeys = REMINDER_FOREIGN_KEYS.map(
			(fk) =>
				`CONSTRAINT "${fk.name}" FOREIGN KEY ("${fk.column}") REFERENCES "${fk.references}" ("id") ON DELETE ${fk.onDelete} ON UPDATE ${fk.onUpdate}`
		);
		await queryRunner.query(`CREATE TABLE IF NOT EXISTS "${TABLE}" (${COLUMNS.sqlite}, ${foreignKeys.join(', ')})`);
		for (const index of REMINDER_INDEXES) {
			await queryRunner.query(
				`CREATE INDEX IF NOT EXISTS "${index.name}" ON "${TABLE}" (${columnList('sqlite', index.columns)})`
			);
		}
		await queryRunner.query(
			`CREATE UNIQUE INDEX IF NOT EXISTS "${REMINDER_UNIQUE_INDEX.name}" ON "${TABLE}" (${columnList('sqlite', REMINDER_UNIQUE_INDEX.columns)})`
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
