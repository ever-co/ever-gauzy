import { MigrationInterface, QueryRunner } from 'typeorm';
import * as chalk from 'chalk';
import { DatabaseTypeEnum } from '@gauzy/config';

/** The table this migration creates. */
const TABLE = 'employee_agent_profile';

/**
 * TypeORM's own names for the keys and indexes the `EmployeeAgentProfile` entity declares (its default
 * naming strategy: a hash of the table and column names), so a generated migration sees no drift.
 */
const NAMES = {
	primaryKey: 'PK_a4aa816bb3f7c34f8423ac1ea2e',
	/** The unique constraint TypeORM puts on the owning side of a one-to-one relation. */
	employeeUnique: 'REL_29e5671efd0dd4205cf33607e9',
	foreignKeys: {
		createdByUserId: 'FK_7b04b38666556d786978f171394',
		updatedByUserId: 'FK_710f48d257e98bc9d19390f8708',
		deletedByUserId: 'FK_df0e32762293f1df2e06385be5d',
		tenantId: 'FK_5b8e961bd3d82a3f249a7abb954',
		organizationId: 'FK_18bd78317553f0de38b9eb3f6ff',
		employeeId: 'FK_29e5671efd0dd4205cf33607e9c',
		reportsToEmployeeId: 'FK_a7e5ab2312159430c19071ec04f'
	},
	indexes: {
		createdByUserId: 'IDX_7b04b38666556d786978f17139',
		updatedByUserId: 'IDX_710f48d257e98bc9d19390f870',
		deletedByUserId: 'IDX_df0e32762293f1df2e06385be5',
		isActive: 'IDX_f201b3971c2e01ee260d2de291',
		isArchived: 'IDX_206caafedf5ae06141c01f9ff9',
		tenantId: 'IDX_5b8e961bd3d82a3f249a7abb95',
		organizationId: 'IDX_18bd78317553f0de38b9eb3f6f',
		externalId: 'IDX_817ce667de185f3afdad6ba920',
		employeeId: 'IDX_29e5671efd0dd4205cf33607e9',
		reportsToEmployeeId: 'IDX_a7e5ab2312159430c19071ec04'
	}
} as const;

/** Each foreign key: its column, the table and column it references, and its delete/update actions. */
const FOREIGN_KEYS: ReadonlyArray<{
	column: keyof typeof NAMES.foreignKeys;
	references: string;
	onDelete: 'CASCADE' | 'SET NULL';
	onUpdate: 'CASCADE' | 'NO ACTION';
}> = [
	{ column: 'createdByUserId', references: 'user', onDelete: 'CASCADE', onUpdate: 'NO ACTION' },
	{ column: 'updatedByUserId', references: 'user', onDelete: 'CASCADE', onUpdate: 'NO ACTION' },
	{ column: 'deletedByUserId', references: 'user', onDelete: 'CASCADE', onUpdate: 'NO ACTION' },
	{ column: 'tenantId', references: 'tenant', onDelete: 'CASCADE', onUpdate: 'NO ACTION' },
	{ column: 'organizationId', references: 'organization', onDelete: 'CASCADE', onUpdate: 'CASCADE' },
	{ column: 'employeeId', references: 'employee', onDelete: 'CASCADE', onUpdate: 'NO ACTION' },
	{ column: 'reportsToEmployeeId', references: 'employee', onDelete: 'SET NULL', onUpdate: 'NO ACTION' }
];

/**
 * Creates `employee_agent_profile`: the agent-specific facts of an agent employee (`employee.kind = 'agent'`),
 * one row per employee. Part of the Gauzy ↔ Ever Works integration (G-P1-1).
 *
 * Pure additive DDL: one new table with its keys and indexes. No existing table, column or row is touched,
 * so it is safe on a populated database. Every statement is guarded by `hasTable`, so a re-run adds nothing,
 * and `down` drops the table (its indexes and keys go with it).
 *
 * - `employeeId` is unique (one profile per employee) and cascades: a profile has no meaning without its
 *   employee.
 * - `reportsToEmployeeId` is cleared when the employee it points at is removed.
 * - `capabilities` and `metadata` are JSON: `jsonb` on Postgres, `json` on MySQL, `text` on SQLite — what
 *   `@JsonColumn` resolves per dialect.
 */
export class CreateEmployeeAgentProfileTable1791000000722 implements MigrationInterface {
	name = 'CreateEmployeeAgentProfileTable1791000000722';

	/** Advisory lock key that serialises concurrent runs of this migration on Postgres. */
	private readonly advisoryLockKey = 1791000000722;

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
			`CREATE TABLE "${TABLE}" ("deletedAt" TIMESTAMP, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "createdByUserId" uuid, "updatedByUserId" uuid, "deletedByUserId" uuid, "id" uuid NOT NULL DEFAULT gen_random_uuid(), "isActive" boolean DEFAULT true, "isArchived" boolean DEFAULT false, "archivedAt" TIMESTAMP, "tenantId" uuid, "organizationId" uuid, "source" character varying(32) NOT NULL, "externalId" character varying(255), "slug" character varying(255), "title" character varying(255), "capabilities" jsonb, "status" character varying(32), "scope" character varying(32), "scopeTargetId" character varying(255), "modelId" character varying(255), "avatarUrl" text, "lastRunAt" TIMESTAMP, "managedExternally" boolean NOT NULL DEFAULT false, "externalUrl" text, "metadata" jsonb, "employeeId" uuid NOT NULL, "reportsToEmployeeId" uuid, CONSTRAINT "${NAMES.employeeUnique}" UNIQUE ("employeeId"), CONSTRAINT "${NAMES.primaryKey}" PRIMARY KEY ("id"))`
		);
		for (const [column, index] of Object.entries(NAMES.indexes)) {
			await queryRunner.query(`CREATE INDEX "${index}" ON "${TABLE}" ("${column}") `);
		}
		for (const fk of FOREIGN_KEYS) {
			await queryRunner.query(
				`ALTER TABLE "${TABLE}" ADD CONSTRAINT "${NAMES.foreignKeys[fk.column]}" FOREIGN KEY ("${fk.column}") REFERENCES "${fk.references}"("id") ON DELETE ${fk.onDelete} ON UPDATE ${fk.onUpdate}`
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
			(fk) =>
				`CONSTRAINT "${NAMES.foreignKeys[fk.column]}" FOREIGN KEY ("${fk.column}") REFERENCES "${fk.references}" ("id") ON DELETE ${fk.onDelete} ON UPDATE ${fk.onUpdate}`
		).join(', ');

		await queryRunner.query(
			`CREATE TABLE "${TABLE}" ("deletedAt" datetime, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "createdByUserId" varchar, "updatedByUserId" varchar, "deletedByUserId" varchar, "id" varchar PRIMARY KEY NOT NULL, "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "tenantId" varchar, "organizationId" varchar, "source" varchar(32) NOT NULL, "externalId" varchar(255), "slug" varchar(255), "title" varchar(255), "capabilities" text, "status" varchar(32), "scope" varchar(32), "scopeTargetId" varchar(255), "modelId" varchar(255), "avatarUrl" text, "lastRunAt" datetime, "managedExternally" boolean NOT NULL DEFAULT (0), "externalUrl" text, "metadata" text, "employeeId" varchar NOT NULL, "reportsToEmployeeId" varchar, CONSTRAINT "${NAMES.employeeUnique}" UNIQUE ("employeeId"), ${foreignKeys})`
		);
		for (const [column, index] of Object.entries(NAMES.indexes)) {
			await queryRunner.query(`CREATE INDEX "${index}" ON "${TABLE}" ("${column}") `);
		}
	}

	/**
	 * MySQL Up Migration
	 *
	 * @param queryRunner
	 */
	public async mysqlUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		if (await queryRunner.hasTable(TABLE)) return;

		const indexes = Object.entries(NAMES.indexes)
			.map(([column, index]) => `INDEX \`${index}\` (\`${column}\`)`)
			.join(', ');

		await queryRunner.query(
			`CREATE TABLE \`${TABLE}\` (\`deletedAt\` datetime(6) NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`createdByUserId\` varchar(255) NULL, \`updatedByUserId\` varchar(255) NULL, \`deletedByUserId\` varchar(255) NULL, \`id\` varchar(36) NOT NULL, \`isActive\` tinyint NULL DEFAULT 1, \`isArchived\` tinyint NULL DEFAULT 0, \`archivedAt\` datetime NULL, \`tenantId\` varchar(255) NULL, \`organizationId\` varchar(255) NULL, \`source\` varchar(32) NOT NULL, \`externalId\` varchar(255) NULL, \`slug\` varchar(255) NULL, \`title\` varchar(255) NULL, \`capabilities\` json NULL, \`status\` varchar(32) NULL, \`scope\` varchar(32) NULL, \`scopeTargetId\` varchar(255) NULL, \`modelId\` varchar(255) NULL, \`avatarUrl\` text NULL, \`lastRunAt\` datetime NULL, \`managedExternally\` tinyint NOT NULL DEFAULT 0, \`externalUrl\` text NULL, \`metadata\` json NULL, \`employeeId\` varchar(255) NOT NULL, \`reportsToEmployeeId\` varchar(255) NULL, ${indexes}, UNIQUE INDEX \`${NAMES.employeeUnique}\` (\`employeeId\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`
		);
		for (const fk of FOREIGN_KEYS) {
			await queryRunner.query(
				`ALTER TABLE \`${TABLE}\` ADD CONSTRAINT \`${NAMES.foreignKeys[fk.column]}\` FOREIGN KEY (\`${fk.column}\`) REFERENCES \`${fk.references}\`(\`id\`) ON DELETE ${fk.onDelete} ON UPDATE ${fk.onUpdate}`
			);
		}
	}
}
