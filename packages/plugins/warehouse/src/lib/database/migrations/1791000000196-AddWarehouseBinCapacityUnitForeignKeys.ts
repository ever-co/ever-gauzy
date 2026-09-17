import { MigrationInterface, QueryRunner } from 'typeorm';
import * as chalk from 'chalk';
import { DatabaseTypeEnum } from '@gauzy/config';

/**
 * One constraint this migration adds, and the rule it carries.
 */
interface IBinUnitForeignKey {
	/** The column that states the unit a bin's limit is expressed in. */
	column: string;
	/** The service check that carries the rule where the dialect cannot declare the constraint. */
	check: string;
}

/**
 * Constrains the three unit references of `warehouse_bin`, which
 * `AddWarehouseBinCapacityUnits1791000000195` deliberately creates as plain identifiers.
 *
 * **Why the constraint is here and not in the kernel.** A bin's capacity, weight ceiling and volume
 * ceiling are each a quantity *in a stated unit*, and `unit` belongs to the kernel's measurement set —
 * so these are plugin-to-core references, which §4.3 of the naming and placement doctrine allows
 * without an exception: a plugin may depend on core, core may never depend on a plugin. A kernel
 * migration that named `warehouse_bin` would be core naming a plugin's table, and the kernel set is
 * replayed identically on an installation that never installs this package. The constraints therefore
 * belong to the set that owns the columns, which is what `05-database-schema-spec.md` §24 rule 10
 * states and what its own list of lagging columns says about `warehouse_bin.capacityUnitId` and its
 * siblings.
 *
 * **Why it is a file of its own.** `…195` shipped without these constraints because their target did
 * not exist when that file's reasons were written, and a migration's timestamp is frozen once it has
 * shipped. This file is the set's next free tick inside its own sub-range, `1791000000196`, which
 * places it after every file of the set and above the kernel revision block that creates `unit`. The
 * programme's five-tick spacing cannot be kept here — the next multiple-of-five tick above `…195`,
 * `…200`, is the cart set's — and taking a tick outside the sub-range to preserve the spacing would
 * collide with another package's range for no ordering benefit.
 *
 * **The delete policy is `RESTRICT`, and it is the schema chapter's.** A limit is *in* a unit, so a
 * unit a bin's capacity is declared in is never deleted from under it: `RESTRICT` turns an accidental
 * hard delete into a loud failure instead of silently restating what the capacity means — which for a
 * bin matters twice over, because the allocator and the low-stock tie-break make decisions from that
 * number. It is the policy `AddMeasurementAndTermForeignKeys1791000000175` gives every other unit
 * reference.
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
 * constraint, so on SQLite the rule is carried where the schema chapter says a constraint a dialect
 * cannot express is carried: by `WarehouseBinService`, on every write — it already refuses a capacity
 * that states no unit — and by the capacity warnings report, which surfaces a bin whose unit is
 * undeclared rather than guessing one. The `up` body says so in the log where it declines to run, so
 * an operator reading the migration output knows exactly what did and did not happen.
 * `1791000000175` documents the same decision in the same terms.
 *
 * Every statement is guarded four ways, because each of the four states is one a real installation
 * reaches: the owning table may be absent, the target may be absent, a column may be absent, and a
 * constraint may already exist — created by a second run of `up` or by a development database whose
 * schema the ORM synchronised. `up` run twice therefore issues probes and no DDL.
 */
export class AddWarehouseBinCapacityUnitForeignKeys1791000000196 implements MigrationInterface {
	name = 'AddWarehouseBinCapacityUnitForeignKeys1791000000196';

	/** The table whose three limits name their unit. */
	private static readonly TABLE = 'warehouse_bin';

	/** The kernel table that defines a unit. */
	private static readonly TARGET = 'unit';

	/**
	 * The three constraints, in the order they are added and the reverse order they are dropped.
	 *
	 * A bin's capacity is what a put-away is measured against, its weight ceiling is what a carrier
	 * limit is measured against and its volume ceiling is what a pallet plan is measured against —
	 * three limits of one position, each stated in its own unit, and none of them interchangeable with
	 * another.
	 */
	private readonly foreignKeys: IBinUnitForeignKey[] = [
		{ column: 'capacityUnitId', check: 'WAREHOUSE_BIN_CAPACITY_UNIT_UNDECLARED' },
		{ column: 'maxWeightUnitId', check: 'WAREHOUSE_BIN_CAPACITY_UNIT_UNDECLARED' },
		{ column: 'maxVolumeUnitId', check: 'WAREHOUSE_BIN_CAPACITY_UNIT_UNDECLARED' }
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
	 * Deliberately empty of DDL: SQLite can only attach a foreign key to an existing column by
	 * rebuilding the table, and that rebuild destroys rows on a populated database in both of the
	 * orders it can be performed in. The measured evidence and the rule's compensating measure are in
	 * the class note above; adding the constraints here would mean deleting a customer's bin rows to do
	 * it. Reported rather than silent, so the migration log states what was and was not applied.
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
			console.log(
				chalk.yellow(
					`${this.name}: SQLite cannot add a foreign key to an existing column without a destructive ` +
						'table rebuild, so the three references from a bin to the units its limits are stated in ' +
						'are carried by the service check and by the capacity warnings report on this dialect.'
				)
			);

			return;
		}

		for (const definition of this.foreignKeys) {
			if (!(await this.applies(queryRunner, definition, dialect))) {
				continue;
			}

			const quote = (identifier: string) => this.quote(identifier, dialect);

			await queryRunner.query(
				`ALTER TABLE ${quote(AddWarehouseBinCapacityUnitForeignKeys1791000000196.TABLE)} ADD CONSTRAINT ${quote(
					this.constraintName(definition)
				)} FOREIGN KEY (${quote(definition.column)}) REFERENCES ${quote(
					AddWarehouseBinCapacityUnitForeignKeys1791000000196.TARGET
				)}(${quote('id')}) ON DELETE RESTRICT ON UPDATE NO ACTION`
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

		if (!(await queryRunner.hasTable(AddWarehouseBinCapacityUnitForeignKeys1791000000196.TABLE))) {
			return;
		}

		for (const definition of [...this.foreignKeys].reverse()) {
			const name = this.constraintName(definition);

			if (!(await this.constraintExists(queryRunner, definition, dialect))) {
				continue;
			}

			await queryRunner.query(
				dialect === DatabaseTypeEnum.mysql
					? `ALTER TABLE ${this.quote(
							AddWarehouseBinCapacityUnitForeignKeys1791000000196.TABLE,
							dialect
						)} DROP FOREIGN KEY ${this.quote(name, dialect)}`
					: `ALTER TABLE ${this.quote(
							AddWarehouseBinCapacityUnitForeignKeys1791000000196.TABLE,
							dialect
						)} DROP CONSTRAINT ${this.quote(name, dialect)}`
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
		definition: IBinUnitForeignKey,
		dialect: DatabaseTypeEnum
	): Promise<boolean> {
		if (!(await queryRunner.hasTable(AddWarehouseBinCapacityUnitForeignKeys1791000000196.TABLE))) {
			return false;
		}

		if (!(await queryRunner.hasTable(AddWarehouseBinCapacityUnitForeignKeys1791000000196.TARGET))) {
			return false;
		}

		if (
			!(await queryRunner.hasColumn(
				AddWarehouseBinCapacityUnitForeignKeys1791000000196.TABLE,
				definition.column
			))
		) {
			return false;
		}

		return !(await this.constraintExists(queryRunner, definition, dialect));
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
	 * @param definition The constraint.
	 * @param dialect The dialect whose catalogue is read.
	 * @returns True when the constraint exists.
	 */
	private async constraintExists(
		queryRunner: QueryRunner,
		definition: IBinUnitForeignKey,
		dialect: DatabaseTypeEnum
	): Promise<boolean> {
		const name = this.constraintName(definition);
		const table = AddWarehouseBinCapacityUnitForeignKeys1791000000196.TABLE;

		if (dialect === DatabaseTypeEnum.mysql) {
			return this.rowsExist(
				await queryRunner.query(
					`SELECT 1 FROM information_schema.table_constraints WHERE constraint_schema = DATABASE() AND table_name = ? AND constraint_name = ? LIMIT 1`,
					[table, name]
				)
			);
		}

		// SQLite reaches here only from `dropForeignKeys`, which returns before the loop on that
		// dialect; the probe is written out anyway so the helper is correct on its own terms.
		if (dialect === DatabaseTypeEnum.sqlite) {
			return false;
		}

		return this.rowsExist(
			await queryRunner.query(`SELECT 1 FROM pg_constraint WHERE conname = $1 AND conrelid = to_regclass($2) LIMIT 1`, [
				name,
				table
			])
		);
	}

	/**
	 * The name of a constraint this migration adds.
	 *
	 * @param definition The constraint.
	 * @returns `FK_<table>_<column>`, which names the column whose rule it states.
	 */
	private constraintName(definition: IBinUnitForeignKey): string {
		return `FK_${AddWarehouseBinCapacityUnitForeignKeys1791000000196.TABLE}_${definition.column}`;
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
