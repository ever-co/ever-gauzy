import { MigrationInterface, QueryRunner } from 'typeorm';
import * as chalk from 'chalk';
import { DatabaseTypeEnum } from '@gauzy/config';

/** The databases this migration runs on. Both SQLite drivers share one entry. */
type Dialect = 'postgres' | 'sqlite' | 'mysql';

const TABLE = 'task_former_reference';

/**
 * The indexes the entity declares, under the names TypeORM gives them (`migration:generate` then sees nothing to add):
 * the base entity's columns, the task and the project, and the lookup `resolveReferences` and the task numbering make
 * (a project's former numbers).
 */
export const TASK_FORMER_REFERENCE_INDEXES: ReadonlyArray<{ name: string; columns: string[] }> = [
	{ name: 'IDX_0421bbbd225e45e70264f5c387', columns: ['createdByUserId'] },
	{ name: 'IDX_ff58157aa3265412ddce3d1bda', columns: ['updatedByUserId'] },
	{ name: 'IDX_05ef39f01b2dd070ec2672c7c0', columns: ['deletedByUserId'] },
	{ name: 'IDX_3572a40f685726bf1d093eef77', columns: ['isActive'] },
	{ name: 'IDX_57dedce04e31c16224d478fa04', columns: ['isArchived'] },
	{ name: 'IDX_924ef9f3f74b07e3e5d0de866e', columns: ['tenantId'] },
	{ name: 'IDX_62656df49c6d9cb900c489ada2', columns: ['organizationId'] },
	{ name: 'IDX_e0cf2bf404ccab8a8e60c84aac', columns: ['taskId'] },
	{ name: 'IDX_ac858d803cd971cf8e0e1b5556', columns: ['projectId'] },
	{ name: 'IDX_task_former_reference_project_number', columns: ['tenantId', 'organizationId', 'projectId', 'number'] }
];

/** The foreign keys, under the names TypeORM gives them. A reference goes with its task and with the project it names. */
export const TASK_FORMER_REFERENCE_FOREIGN_KEYS: ReadonlyArray<{
	name: string;
	column: string;
	references: string;
	onDelete: 'CASCADE';
	onUpdate: 'NO ACTION' | 'CASCADE';
}> = [
	{ name: 'FK_0421bbbd225e45e70264f5c3874', column: 'createdByUserId', references: 'user', onDelete: 'CASCADE', onUpdate: 'NO ACTION' },
	{ name: 'FK_ff58157aa3265412ddce3d1bdaf', column: 'updatedByUserId', references: 'user', onDelete: 'CASCADE', onUpdate: 'NO ACTION' },
	{ name: 'FK_05ef39f01b2dd070ec2672c7c0f', column: 'deletedByUserId', references: 'user', onDelete: 'CASCADE', onUpdate: 'NO ACTION' },
	{ name: 'FK_924ef9f3f74b07e3e5d0de866ef', column: 'tenantId', references: 'tenant', onDelete: 'CASCADE', onUpdate: 'NO ACTION' },
	{ name: 'FK_62656df49c6d9cb900c489ada23', column: 'organizationId', references: 'organization', onDelete: 'CASCADE', onUpdate: 'CASCADE' },
	{ name: 'FK_e0cf2bf404ccab8a8e60c84aac4', column: 'taskId', references: 'task', onDelete: 'CASCADE', onUpdate: 'NO ACTION' },
	{ name: 'FK_ac858d803cd971cf8e0e1b55566', column: 'projectId', references: 'organization_project', onDelete: 'CASCADE', onUpdate: 'NO ACTION' }
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
		`"number" integer NOT NULL`,
		`"prefix" character varying`,
		`"taskId" uuid NOT NULL`,
		`"projectId" uuid NOT NULL`
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
		`"number" integer NOT NULL`,
		`"prefix" varchar`,
		`"taskId" varchar NOT NULL`,
		`"projectId" varchar NOT NULL`
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
		// The entity maps a task number to bigint on MySQL, as `task.number` is.
		'`number` bigint NOT NULL',
		'`prefix` varchar(255) NULL',
		'`taskId` varchar(255) NOT NULL',
		'`projectId` varchar(255) NOT NULL'
	].join(', ')
};

/**
 * Creates `task_former_reference`: the references tasks held before they moved to another project (`API-42` after
 * the task became `SYS-7`). `TaskService.update` writes one row in the transaction that moves a task, the resolver
 * falls back to them when no live task of the project holds the number, and the task numbering skips them, so a
 * former number is never handed to another task of that project.
 *
 * Safe on a live database: one new, empty table with its indexes and foreign keys; no existing table, column or row
 * is changed, and nothing is backfilled (tasks moved before this migration keep no former reference). Every statement
 * is guarded (`IF NOT EXISTS`, or a check of the catalogue for the foreign keys), so running `up` twice is harmless;
 * an advisory lock (a named lock on MySQL) makes two API processes that boot together run it one after the other.
 *
 * `down` drops the table (its indexes and foreign keys go with it).
 */
export class CreateTaskFormerReferenceTable1791000006750 implements MigrationInterface {
	name = 'CreateTaskFormerReferenceTable1791000006750';

	/** Advisory lock key that serialises concurrent runs of this migration on Postgres. */
	private readonly advisoryLockKey = 1791000006750;

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
			`CREATE TABLE IF NOT EXISTS "${TABLE}" (${COLUMNS.postgres}, CONSTRAINT "PK_134c70134620dab4ff0f59dd105" PRIMARY KEY ("id"))`
		);
		for (const index of TASK_FORMER_REFERENCE_INDEXES) {
			await queryRunner.query(`CREATE INDEX IF NOT EXISTS "${index.name}" ON "${TABLE}" (${columnList('postgres', index.columns)})`);
		}
		for (const fk of TASK_FORMER_REFERENCE_FOREIGN_KEYS) {
			const existing = await queryRunner.query(`SELECT 1 FROM pg_constraint WHERE conname = $1 AND conrelid = to_regclass($2)`, [
				fk.name,
				TABLE
			]);
			if (existing.length > 0) continue;
			await queryRunner.query(
				`ALTER TABLE "${TABLE}" ADD CONSTRAINT "${fk.name}" FOREIGN KEY ("${fk.column}") REFERENCES "${fk.references}"("id") ON DELETE ${fk.onDelete} ON UPDATE ${fk.onUpdate}`
			);
		}
	}

	private async mysqlUp(queryRunner: QueryRunner): Promise<void> {
		const indexes = TASK_FORMER_REFERENCE_INDEXES.map((index) => `INDEX \`${index.name}\` (${columnList('mysql', index.columns)})`);
		await queryRunner.query(
			`CREATE TABLE IF NOT EXISTS \`${TABLE}\` (${COLUMNS.mysql}, ${indexes.join(', ')}, PRIMARY KEY (\`id\`)) ENGINE=InnoDB`
		);
		const table = await queryRunner.getTable(TABLE);
		for (const fk of TASK_FORMER_REFERENCE_FOREIGN_KEYS) {
			if (table?.foreignKeys.some((existing) => existing.name === fk.name)) continue;
			await queryRunner.query(
				`ALTER TABLE \`${TABLE}\` ADD CONSTRAINT \`${fk.name}\` FOREIGN KEY (\`${fk.column}\`) REFERENCES \`${fk.references}\`(\`id\`) ON DELETE ${fk.onDelete} ON UPDATE ${fk.onUpdate}`
			);
		}
	}

	/** SQLite declares the foreign keys with the table: it cannot add one to an existing table. */
	private async sqliteUp(queryRunner: QueryRunner): Promise<void> {
		const foreignKeys = TASK_FORMER_REFERENCE_FOREIGN_KEYS.map(
			(fk) =>
				`CONSTRAINT "${fk.name}" FOREIGN KEY ("${fk.column}") REFERENCES "${fk.references}" ("id") ON DELETE ${fk.onDelete} ON UPDATE ${fk.onUpdate}`
		);
		await queryRunner.query(`CREATE TABLE IF NOT EXISTS "${TABLE}" (${COLUMNS.sqlite}, ${foreignKeys.join(', ')})`);
		for (const index of TASK_FORMER_REFERENCE_INDEXES) {
			await queryRunner.query(`CREATE INDEX IF NOT EXISTS "${index.name}" ON "${TABLE}" (${columnList('sqlite', index.columns)})`);
		}
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
async function withMysqlNamedLock(queryRunner: QueryRunner, lockName: string, work: () => Promise<void>): Promise<void> {
	const [row] = (await queryRunner.query(`SELECT GET_LOCK(?, 30) AS acquired`, [lockName])) as Array<{ acquired: number | string | null }>;
	if (Number(row?.acquired) !== 1) {
		throw new Error(`Could not acquire the MySQL lock ${lockName} for the migration.`);
	}
	try {
		await work();
	} finally {
		await queryRunner.query(`SELECT RELEASE_LOCK(?)`, [lockName]);
	}
}
