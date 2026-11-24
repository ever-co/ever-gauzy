import { MigrationInterface, QueryRunner } from 'typeorm';
import * as chalk from 'chalk';
import { DatabaseTypeEnum } from '@gauzy/config';

/** The databases this migration runs on. Both SQLite drivers share one entry. */
type Dialect = 'postgres' | 'sqlite' | 'mysql';

/** An index, under the name TypeORM gives it (`migration:generate` then sees nothing to add). */
interface IIndex {
	name: string;
	columns: string[];
}

/** A foreign key, under the name TypeORM gives it. */
interface IForeignKey {
	name: string;
	column: string;
	references: string;
	onDelete: 'CASCADE' | 'SET NULL';
	onUpdate: 'NO ACTION' | 'CASCADE';
}

/** A table as TypeORM creates it for its entity. */
interface ITable {
	name: string;
	primaryKey: string;
	columns: Record<Dialect, string>;
	indexes: ReadonlyArray<IIndex>;
	unique: IIndex;
	foreignKeys: ReadonlyArray<IForeignKey>;
}

/** The columns every tenant and organization row has, per dialect. */
const BASE_COLUMNS: Record<Dialect, string[]> = {
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
		`"organizationId" uuid`
	],
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
		`"organizationId" varchar`
	],
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
		'`organizationId` varchar(255) NULL'
	]
};

/** The foreign keys every tenant and organization row has: its users, its tenant and its organization. */
function baseForeignKeys(names: Record<'createdBy' | 'updatedBy' | 'deletedBy' | 'tenant' | 'organization', string>) {
	return [
		{
			name: names.createdBy,
			column: 'createdByUserId',
			references: 'user',
			onDelete: 'CASCADE',
			onUpdate: 'NO ACTION'
		},
		{
			name: names.updatedBy,
			column: 'updatedByUserId',
			references: 'user',
			onDelete: 'CASCADE',
			onUpdate: 'NO ACTION'
		},
		{
			name: names.deletedBy,
			column: 'deletedByUserId',
			references: 'user',
			onDelete: 'CASCADE',
			onUpdate: 'NO ACTION'
		},
		{ name: names.tenant, column: 'tenantId', references: 'tenant', onDelete: 'CASCADE', onUpdate: 'NO ACTION' },
		{
			name: names.organization,
			column: 'organizationId',
			references: 'organization',
			onDelete: 'CASCADE',
			onUpdate: 'CASCADE'
		}
	] as IForeignKey[];
}

/** A client's billing schedule. One per client: the unique key on the client. */
const INVOICE_SCHEDULE: ITable = {
	name: 'invoice_schedule',
	primaryKey: 'PK_982df12ca2749b67ad8a2086087',
	columns: {
		postgres: [
			...BASE_COLUMNS.postgres,
			`"frequency" character varying NOT NULL`,
			`"startDay" character varying(10) NOT NULL`,
			`"grouping" character varying NOT NULL DEFAULT 'PROJECT'`,
			`"sendInvoice" boolean NOT NULL DEFAULT false`,
			`"pausedAt" TIMESTAMP`,
			`"activeSince" TIMESTAMP NOT NULL`,
			`"organizationContactId" uuid NOT NULL`,
			`"authorId" uuid`
		].join(', '),
		sqlite: [
			...BASE_COLUMNS.sqlite,
			`"frequency" varchar NOT NULL`,
			`"startDay" varchar(10) NOT NULL`,
			`"grouping" varchar NOT NULL DEFAULT ('PROJECT')`,
			`"sendInvoice" boolean NOT NULL DEFAULT (0)`,
			`"pausedAt" datetime`,
			`"activeSince" datetime NOT NULL`,
			`"organizationContactId" varchar NOT NULL`,
			`"authorId" varchar`
		].join(', '),
		mysql: [
			...BASE_COLUMNS.mysql,
			'`frequency` varchar(255) NOT NULL',
			'`startDay` varchar(10) NOT NULL',
			"`grouping` varchar(255) NOT NULL DEFAULT 'PROJECT'",
			'`sendInvoice` tinyint NOT NULL DEFAULT 0',
			'`pausedAt` datetime NULL',
			'`activeSince` datetime NOT NULL',
			'`organizationContactId` varchar(255) NOT NULL',
			'`authorId` varchar(255) NULL'
		].join(', ')
	},
	indexes: [
		{ name: 'IDX_f9e832dc03fa137373b6edbbe7', columns: ['createdByUserId'] },
		{ name: 'IDX_b5cc5c68962ffa2604551c1839', columns: ['updatedByUserId'] },
		{ name: 'IDX_3760d90ab055974e96fdca7a7c', columns: ['deletedByUserId'] },
		{ name: 'IDX_be7d3901b4e378c3d7c644186d', columns: ['isActive'] },
		{ name: 'IDX_c623657055572c7f895479e886', columns: ['isArchived'] },
		{ name: 'IDX_d2ab759bef19d43003bbb720a0', columns: ['tenantId'] },
		{ name: 'IDX_22282c67de0af064b53670fac9', columns: ['organizationId'] },
		{ name: 'IDX_51624e0c4b22387c97bc756a85', columns: ['authorId'] }
	],
	unique: { name: 'IDX_invoice_schedule_organization_contact', columns: ['organizationContactId'] },
	foreignKeys: [
		...baseForeignKeys({
			createdBy: 'FK_f9e832dc03fa137373b6edbbe72',
			updatedBy: 'FK_b5cc5c68962ffa2604551c1839e',
			deletedBy: 'FK_3760d90ab055974e96fdca7a7c2',
			tenant: 'FK_d2ab759bef19d43003bbb720a0f',
			organization: 'FK_22282c67de0af064b53670fac9e'
		}),
		{
			name: 'FK_1259fee522c97d388d1eafe559e',
			column: 'organizationContactId',
			references: 'organization_contact',
			onDelete: 'CASCADE',
			onUpdate: 'NO ACTION'
		},
		{
			name: 'FK_51624e0c4b22387c97bc756a851',
			column: 'authorId',
			references: 'user',
			onDelete: 'SET NULL',
			onUpdate: 'NO ACTION'
		}
	]
};

/** A run of a schedule, one per period: the unique key on the schedule and the period's first day. */
const INVOICE_SCHEDULE_RUN: ITable = {
	name: 'invoice_schedule_run',
	primaryKey: 'PK_7d488f44c42d393a98e57bdb4ef',
	columns: {
		postgres: [
			...BASE_COLUMNS.postgres,
			`"periodStart" character varying(10) NOT NULL`,
			`"periodEnd" character varying(10) NOT NULL`,
			`"status" character varying NOT NULL`,
			`"reason" character varying`,
			`"claimedAt" TIMESTAMP NOT NULL`,
			`"finishedAt" TIMESTAMP`,
			`"leftOutSeconds" integer`,
			`"invoiceScheduleId" uuid NOT NULL`,
			`"invoiceId" uuid`
		].join(', '),
		sqlite: [
			...BASE_COLUMNS.sqlite,
			`"periodStart" varchar(10) NOT NULL`,
			`"periodEnd" varchar(10) NOT NULL`,
			`"status" varchar NOT NULL`,
			`"reason" varchar`,
			`"claimedAt" datetime NOT NULL`,
			`"finishedAt" datetime`,
			`"leftOutSeconds" integer`,
			`"invoiceScheduleId" varchar NOT NULL`,
			`"invoiceId" varchar`
		].join(', '),
		mysql: [
			...BASE_COLUMNS.mysql,
			'`periodStart` varchar(10) NOT NULL',
			'`periodEnd` varchar(10) NOT NULL',
			'`status` varchar(255) NOT NULL',
			'`reason` varchar(255) NULL',
			'`claimedAt` datetime NOT NULL',
			'`finishedAt` datetime NULL',
			'`leftOutSeconds` int NULL',
			'`invoiceScheduleId` varchar(255) NOT NULL',
			'`invoiceId` varchar(255) NULL'
		].join(', ')
	},
	indexes: [
		{ name: 'IDX_d199a2f2efb167bccb464cf1a2', columns: ['createdByUserId'] },
		{ name: 'IDX_38bc3fbd9cfc9387f91207703a', columns: ['updatedByUserId'] },
		{ name: 'IDX_3233b59c7591e0996cc3447709', columns: ['deletedByUserId'] },
		{ name: 'IDX_b3811d1af78bbfc4b2edc5b967', columns: ['isActive'] },
		{ name: 'IDX_9ad16159fd352b45962c37b9c6', columns: ['isArchived'] },
		{ name: 'IDX_d733799631dd0f6a718a588ce2', columns: ['tenantId'] },
		{ name: 'IDX_e816788330827b39ee9a2dc208', columns: ['organizationId'] },
		{ name: 'IDX_5852e75c02415360da70e2395d', columns: ['invoiceId'] }
	],
	unique: { name: 'IDX_invoice_schedule_run_schedule_period', columns: ['invoiceScheduleId', 'periodStart'] },
	foreignKeys: [
		...baseForeignKeys({
			createdBy: 'FK_d199a2f2efb167bccb464cf1a24',
			updatedBy: 'FK_38bc3fbd9cfc9387f91207703a5',
			deletedBy: 'FK_3233b59c7591e0996cc3447709c',
			tenant: 'FK_d733799631dd0f6a718a588ce21',
			organization: 'FK_e816788330827b39ee9a2dc2082'
		}),
		{
			name: 'FK_246bf55161b1997c4f01f3bbb03',
			column: 'invoiceScheduleId',
			references: 'invoice_schedule',
			onDelete: 'CASCADE',
			onUpdate: 'NO ACTION'
		},
		{
			name: 'FK_5852e75c02415360da70e2395d4',
			column: 'invoiceId',
			references: 'invoice',
			onDelete: 'SET NULL',
			onUpdate: 'NO ACTION'
		}
	]
};

/** In creation order: a run references its schedule. `down` drops them the other way round. */
const TABLES: ReadonlyArray<ITable> = [INVOICE_SCHEDULE, INVOICE_SCHEDULE_RUN];

/**
 * Creates `invoice_schedule` and `invoice_schedule_run` (ever-co/ever-gauzy#11855): a client's billing schedule (every
 * week, two weeks or month from a start day, the grouping of the lines, and whether the invoice is sent or kept as a
 * draft), one per client, and its runs, one per period. A sweep inserts the run before it builds the invoice, and the
 * unique key on the schedule and the period's first day lets a single insert through when several processes sweep at
 * once, so a period is billed once. A schedule goes with its client, its runs with it; a deleted invoice leaves its
 * run, without the link, and a deleted author leaves the schedule without one.
 *
 * Safe on a live database: two new, empty tables with their indexes and foreign keys; no existing table, column or row
 * is changed, and nothing is backfilled. An organization without a schedule sees no change. Every statement is guarded
 * (`IF NOT EXISTS`, or a check of the catalogue for the foreign keys), so running `up` twice is harmless; an advisory
 * lock (a named lock on MySQL) makes two API processes that boot together run it one after the other.
 *
 * `down` drops both tables (their indexes and foreign keys go with them).
 */
export class CreateInvoiceScheduleTables1791000012170 implements MigrationInterface {
	name = 'CreateInvoiceScheduleTables1791000012170';

	/** Advisory lock key that serialises concurrent runs of this migration on Postgres. */
	private readonly advisoryLockKey = 1791000012170;

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
					await this.postgresUp(queryRunner, table);
				}
				break;
			case 'mysql':
				await withMysqlNamedLock(queryRunner, this.mysqlLockName, async () => {
					for (const table of TABLES) {
						await this.mysqlUp(queryRunner, table);
					}
				});
				break;
			default:
				for (const table of TABLES) {
					await this.sqliteUp(queryRunner, table);
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

	private async postgresUp(queryRunner: QueryRunner, table: ITable): Promise<void> {
		await queryRunner.query(
			`CREATE TABLE IF NOT EXISTS "${table.name}" (${table.columns.postgres}, CONSTRAINT "${table.primaryKey}" PRIMARY KEY ("id"))`
		);
		for (const index of table.indexes) {
			await queryRunner.query(
				`CREATE INDEX IF NOT EXISTS "${index.name}" ON "${table.name}" (${columnList('postgres', index.columns)})`
			);
		}
		await queryRunner.query(
			`CREATE UNIQUE INDEX IF NOT EXISTS "${table.unique.name}" ON "${table.name}" (${columnList('postgres', table.unique.columns)})`
		);
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

	private async mysqlUp(queryRunner: QueryRunner, table: ITable): Promise<void> {
		const indexes = [
			...table.indexes.map((index) => `INDEX \`${index.name}\` (${columnList('mysql', index.columns)})`),
			`UNIQUE INDEX \`${table.unique.name}\` (${columnList('mysql', table.unique.columns)})`
		];
		await queryRunner.query(
			`CREATE TABLE IF NOT EXISTS \`${table.name}\` (${table.columns.mysql}, ${indexes.join(', ')}, PRIMARY KEY (\`id\`)) ENGINE=InnoDB`
		);
		const existing = await queryRunner.getTable(table.name);
		for (const fk of table.foreignKeys) {
			if (existing?.foreignKeys.some((key) => key.name === fk.name)) continue;
			await queryRunner.query(
				`ALTER TABLE \`${table.name}\` ADD CONSTRAINT \`${fk.name}\` FOREIGN KEY (\`${fk.column}\`) REFERENCES \`${fk.references}\`(\`id\`) ON DELETE ${fk.onDelete} ON UPDATE ${fk.onUpdate}`
			);
		}
	}

	/** SQLite declares the foreign keys with the table: it cannot add one to an existing table. */
	private async sqliteUp(queryRunner: QueryRunner, table: ITable): Promise<void> {
		const foreignKeys = table.foreignKeys.map(
			(fk) =>
				`CONSTRAINT "${fk.name}" FOREIGN KEY ("${fk.column}") REFERENCES "${fk.references}" ("id") ON DELETE ${fk.onDelete} ON UPDATE ${fk.onUpdate}`
		);
		await queryRunner.query(
			`CREATE TABLE IF NOT EXISTS "${table.name}" (${table.columns.sqlite}, ${foreignKeys.join(', ')})`
		);
		for (const index of table.indexes) {
			await queryRunner.query(
				`CREATE INDEX IF NOT EXISTS "${index.name}" ON "${table.name}" (${columnList('sqlite', index.columns)})`
			);
		}
		await queryRunner.query(
			`CREATE UNIQUE INDEX IF NOT EXISTS "${table.unique.name}" ON "${table.name}" (${columnList('sqlite', table.unique.columns)})`
		);
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
