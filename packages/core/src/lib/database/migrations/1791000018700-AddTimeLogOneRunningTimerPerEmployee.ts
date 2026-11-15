import { MigrationInterface, QueryRunner } from 'typeorm';
import * as chalk from 'chalk';
import { DatabaseTypeEnum } from '@gauzy/config';

/** The key that lets one timer run of an employee go at a time. */
const INDEX = 'UQ_time_log_running_timer_employee';

/** MySQL's stand-in for the predicate: the employee while the row is a running timer run, NULL otherwise. */
const MYSQL_KEY = 'runningTimerKey';

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
 * - a run that had a heartbeat (its `stoppedAt` past its start), or a run of a client that posts one each minute (Ever
 *   Teams, mobile), ends at its last heartbeat, never after the next run's start;
 * - any other run (the web timer, the API clients, which send no heartbeat) ends where the next run starts, as an
 *   explicit stop then would;
 * - never before its own start.
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
		await queryRunner.query(this.stopOlderRunsStatement('GREATEST', 'LEAST'));
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
		await queryRunner.query(this.stopOlderRunsStatement('MAX', 'MIN'));
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
		// MySQL refuses a subquery on the table an UPDATE writes: the next starts are read into a derived table first
		// The end is set before the run stops: MySQL reads each assignment after those before it
		const end = this.replacedRunEnd('`run`', '`next`.`startedAt`', 'GREATEST', 'LEAST', '`');
		await queryRunner.query(
			`UPDATE \`time_log\` AS \`run\` JOIN (${this.nextRunStarts('`', '1')}) AS \`next\` ON \`next\`.\`id\` = \`run\`.\`id\` SET \`run\`.\`stoppedAt\` = ${end}, \`run\`.\`isRunning\` = 0`
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
	 * Stops every running timer run of an employee but their latest, where the start that should have replaced it would
	 * have ended it (see the class comment), on Postgres and SQLite.
	 *
	 * @param larger The dialect's larger of two values: GREATEST on Postgres, MAX on SQLite.
	 * @param smaller The dialect's smaller of two values: LEAST on Postgres, MIN on SQLite.
	 */
	private stopOlderRunsStatement(larger: string, smaller: string): string {
		return `UPDATE "time_log" SET "isRunning" = false, "stoppedAt" = ${this.replacedRunEnd('"time_log"', '"next"."startedAt"', larger, smaller, '"')} FROM (${this.nextRunStarts('"', 'true')}) AS "next" WHERE "time_log"."id" = "next"."id"`;
	}

	/**
	 * Each older running timer run of an employee, with the start of the run that started next after it among the
	 * employee's running timer runs.
	 *
	 * @param q The dialect's identifier quote.
	 * @param running The dialect's literal for a running row.
	 */
	private nextRunStarts(q: string, running: string): string {
		const timerRun = (alias: string) =>
			`${q}${alias}${q}.${q}isRunning${q} = ${running} AND ${q}${alias}${q}.${q}deletedAt${q} IS NULL AND ${q}${alias}${q}.${q}source${q} <> 'DESKTOP'`;
		const col = (alias: string, name: string) => `${q}${alias}${q}.${q}${name}${q}`;
		return `SELECT ${col('older', 'id')} AS ${q}id${q}, MIN(${col('newer', 'startedAt')}) AS ${q}startedAt${q} FROM ${q}time_log${q} AS ${q}older${q} JOIN ${q}time_log${q} AS ${q}newer${q} ON ${col('newer', 'employeeId')} = ${col('older', 'employeeId')} AND ${timerRun('newer')} AND (${col('newer', 'startedAt')} > ${col('older', 'startedAt')} OR (${col('newer', 'startedAt')} = ${col('older', 'startedAt')} AND ${col('newer', 'id')} > ${col('older', 'id')})) WHERE ${timerRun('older')} GROUP BY ${col('older', 'id')}`;
	}

	/**
	 * Where a start replacing a run ends it (`TimerService.replacedRunEnd`), from its columns and the next run's start.
	 *
	 * @param run The run's quoted table or alias.
	 * @param nextStart The next run's start.
	 * @param larger The dialect's larger of two values.
	 * @param smaller The dialect's smaller of two values.
	 * @param q The dialect's identifier quote.
	 */
	private replacedRunEnd(run: string, nextStart: string, larger: string, smaller: string, q: string): string {
		const col = (name: string) => `${run}.${q}${name}${q}`;
		const lastHeartbeat = `COALESCE(${col('stoppedAt')}, ${col('startedAt')})`;
		const endsAtLastHeartbeat = `${lastHeartbeat} > ${col('startedAt')} OR ${col('source')} IN ('TEAMS', 'MOBILE')`;
		return `${larger}(${col('startedAt')}, CASE WHEN ${col('logType')} = 'BREAK' THEN ${nextStart} WHEN ${endsAtLastHeartbeat} THEN ${smaller}(${lastHeartbeat}, ${nextStart}) ELSE ${nextStart} END)`;
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
