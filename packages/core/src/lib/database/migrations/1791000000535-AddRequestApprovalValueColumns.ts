/**
 * Adds the value columns an approval request carries: what it commits, in which currency, and the
 * note that goes with it.
 *
 * **Why this migration exists.** `request_approval` is the platform's single approval table — a
 * request filed by one domain is the same row another domain's approver list reads, which is the
 * whole point of it being one table. A domain that asks for a decision on a document that commits
 * money therefore has to state three facts the table did not have room for: the value being
 * committed, so a threshold policy can be applied to it, the ISO currency that value is stated in,
 * and a note for the approver. Those columns were declared on the entity but no kernel migration
 * created them, and a column declared on an entity and absent from a migration exists only on an
 * installation that was synchronised from the entities — a clean install fails on the first read or
 * write that names it, because every query names every column. That is the defect this file closes.
 *
 * **Nothing here is destructive.** All three columns are nullable `ALTER TABLE … ADD COLUMN`s, so a
 * populated installation keeps every row and every existing behaviour: a request that commits no
 * money — a time-off request, for instance — simply carries `NULL` in all three, which is why none of
 * them takes a default. `down()` reverses exactly what `up()` added.
 *
 * **Money is an exact decimal, never a float.** `amount` is the same `numeric(20,6)` the platform's
 * other money columns are, and `currency` is the same three-character ISO column that stands beside
 * each of them; a float would round at a boundary a threshold policy is evaluated on.
 *
 * **Every addition is guarded, and the guard differs by dialect because the dialects do.** Postgres
 * supports `ADD COLUMN IF NOT EXISTS` and `DROP COLUMN IF EXISTS`, so it uses them. MySQL has neither
 * clause, and SQLite has neither either — SQLite additionally accepts `DROP COLUMN` at all only since
 * 3.35 — so those two are guarded by asking the dialect's own catalogue whether the column is already
 * present, exactly as the platform's other column-adding kernel migration does. A second run of `up`
 * therefore adds nothing on any dialect: it issues the probes and no DDL at all. The table itself is
 * probed first as well, so an installation that has never created `request_approval` is skipped
 * rather than failed.
 *
 * **No index is added.** The three columns are read with the row they belong to; an approver's list
 * is already reachable through the policy and the polymorphic pair, and an index nobody's query uses
 * is a write cost on every approval the platform records.
 *
 * **No foreign key is added.** `amount`, `currency` and `note` name no other table, and this is a
 * kernel alteration: it is additive only.
 */
import { MigrationInterface, QueryRunner } from 'typeorm';
import * as chalk from 'chalk';
import { DatabaseTypeEnum } from '@gauzy/config';

/**
 * The table this migration extends. The name carries no prefix: it is the platform's own approval
 * table, and it belonged to the kernel long before any package asked to file a request against it.
 */
const REQUEST_APPROVAL_TABLE = 'request_approval';

/**
 * One column this migration adds, with the physical type it takes on each dialect.
 *
 * Every definition states all three dialects, and each one is a real dialect difference rather than a
 * convenience: a `numeric` is a `decimal` on MySQL, a `character varying` needs a length MySQL will
 * accept, and SQLite takes the Postgres spelling of both because it is dynamically typed.
 */
interface ColumnDefinition {
	/** Postgres physical type. */
	postgres: string;
	/** MySQL physical type. */
	mysql: string;
	/** SQLite physical type. */
	sqlite: string;
}

/**
 * The value columns `request_approval` gains, keyed by column name.
 *
 * One entry per column, read by all three dialect bodies, so a column cannot be added on one dialect
 * and forgotten on another. `amount` is nullable with no default on purpose: a request that commits
 * no money stores `NULL`, and a default of zero would make "commits nothing" and "commits zero"
 * the same row.
 */
const VALUE_COLUMNS: Record<string, ColumnDefinition> = {
	/** The value the request commits, as an exact decimal plus its ISO currency. */
	amount: {
		postgres: 'numeric(20,6)',
		mysql: 'decimal(20,6) NULL',
		sqlite: 'numeric(20,6)'
	},
	/** ISO 4217 code the amount is stated in; null exactly when the amount is null. */
	currency: {
		postgres: 'character varying(3)',
		mysql: 'varchar(3) NULL',
		sqlite: 'varchar(3)'
	},
	/** Free text kept beside the request, for the approver to read. */
	note: {
		postgres: 'character varying',
		mysql: 'varchar(255) NULL',
		sqlite: 'varchar'
	}
};

/**
 * Adds the value columns of an approval request to `request_approval`, on all three dialects.
 */
export class AddRequestApprovalValueColumns1791000000535 implements MigrationInterface {
	name = 'AddRequestApprovalValueColumns1791000000535';

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
		await this.addColumns(queryRunner, DatabaseTypeEnum.postgres);
	}

	/**
	 * PostgresDB Down Migration
	 *
	 * @param queryRunner
	 */
	public async postgresDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await this.dropColumns(queryRunner, DatabaseTypeEnum.postgres);
	}

	/**
	 * SqliteDB and BetterSQlite3DB Up Migration
	 *
	 * @param queryRunner
	 */
	public async sqliteUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await this.addColumns(queryRunner, DatabaseTypeEnum.sqlite);
	}

	/**
	 * SqliteDB and BetterSQlite3DB Down Migration
	 *
	 * @param queryRunner
	 */
	public async sqliteDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await this.dropColumns(queryRunner, DatabaseTypeEnum.sqlite);
	}

	/**
	 * MySQL Up Migration
	 *
	 * @param queryRunner
	 */
	public async mysqlUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await this.addColumns(queryRunner, DatabaseTypeEnum.mysql);
	}

	/**
	 * MySQL Down Migration
	 *
	 * @param queryRunner
	 */
	public async mysqlDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await this.dropColumns(queryRunner, DatabaseTypeEnum.mysql);
	}

	/**
	 * Adds every value column the dialect does not have yet.
	 *
	 * A table this installation does not have is skipped entirely, and so is a column that is already
	 * present — on Postgres by the `IF NOT EXISTS` clause the dialect supports, and on MySQL and SQLite,
	 * which have no such clause, by asking the catalogue first. Either way a re-run issues no DDL.
	 *
	 * @param queryRunner
	 * @param dialect The dialect whose physical types are used.
	 */
	private async addColumns(queryRunner: QueryRunner, dialect: DatabaseTypeEnum): Promise<void> {
		if (!(await queryRunner.hasTable(REQUEST_APPROVAL_TABLE))) {
			return;
		}

		for (const [column, definition] of Object.entries(VALUE_COLUMNS)) {
			const type = this.typeOf(definition, dialect);

			if (
				dialect !== DatabaseTypeEnum.postgres &&
				(await queryRunner.hasColumn(REQUEST_APPROVAL_TABLE, column))
			) {
				continue;
			}

			await queryRunner.query(
				`ALTER TABLE ${this.quote(REQUEST_APPROVAL_TABLE, dialect)} ADD COLUMN ${
					dialect === DatabaseTypeEnum.postgres ? 'IF NOT EXISTS ' : ''
				}${this.quote(column, dialect)} ${type}`
			);
		}
	}

	/**
	 * Drops every value column the dialect was given, and only those.
	 *
	 * Postgres drops each column with the `IF EXISTS` clause it supports; MySQL and SQLite are asked
	 * whether the column is there before it is named, because neither dialect has that clause — on
	 * SQLite `ALTER TABLE … DROP COLUMN` is the only form the parser accepts.
	 *
	 * @param queryRunner
	 * @param dialect The dialect whose physical types were used.
	 */
	private async dropColumns(queryRunner: QueryRunner, dialect: DatabaseTypeEnum): Promise<void> {
		if (!(await queryRunner.hasTable(REQUEST_APPROVAL_TABLE))) {
			return;
		}

		for (const column of Object.keys(VALUE_COLUMNS)) {
			if (
				dialect !== DatabaseTypeEnum.postgres &&
				!(await queryRunner.hasColumn(REQUEST_APPROVAL_TABLE, column))
			) {
				continue;
			}

			await queryRunner.query(
				`ALTER TABLE ${this.quote(REQUEST_APPROVAL_TABLE, dialect)} DROP COLUMN ${
					dialect === DatabaseTypeEnum.postgres ? 'IF EXISTS ' : ''
				}${this.quote(column, dialect)}`
			);
		}
	}

	/**
	 * The physical type a column takes on a dialect.
	 *
	 * @param definition The column's per-dialect types.
	 * @param dialect The dialect in use.
	 * @returns The type.
	 */
	private typeOf(definition: ColumnDefinition, dialect: DatabaseTypeEnum): string {
		switch (dialect) {
			case DatabaseTypeEnum.postgres:
				return definition.postgres;
			case DatabaseTypeEnum.mysql:
				return definition.mysql;
			default:
				return definition.sqlite;
		}
	}

	/**
	 * Quotes an identifier the way the dialect does.
	 *
	 * @param identifier The table or column name.
	 * @param dialect The dialect in use.
	 * @returns The quoted identifier.
	 */
	private quote(identifier: string, dialect: DatabaseTypeEnum): string {
		return dialect === DatabaseTypeEnum.mysql ? `\`${identifier}\`` : `"${identifier}"`;
	}
}
