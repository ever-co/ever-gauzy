import { MigrationInterface, QueryRunner } from 'typeorm';
import * as chalk from 'chalk';
import { DatabaseTypeEnum } from '@gauzy/config';

/** The databases this migration runs on. Both SQLite drivers share one entry. */
type Dialect = 'postgres' | 'sqlite' | 'mysql';

const TABLE = 'time_log';

/** A rate, as `employee.billRateValue` and the project rates are declared. */
const RATE: Readonly<Record<Dialect, string>> = {
	postgres: 'numeric(14,2)',
	sqlite: 'numeric(14,2)',
	mysql: 'decimal(14,2) NULL'
};

/** A currency, as `employee.billRateCurrency` is declared. */
const CURRENCY: Readonly<Record<Dialect, string>> = {
	postgres: 'character varying',
	sqlite: 'varchar',
	mysql: 'varchar(255) NULL'
};

/** The marker that the log stores its rates. */
const FLAG: Readonly<Record<Dialect, string>> = {
	postgres: 'boolean',
	sqlite: 'boolean',
	mysql: 'tinyint NULL'
};

/** The marker that the log stores its rates, set last by the fill. */
const MARKER = 'ratesStored';

/** The columns this migration adds, the marker last. */
const COLUMNS: ReadonlyArray<{ name: string; type: Readonly<Record<Dialect, string>> }> = [
	{ name: 'billRateValue', type: RATE },
	{ name: 'billRateCurrency', type: CURRENCY },
	{ name: 'payRateValue', type: RATE },
	{ name: 'payRateCurrency', type: CURRENCY },
	{ name: 'projectBillRateValue', type: RATE },
	{ name: 'projectMemberBillRateValue', type: RATE },
	{ name: 'projectBillRateCurrency', type: CURRENCY },
	{ name: 'projectMemberBillRateCurrency', type: CURRENCY },
	{ name: MARKER, type: FLAG }
];

/**
 * Adds to `time_log` the rates that price it, so a rate change no longer re-prices time already tracked:
 *
 * - `billRateValue`, `billRateCurrency`: the member's billing rate;
 * - `payRateValue`, `payRateCurrency`: the member's pay rate;
 * - `projectBillRateValue`, `projectBillRateCurrency`, `projectMemberBillRateValue`, `projectMemberBillRateCurrency`:
 *   the project's client rate and the member's client rate on the project, each with its currency;
 * - `ratesStored`: whether the log stores them. A row written around the API (a restored archive) does not, and is
 *   priced at the current rates as before.
 *
 * Every existing log is filled with the rates of today and marked, so every amount read right after the migration is
 * the amount read right before it. A rate that states no currency (none, or an empty one) is stored with the
 * organization's, as a new log stores it, so a later change of the organization's currency never relabels a recorded
 * price. The fill gives rates only to the logs that store none yet (`ratesStored` null), and marks each log last: a
 * run cut short (MySQL has no transactional DDL) is completed by the next one, and running `up` again, or after
 * SQLite's `down`, which keeps the columns, never overwrites a rate a log already stores.
 *
 * A transaction-scoped advisory lock (a named lock on MySQL) makes two API processes that boot at the same time
 * against one database run it one after the other.
 *
 * `down` drops the columns on Postgres and MySQL. SQLite keeps them, as every additive column of this platform is
 * kept on the embedded dialect; a kept nullable column is invisible to a build without the entity members.
 */
export class AddTimeLogStoredRates1791000009400 implements MigrationInterface {
	name = 'AddTimeLogStoredRates1791000009400';

	/** Advisory lock key that serialises concurrent runs of this migration on Postgres. */
	private readonly advisoryLockKey = 1791000009400;

	/** The MySQL named lock of this migration. MySQL refuses lock names over 64 characters. */
	readonly mysqlLockName = `gauzy:migration:${this.advisoryLockKey}`;

	public async up(queryRunner: QueryRunner): Promise<void> {
		console.log(chalk.yellow(this.name + ' start running!'));

		const dialect = this.dialectOf(queryRunner);

		if (dialect === 'postgres' && queryRunner.isTransactionActive) {
			await queryRunner.query(`SELECT pg_advisory_xact_lock($1)`, [this.advisoryLockKey]);
		}

		// MySQL has no transactional DDL and no migration-run lock: two processes booting together would both see
		// the columns missing. A named lock makes the checks, the DDL and the fill one critical section.
		if (dialect === 'mysql') {
			await withMysqlNamedLock(queryRunner, this.mysqlLockName, () => this.addAndFill(queryRunner, dialect));
			return;
		}
		await this.addAndFill(queryRunner, dialect);
	}

	/** Adds each column the table does not have yet, then fills the logs that store no rate yet. */
	private async addAndFill(queryRunner: QueryRunner, dialect: Dialect): Promise<void> {
		const hasTable = await queryRunner.hasTable(TABLE);
		if (!hasTable) {
			return;
		}
		for (const column of COLUMNS) {
			const hasColumn = await queryRunner.hasColumn(TABLE, column.name);
			if (hasColumn) {
				continue;
			}
			await queryRunner.query(
				`ALTER TABLE ${quoted(dialect, TABLE)} ADD COLUMN ${quoted(dialect, column.name)} ${column.type[dialect]}`
			);
		}
		for (const statement of FILL[dialect]) {
			await queryRunner.query(statement);
		}
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		console.log(chalk.yellow(this.name + ' reverting changes!'));

		const dialect = this.dialectOf(queryRunner);

		if (dialect === 'sqlite') {
			console.log(chalk.gray(`${this.name}: the embedded dialect keeps its additive columns.`));
			return;
		}
		const hasTable = await queryRunner.hasTable(TABLE);
		if (!hasTable) {
			return;
		}
		for (const column of COLUMNS) {
			if (dialect === 'postgres') {
				await queryRunner.query(`ALTER TABLE "${TABLE}" DROP COLUMN IF EXISTS "${column.name}"`);
				continue;
			}
			const hasColumn = await queryRunner.hasColumn(TABLE, column.name);
			if (hasColumn) {
				await queryRunner.query(`ALTER TABLE \`${TABLE}\` DROP COLUMN \`${column.name}\``);
			}
		}
	}

	/** The dialect of the connection's driver. Throws before any statement runs on any other database. */
	private dialectOf(queryRunner: QueryRunner): Dialect {
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
}

/**
 * A membership left inactive, archived or removed no longer gives its client rate, as the project rates read says
 * (NULL counts as current).
 */
const CURRENT_MEMBERSHIP_PG =
	`("member"."isActive" IS NULL OR "member"."isActive" = true) ` +
	`AND ("member"."isArchived" IS NULL OR "member"."isArchived" = false) AND "member"."deletedAt" IS NULL`;

const CURRENT_MEMBERSHIP_MYSQL =
	'(`member`.`isActive` IS NULL OR `member`.`isActive` = 1) ' +
	'AND (`member`.`isArchived` IS NULL OR `member`.`isArchived` = 0) AND `member`.`deletedAt` IS NULL';

const CURRENT_MEMBERSHIP_SQLITE =
	`("member"."isActive" IS NULL OR "member"."isActive" = 1) ` +
	`AND ("member"."isArchived" IS NULL OR "member"."isArchived" = 0) AND "member"."deletedAt" IS NULL`;

/**
 * Today's rates on every log that stores none yet: the project's and the membership's client rates first, then the
 * member's own rates, which mark the log. Each statement only touches unmarked logs, so a run cut short anywhere is
 * completed by the next one, and a marked log is never written again.
 */
const FILL: Readonly<Record<Dialect, ReadonlyArray<string>>> = {
	postgres: [
		`UPDATE "time_log" SET "projectBillRateValue" = "project"."billRateValue", ` +
			`"projectBillRateCurrency" = COALESCE(NULLIF("project"."currency", ''), (SELECT "currency" FROM "organization" WHERE "organization"."id" = "time_log"."organizationId")) ` +
			`FROM "organization_project" "project" WHERE "project"."id" = "time_log"."projectId" ` +
			`AND "project"."deletedAt" IS NULL AND "time_log"."ratesStored" IS NULL`,
		`UPDATE "time_log" SET "projectMemberBillRateValue" = "member"."billRateValue", ` +
			`"projectMemberBillRateCurrency" = COALESCE(NULLIF("project"."currency", ''), (SELECT "currency" FROM "organization" WHERE "organization"."id" = "time_log"."organizationId")) ` +
			`FROM "organization_project_employee" "member", "organization_project" "project" ` +
			`WHERE "project"."id" = "time_log"."projectId" AND "project"."deletedAt" IS NULL ` +
			`AND "member"."organizationProjectId" = "time_log"."projectId" ` +
			`AND "member"."employeeId" = "time_log"."employeeId" AND "member"."billRateValue" IS NOT NULL ` +
			`AND ${CURRENT_MEMBERSHIP_PG} AND "time_log"."ratesStored" IS NULL`,
		`UPDATE "time_log" SET "billRateValue" = "employee"."billRateValue", ` +
			`"billRateCurrency" = COALESCE(NULLIF("employee"."billRateCurrency", ''), (SELECT "currency" FROM "organization" WHERE "organization"."id" = "time_log"."organizationId")), ` +
			`"payRateValue" = "employee"."payRateValue", ` +
			`"payRateCurrency" = COALESCE(NULLIF("employee"."payRateCurrency", ''), (SELECT "currency" FROM "organization" WHERE "organization"."id" = "time_log"."organizationId")), "ratesStored" = true ` +
			`FROM "employee" WHERE "employee"."id" = "time_log"."employeeId" AND "time_log"."ratesStored" IS NULL`
	],
	mysql: [
		'UPDATE `time_log` INNER JOIN `organization_project` `project` ON `project`.`id` = `time_log`.`projectId` ' +
			'SET `time_log`.`projectBillRateValue` = `project`.`billRateValue`, ' +
			"`time_log`.`projectBillRateCurrency` = COALESCE(NULLIF(`project`.`currency`, ''), (SELECT `currency` FROM `organization` WHERE `organization`.`id` = `time_log`.`organizationId`)) " +
			'WHERE `project`.`deletedAt` IS NULL AND `time_log`.`ratesStored` IS NULL',
		'UPDATE `time_log` INNER JOIN `organization_project` `project` ON `project`.`id` = `time_log`.`projectId` ' +
			'INNER JOIN `organization_project_employee` `member` ' +
			'ON `member`.`organizationProjectId` = `time_log`.`projectId` ' +
			'AND `member`.`employeeId` = `time_log`.`employeeId` ' +
			'SET `time_log`.`projectMemberBillRateValue` = `member`.`billRateValue`, ' +
			"`time_log`.`projectMemberBillRateCurrency` = COALESCE(NULLIF(`project`.`currency`, ''), (SELECT `currency` FROM `organization` WHERE `organization`.`id` = `time_log`.`organizationId`)) " +
			`WHERE \`member\`.\`billRateValue\` IS NOT NULL AND \`project\`.\`deletedAt\` IS NULL AND ${CURRENT_MEMBERSHIP_MYSQL} ` +
			'AND `time_log`.`ratesStored` IS NULL',
		'UPDATE `time_log` INNER JOIN `employee` ON `employee`.`id` = `time_log`.`employeeId` ' +
			'SET `time_log`.`billRateValue` = `employee`.`billRateValue`, ' +
			"`time_log`.`billRateCurrency` = COALESCE(NULLIF(`employee`.`billRateCurrency`, ''), (SELECT `currency` FROM `organization` WHERE `organization`.`id` = `time_log`.`organizationId`)), " +
			'`time_log`.`payRateValue` = `employee`.`payRateValue`, ' +
			"`time_log`.`payRateCurrency` = COALESCE(NULLIF(`employee`.`payRateCurrency`, ''), (SELECT `currency` FROM `organization` WHERE `organization`.`id` = `time_log`.`organizationId`)), " +
			'`time_log`.`ratesStored` = 1 ' +
			'WHERE `time_log`.`ratesStored` IS NULL'
	],
	// Correlated sub-queries: an `UPDATE ... FROM` needs SQLite 3.33, older than some embedded builds.
	sqlite: [
		`UPDATE "time_log" SET ` +
			`"projectBillRateValue" = (SELECT "billRateValue" FROM "organization_project" "project" WHERE "project"."id" = "time_log"."projectId" AND "project"."deletedAt" IS NULL), ` +
			`"projectBillRateCurrency" = COALESCE(NULLIF((SELECT "currency" FROM "organization_project" "project" WHERE "project"."id" = "time_log"."projectId" AND "project"."deletedAt" IS NULL), ''), (SELECT "currency" FROM "organization" WHERE "organization"."id" = "time_log"."organizationId")) ` +
			`WHERE "time_log"."projectId" IS NOT NULL AND "time_log"."ratesStored" IS NULL`,
		`UPDATE "time_log" SET "projectMemberBillRateValue" = (SELECT "member"."billRateValue" ` +
			`FROM "organization_project_employee" "member" ` +
			`WHERE "member"."organizationProjectId" = "time_log"."projectId" ` +
			`AND "member"."employeeId" = "time_log"."employeeId" AND "member"."billRateValue" IS NOT NULL ` +
			`AND ${CURRENT_MEMBERSHIP_SQLITE} LIMIT 1), ` +
			`"projectMemberBillRateCurrency" = COALESCE(NULLIF((SELECT "currency" FROM "organization_project" "project" WHERE "project"."id" = "time_log"."projectId"), ''), (SELECT "currency" FROM "organization" WHERE "organization"."id" = "time_log"."organizationId")) ` +
			`WHERE "time_log"."projectId" IS NOT NULL AND "time_log"."ratesStored" IS NULL ` +
			`AND EXISTS (SELECT 1 FROM "organization_project" "project" WHERE "project"."id" = "time_log"."projectId" AND "project"."deletedAt" IS NULL)`,
		`UPDATE "time_log" SET ` +
			`"billRateValue" = (SELECT "billRateValue" FROM "employee" WHERE "employee"."id" = "time_log"."employeeId"), ` +
			`"billRateCurrency" = COALESCE(NULLIF((SELECT "billRateCurrency" FROM "employee" WHERE "employee"."id" = "time_log"."employeeId"), ''), (SELECT "currency" FROM "organization" WHERE "organization"."id" = "time_log"."organizationId")), ` +
			`"payRateValue" = (SELECT "payRateValue" FROM "employee" WHERE "employee"."id" = "time_log"."employeeId"), ` +
			`"payRateCurrency" = COALESCE(NULLIF((SELECT "payRateCurrency" FROM "employee" WHERE "employee"."id" = "time_log"."employeeId"), ''), (SELECT "currency" FROM "organization" WHERE "organization"."id" = "time_log"."organizationId")), ` +
			`"ratesStored" = 1 ` +
			`WHERE EXISTS (SELECT 1 FROM "employee" WHERE "employee"."id" = "time_log"."employeeId") ` +
			`AND "time_log"."ratesStored" IS NULL`
	]
};

/**
 * Runs `work` while holding a MySQL named lock (`GET_LOCK`), so that two processes running the same migration
 * concurrently run its checks, DDL and fill one after the other. The lock is session-level and released in `finally`.
 */
async function withMysqlNamedLock(
	queryRunner: QueryRunner,
	lockName: string,
	work: () => Promise<void>
): Promise<void> {
	const [row] = await queryRunner.query(`SELECT GET_LOCK(?, 120) AS \`acquired\``, [lockName]);
	if (Number(row?.acquired) !== 1) {
		throw new Error(`Could not acquire the MySQL migration lock ${lockName}.`);
	}
	try {
		await work();
	} finally {
		await queryRunner.query(`SELECT RELEASE_LOCK(?)`, [lockName]);
	}
}

/** Quotes an identifier the way the dialect expects: backticks on MySQL, double quotes elsewhere. */
function quoted(dialect: Dialect, identifier: string): string {
	if (dialect === 'mysql') {
		return `\`${identifier}\``;
	}
	return `"${identifier}"`;
}
