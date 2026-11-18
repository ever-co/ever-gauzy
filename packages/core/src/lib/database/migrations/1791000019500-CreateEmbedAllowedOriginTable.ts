import { MigrationInterface, QueryRunner } from 'typeorm';
import * as chalk from 'chalk';
import { DatabaseTypeEnum } from '@gauzy/config';

/** The table this migration creates. */
const TABLE = 'embed_allowed_origin';

/**
 * TypeORM's own names for the keys and indexes the `EmbedAllowedOrigin` entity declares (its default naming strategy: a
 * hash of the table and column names), so a generated migration sees no drift.
 */
const NAMES = {
	primaryKey: 'PK_186046a05e38334ae9b33875416',
	foreignKeys: {
		tenantId: 'FK_642a7aeff46682ffd0316c01f62',
		organizationId: 'FK_733b869830fdb1a2bade007d666',
		createdByUserId: 'FK_dc099a266d07fd8ac61f3193620',
		updatedByUserId: 'FK_69b7bbf36d4ddbf964c5242870c',
		deletedByUserId: 'FK_baf5a5e3f6a7bc251be9d290b32'
	},
	indexes: {
		createdByUserId: 'IDX_dc099a266d07fd8ac61f319362',
		updatedByUserId: 'IDX_69b7bbf36d4ddbf964c5242870',
		deletedByUserId: 'IDX_baf5a5e3f6a7bc251be9d290b3',
		isActive: 'IDX_d5b889b3bfa09313b4e9672e62',
		isArchived: 'IDX_edce1ecc32e89ddbc57201835d',
		tenantId: 'IDX_642a7aeff46682ffd0316c01f6',
		organizationId: 'IDX_733b869830fdb1a2bade007d66'
	},
	/** Unique: an origin once per organization. */
	organizationOriginUnique: 'IDX_59724e36b5e4babd38d5b76298'
} as const;

/** What each foreign key references, and its update rule (the organization's cascades, as its base entity says). */
const REFERENCES: Record<keyof typeof NAMES.foreignKeys, { table: string; onUpdate: 'CASCADE' | 'NO ACTION' }> = {
	tenantId: { table: 'tenant', onUpdate: 'NO ACTION' },
	organizationId: { table: 'organization', onUpdate: 'CASCADE' },
	createdByUserId: { table: 'user', onUpdate: 'NO ACTION' },
	updatedByUserId: { table: 'user', onUpdate: 'NO ACTION' },
	deletedByUserId: { table: 'user', onUpdate: 'NO ACTION' }
};

const FOREIGN_KEYS = Object.keys(REFERENCES) as ReadonlyArray<keyof typeof NAMES.foreignKeys>;

/**
 * Creates `embed_allowed_origin`: the sites an organization allows to embed its timer (KIT-09).
 *
 * Purely additive: one new table with its keys and indexes, read only while `GAUZY_EMBED_TOKENS_ENABLED` is on. No
 * existing table, column or row is touched. Every statement is guarded by `hasTable`, so a re-run adds nothing; `down`
 * drops the table.
 */
export class CreateEmbedAllowedOriginTable1791000019500 implements MigrationInterface {
	name = 'CreateEmbedAllowedOriginTable1791000019500';

	/** Advisory lock key that serialises concurrent runs of this migration on Postgres. */
	private readonly advisoryLockKey = 1791000019500;

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
			`CREATE TABLE "${TABLE}" ("deletedAt" TIMESTAMP, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "createdByUserId" uuid, "updatedByUserId" uuid, "deletedByUserId" uuid, "id" uuid NOT NULL DEFAULT gen_random_uuid(), "isActive" boolean DEFAULT true, "isArchived" boolean DEFAULT false, "archivedAt" TIMESTAMP, "tenantId" uuid, "organizationId" uuid, "origin" character varying(255) NOT NULL, CONSTRAINT "${NAMES.primaryKey}" PRIMARY KEY ("id"))`
		);
		for (const [column, index] of Object.entries(NAMES.indexes)) {
			await queryRunner.query(`CREATE INDEX "${index}" ON "${TABLE}" ("${column}") `);
		}
		await queryRunner.query(`CREATE UNIQUE INDEX "${NAMES.organizationOriginUnique}" ON "${TABLE}" ("organizationId", "origin") `);
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
			`CREATE TABLE "${TABLE}" ("deletedAt" datetime, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "createdByUserId" varchar, "updatedByUserId" varchar, "deletedByUserId" varchar, "id" varchar PRIMARY KEY NOT NULL, "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "tenantId" varchar, "organizationId" varchar, "origin" varchar(255) NOT NULL, ${foreignKeys})`
		);
		for (const [column, index] of Object.entries(NAMES.indexes)) {
			await queryRunner.query(`CREATE INDEX "${index}" ON "${TABLE}" ("${column}") `);
		}
		await queryRunner.query(`CREATE UNIQUE INDEX "${NAMES.organizationOriginUnique}" ON "${TABLE}" ("organizationId", "origin") `);
	}

	public async mysqlUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		// MySQL has no transactional DDL and no migration-run lock: a named lock makes the check and the DDL one
		// critical section for two processes booting together.
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
			`CREATE TABLE \`${TABLE}\` (\`deletedAt\` datetime(6) NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`createdByUserId\` varchar(255) NULL, \`updatedByUserId\` varchar(255) NULL, \`deletedByUserId\` varchar(255) NULL, \`id\` varchar(36) NOT NULL, \`isActive\` tinyint NULL DEFAULT 1, \`isArchived\` tinyint NULL DEFAULT 0, \`archivedAt\` datetime NULL, \`tenantId\` varchar(255) NULL, \`organizationId\` varchar(255) NULL, \`origin\` varchar(255) NOT NULL, ${indexes}, UNIQUE INDEX \`${NAMES.organizationOriginUnique}\` (\`organizationId\`, \`origin\`), PRIMARY KEY (\`id\`), ${foreignKeys}) ENGINE=InnoDB`
		);
	}
}
