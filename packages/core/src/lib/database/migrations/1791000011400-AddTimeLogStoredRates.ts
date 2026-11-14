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
 * price. The fill gives rates only to the logs that store none yet (`ratesStored` null), and marks each log in the
 * statement that fills it: a run cut short (MySQL has no transactional DDL) is completed by the next one, and running
 * `up` again, or after SQLite's `down`, which keeps the columns, never overwrites a rate a log already stores.
 *
 * The fill runs in batches of logs, in the order of their ids, each batch one statement that commits on its own
 * (`transaction = false`; Gauzy runs migrations in `each` mode): no statement rewrites or locks the whole table, and
 * an API that is stopped while it boots on a large `time_log` (a startup probe) keeps the batches it wrote, the next
 * boot filling the rest. Inside a transaction block (a rollback, or the `all` transaction mode, which both wrap the
 * migration whatever it declares) the batches run in that transaction.
 *
 * Two API processes that boot at the same time against one database run it one after the other: on Postgres the
 * migration-run lock serialises the whole run (and a transaction-scoped advisory lock this migration, inside a
 * transaction block), on MySQL a named lock.
 *
 * `down` drops the columns on Postgres and MySQL. SQLite keeps them, as every additive column of this platform is
 * kept on the embedded dialect; a kept nullable column is invisible to a build without the entity members.
 */
export class AddTimeLogStoredRates1791000011400 implements MigrationInterface {
	name = 'AddTimeLogStoredRates1791000011400';

	/** Each batch of the fill commits on its own (see above). */
	transaction = false;

	/** How many logs one statement of the fill writes at most. */
	fillBatchSize = 5000;

	/** Advisory lock key that serialises concurrent runs of this migration on Postgres. */
	private readonly advisoryLockKey = 1791000011400;

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
		await this.fill(queryRunner, dialect);
	}

	/**
	 * Fills the logs that store no rate yet, batch after batch in the order of their ids: each batch is the logs up to
	 * the id `fillBatchSize` logs further, and the last one every log after it. A batch whose logs are all filled
	 * already (a run that resumes) writes nothing.
	 */
	private async fill(queryRunner: QueryRunner, dialect: Dialect): Promise<void> {
		let after: string | null = null;
		for (;;) {
			const upTo = await this.batchEnd(queryRunner, dialect, after);
			const range = idRange(dialect, after, upTo);
			await queryRunner.query(FILL[dialect](range.condition), range.parameters);
			const isLastBatch = upTo === null;
			if (isLastBatch) {
				return;
			}
			after = upTo;
		}
	}

	/**
	 * The id of the last log of the batch that starts after `after` (from the first log when null), or null when fewer
	 * than `fillBatchSize` logs are left: that batch is the last.
	 */
	private async batchEnd(queryRunner: QueryRunner, dialect: Dialect, after: string | null): Promise<string | null> {
		const id = quoted(dialect, 'id');
		const parameters: string[] = [];
		let where = '';
		if (after !== null) {
			parameters.push(after);
			where = ` WHERE ${id} > ${placeholder(dialect, 1)}`;
		}
		const offset = Math.max(Math.floor(this.fillBatchSize), 1) - 1;
		const rows = await queryRunner.query(
			`SELECT ${id} AS ${quoted(dialect, 'batchEnd')} FROM ${quoted(dialect, TABLE)}${where} ` +
				`ORDER BY ${id} LIMIT 1 OFFSET ${offset}`,
			parameters
		);
		const end = Array.isArray(rows) ? rows[0]?.batchEnd : undefined;
		if (end === undefined || end === null) {
			return null;
		}
		return String(end);
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

/** The currency of the organization of the log being filled, on SQLite. */
const SQLITE_ORGANIZATION_CURRENCY = `(SELECT "currency" FROM "organization" WHERE "organization"."id" = "time_log"."organizationId")`;

/** The project of the log being filled, while it is live, on SQLite. */
const SQLITE_LIVE_PROJECT = `"organization_project" "project" WHERE "project"."id" = "time_log"."projectId" AND "project"."deletedAt" IS NULL`;

/** The member's client rate on the live project of the log being filled, from a current membership, on SQLite. */
const SQLITE_MEMBER_RATE =
	`SELECT "member"."billRateValue" FROM "organization_project_employee" "member" ` +
	`WHERE "member"."organizationProjectId" = "time_log"."projectId" ` +
	`AND "member"."employeeId" = "time_log"."employeeId" AND "member"."billRateValue" IS NOT NULL ` +
	`AND ${CURRENT_MEMBERSHIP_SQLITE} AND EXISTS (SELECT 1 FROM ${SQLITE_LIVE_PROJECT}) LIMIT 1`;

/** The id of the log a fill statement writes, as each dialect's statement names it. */
const LOG_ID: Readonly<Record<Dialect, string>> = {
	postgres: `"log"."id"`,
	mysql: '`time_log`.`id`',
	sqlite: `"time_log"."id"`
};

/** The n-th (1-based) parameter of a statement: `$n` on Postgres, `?` elsewhere. */
function placeholder(dialect: Dialect, n: number): string {
	if (dialect === 'postgres') {
		return `$${n}`;
	}
	return '?';
}

/**
 * The logs of one batch of the fill: those after `after` (from the first when null) and up to `upTo` (every one
 * left when null), as a condition the fill statement adds to its own, and its parameters.
 */
function idRange(
	dialect: Dialect,
	after: string | null,
	upTo: string | null
): { condition: string; parameters: string[] } {
	const parameters: string[] = [];
	let condition = '';
	if (after !== null) {
		parameters.push(after);
		condition += ` AND ${LOG_ID[dialect]} > ${placeholder(dialect, parameters.length)}`;
	}
	if (upTo !== null) {
		parameters.push(upTo);
		condition += ` AND ${LOG_ID[dialect]} <= ${placeholder(dialect, parameters.length)}`;
	}
	return { condition, parameters };
}

/**
 * Today's rates on the logs of a batch that store none yet, in one statement that also marks them: each log is written
 * once (a table of a million logs is rewritten once, not three times), and a run cut short leaves each log either
 * filled and marked or untouched, which the next run fills. A marked log is never written again.
 *
 * The client rates come from a live project, the member's from a current membership of that project. Each stored
 * currency is the rate's own, else the organization's (an empty one counts as none), and a client rate there is none of
 * stores no currency.
 *
 * Each statement takes the batch's id range (see `idRange`), empty for a single pass.
 */
const FILL: Readonly<Record<Dialect, (range: string) => string>> = {
	postgres: (range) =>
		`UPDATE "time_log" SET "billRateValue" = "rates"."billRateValue", "billRateCurrency" = "rates"."billRateCurrency", ` +
			`"payRateValue" = "rates"."payRateValue", "payRateCurrency" = "rates"."payRateCurrency", ` +
			`"projectBillRateValue" = "rates"."projectBillRateValue", ` +
			`"projectBillRateCurrency" = "rates"."projectBillRateCurrency", ` +
			`"projectMemberBillRateValue" = "rates"."projectMemberBillRateValue", ` +
			`"projectMemberBillRateCurrency" = "rates"."projectMemberBillRateCurrency", "ratesStored" = true ` +
			`FROM (SELECT "log"."id", "employee"."billRateValue", ` +
			`COALESCE(NULLIF("employee"."billRateCurrency", ''), "organization"."currency") AS "billRateCurrency", ` +
			`"employee"."payRateValue", ` +
			`COALESCE(NULLIF("employee"."payRateCurrency", ''), "organization"."currency") AS "payRateCurrency", ` +
			`"project"."billRateValue" AS "projectBillRateValue", ` +
			`CASE WHEN "project"."id" IS NOT NULL THEN COALESCE(NULLIF("project"."currency", ''), "organization"."currency") END ` +
			`AS "projectBillRateCurrency", ` +
			`"member"."billRateValue" AS "projectMemberBillRateValue", ` +
			`CASE WHEN "member"."billRateValue" IS NOT NULL THEN COALESCE(NULLIF("project"."currency", ''), "organization"."currency") END ` +
			`AS "projectMemberBillRateCurrency" ` +
			`FROM "time_log" "log" INNER JOIN "employee" ON "employee"."id" = "log"."employeeId" ` +
			`LEFT JOIN "organization" ON "organization"."id" = "log"."organizationId" ` +
			`LEFT JOIN "organization_project" "project" ON "project"."id" = "log"."projectId" AND "project"."deletedAt" IS NULL ` +
			`LEFT JOIN LATERAL (SELECT "member"."billRateValue" FROM "organization_project_employee" "member" ` +
			`WHERE "member"."organizationProjectId" = "project"."id" AND "member"."employeeId" = "log"."employeeId" ` +
			`AND "member"."billRateValue" IS NOT NULL AND ${CURRENT_MEMBERSHIP_PG} LIMIT 1) "member" ON true ` +
			`WHERE "log"."ratesStored" IS NULL${range}) "rates" ` +
			`WHERE "time_log"."id" = "rates"."id"`,
	mysql: (range) =>
		'UPDATE `time_log` INNER JOIN `employee` ON `employee`.`id` = `time_log`.`employeeId` ' +
			'LEFT JOIN `organization` ON `organization`.`id` = `time_log`.`organizationId` ' +
			'LEFT JOIN `organization_project` `project` ' +
			'ON `project`.`id` = `time_log`.`projectId` AND `project`.`deletedAt` IS NULL ' +
			'LEFT JOIN `organization_project_employee` `member` ON `member`.`organizationProjectId` = `project`.`id` ' +
			'AND `member`.`employeeId` = `time_log`.`employeeId` AND `member`.`billRateValue` IS NOT NULL ' +
			`AND ${CURRENT_MEMBERSHIP_MYSQL} ` +
			'SET `time_log`.`billRateValue` = `employee`.`billRateValue`, ' +
			"`time_log`.`billRateCurrency` = COALESCE(NULLIF(`employee`.`billRateCurrency`, ''), `organization`.`currency`), " +
			'`time_log`.`payRateValue` = `employee`.`payRateValue`, ' +
			"`time_log`.`payRateCurrency` = COALESCE(NULLIF(`employee`.`payRateCurrency`, ''), `organization`.`currency`), " +
			'`time_log`.`projectBillRateValue` = `project`.`billRateValue`, ' +
			'`time_log`.`projectBillRateCurrency` = CASE WHEN `project`.`id` IS NOT NULL ' +
			"THEN COALESCE(NULLIF(`project`.`currency`, ''), `organization`.`currency`) END, " +
			'`time_log`.`projectMemberBillRateValue` = `member`.`billRateValue`, ' +
			'`time_log`.`projectMemberBillRateCurrency` = CASE WHEN `member`.`billRateValue` IS NOT NULL ' +
			"THEN COALESCE(NULLIF(`project`.`currency`, ''), `organization`.`currency`) END, " +
			'`time_log`.`ratesStored` = 1 ' +
			'WHERE `time_log`.`ratesStored` IS NULL' +
			range,
	// Correlated sub-queries: an `UPDATE ... FROM` needs SQLite 3.33, older than some embedded builds.
	sqlite: (range) =>
		`UPDATE "time_log" SET ` +
			`"billRateValue" = (SELECT "billRateValue" FROM "employee" WHERE "employee"."id" = "time_log"."employeeId"), ` +
			`"billRateCurrency" = COALESCE(NULLIF((SELECT "billRateCurrency" FROM "employee" WHERE "employee"."id" = "time_log"."employeeId"), ''), ${SQLITE_ORGANIZATION_CURRENCY}), ` +
			`"payRateValue" = (SELECT "payRateValue" FROM "employee" WHERE "employee"."id" = "time_log"."employeeId"), ` +
			`"payRateCurrency" = COALESCE(NULLIF((SELECT "payRateCurrency" FROM "employee" WHERE "employee"."id" = "time_log"."employeeId"), ''), ${SQLITE_ORGANIZATION_CURRENCY}), ` +
			`"projectBillRateValue" = (SELECT "billRateValue" FROM ${SQLITE_LIVE_PROJECT}), ` +
			`"projectBillRateCurrency" = CASE WHEN EXISTS (SELECT 1 FROM ${SQLITE_LIVE_PROJECT}) ` +
			`THEN COALESCE(NULLIF((SELECT "currency" FROM ${SQLITE_LIVE_PROJECT}), ''), ${SQLITE_ORGANIZATION_CURRENCY}) END, ` +
			`"projectMemberBillRateValue" = (${SQLITE_MEMBER_RATE}), ` +
			`"projectMemberBillRateCurrency" = CASE WHEN (${SQLITE_MEMBER_RATE}) IS NOT NULL ` +
			`THEN COALESCE(NULLIF((SELECT "currency" FROM ${SQLITE_LIVE_PROJECT}), ''), ${SQLITE_ORGANIZATION_CURRENCY}) END, ` +
			`"ratesStored" = 1 ` +
			`WHERE EXISTS (SELECT 1 FROM "employee" WHERE "employee"."id" = "time_log"."employeeId") ` +
			`AND "time_log"."ratesStored" IS NULL${range}`
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
