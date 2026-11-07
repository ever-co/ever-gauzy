import { MigrationInterface, QueryRunner } from 'typeorm';
import * as chalk from 'chalk';
import { DatabaseTypeEnum } from '@gauzy/config';

/** The table this migration creates. */
const TABLE = 'user_api_token';

/**
 * TypeORM's own names for the keys and indexes the `UserApiToken` entity declares (its default naming strategy: a hash
 * of the table and column names), so a generated migration sees no drift.
 */
const NAMES = {
	primaryKey: 'PK_7a3778861a0df3bdc7b8bcc860d',
	foreignKeys: {
		tenantId: 'FK_76c617ef01e34b310b7a7d2df57',
		userId: 'FK_30f78f632dd03e5e39a2bd238f9',
		createdByUserId: 'FK_5f4241350e07416ad0428bef2a5',
		updatedByUserId: 'FK_6d4fda24ab59017653d58aee429',
		deletedByUserId: 'FK_8464415b93082e554a61a0379ea'
	},
	indexes: {
		createdByUserId: 'IDX_5f4241350e07416ad0428bef2a',
		updatedByUserId: 'IDX_6d4fda24ab59017653d58aee42',
		deletedByUserId: 'IDX_8464415b93082e554a61a0379e',
		isActive: 'IDX_f8b51bbec75d81ac1e6920e32e',
		isArchived: 'IDX_53cbdcff25a1f038c6051d8796',
		tenantId: 'IDX_76c617ef01e34b310b7a7d2df5',
		userId: 'IDX_30f78f632dd03e5e39a2bd238f'
	},
	/** Unique: one row per token. */
	tokenHashUnique: 'IDX_ec8e910577163502d007771190'
} as const;

/** What each foreign key references. All of them cascade: a token goes with its user and its tenant. */
const REFERENCES: Record<keyof typeof NAMES.foreignKeys, string> = {
	tenantId: 'tenant',
	userId: 'user',
	createdByUserId: 'user',
	updatedByUserId: 'user',
	deletedByUserId: 'user'
};

const FOREIGN_KEYS = Object.keys(REFERENCES) as ReadonlyArray<keyof typeof NAMES.foreignKeys>;

/**
 * Creates `user_api_token`: personal API tokens, which a user creates in Settings and hands to an agent or a script.
 *
 * Purely additive: one new table with its keys and indexes, and nothing reads it until
 * `GAUZY_USER_API_TOKENS_ENABLED` is on. No existing table, column or row is touched, so it is safe on a populated
 * database. Every statement is guarded by `hasTable`, so a re-run adds nothing; `down` drops the table.
 *
 * The table holds no clear token, only its SHA-256.
 */
export class CreateUserApiTokenTable1791000003900 implements MigrationInterface {
	name = 'CreateUserApiTokenTable1791000003900';

	/** Advisory lock key that serialises concurrent runs of this migration on Postgres. */
	private readonly advisoryLockKey = 1791000003900;

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
			`CREATE TABLE "${TABLE}" ("deletedAt" TIMESTAMP, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "createdByUserId" uuid, "updatedByUserId" uuid, "deletedByUserId" uuid, "id" uuid NOT NULL DEFAULT gen_random_uuid(), "isActive" boolean DEFAULT true, "isArchived" boolean DEFAULT false, "archivedAt" TIMESTAMP, "tenantId" uuid, "userId" uuid NOT NULL, "name" character varying(100) NOT NULL, "tokenHash" character varying(64) NOT NULL, "prefix" character varying(20) NOT NULL, "expiresAt" TIMESTAMP, "lastUsedAt" TIMESTAMP, "revokedAt" TIMESTAMP, CONSTRAINT "${NAMES.primaryKey}" PRIMARY KEY ("id"))`
		);
		for (const [column, index] of Object.entries(NAMES.indexes)) {
			await queryRunner.query(`CREATE INDEX "${index}" ON "${TABLE}" ("${column}") `);
		}
		await queryRunner.query(`CREATE UNIQUE INDEX "${NAMES.tokenHashUnique}" ON "${TABLE}" ("tokenHash") `);
		for (const column of FOREIGN_KEYS) {
			await queryRunner.query(
				`ALTER TABLE "${TABLE}" ADD CONSTRAINT "${NAMES.foreignKeys[column]}" FOREIGN KEY ("${column}") REFERENCES "${REFERENCES[column]}"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
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
				`CONSTRAINT "${NAMES.foreignKeys[column]}" FOREIGN KEY ("${column}") REFERENCES "${REFERENCES[column]}" ("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		).join(', ');

		await queryRunner.query(
			`CREATE TABLE "${TABLE}" ("deletedAt" datetime, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "createdByUserId" varchar, "updatedByUserId" varchar, "deletedByUserId" varchar, "id" varchar PRIMARY KEY NOT NULL, "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "tenantId" varchar, "userId" varchar NOT NULL, "name" varchar(100) NOT NULL, "tokenHash" varchar(64) NOT NULL, "prefix" varchar(20) NOT NULL, "expiresAt" datetime, "lastUsedAt" datetime, "revokedAt" datetime, ${foreignKeys})`
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
	 * Creates the table, its indexes and foreign keys on MySQL, when the table is not there yet, in ONE statement:
	 * MySQL commits each DDL statement on its own, so keys added by later statements could be missing after a failure
	 * in between, and a re-run (finding the table) would never add them.
	 */
	private async mysqlCreateTable(queryRunner: QueryRunner): Promise<void> {
		if (await queryRunner.hasTable(TABLE)) return;

		const indexes = Object.entries(NAMES.indexes)
			.map(([column, index]) => `INDEX \`${index}\` (\`${column}\`)`)
			.join(', ');
		const foreignKeys = FOREIGN_KEYS.map(
			(column) =>
				`CONSTRAINT \`${NAMES.foreignKeys[column]}\` FOREIGN KEY (\`${column}\`) REFERENCES \`${REFERENCES[column]}\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		).join(', ');

		await queryRunner.query(
			`CREATE TABLE \`${TABLE}\` (\`deletedAt\` datetime(6) NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`createdByUserId\` varchar(255) NULL, \`updatedByUserId\` varchar(255) NULL, \`deletedByUserId\` varchar(255) NULL, \`id\` varchar(36) NOT NULL, \`isActive\` tinyint NULL DEFAULT 1, \`isArchived\` tinyint NULL DEFAULT 0, \`archivedAt\` datetime NULL, \`tenantId\` varchar(255) NULL, \`userId\` varchar(255) NOT NULL, \`name\` varchar(100) NOT NULL, \`tokenHash\` varchar(64) NOT NULL, \`prefix\` varchar(20) NOT NULL, \`expiresAt\` datetime NULL, \`lastUsedAt\` datetime NULL, \`revokedAt\` datetime NULL, ${indexes}, UNIQUE INDEX \`${NAMES.tokenHashUnique}\` (\`tokenHash\`), PRIMARY KEY (\`id\`), ${foreignKeys}) ENGINE=InnoDB`
		);
	}
}
