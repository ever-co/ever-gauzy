import { MigrationInterface, QueryRunner } from 'typeorm';
import * as chalk from 'chalk';
import { DatabaseTypeEnum } from '@gauzy/config';

/** The databases this migration runs on. Both SQLite drivers share one entry. */
type Dialect = 'postgres' | 'sqlite' | 'mysql';

const TABLE = 'document_comment_anchor';

/**
 * The indexes the entity declares, under the names TypeORM gives them (`migration:generate` then sees nothing to add):
 * the base entity's columns, one anchor per comment, and the page's anchors (`GET /documents/:id/comment-anchors`).
 */
export const DOCUMENT_COMMENT_ANCHOR_INDEXES: ReadonlyArray<{ name: string; columns: string[]; unique?: boolean }> = [
	{ name: 'IDX_a1a92699edad714ce359839511', columns: ['createdByUserId'] },
	{ name: 'IDX_fe3e5a0a41590ca6fbc6b78b99', columns: ['updatedByUserId'] },
	{ name: 'IDX_18766d733bc144d9c8fcdcf209', columns: ['deletedByUserId'] },
	{ name: 'IDX_949fffe0263941161654e8ea85', columns: ['isActive'] },
	{ name: 'IDX_0d5f4e6d85833f63f6abc7c1cc', columns: ['isArchived'] },
	{ name: 'IDX_8634cdaaa986ae3962d87663e9', columns: ['tenantId'] },
	{ name: 'IDX_9b5badf9207589bda643dfb86b', columns: ['organizationId'] },
	{ name: 'IDX_document_comment_anchor_comment', columns: ['commentId'], unique: true },
	{ name: 'IDX_document_comment_anchor_tenant_doc', columns: ['tenantId', 'documentId'] }
];

/** The foreign keys, under the names TypeORM gives them. An anchor goes with its comment and with its page. */
export const DOCUMENT_COMMENT_ANCHOR_FOREIGN_KEYS: ReadonlyArray<{
	name: string;
	column: string;
	references: string;
	onDelete: 'CASCADE';
	onUpdate: 'NO ACTION' | 'CASCADE';
}> = [
	{ name: 'FK_a1a92699edad714ce3598395112', column: 'createdByUserId', references: 'user', onDelete: 'CASCADE', onUpdate: 'NO ACTION' },
	{ name: 'FK_fe3e5a0a41590ca6fbc6b78b99a', column: 'updatedByUserId', references: 'user', onDelete: 'CASCADE', onUpdate: 'NO ACTION' },
	{ name: 'FK_18766d733bc144d9c8fcdcf2092', column: 'deletedByUserId', references: 'user', onDelete: 'CASCADE', onUpdate: 'NO ACTION' },
	{ name: 'FK_8634cdaaa986ae3962d87663e91', column: 'tenantId', references: 'tenant', onDelete: 'CASCADE', onUpdate: 'NO ACTION' },
	{ name: 'FK_9b5badf9207589bda643dfb86bc', column: 'organizationId', references: 'organization', onDelete: 'CASCADE', onUpdate: 'CASCADE' },
	{ name: 'FK_91b09afbce6009dd9033bab20ca', column: 'commentId', references: 'comment', onDelete: 'CASCADE', onUpdate: 'NO ACTION' },
	{ name: 'FK_6b228b48aaec32c932290ba2978', column: 'documentId', references: 'document', onDelete: 'CASCADE', onUpdate: 'NO ACTION' }
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
		`"blockId" character varying(128) NOT NULL`,
		`"startOffset" integer NOT NULL`,
		`"endOffset" integer NOT NULL`,
		`"quote" text NOT NULL`,
		`"prefix" character varying(64)`,
		`"suffix" character varying(64)`,
		`"relativeStart" character varying(512)`,
		`"relativeEnd" character varying(512)`,
		`"commentId" uuid NOT NULL`,
		`"documentId" uuid NOT NULL`
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
		`"blockId" varchar(128) NOT NULL`,
		`"startOffset" integer NOT NULL`,
		`"endOffset" integer NOT NULL`,
		`"quote" text NOT NULL`,
		`"prefix" varchar(64)`,
		`"suffix" varchar(64)`,
		`"relativeStart" varchar(512)`,
		`"relativeEnd" varchar(512)`,
		`"commentId" varchar NOT NULL`,
		`"documentId" varchar NOT NULL`
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
		'`blockId` varchar(128) NOT NULL',
		'`startOffset` int NOT NULL',
		'`endOffset` int NOT NULL',
		'`quote` text NOT NULL',
		'`prefix` varchar(64) NULL',
		'`suffix` varchar(64) NULL',
		'`relativeStart` varchar(512) NULL',
		'`relativeEnd` varchar(512) NULL',
		'`commentId` varchar(255) NOT NULL',
		'`documentId` varchar(255) NOT NULL'
	].join(', ')
};

/**
 * Creates `document_comment_anchor`: where a comment of a Docs page was made, a range of one block's text (block id,
 * offsets, the quote and its context, and in a live session the range's relative positions in the shared document).
 * The platform's comment has no field for it, so the Docs plugin keeps it beside the comment, one row per comment.
 *
 * Safe on a live database: one new, empty table with its indexes and foreign keys; no existing table, column or row
 * is changed, and nothing is backfilled (a comment made before keeps its block anchor, the `[[block:…]]` first line).
 * Every statement is guarded (`IF NOT EXISTS`, or a check of the catalogue for the foreign keys), so running `up`
 * twice is harmless; an advisory lock (a named lock on MySQL) makes two API processes that boot together run it one
 * after the other. Without the `document` or the `comment` table it does nothing.
 *
 * `down` drops the table (its indexes and foreign keys go with it).
 */
export class CreateDocumentCommentAnchorTable1791000007530 implements MigrationInterface {
	name = 'CreateDocumentCommentAnchorTable1791000007530';

	/** Advisory lock key that serialises concurrent runs of this migration on Postgres. */
	private readonly advisoryLockKey = 1791000007530;

	/** The MySQL named lock of this migration. MySQL refuses lock names over 64 characters. */
	readonly mysqlLockName = `gauzy:migration:${this.advisoryLockKey}`;

	public async up(queryRunner: QueryRunner): Promise<void> {
		console.log(chalk.yellow(this.name + ' start running!'));

		const dialect = dialectOf(queryRunner);
		if (!(await queryRunner.hasTable('document')) || !(await queryRunner.hasTable('comment'))) {
			console.log(chalk.gray(`${this.name}: no document or comment table, nothing to do.`));
			return;
		}
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
			`CREATE TABLE IF NOT EXISTS "${TABLE}" (${COLUMNS.postgres}, CONSTRAINT "PK_b5c5cab02054dbd9a69f91a5fbf" PRIMARY KEY ("id"))`
		);
		for (const index of DOCUMENT_COMMENT_ANCHOR_INDEXES) {
			await queryRunner.query(
				`CREATE ${index.unique ? 'UNIQUE ' : ''}INDEX IF NOT EXISTS "${index.name}" ON "${TABLE}" (${columnList('postgres', index.columns)})`
			);
		}
		for (const fk of DOCUMENT_COMMENT_ANCHOR_FOREIGN_KEYS) {
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
		const indexes = DOCUMENT_COMMENT_ANCHOR_INDEXES.map(
			(index) => `${index.unique ? 'UNIQUE ' : ''}INDEX \`${index.name}\` (${columnList('mysql', index.columns)})`
		);
		await queryRunner.query(
			`CREATE TABLE IF NOT EXISTS \`${TABLE}\` (${COLUMNS.mysql}, ${indexes.join(', ')}, PRIMARY KEY (\`id\`)) ENGINE=InnoDB`
		);
		const table = await queryRunner.getTable(TABLE);
		for (const fk of DOCUMENT_COMMENT_ANCHOR_FOREIGN_KEYS) {
			if (table?.foreignKeys.some((existing) => existing.name === fk.name)) continue;
			await queryRunner.query(
				`ALTER TABLE \`${TABLE}\` ADD CONSTRAINT \`${fk.name}\` FOREIGN KEY (\`${fk.column}\`) REFERENCES \`${fk.references}\`(\`id\`) ON DELETE ${fk.onDelete} ON UPDATE ${fk.onUpdate}`
			);
		}
	}

	/** SQLite declares the foreign keys with the table: it cannot add one to an existing table. */
	private async sqliteUp(queryRunner: QueryRunner): Promise<void> {
		const foreignKeys = DOCUMENT_COMMENT_ANCHOR_FOREIGN_KEYS.map(
			(fk) =>
				`CONSTRAINT "${fk.name}" FOREIGN KEY ("${fk.column}") REFERENCES "${fk.references}" ("id") ON DELETE ${fk.onDelete} ON UPDATE ${fk.onUpdate}`
		);
		await queryRunner.query(`CREATE TABLE IF NOT EXISTS "${TABLE}" (${COLUMNS.sqlite}, ${foreignKeys.join(', ')})`);
		for (const index of DOCUMENT_COMMENT_ANCHOR_INDEXES) {
			await queryRunner.query(
				`CREATE ${index.unique ? 'UNIQUE ' : ''}INDEX IF NOT EXISTS "${index.name}" ON "${TABLE}" (${columnList('sqlite', index.columns)})`
			);
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
