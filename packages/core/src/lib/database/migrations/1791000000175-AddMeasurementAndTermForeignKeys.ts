import { MigrationInterface, QueryRunner } from 'typeorm';
import * as chalk from 'chalk';
import { DatabaseTypeEnum } from '@gauzy/config';

/**
 * One constraint this migration adds, and the rule it carries.
 */
interface IForeignKeyDefinition {
	/** The table that owns the column. */
	table: string;
	/** The column that references a measurement family, a unit or a settlement term. */
	column: string;
	/** The table it references. */
	target: string;
	/** What happens to the row when its reference is hard-deleted. */
	onDelete: 'RESTRICT' | 'SET NULL';
	/** The service check that carries the rule where the dialect cannot declare the constraint. */
	check: string;
}

/**
 * Adds the constraints on every core column that references a measurement family, a unit or a
 * settlement term.
 *
 * The columns themselves shipped with `AlterCoreTablesForExtensions1791000000095`, deliberately
 * **without** their foreign keys: that migration runs before the tables they point at exist, and a
 * kernel alteration never waits for a table to appear. This file is the other half — the set that
 * created `unit_category`, `unit` and `payment_term` now owns their constraints, and every one of the
 * nine is added here rather than spread across the files that happened to touch each table.
 *
 * **The delete policy is the schema chapter's, and it is not uniform.** A quantity is *in* a unit, so a
 * unit a variant is counted in is never deleted from under it: `RESTRICT`, which turns an accidental
 * hard delete into a loud failure instead of silently restating a stock ledger. A settlement term is an
 * *optional* reference — a document names the term it was settled against and carries its own money
 * facts — so `SET NULL`, which lets a document outlive a term nobody should have deleted while still
 * refusing to guess a replacement schedule.
 *
 * **Every statement is guarded four ways**, because each of the four states is one a real installation
 * reaches. The owning table may be absent (an installation that has not applied the extension). The
 * target may be absent (the same installation, one revision earlier). The column may be absent, which
 * is what an installation whose schema was synchronised from the entities before the extension ran
 * looks like. And the constraint may already be present, which is what a second run of `up` — or a
 * database whose constraints a `synchronize` run created — looks like. `up` run twice therefore issues
 * probes and no DDL.
 *
 * **SQLite does not rebuild a table to add a constraint, and that is a measured decision rather than a
 * convenience.** SQLite cannot attach a foreign key to a column that already exists: its only route is
 * the documented twelve-step rebuild, and both orders of that rebuild destroy data on a populated
 * database. Rebuilding into a new table and dropping the old one fires the old table's implicit
 * `DELETE FROM`, which cascades into every child row of every table that references it — measured, and
 * the child rows were gone. Renaming the original aside first does not help: with foreign-key
 * enforcement on, and `PRAGMA foreign_keys` being a no-op inside the transaction a migration runs in,
 * the rename rewrites the other tables' references to follow it and the subsequent drop cascades
 * anyway — measured, and the children were gone and their constraint pointed at a table that no longer
 * existed. A migration that silently deletes a customer's rows is a worse failure than a missing
 * constraint, so on SQLite the rule is carried where the schema chapter already says a constraint a
 * dialect cannot express is carried: by the service, on every write, with a named error code, and by
 * the nightly measurement audit, which reports a violation rather than silently accepting one. The
 * effect is the one the convention states — nothing is enforced quietly and nothing is lost loudly.
 */
export class AddMeasurementAndTermForeignKeys1791000000175 implements MigrationInterface {
	name = 'AddMeasurementAndTermForeignKeys1791000000175';

	/**
	 * The nine constraints, in the order they are added and the reverse order they are dropped.
	 *
	 * A plant's four unit columns are `RESTRICT` because a variant counted in a unit must not lose it;
	 * the two level families are `RESTRICT` for the same reason one level up; the three settlement
	 * references are `SET NULL` because a document outlives the term it was settled against.
	 */
	private readonly foreignKeys: IForeignKeyDefinition[] = [
		{
			table: 'product_variant',
			column: 'stockUnitId',
			target: 'unit',
			onDelete: 'RESTRICT',
			check: 'STOCK_UNIT_NOT_REFERENCE and UNIT_CATEGORY_MISMATCH'
		},
		{
			table: 'product_variant',
			column: 'salesUnitId',
			target: 'unit',
			onDelete: 'RESTRICT',
			check: 'UNIT_CATEGORY_MISMATCH'
		},
		{
			table: 'product_variant',
			column: 'purchaseUnitId',
			target: 'unit',
			onDelete: 'RESTRICT',
			check: 'UNIT_CATEGORY_MISMATCH'
		},
		{
			table: 'product_variant',
			column: 'weightUnitId',
			target: 'unit',
			onDelete: 'RESTRICT',
			check: 'UNIT_CATEGORY_MISMATCH'
		},
		{
			table: 'warehouse_product',
			column: 'unitCategoryId',
			target: 'unit_category',
			onDelete: 'RESTRICT',
			check: 'PRODUCT_LEVEL_UNIT_CATEGORY_MISMATCH'
		},
		{
			table: 'warehouse_product_variant',
			column: 'unitCategoryId',
			target: 'unit_category',
			onDelete: 'RESTRICT',
			check: 'PRODUCT_LEVEL_UNIT_CATEGORY_MISMATCH'
		},
		{
			table: 'organization_contact',
			column: 'paymentTermId',
			target: 'payment_term',
			onDelete: 'SET NULL',
			check: 'PAYMENT_TERM_LINES_INVALID'
		},
		{
			table: 'organization_vendor',
			column: 'paymentTermId',
			target: 'payment_term',
			onDelete: 'SET NULL',
			check: 'PAYMENT_TERM_LINES_INVALID'
		},
		{
			table: 'invoice',
			column: 'paymentTermId',
			target: 'payment_term',
			onDelete: 'SET NULL',
			check: 'PAYMENT_TERM_LINES_INVALID'
		}
	];

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
		await this.addForeignKeys(queryRunner, DatabaseTypeEnum.postgres);
	}

	/**
	 * PostgresDB Down Migration
	 *
	 * @param queryRunner
	 */
	public async postgresDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await this.dropForeignKeys(queryRunner, DatabaseTypeEnum.postgres);
	}

	/**
	 * SqliteDB and BetterSQlite3DB Up Migration
	 *
	 * Deliberately empty of DDL: SQLite cannot attach a foreign key to an existing column without the
	 * documented table rebuild, and that rebuild destroys rows on a populated database in both of the
	 * orders it can be performed in. The measured evidence and the rule's compensating measure are in
	 * the class note above; adding a constraint here would mean deleting a customer's rows to do it.
	 *
	 * @param queryRunner
	 */
	public async sqliteUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await this.addForeignKeys(queryRunner, DatabaseTypeEnum.sqlite);
	}

	/**
	 * SqliteDB and BetterSQlite3DB Down Migration
	 *
	 * @param queryRunner
	 */
	public async sqliteDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await this.dropForeignKeys(queryRunner, DatabaseTypeEnum.sqlite);
	}

	/**
	 * MySQL Up Migration
	 *
	 * @param queryRunner
	 */
	public async mysqlUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await this.addForeignKeys(queryRunner, DatabaseTypeEnum.mysql);
	}

	/**
	 * MySQL Down Migration
	 *
	 * @param queryRunner
	 */
	public async mysqlDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await this.dropForeignKeys(queryRunner, DatabaseTypeEnum.mysql);
	}

	/**
	 * Adds every constraint that is not already there.
	 *
	 * @param queryRunner
	 * @param dialect The dialect whose statement form and catalogue are used.
	 */
	private async addForeignKeys(queryRunner: QueryRunner, dialect: DatabaseTypeEnum): Promise<void> {
		if (dialect === DatabaseTypeEnum.sqlite) {
			// See the class note: the rebuild this would require is destructive on a populated database, so
			// the rule is a service check and a nightly audit on this dialect instead. Reported rather than
			// silent, so an operator reading the migration log knows exactly what did and did not happen.
			console.log(
				chalk.yellow(
					`${this.name}: SQLite cannot add a foreign key to an existing column without a destructive ` +
						'table rebuild, so the nine measurement and settlement references are carried by the ' +
						'service checks and by the nightly measurement audit on this dialect.'
				)
			);

			return;
		}

		for (const definition of this.foreignKeys) {
			if (!(await this.applies(queryRunner, definition, dialect))) {
				continue;
			}

			const name = this.constraintName(definition);
			const quote = (identifier: string) => this.quote(identifier, dialect);

			await queryRunner.query(
				`ALTER TABLE ${quote(definition.table)} ADD CONSTRAINT ${quote(name)} FOREIGN KEY (${quote(
					definition.column
				)}) REFERENCES ${quote(definition.target)}(${quote('id')}) ON DELETE ${definition.onDelete} ON UPDATE NO ACTION`
			);
		}
	}

	/**
	 * Drops every constraint that is present.
	 *
	 * The reverse order matters on MySQL, where a constraint's index is dropped with it and a later
	 * constraint on the same column would otherwise be re-created against a missing index.
	 *
	 * @param queryRunner
	 * @param dialect The dialect whose statement form and catalogue are used.
	 */
	private async dropForeignKeys(queryRunner: QueryRunner, dialect: DatabaseTypeEnum): Promise<void> {
		if (dialect === DatabaseTypeEnum.sqlite) {
			return;
		}

		for (const definition of [...this.foreignKeys].reverse()) {
			const name = this.constraintName(definition);

			if (!(await queryRunner.hasTable(definition.table))) {
				continue;
			}

			if (!(await this.constraintExists(queryRunner, definition, dialect))) {
				continue;
			}

			await queryRunner.query(
				dialect === DatabaseTypeEnum.mysql
					? `ALTER TABLE ${this.quote(definition.table, dialect)} DROP FOREIGN KEY ${this.quote(name, dialect)}`
					: `ALTER TABLE ${this.quote(definition.table, dialect)} DROP CONSTRAINT ${this.quote(name, dialect)}`
			);
		}
	}

	/**
	 * Whether a constraint should be added: its table, its target and its column all exist, and the
	 * constraint itself does not.
	 *
	 * @param queryRunner
	 * @param definition The constraint.
	 * @param dialect The dialect whose catalogue is read.
	 * @returns True when the constraint is missing and can be added.
	 */
	private async applies(
		queryRunner: QueryRunner,
		definition: IForeignKeyDefinition,
		dialect: DatabaseTypeEnum
	): Promise<boolean> {
		if (!(await queryRunner.hasTable(definition.table))) {
			return false;
		}

		if (!(await queryRunner.hasTable(definition.target))) {
			return false;
		}

		if (!(await queryRunner.hasColumn(definition.table, definition.column))) {
			return false;
		}

		return !(await this.constraintExists(queryRunner, definition, dialect));
	}

	/**
	 * Whether the dialect's catalogue already carries the constraint.
	 *
	 * The catalogue is read rather than guessed, because a constraint on this platform is created by a
	 * migration, by the ORM's own synchronise run or by the ORM's generated history, and the name is the
	 * only thing all three agree on. MySQL has no `IF NOT EXISTS` for a constraint at all, so the probe
	 * is the only portable form.
	 *
	 * @param queryRunner
	 * @param definition The constraint.
	 * @param dialect The dialect whose catalogue is read.
	 * @returns True when the constraint exists.
	 */
	private async constraintExists(
		queryRunner: QueryRunner,
		definition: IForeignKeyDefinition,
		dialect: DatabaseTypeEnum
	): Promise<boolean> {
		const name = this.constraintName(definition);

		if (dialect === DatabaseTypeEnum.mysql) {
			return this.rowsExist(
				await queryRunner.query(
					`SELECT 1 FROM information_schema.table_constraints WHERE constraint_schema = DATABASE() AND table_name = ? AND constraint_name = ? LIMIT 1`,
					[definition.table, name]
				)
			);
		}

		// SQLite reaches here only from `dropForeignKeys`, which returns before the loop on that dialect;
		// the probe is written out anyway so the helper is correct on its own terms.
		if (dialect === DatabaseTypeEnum.sqlite) {
			return false;
		}

		return this.rowsExist(
			await queryRunner.query(
				`SELECT 1 FROM pg_constraint WHERE conname = $1 AND conrelid = to_regclass($2) LIMIT 1`,
				[name, definition.table]
			)
		);
	}

	/**
	 * The name of a constraint this migration adds.
	 *
	 * @param definition The constraint.
	 * @returns `FK_<table>_<column>`, which names the column whose rule it states.
	 */
	private constraintName(definition: IForeignKeyDefinition): string {
		return `FK_${definition.table}_${definition.column}`;
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

	/**
	 * Whether a probe returned a row.
	 *
	 * @param rows Whatever the driver returned.
	 * @returns True when at least one row came back.
	 */
	private rowsExist(rows: unknown): boolean {
		return Array.isArray(rows) && rows.length > 0;
	}
}
