import { MigrationInterface, QueryRunner } from 'typeorm';
import * as chalk from 'chalk';
import { DatabaseTypeEnum } from '@gauzy/config';

/** The databases this migration runs on. Both SQLite drivers share one entry. */
type Dialect = 'postgres' | 'sqlite' | 'mysql';

/** An index under the name TypeORM gives it (`migration:generate` then sees nothing to add). */
interface IndexDefinition {
	name: string;
	column: string;
}

/** A foreign key under the name TypeORM gives it. */
interface ForeignKeyDefinition {
	name: string;
	column: string;
	references: string;
	onDelete: 'CASCADE';
	onUpdate: 'NO ACTION' | 'CASCADE';
}

/** A table this migration creates, as TypeORM creates it for the entity. */
interface TableDefinition {
	name: string;
	primaryKey: { name: string; columns: string[] };
	columns: Record<Dialect, string>;
	indexes: IndexDefinition[];
	foreignKeys: ForeignKeyDefinition[];
}

const TIME_GOAL: TableDefinition = {
	name: 'time_goal',
	primaryKey: { name: 'PK_e6646fbad15da26e38670159c89', columns: ['id'] },
	columns: {
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
			`"name" character varying NOT NULL`,
			`"comparison" character varying NOT NULL`,
			`"targetHours" numeric(7,2) NOT NULL`,
			`"period" character varying NOT NULL`,
			`"scope" character varying NOT NULL`,
			`"billableOnly" boolean NOT NULL DEFAULT false`,
			`"listedProjectsOnly" boolean NOT NULL DEFAULT false`,
			`"listedClientsOnly" boolean NOT NULL DEFAULT false`,
			`"employeeId" uuid`,
			`"organizationTeamId" uuid`
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
			`"name" varchar NOT NULL`,
			`"comparison" varchar NOT NULL`,
			`"targetHours" numeric(7,2) NOT NULL`,
			`"period" varchar NOT NULL`,
			`"scope" varchar NOT NULL`,
			`"billableOnly" boolean NOT NULL DEFAULT (0)`,
			`"listedProjectsOnly" boolean NOT NULL DEFAULT (0)`,
			`"listedClientsOnly" boolean NOT NULL DEFAULT (0)`,
			`"employeeId" varchar`,
			`"organizationTeamId" varchar`
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
			'`name` varchar(255) NOT NULL',
			'`comparison` varchar(255) NOT NULL',
			'`targetHours` decimal(7,2) NOT NULL',
			'`period` varchar(255) NOT NULL',
			'`scope` varchar(255) NOT NULL',
			'`billableOnly` tinyint NOT NULL DEFAULT 0',
			'`listedProjectsOnly` tinyint NOT NULL DEFAULT 0',
			'`listedClientsOnly` tinyint NOT NULL DEFAULT 0',
			'`employeeId` varchar(255) NULL',
			'`organizationTeamId` varchar(255) NULL'
		].join(', ')
	},
	indexes: [
		{ name: 'IDX_0f990ce4df7bc2568472603f64', column: 'createdByUserId' },
		{ name: 'IDX_60deb299bd431c1d161b68cfda', column: 'updatedByUserId' },
		{ name: 'IDX_11402d4eedb444083ad2307112', column: 'deletedByUserId' },
		{ name: 'IDX_c7b7f0a4bae8d67c9f80d8752f', column: 'isActive' },
		{ name: 'IDX_c0f6bfbfc751c4169f62338532', column: 'isArchived' },
		{ name: 'IDX_4b0a29f1f46ff5e46af1cee5c7', column: 'tenantId' },
		{ name: 'IDX_51acd019826022b4864e3f8326', column: 'organizationId' },
		{ name: 'IDX_92f8cbaf799c0f3fcad6fa778e', column: 'employeeId' },
		{ name: 'IDX_e664aa20f1e417d9b1f6c03ad2', column: 'organizationTeamId' }
	],
	foreignKeys: [
		{
			name: 'FK_0f990ce4df7bc2568472603f649',
			column: 'createdByUserId',
			references: 'user',
			onDelete: 'CASCADE',
			onUpdate: 'NO ACTION'
		},
		{
			name: 'FK_60deb299bd431c1d161b68cfda6',
			column: 'updatedByUserId',
			references: 'user',
			onDelete: 'CASCADE',
			onUpdate: 'NO ACTION'
		},
		{
			name: 'FK_11402d4eedb444083ad23071122',
			column: 'deletedByUserId',
			references: 'user',
			onDelete: 'CASCADE',
			onUpdate: 'NO ACTION'
		},
		{
			name: 'FK_4b0a29f1f46ff5e46af1cee5c7f',
			column: 'tenantId',
			references: 'tenant',
			onDelete: 'CASCADE',
			onUpdate: 'NO ACTION'
		},
		{
			name: 'FK_51acd019826022b4864e3f8326d',
			column: 'organizationId',
			references: 'organization',
			onDelete: 'CASCADE',
			onUpdate: 'CASCADE'
		},
		{
			name: 'FK_92f8cbaf799c0f3fcad6fa778e3',
			column: 'employeeId',
			references: 'employee',
			onDelete: 'CASCADE',
			onUpdate: 'NO ACTION'
		},
		{
			name: 'FK_e664aa20f1e417d9b1f6c03ad26',
			column: 'organizationTeamId',
			references: 'organization_team',
			onDelete: 'CASCADE',
			onUpdate: 'NO ACTION'
		}
	]
};

/**
 * A pivot of a goal and the records it counts (its projects, or its clients): both columns form the key, and a link
 * goes with either side.
 */
function pivotTable(
	name: string,
	primaryKeyName: string,
	otherColumn: string,
	otherTable: string,
	names: { goalIndex: string; otherIndex: string; goalForeignKey: string; otherForeignKey: string }
): TableDefinition {
	return {
		name,
		primaryKey: { name: primaryKeyName, columns: ['timeGoalId', otherColumn] },
		columns: {
			postgres: `"timeGoalId" uuid NOT NULL, "${otherColumn}" uuid NOT NULL`,
			sqlite: `"timeGoalId" varchar NOT NULL, "${otherColumn}" varchar NOT NULL`,
			mysql: `\`timeGoalId\` varchar(36) NOT NULL, \`${otherColumn}\` varchar(36) NOT NULL`
		},
		indexes: [
			{ name: names.goalIndex, column: 'timeGoalId' },
			{ name: names.otherIndex, column: otherColumn }
		],
		foreignKeys: [
			{
				name: names.goalForeignKey,
				column: 'timeGoalId',
				references: 'time_goal',
				onDelete: 'CASCADE',
				onUpdate: 'CASCADE'
			},
			{
				name: names.otherForeignKey,
				column: otherColumn,
				references: otherTable,
				onDelete: 'CASCADE',
				onUpdate: 'CASCADE'
			}
		]
	};
}

const TIME_GOAL_PROJECT = pivotTable(
	'time_goal_project',
	'PK_891033af6e39fdf397f56b69c8a',
	'organizationProjectId',
	'organization_project',
	{
		goalIndex: 'IDX_dd0ecf361f2953297c958f53cf',
		otherIndex: 'IDX_41fe9403ede67e86f68694b3a2',
		goalForeignKey: 'FK_dd0ecf361f2953297c958f53cf6',
		otherForeignKey: 'FK_41fe9403ede67e86f68694b3a26'
	}
);

const TIME_GOAL_ORGANIZATION_CONTACT = pivotTable(
	'time_goal_organization_contact',
	'PK_6e2804f6ca8102e74afb654254c',
	'organizationContactId',
	'organization_contact',
	{
		goalIndex: 'IDX_1fd0b4d9fe4e6406bede310282',
		otherIndex: 'IDX_f86d72bd87532012b09a0ca3ed',
		goalForeignKey: 'FK_1fd0b4d9fe4e6406bede3102824',
		otherForeignKey: 'FK_f86d72bd87532012b09a0ca3edc'
	}
);

/** The tables in the order they are created: a pivot after the goal table it points to. */
const TABLES: ReadonlyArray<TableDefinition> = [TIME_GOAL, TIME_GOAL_PROJECT, TIME_GOAL_ORGANIZATION_CONTACT];

/**
 * Creates `time_goal`, the hours a member, or each member of a team or of the organization, holds to per day, week
 * or month (ever-co/ever-gauzy#11918), with `time_goal_project` and `time_goal_organization_contact`, the projects
 * and clients a goal counts. It is a module of its own: the `goal`, `goal_kpi` and `goal_time_frame` tables of the
 * objectives and key results are not touched.
 *
 * Safe on a live database: three new, empty tables with their indexes and foreign keys; no existing table, column or
 * row changes, and nothing is backfilled. Every statement is guarded (`IF NOT EXISTS`, or a check of the catalogue
 * for the foreign keys), so running `up` twice is harmless; an advisory lock (a named lock on MySQL) makes two API
 * processes that boot together run it one after the other.
 *
 * `down` drops the three tables, the pivots first (their indexes and foreign keys go with them).
 */
export class CreateTimeGoalTables1791000009500 implements MigrationInterface {
	name = 'CreateTimeGoalTables1791000009500';

	/** Advisory lock key that serialises concurrent runs of this migration on Postgres. */
	private readonly advisoryLockKey = 1791000009500;

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
				for (const table of TABLES) {
					await postgresUp(queryRunner, table);
				}
				break;
			case 'mysql':
				await withMysqlNamedLock(queryRunner, this.mysqlLockName, async () => {
					for (const table of TABLES) {
						await mysqlUp(queryRunner, table);
					}
				});
				break;
			default:
				for (const table of TABLES) {
					await sqliteUp(queryRunner, table);
				}
		}
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		console.log(chalk.yellow(this.name + ' reverting changes!'));

		const dialect = dialectOf(queryRunner);
		for (const table of [...TABLES].reverse()) {
			await queryRunner.query(`DROP TABLE IF EXISTS ${quoted(dialect, table.name)}`);
		}
	}
}

async function postgresUp(queryRunner: QueryRunner, table: TableDefinition): Promise<void> {
	const primaryKey = `CONSTRAINT "${table.primaryKey.name}" PRIMARY KEY (${columnList('postgres', table.primaryKey.columns)})`;
	await queryRunner.query(`CREATE TABLE IF NOT EXISTS "${table.name}" (${table.columns.postgres}, ${primaryKey})`);
	for (const index of table.indexes) {
		await queryRunner.query(`CREATE INDEX IF NOT EXISTS "${index.name}" ON "${table.name}" ("${index.column}")`);
	}
	for (const fk of table.foreignKeys) {
		const existing = await queryRunner.query(
			`SELECT 1 FROM pg_constraint WHERE conname = $1 AND conrelid = to_regclass($2)`,
			[fk.name, table.name]
		);
		if (existing.length > 0) continue;
		await queryRunner.query(
			`ALTER TABLE "${table.name}" ADD CONSTRAINT "${fk.name}" FOREIGN KEY ("${fk.column}") REFERENCES "${fk.references}"("id") ON DELETE ${fk.onDelete} ON UPDATE ${fk.onUpdate}`
		);
	}
}

async function mysqlUp(queryRunner: QueryRunner, table: TableDefinition): Promise<void> {
	const indexes = table.indexes.map((index) => `INDEX \`${index.name}\` (\`${index.column}\`)`);
	const primaryKey = `PRIMARY KEY (${columnList('mysql', table.primaryKey.columns)})`;
	await queryRunner.query(
		`CREATE TABLE IF NOT EXISTS \`${table.name}\` (${table.columns.mysql}, ${indexes.join(', ')}, ${primaryKey}) ENGINE=InnoDB`
	);
	const existing = await queryRunner.getTable(table.name);
	for (const fk of table.foreignKeys) {
		if (existing?.foreignKeys.some((foreignKey) => foreignKey.name === fk.name)) continue;
		await queryRunner.query(
			`ALTER TABLE \`${table.name}\` ADD CONSTRAINT \`${fk.name}\` FOREIGN KEY (\`${fk.column}\`) REFERENCES \`${fk.references}\`(\`id\`) ON DELETE ${fk.onDelete} ON UPDATE ${fk.onUpdate}`
		);
	}
}

/** SQLite declares the foreign keys with the table: it cannot add one to an existing table. */
async function sqliteUp(queryRunner: QueryRunner, table: TableDefinition): Promise<void> {
	const foreignKeys = table.foreignKeys.map(
		(fk) =>
			`CONSTRAINT "${fk.name}" FOREIGN KEY ("${fk.column}") REFERENCES "${fk.references}" ("id") ON DELETE ${fk.onDelete} ON UPDATE ${fk.onUpdate}`
	);
	// The goal table declares its key with its `id` column; a pivot declares its two-column key last.
	const hasCompositeKey = table.primaryKey.columns.length > 1;
	const parts = [table.columns.sqlite, ...foreignKeys];
	if (hasCompositeKey) {
		parts.push(`PRIMARY KEY (${columnList('sqlite', table.primaryKey.columns)})`);
	}
	await queryRunner.query(`CREATE TABLE IF NOT EXISTS "${table.name}" (${parts.join(', ')})`);
	for (const index of table.indexes) {
		await queryRunner.query(`CREATE INDEX IF NOT EXISTS "${index.name}" ON "${table.name}" ("${index.column}")`);
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
	if (dialect === 'mysql') {
		return `\`${identifier}\``;
	}
	return `"${identifier}"`;
}

/** Quoted column names, comma-separated. */
function columnList(dialect: Dialect, columns: string[]): string {
	return columns.map((column) => quoted(dialect, column)).join(', ');
}

/**
 * Runs `work` while holding a MySQL named lock (`GET_LOCK`), so that two processes running the same migration
 * concurrently run its checks and DDL one after the other. The lock is session-level and released in `finally`.
 */
async function withMysqlNamedLock(
	queryRunner: QueryRunner,
	lockName: string,
	work: () => Promise<void>
): Promise<void> {
	const [row] = (await queryRunner.query(`SELECT GET_LOCK(?, 30) AS acquired`, [lockName])) as Array<{
		acquired: number | string | null;
	}>;
	if (Number(row?.acquired) !== 1) {
		throw new Error(`Could not acquire the MySQL lock ${lockName} for the migration.`);
	}
	try {
		await work();
	} finally {
		await queryRunner.query(`SELECT RELEASE_LOCK(?)`, [lockName]);
	}
}
