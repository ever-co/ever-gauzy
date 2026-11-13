import { MigrationInterface, QueryRunner } from 'typeorm';
import * as chalk from 'chalk';
import { DatabaseTypeEnum } from '@gauzy/config';

/** The table this migration creates. */
const TABLE = 'user_two_factor';

/**
 * TypeORM's own names for the keys and indexes the `UserTwoFactor` entity declares (its default naming strategy: a
 * hash of the table and column names), so a generated migration sees no drift.
 */
const NAMES = {
	primaryKey: 'PK_a0dc97e08540c59d6c744e21c58',
	foreignKeys: {
		tenantId: 'FK_e5fa5bc27e33a32a542e704eb1d',
		userId: 'FK_2cbb5b2d99e69fabcd8a5a0fdb0',
		createdByUserId: 'FK_adf6d3b3905314dccebddc67978',
		updatedByUserId: 'FK_95e62ccf2abeed1023264eb7a73',
		deletedByUserId: 'FK_3ec6eb8a4b7872a0a2a85203b4a'
	},
	indexes: {
		createdByUserId: 'IDX_adf6d3b3905314dccebddc6797',
		updatedByUserId: 'IDX_95e62ccf2abeed1023264eb7a7',
		deletedByUserId: 'IDX_3ec6eb8a4b7872a0a2a85203b4',
		isActive: 'IDX_47354514ba9f03de0d77d2c427',
		isArchived: 'IDX_f0954d2724f22e3029dd4420d2',
		tenantId: 'IDX_e5fa5bc27e33a32a542e704eb1'
	},
	/** Unique: one row per user. */
	userIdUnique: 'IDX_2cbb5b2d99e69fabcd8a5a0fdb'
} as const;

/** What each foreign key references. All of them cascade: the row goes with its user and its tenant. */
const REFERENCES: Record<keyof typeof NAMES.foreignKeys, string> = {
	tenantId: 'tenant',
	userId: 'user',
	createdByUserId: 'user',
	updatedByUserId: 'user',
	deletedByUserId: 'user'
};

const FOREIGN_KEYS = Object.keys(REFERENCES) as ReadonlyArray<keyof typeof NAMES.foreignKeys>;

/** The organization rule this migration adds: whether members are asked to turn two-factor authentication on. */
const RULE = { table: 'organization', column: 'requireTwoFactor' } as const;

/**
 * Two-factor authentication with an authenticator app (ever-co/ever-gauzy#11916). Creates `user_two_factor`: one row
 * per user who started an enrolment, with the encrypted secret, the date it was turned on, the SHA-256 of the unused
 * recovery codes, the last accepted step (replay) and the last administrator reset. Adds
 * `organization.requireTwoFactor` (`boolean NOT NULL DEFAULT false`): whether the organization asks its members to turn
 * it on.
 *
 * Purely additive: a new table with its keys and indexes, and a column whose default leaves every organization as it is
 * (off). Nothing reads the table for a user who never turns two-factor authentication on, so every sign-in answers as
 * before. Every statement is guarded (`hasTable`, `IF NOT EXISTS` or a column check), so a re-run adds nothing. `down`
 * drops the table, and the column on Postgres and MySQL; SQLite keeps the column, as every additive column of this
 * platform is kept on the embedded dialect.
 */
export class AddTwoFactorAuthentication1791000009900 implements MigrationInterface {
	name = 'AddTwoFactorAuthentication1791000009900';

	/** Advisory lock key that serialises concurrent runs of this migration on Postgres. */
	private readonly advisoryLockKey = 1791000009900;

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
				await queryRunner.query(`DROP TABLE IF EXISTS "${TABLE}"`);
				break;
			case DatabaseTypeEnum.postgres:
				await queryRunner.query(`ALTER TABLE "${RULE.table}" DROP COLUMN IF EXISTS "${RULE.column}"`);
				await queryRunner.query(`DROP TABLE IF EXISTS "${TABLE}"`);
				break;
			case DatabaseTypeEnum.mysql:
				if (await queryRunner.hasColumn(RULE.table, RULE.column)) {
					await queryRunner.query(`ALTER TABLE \`${RULE.table}\` DROP COLUMN \`${RULE.column}\``);
				}
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
	public async postgresUpQueryRunner(queryRunner: QueryRunner): Promise<void> {
		if (queryRunner.isTransactionActive) {
			await queryRunner.query(`SELECT pg_advisory_xact_lock($1)`, [this.advisoryLockKey]);
		}
		await queryRunner.query(
			`ALTER TABLE "${RULE.table}" ADD COLUMN IF NOT EXISTS "${RULE.column}" boolean NOT NULL DEFAULT false`
		);
		if (await queryRunner.hasTable(TABLE)) return;

		await queryRunner.query(
			`CREATE TABLE "${TABLE}" ("deletedAt" TIMESTAMP, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "createdByUserId" uuid, "updatedByUserId" uuid, "deletedByUserId" uuid, "id" uuid NOT NULL DEFAULT gen_random_uuid(), "isActive" boolean DEFAULT true, "isArchived" boolean DEFAULT false, "archivedAt" TIMESTAMP, "tenantId" uuid, "userId" uuid NOT NULL, "secret" character varying(255), "enabledAt" TIMESTAMP, "recoveryCodes" text, "lastUsedTimeStep" integer NOT NULL DEFAULT '0', "resetAt" TIMESTAMP, "resetByUserId" character varying, CONSTRAINT "${NAMES.primaryKey}" PRIMARY KEY ("id"))`
		);
		for (const [column, index] of Object.entries(NAMES.indexes)) {
			await queryRunner.query(`CREATE INDEX "${index}" ON "${TABLE}" ("${column}") `);
		}
		await queryRunner.query(`CREATE UNIQUE INDEX "${NAMES.userIdUnique}" ON "${TABLE}" ("userId") `);
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
	public async sqliteUpQueryRunner(queryRunner: QueryRunner): Promise<void> {
		if (!(await queryRunner.hasColumn(RULE.table, RULE.column))) {
			await queryRunner.query(
				`ALTER TABLE "${RULE.table}" ADD COLUMN "${RULE.column}" boolean NOT NULL DEFAULT (0)`
			);
		}
		if (await queryRunner.hasTable(TABLE)) return;

		const foreignKeys = FOREIGN_KEYS.map(
			(column) =>
				`CONSTRAINT "${NAMES.foreignKeys[column]}" FOREIGN KEY ("${column}") REFERENCES "${REFERENCES[column]}" ("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		).join(', ');

		await queryRunner.query(
			`CREATE TABLE "${TABLE}" ("deletedAt" datetime, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "createdByUserId" varchar, "updatedByUserId" varchar, "deletedByUserId" varchar, "id" varchar PRIMARY KEY NOT NULL, "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "tenantId" varchar, "userId" varchar NOT NULL, "secret" varchar(255), "enabledAt" datetime, "recoveryCodes" text, "lastUsedTimeStep" integer NOT NULL DEFAULT (0), "resetAt" datetime, "resetByUserId" varchar, ${foreignKeys})`
		);
		for (const [column, index] of Object.entries(NAMES.indexes)) {
			await queryRunner.query(`CREATE INDEX "${index}" ON "${TABLE}" ("${column}") `);
		}
		await queryRunner.query(`CREATE UNIQUE INDEX "${NAMES.userIdUnique}" ON "${TABLE}" ("userId") `);
	}

	/**
	 * MySQL Up Migration
	 *
	 * @param queryRunner
	 */
	public async mysqlUpQueryRunner(queryRunner: QueryRunner): Promise<void> {
		// MySQL has no transactional DDL and no migration-run lock: two processes booting together would both see
		// the table missing. A named lock makes the check and the DDL one critical section.
		const lockName = `gauzy:migration:${this.advisoryLockKey}`;
		const [row] = await queryRunner.query(`SELECT GET_LOCK(?, 120) AS \`acquired\``, [lockName]);
		if (Number(row?.acquired) !== 1) {
			throw new Error(`${this.name}: could not acquire the MySQL migration lock ${lockName}.`);
		}
		try {
			if (!(await queryRunner.hasColumn(RULE.table, RULE.column))) {
				await queryRunner.query(
					`ALTER TABLE \`${RULE.table}\` ADD COLUMN \`${RULE.column}\` tinyint NOT NULL DEFAULT 0`
				);
			}
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
			`CREATE TABLE \`${TABLE}\` (\`deletedAt\` datetime(6) NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`createdByUserId\` varchar(255) NULL, \`updatedByUserId\` varchar(255) NULL, \`deletedByUserId\` varchar(255) NULL, \`id\` varchar(36) NOT NULL, \`isActive\` tinyint NULL DEFAULT 1, \`isArchived\` tinyint NULL DEFAULT 0, \`archivedAt\` datetime NULL, \`tenantId\` varchar(255) NULL, \`userId\` varchar(255) NOT NULL, \`secret\` varchar(255) NULL, \`enabledAt\` datetime NULL, \`recoveryCodes\` text NULL, \`lastUsedTimeStep\` int NOT NULL DEFAULT 0, \`resetAt\` datetime NULL, \`resetByUserId\` varchar(255) NULL, ${indexes}, UNIQUE INDEX \`${NAMES.userIdUnique}\` (\`userId\`), PRIMARY KEY (\`id\`), ${foreignKeys}) ENGINE=InnoDB`
		);
	}
}
