import { MigrationInterface, QueryRunner } from 'typeorm';
import * as chalk from 'chalk';
import { DatabaseTypeEnum } from '@gauzy/config';

/** The table this migration creates. */
const TABLE = 'time_off_balance_deduction';

/**
 * TypeORM's own names for the keys and indexes the `TimeOffBalanceDeduction` entity declares (its default naming
 * strategy: a hash of the table and column names), so a generated migration sees no drift.
 */
const NAMES = {
	primaryKey: 'PK_a5429ce9b296640369ccf4feb8a',
	foreignKeys: {
		createdByUserId: 'FK_1c4e23b819c9d456c9ad0cf259a',
		updatedByUserId: 'FK_b2d058c0137dfd9ad84fa869155',
		deletedByUserId: 'FK_c025b64f25e9be6f069f963f4ed',
		tenantId: 'FK_199c5b032a1452d1111e1f1351c',
		organizationId: 'FK_cd94a43bb19cd71f2f41b861140',
		timeOffRequestId: 'FK_eb339445e86befbd5585031f6b0',
		balanceId: 'FK_6fce94530f4e89bf157ab8c71dc'
	},
	indexes: {
		createdByUserId: 'IDX_1c4e23b819c9d456c9ad0cf259',
		updatedByUserId: 'IDX_b2d058c0137dfd9ad84fa86915',
		deletedByUserId: 'IDX_c025b64f25e9be6f069f963f4e',
		isActive: 'IDX_98374dbeeecffe3875f13b0cc7',
		isArchived: 'IDX_f18d383a824831c23d34521b6a',
		tenantId: 'IDX_199c5b032a1452d1111e1f1351',
		organizationId: 'IDX_cd94a43bb19cd71f2f41b86114',
		timeOffRequestId: 'IDX_eb339445e86befbd5585031f6b',
		balanceId: 'IDX_6fce94530f4e89bf157ab8c71d'
	},
	/** Unique: one request takes days from one balance once. Named by the entity. */
	requestBalanceUnique: 'IDX_time_off_balance_deduction_unique'
} as const;

type ForeignKeyColumn = keyof typeof NAMES.foreignKeys;

/** What each foreign key references, and its actions, as the entity's relations declare them. */
const REFERENCES: ReadonlyArray<{ column: ForeignKeyColumn; table: string; onUpdate: 'NO ACTION' | 'CASCADE' }> = [
	{ column: 'createdByUserId', table: 'user', onUpdate: 'NO ACTION' },
	{ column: 'updatedByUserId', table: 'user', onUpdate: 'NO ACTION' },
	{ column: 'deletedByUserId', table: 'user', onUpdate: 'NO ACTION' },
	{ column: 'tenantId', table: 'tenant', onUpdate: 'NO ACTION' },
	{ column: 'organizationId', table: 'organization', onUpdate: 'CASCADE' },
	{ column: 'timeOffRequestId', table: 'time_off_request', onUpdate: 'NO ACTION' },
	{ column: 'balanceId', table: 'time_off_balance', onUpdate: 'NO ACTION' }
];

/**
 * Creates `time_off_balance_deduction`: the days one approved time-off request took from one leave balance
 * (ever-co/ever-gauzy#10183). Approving a request writes its rows, and taking the approval back gives exactly those
 * days back and removes them, so a reversal never gives back days that were not taken and a repeated approval never
 * takes them twice.
 *
 * Pure additive: one new table with its keys and indexes. No existing table, column or row is touched, so it is safe
 * on a populated database; the table starts empty, and requests approved before it simply have nothing recorded
 * (their approval took nothing). Every dialect's `up` is guarded by `hasTable`, so a re-run adds nothing; `down`
 * drops the table. Every foreign key cascades on delete: deleting a request or a balance is never refused because of
 * this record.
 */
export class CreateTimeOffBalanceDeductionTable1791000003630 implements MigrationInterface {
	name = 'CreateTimeOffBalanceDeductionTable1791000003630';

	/** Advisory lock key that serialises concurrent runs of this migration on Postgres. */
	private readonly advisoryLockKey = 1791000003630;

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
			`CREATE TABLE "${TABLE}" ("deletedAt" TIMESTAMP, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "createdByUserId" uuid, "updatedByUserId" uuid, "deletedByUserId" uuid, "id" uuid NOT NULL DEFAULT gen_random_uuid(), "isActive" boolean DEFAULT true, "isArchived" boolean DEFAULT false, "archivedAt" TIMESTAMP, "tenantId" uuid, "organizationId" uuid, "days" numeric(10,2) NOT NULL, "timeOffRequestId" uuid NOT NULL, "balanceId" uuid NOT NULL, CONSTRAINT "${NAMES.primaryKey}" PRIMARY KEY ("id"))`
		);
		for (const [column, index] of Object.entries(NAMES.indexes)) {
			await queryRunner.query(`CREATE INDEX "${index}" ON "${TABLE}" ("${column}") `);
		}
		await queryRunner.query(
			`CREATE UNIQUE INDEX "${NAMES.requestBalanceUnique}" ON "${TABLE}" ("timeOffRequestId", "balanceId") `
		);
		for (const { column, table, onUpdate } of REFERENCES) {
			await queryRunner.query(
				`ALTER TABLE "${TABLE}" ADD CONSTRAINT "${NAMES.foreignKeys[column]}" FOREIGN KEY ("${column}") REFERENCES "${table}"("id") ON DELETE CASCADE ON UPDATE ${onUpdate}`
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

		const foreignKeys = REFERENCES.map(
			({ column, table, onUpdate }) =>
				`CONSTRAINT "${NAMES.foreignKeys[column]}" FOREIGN KEY ("${column}") REFERENCES "${table}" ("id") ON DELETE CASCADE ON UPDATE ${onUpdate}`
		).join(', ');

		await queryRunner.query(
			`CREATE TABLE "${TABLE}" ("deletedAt" datetime, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "createdByUserId" varchar, "updatedByUserId" varchar, "deletedByUserId" varchar, "id" varchar PRIMARY KEY NOT NULL, "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "tenantId" varchar, "organizationId" varchar, "days" numeric(10,2) NOT NULL, "timeOffRequestId" varchar NOT NULL, "balanceId" varchar NOT NULL, ${foreignKeys})`
		);
		for (const [column, index] of Object.entries(NAMES.indexes)) {
			await queryRunner.query(`CREATE INDEX "${index}" ON "${TABLE}" ("${column}") `);
		}
		await queryRunner.query(
			`CREATE UNIQUE INDEX "${NAMES.requestBalanceUnique}" ON "${TABLE}" ("timeOffRequestId", "balanceId") `
		);
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
	 * Creates the table, its indexes and foreign keys on MySQL, when the table is not there yet — in ONE statement:
	 * MySQL commits each DDL statement on its own, so keys added by later statements could be missing after a failure
	 * in between, and a re-run (finding the table) would never add them.
	 */
	private async mysqlCreateTable(queryRunner: QueryRunner): Promise<void> {
		if (await queryRunner.hasTable(TABLE)) return;

		const indexes = Object.entries(NAMES.indexes)
			.map(([column, index]) => `INDEX \`${index}\` (\`${column}\`)`)
			.join(', ');
		const foreignKeys = REFERENCES.map(
			({ column, table, onUpdate }) =>
				`CONSTRAINT \`${NAMES.foreignKeys[column]}\` FOREIGN KEY (\`${column}\`) REFERENCES \`${table}\`(\`id\`) ON DELETE CASCADE ON UPDATE ${onUpdate}`
		).join(', ');

		await queryRunner.query(
			`CREATE TABLE \`${TABLE}\` (\`deletedAt\` datetime(6) NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`createdByUserId\` varchar(255) NULL, \`updatedByUserId\` varchar(255) NULL, \`deletedByUserId\` varchar(255) NULL, \`id\` varchar(36) NOT NULL, \`isActive\` tinyint NULL DEFAULT 1, \`isArchived\` tinyint NULL DEFAULT 0, \`archivedAt\` datetime NULL, \`tenantId\` varchar(255) NULL, \`organizationId\` varchar(255) NULL, \`days\` decimal(10,2) NOT NULL, \`timeOffRequestId\` varchar(255) NOT NULL, \`balanceId\` varchar(255) NOT NULL, ${indexes}, UNIQUE INDEX \`${NAMES.requestBalanceUnique}\` (\`timeOffRequestId\`, \`balanceId\`), PRIMARY KEY (\`id\`), ${foreignKeys}) ENGINE=InnoDB`
		);
	}
}
