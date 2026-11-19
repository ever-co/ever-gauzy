import { MigrationInterface, QueryRunner } from 'typeorm';
import * as chalk from 'chalk';
import { DatabaseTypeEnum } from '@gauzy/config';

/** The table this migration creates. */
const TABLE = 'embed_site_grant';

/**
 * TypeORM's own names for the keys and indexes the `EmbedSiteGrant` entity declares (its default naming strategy: a
 * hash of the table and column names), so a generated migration sees no drift.
 */
const NAMES = {
	primaryKey: 'PK_a95f0a7a21d87ec9c4c4189c294',
	foreignKeys: {
		tenantId: 'FK_7faacf65d00871288e9f770339e',
		organizationId: 'FK_b8a0c69262e3fae981b2f58ec50',
		createdByUserId: 'FK_7d21d73fb3298dee1a6e06a39f9',
		updatedByUserId: 'FK_e80aece60c63599cd1704ed4fcb',
		deletedByUserId: 'FK_d279b9f5c9723285c6ce839d41c',
		userId: 'FK_358e50ffb2e34d5e3964f291cd2',
		employeeId: 'FK_bfb6cdb66dd7b505a7cf067fcab'
	},
	indexes: {
		createdByUserId: 'IDX_7d21d73fb3298dee1a6e06a39f',
		updatedByUserId: 'IDX_e80aece60c63599cd1704ed4fc',
		deletedByUserId: 'IDX_d279b9f5c9723285c6ce839d41',
		isActive: 'IDX_7230bc256b7bdcc181d2b4a8e5',
		isArchived: 'IDX_f593e52fa0374fbeab825fa9dd',
		tenantId: 'IDX_7faacf65d00871288e9f770339',
		organizationId: 'IDX_b8a0c69262e3fae981b2f58ec5',
		userId: 'IDX_358e50ffb2e34d5e3964f291cd',
		employeeId: 'IDX_bfb6cdb66dd7b505a7cf067fca',
		familyId: 'IDX_bab76b4625ee97a5aee7490664'
	},
	/** Unique: one row per renewal token. */
	keyHashUnique: 'IDX_098089ac46cc6646a7d8b07dcd'
} as const;

/**
 * What each foreign key references, and its update rule (the organization's cascades, as its base entity says). Every
 * one cascades on delete: a grant goes with its person, their employee, the organization and the tenant.
 */
const REFERENCES: Record<keyof typeof NAMES.foreignKeys, { table: string; onUpdate: 'CASCADE' | 'NO ACTION' }> = {
	tenantId: { table: 'tenant', onUpdate: 'NO ACTION' },
	organizationId: { table: 'organization', onUpdate: 'CASCADE' },
	createdByUserId: { table: 'user', onUpdate: 'NO ACTION' },
	updatedByUserId: { table: 'user', onUpdate: 'NO ACTION' },
	deletedByUserId: { table: 'user', onUpdate: 'NO ACTION' },
	userId: { table: 'user', onUpdate: 'NO ACTION' },
	employeeId: { table: 'employee', onUpdate: 'NO ACTION' }
};

const FOREIGN_KEYS = Object.keys(REFERENCES) as ReadonlyArray<keyof typeof NAMES.foreignKeys>;

/**
 * Creates `embed_site_grant`: the renewal tokens of the sites people allowed to start and stop their timer, one row per
 * token, the tokens of one sign-in sharing a `familyId` (KIT-39, ever-co/ever-gauzy#12094).
 *
 * Purely additive: one new table with its keys and indexes, read only while `GAUZY_EMBED_TOKENS_ENABLED` is on. No
 * existing table, column or row is touched. Every statement is guarded by `hasTable`, so a re-run adds nothing; `down`
 * drops the table. The table holds no clear token, only its SHA-256.
 */
export class CreateEmbedSiteGrantTable1791000019860 implements MigrationInterface {
	name = 'CreateEmbedSiteGrantTable1791000019860';

	/** Advisory lock key that serialises concurrent runs of this migration on Postgres. */
	private readonly advisoryLockKey = 1791000019860;

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

	public async postgresUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		if (queryRunner.isTransactionActive) {
			await queryRunner.query(`SELECT pg_advisory_xact_lock($1)`, [this.advisoryLockKey]);
		}
		if (await queryRunner.hasTable(TABLE)) return;

		await queryRunner.query(
			`CREATE TABLE "${TABLE}" ("deletedAt" TIMESTAMP, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "createdByUserId" uuid, "updatedByUserId" uuid, "deletedByUserId" uuid, "id" uuid NOT NULL DEFAULT gen_random_uuid(), "isActive" boolean DEFAULT true, "isArchived" boolean DEFAULT false, "archivedAt" TIMESTAMP, "tenantId" uuid, "organizationId" uuid, "userId" uuid NOT NULL, "employeeId" uuid NOT NULL, "origin" character varying(255) NOT NULL, "familyId" uuid NOT NULL, "keyHash" character varying(64) NOT NULL, "expiresAt" TIMESTAMP NOT NULL, "usedAt" TIMESTAMP, "revokedAt" TIMESTAMP, CONSTRAINT "${NAMES.primaryKey}" PRIMARY KEY ("id"))`
		);
		for (const [column, index] of Object.entries(NAMES.indexes)) {
			await queryRunner.query(`CREATE INDEX "${index}" ON "${TABLE}" ("${column}") `);
		}
		await queryRunner.query(`CREATE UNIQUE INDEX "${NAMES.keyHashUnique}" ON "${TABLE}" ("keyHash") `);
		for (const column of FOREIGN_KEYS) {
			const { table, onUpdate } = REFERENCES[column];
			await queryRunner.query(
				`ALTER TABLE "${TABLE}" ADD CONSTRAINT "${NAMES.foreignKeys[column]}" FOREIGN KEY ("${column}") REFERENCES "${table}"("id") ON DELETE CASCADE ON UPDATE ${onUpdate}`
			);
		}
	}

	/** SQLite declares the foreign keys inside the table definition. */
	public async sqliteUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		if (await queryRunner.hasTable(TABLE)) return;

		const foreignKeys = FOREIGN_KEYS.map((column) => {
			const { table, onUpdate } = REFERENCES[column];
			return `CONSTRAINT "${NAMES.foreignKeys[column]}" FOREIGN KEY ("${column}") REFERENCES "${table}" ("id") ON DELETE CASCADE ON UPDATE ${onUpdate}`;
		}).join(', ');

		await queryRunner.query(
			`CREATE TABLE "${TABLE}" ("deletedAt" datetime, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "createdByUserId" varchar, "updatedByUserId" varchar, "deletedByUserId" varchar, "id" varchar PRIMARY KEY NOT NULL, "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "tenantId" varchar, "organizationId" varchar, "userId" varchar NOT NULL, "employeeId" varchar NOT NULL, "origin" varchar(255) NOT NULL, "familyId" varchar NOT NULL, "keyHash" varchar(64) NOT NULL, "expiresAt" datetime NOT NULL, "usedAt" datetime, "revokedAt" datetime, ${foreignKeys})`
		);
		for (const [column, index] of Object.entries(NAMES.indexes)) {
			await queryRunner.query(`CREATE INDEX "${index}" ON "${TABLE}" ("${column}") `);
		}
		await queryRunner.query(`CREATE UNIQUE INDEX "${NAMES.keyHashUnique}" ON "${TABLE}" ("keyHash") `);
	}

	public async mysqlUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		// MySQL has no transactional DDL and no migration-run lock: a named lock makes the check and the DDL one
		// critical section for two processes booting together. MySQL refuses lock names over 64 characters.
		const lockName = `gauzy:migration:${this.advisoryLockKey}`;
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

	/** The table, its indexes and foreign keys in ONE statement: MySQL commits each DDL statement on its own. */
	private async mysqlCreateTable(queryRunner: QueryRunner): Promise<void> {
		if (await queryRunner.hasTable(TABLE)) return;

		const indexes = Object.entries(NAMES.indexes)
			.map(([column, index]) => `INDEX \`${index}\` (\`${column}\`)`)
			.join(', ');
		const foreignKeys = FOREIGN_KEYS.map((column) => {
			const { table, onUpdate } = REFERENCES[column];
			return `CONSTRAINT \`${NAMES.foreignKeys[column]}\` FOREIGN KEY (\`${column}\`) REFERENCES \`${table}\`(\`id\`) ON DELETE CASCADE ON UPDATE ${onUpdate}`;
		}).join(', ');

		await queryRunner.query(
			`CREATE TABLE \`${TABLE}\` (\`deletedAt\` datetime(6) NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`createdByUserId\` varchar(255) NULL, \`updatedByUserId\` varchar(255) NULL, \`deletedByUserId\` varchar(255) NULL, \`id\` varchar(36) NOT NULL, \`isActive\` tinyint NULL DEFAULT 1, \`isArchived\` tinyint NULL DEFAULT 0, \`archivedAt\` datetime NULL, \`tenantId\` varchar(255) NULL, \`organizationId\` varchar(255) NULL, \`userId\` varchar(255) NOT NULL, \`employeeId\` varchar(255) NOT NULL, \`origin\` varchar(255) NOT NULL, \`familyId\` varchar(255) NOT NULL, \`keyHash\` varchar(64) NOT NULL, \`expiresAt\` datetime NOT NULL, \`usedAt\` datetime NULL, \`revokedAt\` datetime NULL, ${indexes}, UNIQUE INDEX \`${NAMES.keyHashUnique}\` (\`keyHash\`), PRIMARY KEY (\`id\`), ${foreignKeys}) ENGINE=InnoDB`
		);
	}
}
