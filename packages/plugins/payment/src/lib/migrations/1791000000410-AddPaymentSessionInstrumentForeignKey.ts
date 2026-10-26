import { MigrationInterface, QueryRunner } from 'typeorm';
import * as chalk from 'chalk';
import { DatabaseTypeEnum } from '@gauzy/config';

/**
 * Adds the reference from an off-session attempt to the instrument it charges.
 *
 * ## Why it was missing
 *
 * `payment_session.paymentMethodTokenId` was created by `1791000000280-CreatePaymentTables` as an
 * indexed column **without** its constraint, which is this programme's convention for a reference onto
 * a table another set creates: the target is a kernel table, so the constraint belongs to a migration
 * that runs after it. `1791000000290-AddPaymentDomainForeignKeys` then added the constraints this
 * package owns on the core `payment` row and the two provider references on the instrument tables — and
 * this one was left out. The column works, the service checks the instrument before it writes, and the
 * database would happily record an attempt against an instrument row that no longer exists.
 *
 * ## What it does
 *
 * One constraint, `ON DELETE SET NULL`, which is the action the specification states: a saved
 * instrument that is removed leaves the attempt that used it readable, with its instrument released
 * rather than its history deleted. The attempt's own money, status and provider reference are what an
 * audit reads; the instrument is a reference it once pointed at.
 *
 * ## Dialects
 *
 * PostgreSQL and MySQL add it, probed with `hasTable` + `hasColumn` + a constraint lookup so a re-run
 * and an installation that already carries it are both no-ops. SQLite cannot add a constraint to an
 * existing table, so that branch is a documented no-op — and on SQLite a fresh installation does not
 * get it either, because the creating migration's `CREATE TABLE` does not declare it. That is stated
 * rather than hidden: the column is constrained by the service on that dialect, and the reference is a
 * database guarantee only where the database can express it.
 */
export class AddPaymentSessionInstrumentForeignKey1791000000410 implements MigrationInterface {
	name = 'AddPaymentSessionInstrumentForeignKey1791000000410';

	/** The referencing table, the column, the constraint and the table it points at. */
	private static readonly REFERENCE = {
		table: 'payment_session',
		column: 'paymentMethodTokenId',
		constraint: 'FK_payment_session_payment_token',
		target: 'payment_method_token'
	};

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
	 * SqliteDB Up Migration
	 *
	 * SQLite cannot add a constraint to an existing table. The column stays exactly as
	 * `1791000000280-CreatePaymentTables` created it, and the service is what keeps it honest here.
	 *
	 * @param queryRunner
	 */
	public async sqliteUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		console.log(
			chalk.yellow(`${this.name}: SQLite cannot add a constraint to an existing table; nothing to do.`)
		);
	}

	/**
	 * SqliteDB Down Migration
	 *
	 * @param queryRunner
	 */
	public async sqliteDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		// Nothing was added, so there is nothing to drop.
	}

	/**
	 * PostgresDB Up Migration
	 *
	 * @param queryRunner
	 */
	public async postgresUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await this.addConstraint(
			queryRunner,
			`ALTER TABLE "payment_session" ADD CONSTRAINT "FK_payment_session_payment_token" FOREIGN KEY ("paymentMethodTokenId") REFERENCES "payment_method_token"("id") ON DELETE SET NULL ON UPDATE NO ACTION`
		);
	}

	/**
	 * PostgresDB Down Migration
	 *
	 * @param queryRunner
	 */
	public async postgresDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await this.dropConstraint(queryRunner, '"');
	}

	/**
	 * MySQL Up Migration
	 *
	 * @param queryRunner
	 */
	public async mysqlUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await this.addConstraint(
			queryRunner,
			`ALTER TABLE \`payment_session\` ADD CONSTRAINT \`FK_payment_session_payment_token\` FOREIGN KEY (\`paymentMethodTokenId\`) REFERENCES \`payment_method_token\`(\`id\`) ON DELETE SET NULL ON UPDATE NO ACTION`
		);
	}

	/**
	 * MySQL Down Migration
	 *
	 * @param queryRunner
	 */
	public async mysqlDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await this.dropConstraint(queryRunner, '`');
	}

	/**
	 * Adds the constraint when the table, the column, the target and its absence all allow it.
	 *
	 * @param queryRunner The runner the migration is executing on.
	 * @param statement The dialect's own ALTER statement.
	 */
	private async addConstraint(queryRunner: QueryRunner, statement: string): Promise<void> {
		const { table, column, constraint, target } = AddPaymentSessionInstrumentForeignKey1791000000410.REFERENCE;

		if (!(await queryRunner.hasTable(table))) return;
		if (!(await queryRunner.hasColumn(table, column))) return;
		if (!(await queryRunner.hasTable(target))) return;
		if (await this.hasConstraint(queryRunner, constraint)) return;

		await queryRunner.query(statement);
		console.log(chalk.yellow(`${this.name}: added ${constraint} on ${table}("${column}") → ${target}("id").`));
	}

	/**
	 * Drops the constraint when it is present.
	 *
	 * @param queryRunner The runner the migration is executing on.
	 * @param quote The dialect's identifier quote.
	 */
	private async dropConstraint(queryRunner: QueryRunner, quote: string): Promise<void> {
		const { table, constraint } = AddPaymentSessionInstrumentForeignKey1791000000410.REFERENCE;

		if (!(await queryRunner.hasTable(table))) return;
		if (!(await this.hasConstraint(queryRunner, constraint))) return;

		await queryRunner.query(`ALTER TABLE ${quote}${table}${quote} DROP CONSTRAINT ${quote}${constraint}${quote}`);
	}

	/**
	 * Whether the session table already carries a constraint of a given name.
	 *
	 * Read through the table metadata, which is the one description of a table the installed driver
	 * answers for every dialect this migration runs on.
	 *
	 * @param queryRunner The runner the migration is executing on.
	 * @param name The constraint name.
	 * @returns Whether the constraint is already there.
	 */
	private async hasConstraint(queryRunner: QueryRunner, name: string): Promise<boolean> {
		try {
			const table = await queryRunner.getTable(AddPaymentSessionInstrumentForeignKey1791000000410.REFERENCE.table);

			return Boolean(table?.foreignKeys?.some((foreignKey) => foreignKey.name === name));
		} catch {
			// A table that cannot be described is a table this migration has nothing to add to.
			return true;
		}
	}
}
