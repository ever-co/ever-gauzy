import { MigrationInterface, QueryRunner } from 'typeorm';
import * as chalk from 'chalk';
import { DatabaseTypeEnum } from '@gauzy/config';

/** The key that lets one timer run of an employee go at a time. */
const INDEX = 'UQ_time_log_running_timer_employee';

/** MySQL's stand-in for the predicate: the employee while the row is a running timer run, NULL otherwise. */
const MYSQL_KEY = 'runningTimerKey';

/** How a dialect writes the expressions the stop of the older runs needs. */
interface Dialect {
	/** The identifier quote. */
	q: string;
	/** A running row's `isRunning`. */
	running: string;
	/** A stopped row's `isRunning`. */
	stopped: string;
	/** The larger of two values. */
	larger: string;
	/** The smaller of two values. */
	smaller: string;
	/** Where a time slot ends: its start plus its duration, in seconds, as the dialect stores a timestamp. */
	slotEnd: (slot: string) => string;
}

const POSTGRES: Dialect = {
	q: '"',
	running: 'true',
	stopped: 'false',
	larger: 'GREATEST',
	smaller: 'LEAST',
	slotEnd: (slot) => `${slot}."startedAt" + ${slot}."duration" * interval '1 second'`
};

const SQLITE: Dialect = {
	q: '"',
	running: 'true',
	stopped: 'false',
	larger: 'MAX',
	smaller: 'MIN',
	// The text TypeORM stores a date as on SQLite, with its milliseconds
	slotEnd: (slot) => `strftime('%Y-%m-%d %H:%M:%f', ${slot}."startedAt", '+' || ${slot}."duration" || ' seconds')`
};

const MYSQL: Dialect = {
	q: '`',
	running: '1',
	stopped: '0',
	larger: 'GREATEST',
	smaller: 'LEAST',
	slotEnd: (slot) => `DATE_ADD(${slot}.\`startedAt\`, INTERVAL ${slot}.\`duration\` SECOND)`
};

/**
 * One running timer run per employee, in the database (ever-co/ever-gauzy#11826).
 *
 * ## What the key covers
 *
 * A row of a timer client (any source but the desktop's) that is running and not deleted. The desktop is left out on
 * purpose: it stores the time it uploads (`POST /timesheet/time-log`, source `DESKTOP`, no `isRunning`) as running by
 * design (`isRunningTimeLogInput`), until the employee's next start or stop closes it, so one employee may hold several
 * running desktop rows, and a key over them would refuse the desktop's offline uploads. Those rows are the ones
 * `TRACKER_SOURCES` names in `tracker-source.ts`. A start of any client still closes them, and its run is written with
 * the check that no timer run is going (`TimeLogCreateHandler`, `isOnlyRun`), which this key backs up for writes that
 * pass beside that check.
 *
 * Postgres and SQLite index `employeeId` under the predicate. MySQL has no filtered index: a virtual generated column
 * holds the employee while the row is a running timer run and NULL otherwise, and a NULL key part exempts the row.
 * Virtual, not stored: `time_log` is the largest table, and a stored column would rewrite every row.
 *
 * ## Rows that already break it
 *
 * Several running timer runs of one employee were left by the races the issue describes (a stop on one API process
 * closing nothing while a start on another wrote its run, two starts at once). Before the key is built, each employee
 * keeps their latest running timer run (by start, then id) running. Every older one is stopped where the start that
 * should have replaced it would have ended it (`TimerService.replacedRunEnd`), the next run being the one that started
 * next after it:
 *
 * - a break ends where the next run starts;
 * - a run that had a heartbeat (its `stoppedAt` past its start, or time slots of its own), or a run of a client that
 *   posts one each minute (Ever Teams, mobile), ends at its last heartbeat (the later of its `stoppedAt` and the end of
 *   its last time slot), never after the next run's start;
 * - any other run (the web timer, the API clients, which send no heartbeat) ends where the next run starts, as an
 *   explicit stop then would;
 * - never before its own start.
 *
 * A running timer row without a start is no run a client can read, stop or report: it is stopped first, its `stoppedAt`
 * left as stored. The rows with a start are then ranked as above.
 *
 * Nothing is deleted and no time counts twice. The rows stay as stored otherwise: the stop does not create the slots of
 * its range, which a stop through the API gives a web timer run, nor cut the logs it overlaps. A stop or start of the
 * employee only ever answered for their latest run.
 *
 * ## Down
 *
 * Drops the key (and MySQL's column). The runs stopped by `up` stay stopped.
 */
export class AddTimeLogOneRunningTimerPerEmployee1791000018700 implements MigrationInterface {
	name = 'AddTimeLogOneRunningTimerPerEmployee1791000018700';

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
				await this.sqliteDownQueryRunner(queryRunner);
				break;
			case DatabaseTypeEnum.postgres:
				await this.postgresDownQueryRunner(queryRunner);
				break;
			case DatabaseTypeEnum.mysql:
				await this.mysqlDownQueryRunner(queryRunner);
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
		await queryRunner.query(this.stopRunsWithoutStartStatement(POSTGRES));
		await queryRunner.query(this.stopOlderRunsStatement(POSTGRES));
		await queryRunner.query(
			`CREATE UNIQUE INDEX IF NOT EXISTS "${INDEX}" ON "time_log" ("employeeId") WHERE "isRunning" = true AND "deletedAt" IS NULL AND "source" <> 'DESKTOP'`
		);
	}

	/**
	 * PostgresDB Down Migration
	 *
	 * @param queryRunner
	 */
	public async postgresDownQueryRunner(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`DROP INDEX IF EXISTS "${INDEX}"`);
	}

	/**
	 * SqliteDB and BetterSQlite3DB Up Migration
	 *
	 * @param queryRunner
	 */
	public async sqliteUpQueryRunner(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(this.stopRunsWithoutStartStatement(SQLITE));
		await queryRunner.query(this.stopOlderRunsStatement(SQLITE));
		await queryRunner.query(
			`CREATE UNIQUE INDEX IF NOT EXISTS "${INDEX}" ON "time_log" ("employeeId") WHERE "isRunning" = true AND "deletedAt" IS NULL AND "source" <> 'DESKTOP'`
		);
	}

	/**
	 * SqliteDB and BetterSQlite3DB Down Migration
	 *
	 * @param queryRunner
	 */
	public async sqliteDownQueryRunner(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`DROP INDEX IF EXISTS "${INDEX}"`);
	}

	/**
	 * MySQL Up Migration
	 *
	 * @param queryRunner
	 */
	public async mysqlUpQueryRunner(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(this.stopRunsWithoutStartStatement(MYSQL));
		// MySQL refuses a subquery on the table an UPDATE writes: the next starts are read into a derived table first.
		// The end is set before the run stops: MySQL reads each assignment after those before it
		const end = this.replacedRunEnd('`run`', '`next`', MYSQL);
		await queryRunner.query(
			`UPDATE \`time_log\` AS \`run\` JOIN (${this.nextRunStarts(MYSQL)}) AS \`next\` ON \`next\`.\`id\` = \`run\`.\`id\` SET \`run\`.\`stoppedAt\` = ${end}, \`run\`.\`isRunning\` = 0`
		);
		if (!(await queryRunner.hasColumn('time_log', MYSQL_KEY))) {
			await queryRunner.query(
				`ALTER TABLE \`time_log\` ADD \`${MYSQL_KEY}\` varchar(36) GENERATED ALWAYS AS (IF(\`isRunning\` = 1 AND \`deletedAt\` IS NULL AND \`source\` <> 'DESKTOP', \`employeeId\`, NULL)) VIRTUAL`
			);
		}
		if (!(await this.mysqlHasIndex(queryRunner))) {
			await queryRunner.query(`CREATE UNIQUE INDEX \`${INDEX}\` ON \`time_log\` (\`${MYSQL_KEY}\`)`);
		}
	}

	/**
	 * MySQL Down Migration
	 *
	 * @param queryRunner
	 */
	public async mysqlDownQueryRunner(queryRunner: QueryRunner): Promise<void> {
		if (await this.mysqlHasIndex(queryRunner)) {
			await queryRunner.query(`DROP INDEX \`${INDEX}\` ON \`time_log\``);
		}
		if (await queryRunner.hasColumn('time_log', MYSQL_KEY)) {
			await queryRunner.query(`ALTER TABLE \`time_log\` DROP COLUMN \`${MYSQL_KEY}\``);
		}
	}

	/**
	 * Stops every running timer row without a start: no client can read, stop or report it (see the class comment).
	 *
	 * @param dialect The dialect's expressions.
	 */
	private stopRunsWithoutStartStatement({ q, running, stopped }: Dialect): string {
		return `UPDATE ${q}time_log${q} SET ${q}isRunning${q} = ${stopped} WHERE ${q}isRunning${q} = ${running} AND ${q}deletedAt${q} IS NULL AND ${q}source${q} <> 'DESKTOP' AND ${q}startedAt${q} IS NULL`;
	}

	/**
	 * Stops every running timer run of an employee but their latest, where the start that should have replaced it would
	 * have ended it (see the class comment), on Postgres and SQLite.
	 *
	 * @param dialect The dialect's expressions.
	 */
	private stopOlderRunsStatement(dialect: Dialect): string {
		const { q, stopped } = dialect;
		const end = this.replacedRunEnd(`${q}time_log${q}`, `${q}next${q}`, dialect);
		return `UPDATE ${q}time_log${q} SET ${q}isRunning${q} = ${stopped}, ${q}stoppedAt${q} = ${end} FROM (${this.nextRunStarts(dialect)}) AS ${q}next${q} WHERE ${q}time_log${q}.${q}id${q} = ${q}next${q}.${q}id${q}`;
	}

	/**
	 * Each older running timer run of an employee, with the start of the run that started next after it among the
	 * employee's running timer runs (`startedAt`), and the end of its last time slot (`lastSlotEnd`, none without).
	 *
	 * @param dialect The dialect's expressions.
	 */
	private nextRunStarts({ q, running, slotEnd }: Dialect): string {
		const col = (alias: string, name: string) => `${q}${alias}${q}.${q}${name}${q}`;
		const timerRun = (alias: string) =>
			`${col(alias, 'isRunning')} = ${running} AND ${col(alias, 'deletedAt')} IS NULL AND ${col(alias, 'source')} <> 'DESKTOP' AND ${col(alias, 'startedAt')} IS NOT NULL`;
		const startsAfter = `(${col('newer', 'startedAt')} > ${col('older', 'startedAt')} OR (${col('newer', 'startedAt')} = ${col('older', 'startedAt')} AND ${col('newer', 'id')} > ${col('older', 'id')}))`;
		const lastSlotEnd = `(SELECT MAX(${slotEnd(`${q}slot${q}`)}) FROM ${q}time_slot_time_logs${q} AS ${q}link${q} JOIN ${q}time_slot${q} AS ${q}slot${q} ON ${col('slot', 'id')} = ${col('link', 'timeSlotId')} WHERE ${col('link', 'timeLogId')} = ${col('older', 'id')})`;
		return `SELECT ${col('older', 'id')} AS ${q}id${q}, MIN(${col('newer', 'startedAt')}) AS ${q}startedAt${q}, ${lastSlotEnd} AS ${q}lastSlotEnd${q} FROM ${q}time_log${q} AS ${q}older${q} JOIN ${q}time_log${q} AS ${q}newer${q} ON ${col('newer', 'employeeId')} = ${col('older', 'employeeId')} AND ${timerRun('newer')} AND ${startsAfter} WHERE ${timerRun('older')} GROUP BY ${col('older', 'id')}`;
	}

	/**
	 * Where a start replacing a run ends it (`TimerService.replacedRunEnd`), from its columns, the next run's start and
	 * the end of its last time slot.
	 *
	 * @param run The run's quoted table or alias.
	 * @param next The quoted alias of `nextRunStarts`.
	 * @param dialect The dialect's expressions.
	 */
	private replacedRunEnd(run: string, next: string, { q, larger, smaller }: Dialect): string {
		const col = (alias: string, name: string) => `${alias}.${q}${name}${q}`;
		const nextStart = col(next, 'startedAt');
		const lastSlotEnd = col(next, 'lastSlotEnd');
		const stored = `COALESCE(${col(run, 'stoppedAt')}, ${col(run, 'startedAt')})`;
		// The later of its stored end and its last slot's: MySQL's GREATEST and SQLite's MAX answer NULL beside a NULL
		const lastHeartbeat = `${larger}(${stored}, COALESCE(${lastSlotEnd}, ${stored}))`;
		const endsAtLastHeartbeat = `${lastHeartbeat} > ${col(run, 'startedAt')} OR ${lastSlotEnd} IS NOT NULL OR ${col(run, 'source')} IN ('TEAMS', 'MOBILE')`;
		return `${larger}(${col(run, 'startedAt')}, CASE WHEN ${col(run, 'logType')} = 'BREAK' THEN ${nextStart} WHEN ${endsAtLastHeartbeat} THEN ${smaller}(${lastHeartbeat}, ${nextStart}) ELSE ${nextStart} END)`;
	}

	/** Whether MySQL holds the key on `time_log`. */
	private async mysqlHasIndex(queryRunner: QueryRunner): Promise<boolean> {
		const rows = await queryRunner.query(
			`SELECT 1 FROM information_schema.statistics WHERE table_schema = DATABASE() AND table_name = 'time_log' AND index_name = ?`,
			[INDEX]
		);
		return rows.length > 0;
	}
}
