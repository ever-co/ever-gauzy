import { MigrationInterface, QueryRunner } from 'typeorm';
import * as chalk from 'chalk';
import { DatabaseTypeEnum } from '@gauzy/config';

/**
 * Creates `employee_timer_turn`, the turn every API process shares for an employee's timer (ever-co/ever-gauzy#11826).
 *
 * A start and a stop of one employee's timer took turns within one API process only: a stop reaching one process while
 * a start reached another closed the new run at once, and two starts could both create a run. A start or stop now
 * takes the employee's turn in this table first. A row is a lease: the employee, the holder that took it, and when it
 * ends (`endsAt`, milliseconds since the epoch, so no time zone of any process or database is involved). Taking it is
 * an insert the primary key lets through once; giving it back deletes the row; a row whose end has passed is deleted
 * by the next start or stop, so a process that stops or hangs holds an employee's timer for the lease's length at
 * most.
 *
 * The rows live for the length of a start or a stop, carry nothing of a tenant but the employee's id, and are read and
 * written by raw statements only, so no entity maps the table. There is no foreign key: an employee deleted while a
 * row names them leaves a row that ends on its own.
 *
 * Down drops the table; the timer then takes turns within each process only, as before.
 */
export class CreateEmployeeTimerTurnTable1791000012100 implements MigrationInterface {
	name = 'CreateEmployeeTimerTurnTable1791000012100';

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
	public async postgresUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(
			`CREATE TABLE IF NOT EXISTS "employee_timer_turn" ("employeeId" uuid NOT NULL, "holder" uuid NOT NULL, "endsAt" bigint NOT NULL, CONSTRAINT "PK_employee_timer_turn" PRIMARY KEY ("employeeId"))`
		);
	}

	/**
	 * PostgresDB Down Migration
	 *
	 * @param queryRunner
	 */
	public async postgresDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(`DROP TABLE IF EXISTS "employee_timer_turn"`);
	}

	/**
	 * SqliteDB and BetterSQlite3DB Up Migration
	 *
	 * @param queryRunner
	 */
	public async sqliteUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(
			`CREATE TABLE IF NOT EXISTS "employee_timer_turn" ("employeeId" varchar PRIMARY KEY NOT NULL, "holder" varchar NOT NULL, "endsAt" bigint NOT NULL)`
		);
	}

	/**
	 * SqliteDB and BetterSQlite3DB Down Migration
	 *
	 * @param queryRunner
	 */
	public async sqliteDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(`DROP TABLE IF EXISTS "employee_timer_turn"`);
	}

	/**
	 * MySQL Up Migration
	 *
	 * @param queryRunner
	 */
	public async mysqlUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(
			`CREATE TABLE IF NOT EXISTS \`employee_timer_turn\` (\`employeeId\` varchar(36) NOT NULL, \`holder\` varchar(36) NOT NULL, \`endsAt\` bigint NOT NULL, PRIMARY KEY (\`employeeId\`)) ENGINE=InnoDB`
		);
	}

	/**
	 * MySQL Down Migration
	 *
	 * @param queryRunner
	 */
	public async mysqlDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(`DROP TABLE IF EXISTS \`employee_timer_turn\``);
	}
}
