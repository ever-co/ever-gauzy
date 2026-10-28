import { MigrationInterface, QueryRunner } from 'typeorm';
import * as chalk from 'chalk';
import { DatabaseTypeEnum } from '@gauzy/config';
import { EmailTemplateEnum } from '@gauzy/contracts';
import { EmailTemplateUtils } from '../../email-template/utils';

/** The table this migration creates. */
const TABLE = 'account_deletion_request';

/**
 * TypeORM's own names for the keys and indexes the `AccountDeletionRequest` entity declares (its default
 * naming strategy: a hash of the table and column names), so a generated migration sees no drift.
 */
const NAMES = {
	primaryKey: 'PK_dd55b283ce224f1203ee1584e4c',
	foreignKeys: {
		createdByUserId: 'FK_73057a815c82445de9328fe9749',
		updatedByUserId: 'FK_04f5453cf6b3d314a1434bd2bcf',
		deletedByUserId: 'FK_96578587cb168e414f820bc4d12'
	},
	indexes: {
		createdByUserId: 'IDX_73057a815c82445de9328fe974',
		updatedByUserId: 'IDX_04f5453cf6b3d314a1434bd2bc',
		deletedByUserId: 'IDX_96578587cb168e414f820bc4d1',
		isActive: 'IDX_0ec9233887014e247f0921ea49',
		isArchived: 'IDX_07881f19f03624cad28f97f30e',
		emailHash: 'IDX_d13e7d141283143d0aad905f34'
	},
	/** Unique: one row per token. */
	tokenHashUnique: 'IDX_04bebe8b6cd99ca5ea6286a33a'
} as const;

/** The audit columns reference `user` like every `BaseEntity` table's. */
const FOREIGN_KEYS: ReadonlyArray<keyof typeof NAMES.foreignKeys> = ['createdByUserId', 'updatedByUserId', 'deletedByUserId'];

/**
 * Creates `account_deletion_request` (self-service account deletion by emailed link) and adds the two
 * emails of that flow (`account-deletion-request`, `account-deletion-completed`) to `email_template`.
 *
 * Pure additive: one new table with its keys and indexes, plus new template rows. No existing table, column
 * or row is touched, so it is safe on a populated database. Every statement is guarded by `hasTable`, the
 * templates are upserted, so a re-run adds nothing; `down` drops the table (the template rows stay, like
 * every other template migration's).
 *
 * The table holds no clear token (only its SHA-256) and, once a deletion ran, no clear address either.
 */
export class CreateAccountDeletionRequestTable1791000003450 implements MigrationInterface {
	name = 'CreateAccountDeletionRequestTable1791000003450';

	/** Advisory lock key that serialises concurrent runs of this migration on Postgres. */
	private readonly advisoryLockKey = 1791000003450;

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
				throw Error(`Unsupported database: ${queryRunner.connection.options.type}`);
		}

		for (const template of [EmailTemplateEnum.ACCOUNT_DELETION_REQUEST, EmailTemplateEnum.ACCOUNT_DELETION_COMPLETED]) {
			try {
				await EmailTemplateUtils.migrateEmailTemplates(queryRunner, template);
			} catch (error) {
				console.error(`Error while migrating email templates for ${template}:`, error);
			}
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
				await queryRunner.query(`DROP TABLE IF EXISTS "${TABLE}"`);
				break;
			case DatabaseTypeEnum.mysql:
				await queryRunner.query(`DROP TABLE IF EXISTS \`${TABLE}\``);
				break;
			default:
				throw Error(`Unsupported database: ${queryRunner.connection.options.type}`);
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
		if (await queryRunner.hasTable(TABLE)) return;

		await queryRunner.query(
			`CREATE TABLE "${TABLE}" ("deletedAt" TIMESTAMP, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "createdByUserId" uuid, "updatedByUserId" uuid, "deletedByUserId" uuid, "id" uuid NOT NULL DEFAULT gen_random_uuid(), "isActive" boolean DEFAULT true, "isArchived" boolean DEFAULT false, "archivedAt" TIMESTAMP, "email" character varying, "emailHash" character varying(64) NOT NULL, "tokenHash" character varying(64) NOT NULL, "expiresAt" TIMESTAMP NOT NULL, "usedAt" TIMESTAMP, "claimId" character varying(36), "completedAt" TIMESTAMP, "revokedAt" TIMESTAMP, "requestIpHash" character varying(64), "userAgent" character varying, "locale" character varying(20), "branding" text, "result" text, CONSTRAINT "${NAMES.primaryKey}" PRIMARY KEY ("id"))`
		);
		for (const [column, index] of Object.entries(NAMES.indexes)) {
			await queryRunner.query(`CREATE INDEX "${index}" ON "${TABLE}" ("${column}") `);
		}
		await queryRunner.query(`CREATE UNIQUE INDEX "${NAMES.tokenHashUnique}" ON "${TABLE}" ("tokenHash") `);
		for (const column of FOREIGN_KEYS) {
			await queryRunner.query(
				`ALTER TABLE "${TABLE}" ADD CONSTRAINT "${NAMES.foreignKeys[column]}" FOREIGN KEY ("${column}") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
			);
		}
	}

	/**
	 * SqliteDB and BetterSQlite3DB Up Migration
	 *
	 * SQLite declares the foreign keys inside the table definition.
	 *
	 * @param queryRunner
	 */
	public async sqliteUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		if (await queryRunner.hasTable(TABLE)) return;

		const foreignKeys = FOREIGN_KEYS.map(
			(column) =>
				`CONSTRAINT "${NAMES.foreignKeys[column]}" FOREIGN KEY ("${column}") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		).join(', ');

		await queryRunner.query(
			`CREATE TABLE "${TABLE}" ("deletedAt" datetime, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "createdByUserId" varchar, "updatedByUserId" varchar, "deletedByUserId" varchar, "id" varchar PRIMARY KEY NOT NULL, "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "email" varchar, "emailHash" varchar(64) NOT NULL, "tokenHash" varchar(64) NOT NULL, "expiresAt" datetime NOT NULL, "usedAt" datetime, "claimId" varchar(36), "completedAt" datetime, "revokedAt" datetime, "requestIpHash" varchar(64), "userAgent" varchar, "locale" varchar(20), "branding" text, "result" text, ${foreignKeys})`
		);
		for (const [column, index] of Object.entries(NAMES.indexes)) {
			await queryRunner.query(`CREATE INDEX "${index}" ON "${TABLE}" ("${column}") `);
		}
		await queryRunner.query(`CREATE UNIQUE INDEX "${NAMES.tokenHashUnique}" ON "${TABLE}" ("tokenHash") `);
	}

	/**
	 * MySQL Up Migration
	 *
	 * @param queryRunner
	 */
	public async mysqlUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		// MySQL has no transactional DDL and no migration-run lock: two processes booting together would both see
		// the table missing. A named lock makes the check and the DDL one critical section.
		const lockName = `gauzy:migration:${this.name}`;
		const [row] = await queryRunner.query(`SELECT GET_LOCK(?, 120) AS \`acquired\``, [lockName]);
		if (Number(row?.acquired) !== 1) {
			throw new Error(`${this.name}: could not acquire the MySQL migration lock ${lockName}.`);
		}
		try {
			await this.mysqlCreateTable(queryRunner);
		} finally {
			await queryRunner.query(`SELECT RELEASE_LOCK(?)`, [lockName]);
		}
	}

	/**
	 * Creates the table, its indexes and foreign keys on MySQL, when the table is not there yet — in ONE
	 * statement: MySQL commits each DDL statement on its own, so keys added by later statements could be missing
	 * after a failure in between, and a re-run (finding the table) would never add them.
	 */
	private async mysqlCreateTable(queryRunner: QueryRunner): Promise<void> {
		if (await queryRunner.hasTable(TABLE)) return;

		const indexes = Object.entries(NAMES.indexes)
			.map(([column, index]) => `INDEX \`${index}\` (\`${column}\`)`)
			.join(', ');
		const foreignKeys = FOREIGN_KEYS.map(
			(column) =>
				`CONSTRAINT \`${NAMES.foreignKeys[column]}\` FOREIGN KEY (\`${column}\`) REFERENCES \`user\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		).join(', ');

		await queryRunner.query(
			`CREATE TABLE \`${TABLE}\` (\`deletedAt\` datetime(6) NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`createdByUserId\` varchar(255) NULL, \`updatedByUserId\` varchar(255) NULL, \`deletedByUserId\` varchar(255) NULL, \`id\` varchar(36) NOT NULL, \`isActive\` tinyint NULL DEFAULT 1, \`isArchived\` tinyint NULL DEFAULT 0, \`archivedAt\` datetime NULL, \`email\` varchar(255) NULL, \`emailHash\` varchar(64) NOT NULL, \`tokenHash\` varchar(64) NOT NULL, \`expiresAt\` datetime NOT NULL, \`usedAt\` datetime NULL, \`claimId\` varchar(36) NULL, \`completedAt\` datetime NULL, \`revokedAt\` datetime NULL, \`requestIpHash\` varchar(64) NULL, \`userAgent\` varchar(255) NULL, \`locale\` varchar(20) NULL, \`branding\` text NULL, \`result\` text NULL, ${indexes}, UNIQUE INDEX \`${NAMES.tokenHashUnique}\` (\`tokenHash\`), PRIMARY KEY (\`id\`), ${foreignKeys}) ENGINE=InnoDB`
		);
	}
}
