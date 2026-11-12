import { MigrationInterface, QueryRunner } from 'typeorm';
import * as chalk from 'chalk';
import { DatabaseTypeEnum } from '@gauzy/config';

/** The databases this migration runs on. Both SQLite drivers share one entry. */
type Dialect = 'postgres' | 'sqlite' | 'mysql';

const TABLE = 'document_import';

/**
 * The indexes the entity declares, under the names TypeORM gives them (`migration:generate` then sees nothing to add):
 * the base entity's columns, the parent, the status (the stale-import sweep) and the caller's own imports
 * (`GET /plugins/docs/imports`).
 */
export const DOCUMENT_IMPORT_INDEXES: ReadonlyArray<{ name: string; columns: string[] }> = [
	{ name: 'IDX_9f566b9aafd2afd4f408199309', columns: ['createdByUserId'] },
	{ name: 'IDX_add0b6d02a43e01e8288c380d0', columns: ['updatedByUserId'] },
	{ name: 'IDX_33f8799e931298dd26ae941f2b', columns: ['deletedByUserId'] },
	{ name: 'IDX_d33a05211b52e00446caf0ffac', columns: ['isActive'] },
	{ name: 'IDX_fc031ba204d0a2718872fbfc36', columns: ['isArchived'] },
	{ name: 'IDX_361ddab6b7034612063bb3dc8e', columns: ['tenantId'] },
	{ name: 'IDX_e986e1f2b905aed782bb955da5', columns: ['organizationId'] },
	{ name: 'IDX_document_import_status', columns: ['status'] },
	{ name: 'IDX_document_import_parentId', columns: ['parentId'] },
	{ name: 'IDX_document_import_tenant_org_creator', columns: ['tenantId', 'organizationId', 'createdByUserId'] }
];

/**
 * The foreign keys, under the names TypeORM gives them. An import goes with its tenant and organization; a deleted
 * parent page or team leaves the row (its report keeps the history) without one.
 */
export const DOCUMENT_IMPORT_FOREIGN_KEYS: ReadonlyArray<{
	name: string;
	column: string;
	references: string;
	onDelete: 'CASCADE' | 'SET NULL';
	onUpdate: 'NO ACTION' | 'CASCADE';
}> = [
	{ name: 'FK_9f566b9aafd2afd4f4081993098', column: 'createdByUserId', references: 'user', onDelete: 'CASCADE', onUpdate: 'NO ACTION' },
	{ name: 'FK_add0b6d02a43e01e8288c380d04', column: 'updatedByUserId', references: 'user', onDelete: 'CASCADE', onUpdate: 'NO ACTION' },
	{ name: 'FK_33f8799e931298dd26ae941f2b4', column: 'deletedByUserId', references: 'user', onDelete: 'CASCADE', onUpdate: 'NO ACTION' },
	{ name: 'FK_361ddab6b7034612063bb3dc8e9', column: 'tenantId', references: 'tenant', onDelete: 'CASCADE', onUpdate: 'NO ACTION' },
	{ name: 'FK_e986e1f2b905aed782bb955da5b', column: 'organizationId', references: 'organization', onDelete: 'CASCADE', onUpdate: 'CASCADE' },
	{ name: 'FK_b2f58502ff43bfff5fb3d9519ca', column: 'parentId', references: 'document', onDelete: 'SET NULL', onUpdate: 'NO ACTION' },
	{ name: 'FK_63cad0282581d62f0826bdaa0b9', column: 'organizationTeamId', references: 'organization_team', onDelete: 'SET NULL', onUpdate: 'NO ACTION' }
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
		`"id" uuid NOT NULL DEFAULT gen_random_uuid()`,
		`"isActive" boolean DEFAULT true`,
		`"isArchived" boolean DEFAULT false`,
		`"archivedAt" TIMESTAMP`,
		`"tenantId" uuid`,
		`"organizationId" uuid`,
		`"status" character varying(16) NOT NULL DEFAULT 'QUEUED'`,
		`"phase" character varying(16)`,
		`"layout" character varying(16)`,
		`"fileName" character varying(255) NOT NULL`,
		`"fileSize" integer`,
		`"storageProvider" character varying(20)`,
		`"storageKey" character varying(1024)`,
		`"parentId" uuid`,
		`"visibility" character varying(16)`,
		`"organizationTeamId" uuid`,
		`"totalItems" integer NOT NULL DEFAULT 0`,
		`"processedItems" integer NOT NULL DEFAULT 0`,
		`"importedCount" integer NOT NULL DEFAULT 0`,
		`"skippedCount" integer NOT NULL DEFAULT 0`,
		`"failedCount" integer NOT NULL DEFAULT 0`,
		`"attempts" integer NOT NULL DEFAULT 0`,
		`"errorCode" character varying(64)`,
		`"errorMessage" character varying(500)`,
		`"optionsJson" text`,
		`"reportJson" text`,
		`"startedAt" TIMESTAMP`,
		`"finishedAt" TIMESTAMP`,
		`"lastProgressAt" TIMESTAMP`
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
		`"status" varchar(16) NOT NULL DEFAULT ('QUEUED')`,
		`"phase" varchar(16)`,
		`"layout" varchar(16)`,
		`"fileName" varchar(255) NOT NULL`,
		`"fileSize" integer`,
		`"storageProvider" varchar(20)`,
		`"storageKey" varchar(1024)`,
		`"parentId" varchar`,
		`"visibility" varchar(16)`,
		`"organizationTeamId" varchar`,
		`"totalItems" integer NOT NULL DEFAULT (0)`,
		`"processedItems" integer NOT NULL DEFAULT (0)`,
		`"importedCount" integer NOT NULL DEFAULT (0)`,
		`"skippedCount" integer NOT NULL DEFAULT (0)`,
		`"failedCount" integer NOT NULL DEFAULT (0)`,
		`"attempts" integer NOT NULL DEFAULT (0)`,
		`"errorCode" varchar(64)`,
		`"errorMessage" varchar(500)`,
		`"optionsJson" text`,
		`"reportJson" text`,
		`"startedAt" datetime`,
		`"finishedAt" datetime`,
		`"lastProgressAt" datetime`
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
		"`status` varchar(16) NOT NULL DEFAULT 'QUEUED'",
		'`phase` varchar(16) NULL',
		'`layout` varchar(16) NULL',
		'`fileName` varchar(255) NOT NULL',
		'`fileSize` int NULL',
		'`storageProvider` varchar(20) NULL',
		'`storageKey` varchar(1024) NULL',
		'`parentId` varchar(255) NULL',
		'`visibility` varchar(16) NULL',
		'`organizationTeamId` varchar(255) NULL',
		'`totalItems` int NOT NULL DEFAULT 0',
		'`processedItems` int NOT NULL DEFAULT 0',
		'`importedCount` int NOT NULL DEFAULT 0',
		'`skippedCount` int NOT NULL DEFAULT 0',
		'`failedCount` int NOT NULL DEFAULT 0',
		'`attempts` int NOT NULL DEFAULT 0',
		'`errorCode` varchar(64) NULL',
		'`errorMessage` varchar(500) NULL',
		'`optionsJson` text NULL',
		// `text` stops at 64 KiB on MySQL; a report of a thousand pages is past that.
		'`reportJson` longtext NULL',
		'`startedAt` datetime NULL',
		'`finishedAt` datetime NULL',
		'`lastProgressAt` datetime NULL'
	].join(', ')
};

/**
 * Creates `document_import`: one row per import of an exported workspace into Docs (a Markdown vault or an HTML
 * export zip, `docs-import-export` plan §3) — the uploaded zip's storage key, the target, the detected layout, the
 * state and progress the clients poll, and the report.
 *
 * Safe on a live database: one new, empty table with its indexes and foreign keys; no existing table, column or row
 * is changed. Every statement is guarded (`IF NOT EXISTS`, or a check of the catalogue for the foreign keys), so
 * running `up` twice is harmless; an advisory lock (a named lock on MySQL) makes two API processes that boot together
 * run it one after the other.
 *
 * `down` drops the table (its indexes and foreign keys go with it). The documents an import created stay.
 */
export class CreateDocumentImportTable1791000007420 implements MigrationInterface {
	name = 'CreateDocumentImportTable1791000007420';

	/** Advisory lock key that serialises concurrent runs of this migration on Postgres. */
	private readonly advisoryLockKey = 1791000007420;

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
			`CREATE TABLE IF NOT EXISTS "${TABLE}" (${COLUMNS.postgres}, CONSTRAINT "PK_09b29468e0f7b3ee0125466ed0e" PRIMARY KEY ("id"))`
		);
		for (const index of DOCUMENT_IMPORT_INDEXES) {
			await queryRunner.query(`CREATE INDEX IF NOT EXISTS "${index.name}" ON "${TABLE}" (${columnList('postgres', index.columns)})`);
		}
		for (const fk of DOCUMENT_IMPORT_FOREIGN_KEYS) {
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
		const indexes = DOCUMENT_IMPORT_INDEXES.map((index) => `INDEX \`${index.name}\` (${columnList('mysql', index.columns)})`);
		await queryRunner.query(
			`CREATE TABLE IF NOT EXISTS \`${TABLE}\` (${COLUMNS.mysql}, ${indexes.join(', ')}, PRIMARY KEY (\`id\`)) ENGINE=InnoDB`
		);
		const table = await queryRunner.getTable(TABLE);
		for (const fk of DOCUMENT_IMPORT_FOREIGN_KEYS) {
			if (table?.foreignKeys.some((existing) => existing.name === fk.name)) continue;
			await queryRunner.query(
				`ALTER TABLE \`${TABLE}\` ADD CONSTRAINT \`${fk.name}\` FOREIGN KEY (\`${fk.column}\`) REFERENCES \`${fk.references}\`(\`id\`) ON DELETE ${fk.onDelete} ON UPDATE ${fk.onUpdate}`
			);
		}
	}

	/** SQLite declares the foreign keys with the table: it cannot add one to an existing table. */
	private async sqliteUp(queryRunner: QueryRunner): Promise<void> {
		const foreignKeys = DOCUMENT_IMPORT_FOREIGN_KEYS.map(
			(fk) =>
				`CONSTRAINT "${fk.name}" FOREIGN KEY ("${fk.column}") REFERENCES "${fk.references}" ("id") ON DELETE ${fk.onDelete} ON UPDATE ${fk.onUpdate}`
		);
		await queryRunner.query(`CREATE TABLE IF NOT EXISTS "${TABLE}" (${COLUMNS.sqlite}, ${foreignKeys.join(', ')})`);
		for (const index of DOCUMENT_IMPORT_INDEXES) {
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
