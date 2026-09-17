import { MigrationInterface, QueryRunner } from 'typeorm';
import * as chalk from 'chalk';
import { DatabaseTypeEnum } from '@gauzy/config';

/**
 * Constrains `order.paymentTermId`, the settlement schedule an order was placed against.
 *
 * **Why the constraint is here and not in the kernel.** `order` is this package's table and
 * `payment_term` is the kernel's, so this is a plugin-to-core reference — allowed without an exception
 * by §4.3 of the naming and placement doctrine: a plugin may depend on core, core may never depend on a
 * plugin. A kernel migration that named `order` would be core naming a plugin's table, and the kernel
 * set is replayed identically on an installation that never installs this package. The constraint
 * therefore belongs to the set that owns the column, which is what `05-database-schema-spec.md` §24
 * rule 10 states: a constraint is added where its target is created, and the plugin-owned columns that
 * reference a kernel table are constrained by their own sets.
 *
 * **Why it is a file of its own.** `CreateOrderLineInvoiceTable1791000000235` adds the column and
 * deliberately leaves it unconstrained, and a migration's timestamp is frozen once it has shipped. This
 * file is the set's next free tick inside its own sub-range, `1791000000236`, which places it after
 * every file of the set and above the kernel revision block that creates `payment_term`. The
 * programme's five-tick spacing cannot be kept here — the next multiple-of-five tick above `…235`,
 * `…240`, is the fulfilment set's — and taking a tick outside the sub-range to preserve the spacing
 * would collide with another package's range for no ordering benefit.
 *
 * **The delete policy is `SET NULL`, and it is the schema chapter's.** A settlement term is an
 * *optional* reference: an order names the term it was settled against and carries its own money facts,
 * so it outlives a term nobody should have deleted while still refusing to guess a replacement
 * schedule. That is exactly the policy `AddMeasurementAndTermForeignKeys1791000000175` gives the three
 * settlement references it owns — `organization_contact`, `organization_vendor` and `invoice` — and an
 * order is the fourth document of the same kind, so it is not a case for a different rule.
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
 * existed. On a table this central the cascade would take the order lines, the totals, the money ledger
 * and the timeline with it. A migration that silently deletes a customer's orders is a worse failure
 * than a missing constraint, so on SQLite the rule is carried where the schema chapter says a
 * constraint a dialect cannot express is carried: by `OrderService`, on every write, and by the
 * settlement report, which resolves a term rather than assuming one. The `up` body says so in the log
 * where it declines to run, so an operator reading the migration output knows exactly what did and did
 * not happen. `1791000000175` documents the same decision in the same terms.
 *
 * Every statement is guarded four ways, because each of the four states is one a real installation
 * reaches: the owning table may be absent, the target may be absent, the column may be absent, and the
 * constraint may already exist — created by a second run of `up` or by a development database whose
 * schema the ORM synchronised. `up` run twice therefore issues probes and no DDL.
 */
export class AddOrderPaymentTermForeignKey1791000000236 implements MigrationInterface {
	name = 'AddOrderPaymentTermForeignKey1791000000236';

	/** The table that owns the column. */
	private static readonly TABLE = 'order';

	/** The column that names the settlement schedule the order was placed against. */
	private static readonly COLUMN = 'paymentTermId';

	/** The kernel table that defines a settlement term. */
	private static readonly TARGET = 'payment_term';

	/**
	 * The constraint, named for the column whose rule it states.
	 *
	 * The name is the migration's own, which is what lets `down` identify the constraint it may drop
	 * without touching one a synchronise run created under a different name.
	 */
	private static readonly CONSTRAINT = 'FK_order_paymentTermId';

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
		await this.addForeignKey(queryRunner, DatabaseTypeEnum.postgres);
	}

	/**
	 * PostgresDB Down Migration
	 *
	 * @param queryRunner
	 */
	public async postgresDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await this.dropForeignKey(queryRunner, DatabaseTypeEnum.postgres);
	}

	/**
	 * SqliteDB and BetterSQlite3DB Up Migration
	 *
	 * Deliberately empty of DDL: SQLite can only attach a foreign key to an existing column by
	 * rebuilding the table, and that rebuild destroys rows on a populated database in both of the
	 * orders it can be performed in — on this table, the whole aggregate with them. The measured
	 * evidence and the rule's compensating measure are in the class note above. Reported rather than
	 * silent, so the migration log states what was and was not applied.
	 *
	 * @param queryRunner
	 */
	public async sqliteUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await this.addForeignKey(queryRunner, DatabaseTypeEnum.sqlite);
	}

	/**
	 * SqliteDB and BetterSQlite3DB Down Migration
	 *
	 * @param queryRunner
	 */
	public async sqliteDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await this.dropForeignKey(queryRunner, DatabaseTypeEnum.sqlite);
	}

	/**
	 * MySQL Up Migration
	 *
	 * @param queryRunner
	 */
	public async mysqlUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await this.addForeignKey(queryRunner, DatabaseTypeEnum.mysql);
	}

	/**
	 * MySQL Down Migration
	 *
	 * @param queryRunner
	 */
	public async mysqlDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await this.dropForeignKey(queryRunner, DatabaseTypeEnum.mysql);
	}

	/**
	 * Adds the constraint when every precondition holds and it is not already there.
	 *
	 * @param queryRunner
	 * @param dialect The dialect whose statement form and catalogue are used.
	 */
	private async addForeignKey(queryRunner: QueryRunner, dialect: DatabaseTypeEnum): Promise<void> {
		if (dialect === DatabaseTypeEnum.sqlite) {
			console.log(
				chalk.yellow(
					`${this.name}: SQLite cannot add a foreign key to an existing column without a destructive ` +
						'table rebuild, so the reference from an order to the settlement term it was placed ' +
						'against is carried by the service check and by the settlement report on this dialect.'
				)
			);

			return;
		}

		if (!(await this.applies(queryRunner, dialect))) {
			return;
		}

		const quote = (identifier: string) => this.quote(identifier, dialect);

		await queryRunner.query(
			`ALTER TABLE ${quote(AddOrderPaymentTermForeignKey1791000000236.TABLE)} ADD CONSTRAINT ${quote(
				AddOrderPaymentTermForeignKey1791000000236.CONSTRAINT
			)} FOREIGN KEY (${quote(AddOrderPaymentTermForeignKey1791000000236.COLUMN)}) REFERENCES ${quote(
				AddOrderPaymentTermForeignKey1791000000236.TARGET
			)}(${quote('id')}) ON DELETE SET NULL ON UPDATE NO ACTION`
		);
	}

	/**
	 * Drops the constraint when it is present.
	 *
	 * @param queryRunner
	 * @param dialect The dialect whose statement form and catalogue are used.
	 */
	private async dropForeignKey(queryRunner: QueryRunner, dialect: DatabaseTypeEnum): Promise<void> {
		if (dialect === DatabaseTypeEnum.sqlite) {
			return;
		}

		if (!(await queryRunner.hasTable(AddOrderPaymentTermForeignKey1791000000236.TABLE))) {
			return;
		}

		if (!(await this.constraintExists(queryRunner, dialect))) {
			return;
		}

		await queryRunner.query(
			dialect === DatabaseTypeEnum.mysql
				? `ALTER TABLE ${this.quote(
						AddOrderPaymentTermForeignKey1791000000236.TABLE,
						dialect
					)} DROP FOREIGN KEY ${this.quote(AddOrderPaymentTermForeignKey1791000000236.CONSTRAINT, dialect)}`
				: `ALTER TABLE ${this.quote(
						AddOrderPaymentTermForeignKey1791000000236.TABLE,
						dialect
					)} DROP CONSTRAINT ${this.quote(AddOrderPaymentTermForeignKey1791000000236.CONSTRAINT, dialect)}`
		);
	}

	/**
	 * Whether the constraint should be added: the owning table, the target table and the column all
	 * exist, and the constraint itself does not.
	 *
	 * @param queryRunner
	 * @param dialect The dialect whose catalogue is read.
	 * @returns True when the constraint is missing and can be added.
	 */
	private async applies(queryRunner: QueryRunner, dialect: DatabaseTypeEnum): Promise<boolean> {
		if (!(await queryRunner.hasTable(AddOrderPaymentTermForeignKey1791000000236.TABLE))) {
			return false;
		}

		if (!(await queryRunner.hasTable(AddOrderPaymentTermForeignKey1791000000236.TARGET))) {
			return false;
		}

		if (
			!(await queryRunner.hasColumn(
				AddOrderPaymentTermForeignKey1791000000236.TABLE,
				AddOrderPaymentTermForeignKey1791000000236.COLUMN
			))
		) {
			return false;
		}

		return !(await this.constraintExists(queryRunner, dialect));
	}

	/**
	 * Whether the dialect's catalogue already carries the constraint.
	 *
	 * The catalogue is read rather than guessed, because a constraint on this platform is created by a
	 * migration, by the ORM's own synchronise run or by the ORM's generated history, and the name is
	 * the only thing all three agree on. MySQL has no `IF NOT EXISTS` for a constraint at all, so the
	 * probe is the only portable form.
	 *
	 * @param queryRunner
	 * @param dialect The dialect whose catalogue is read.
	 * @returns True when the constraint exists.
	 */
	private async constraintExists(queryRunner: QueryRunner, dialect: DatabaseTypeEnum): Promise<boolean> {
		const name = AddOrderPaymentTermForeignKey1791000000236.CONSTRAINT;

		if (dialect === DatabaseTypeEnum.mysql) {
			return this.rowsExist(
				await queryRunner.query(
					`SELECT 1 FROM information_schema.table_constraints WHERE constraint_schema = DATABASE() AND table_name = ? AND constraint_name = ? LIMIT 1`,
					[AddOrderPaymentTermForeignKey1791000000236.TABLE, name]
				)
			);
		}

		// SQLite reaches here only from `dropForeignKey`, which returns before this point on that
		// dialect; the probe is written out anyway so the helper is correct on its own terms.
		if (dialect === DatabaseTypeEnum.sqlite) {
			return false;
		}

		return this.rowsExist(
			await queryRunner.query(`SELECT 1 FROM pg_constraint WHERE conname = $1 AND conrelid = to_regclass($2) LIMIT 1`, [
				name,
				AddOrderPaymentTermForeignKey1791000000236.TABLE
			])
		);
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
