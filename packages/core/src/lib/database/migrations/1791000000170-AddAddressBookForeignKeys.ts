import { MigrationInterface, QueryRunner } from 'typeorm';
import * as chalk from 'chalk';
import { DatabaseTypeEnum } from '@gauzy/config';

/**
 * Makes the two references into the address book real, by adding each constraint that exists nowhere
 * yet.
 *
 * **What was broken.** `address` is created by `1791000000092-CreateAddressTable`, and two migrations
 * that shipped before it point at the table with a constraint they create **only where the target
 * already exists**: `1791000000125-CreatePaymentInstrumentTables` guards
 * `payment_method_token.billingAddressId` with `hasTable('address')`, and
 * `1791000000165-CreateAddressRoleTable` guards `address_role.addressId` the same way. Both guards
 * were the right call at the time — a foreign key to a table that does not exist fails the whole
 * migration on a fresh database, and a kernel migration never waits for another table to appear — but
 * they leave an installation that already ran them with two columns that point at nothing:
 *
 *   - `address_role.addressId` → `address`, `ON DELETE CASCADE` (the role row has no meaning without
 *     its address; the schema chapter's bucket 3);
 *   - `payment_method_token.billingAddressId` → `address`, `ON DELETE SET NULL` (an instrument
 *     outlives the address it was billed to; bucket 4).
 *
 * **Why this file runs at `1791000000170`.** The platform's rule, enforced by the migration-ordering
 * check, is that a migration may only reference a table an **earlier** migration creates. This file
 * references three tables and every one of them exists by the time it runs: `address` at `…092`,
 * `payment_method_token` at `…125` and `address_role` at `…165`. It is therefore placed above both
 * files whose guards it repairs, which is the only position from which it can see the columns they
 * created.
 *
 * **It is a no-op on a fresh installation, and that is not a contradiction.** A database built from
 * scratch runs `…092` first, so when `…125` and `…165` execute their `hasTable('address')` probe
 * answers yes and each creates its constraint inline, exactly as written. This migration then finds
 * both constraints present and adds nothing. The state it exists for is the other one: an installation
 * that applied `…125` and `…165` while the address book was still missing, and that today carries the
 * role pivot and the billing-address column with no referential guarantee at all.
 *
 * **SQLite cannot add a constraint to an existing table.** `ALTER TABLE … ADD CONSTRAINT` is not part
 * of its grammar — adding one means rebuilding the table and copying it — so that branch is a
 * documented no-op rather than a silent one. A fresh SQLite installation is not left wanting: it runs
 * this kernel set in tick order, so `address` exists before `…125` and `…165` run and **both
 * constraints are declared inline in their `CREATE TABLE` statements**, which is the same guarantee
 * Postgres and MySQL end up with, written where SQLite can express it. A SQLite database that applied
 * those two files before the address book existed keeps the unconstrained shape; the entities and the
 * services do not depend on the constraint, and the referential-integrity audit reports the same
 * dangling references it reports on any dialect.
 *
 * **Both probes are re-run safe.** Every statement is guarded by `hasTable` and `hasColumn`, and the
 * constraint itself is probed before it is added. TypeORM's query runner exposes `hasTable` and
 * `hasColumn` but no `hasConstraint`, so the constraint probe reads the table's own foreign keys
 * through `getTable` — the same question asked the other way round — which is what makes a second run
 * add nothing instead of failing on a duplicate constraint name.
 *
 * **`down` drops exactly the two constraints this migration is about.** On a database where this
 * file's `up` added them, that is what it added. On a fresh installation they arrived inline from
 * `…125` and `…165`; they are dropped here all the same, deliberately, because after this file the
 * address book's constraints belong to the address book's own migration set — re-running this file's
 * `up` restores them, and reverting the creating migrations removes the tables that carry them.
 */
export class AddAddressBookForeignKeys1791000000170 implements MigrationInterface {
	name = 'AddAddressBookForeignKeys1791000000170';

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
		// The role pivot first: it is the reference the address book was delivered beside, and the one
		// that cascades with its address.
		await this.addForeignKey(
			queryRunner,
			'address_role',
			'addressId',
			'FK_address_role_address',
			`ALTER TABLE "address_role" ADD CONSTRAINT "FK_address_role_address" FOREIGN KEY ("addressId") REFERENCES "address"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await this.addForeignKey(
			queryRunner,
			'payment_method_token',
			'billingAddressId',
			'FK_payment_method_token_address',
			`ALTER TABLE "payment_method_token" ADD CONSTRAINT "FK_payment_method_token_address" FOREIGN KEY ("billingAddressId") REFERENCES "address"("id") ON DELETE SET NULL ON UPDATE NO ACTION`
		);
	}

	/**
	 * PostgresDB Down Migration
	 *
	 * @param queryRunner
	 */
	public async postgresDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await this.dropForeignKey(queryRunner, 'payment_method_token', 'FK_payment_method_token_address');
		await this.dropForeignKey(queryRunner, 'address_role', 'FK_address_role_address');
	}

	/**
	 * SqliteDB and BetterSQlite3DB Up Migration
	 *
	 * A documented no-op: SQLite's `ALTER TABLE` has no `ADD CONSTRAINT` form, so a constraint cannot
	 * be attached to a table that already exists. A fresh SQLite installation gets both constraints
	 * inline from `1791000000125-CreatePaymentInstrumentTables` and
	 * `1791000000165-CreateAddressRoleTable`, which run after the address table exists and therefore
	 * take their guarded branches with the target present — see the class note.
	 *
	 * @param queryRunner
	 */
	public async sqliteUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		console.log(
			chalk.yellow(
				`${this.name}: SQLite cannot add a constraint to an existing table; a fresh installation declares both address references inline in the migrations that create their tables.`
			)
		);
	}

	/**
	 * SqliteDB and BetterSQlite3DB Down Migration
	 *
	 * A documented no-op, for the same reason: nothing was added on this dialect, and SQLite has no
	 * `DROP CONSTRAINT` form to remove an inline declaration with. Dropping the tables removes them.
	 *
	 * @param queryRunner
	 */
	public async sqliteDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		console.log(
			chalk.yellow(
				`${this.name}: SQLite carries both address references inside the table definitions, so there is no separate constraint to drop.`
			)
		);
	}

	/**
	 * MySQL Up Migration
	 *
	 * MySQL adds a foreign key to an existing table with the same `ALTER TABLE … ADD CONSTRAINT` form,
	 * so the two statements are the MySQL spelling of the Postgres pair. As on every other dialect the
	 * guards make a re-run a no-op.
	 *
	 * @param queryRunner
	 */
	public async mysqlUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await this.addForeignKey(
			queryRunner,
			'address_role',
			'addressId',
			'FK_address_role_address',
			'ALTER TABLE `address_role` ADD CONSTRAINT `FK_address_role_address` FOREIGN KEY (`addressId`) REFERENCES `address`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION'
		);
		await this.addForeignKey(
			queryRunner,
			'payment_method_token',
			'billingAddressId',
			'FK_payment_method_token_address',
			'ALTER TABLE `payment_method_token` ADD CONSTRAINT `FK_payment_method_token_address` FOREIGN KEY (`billingAddressId`) REFERENCES `address`(`id`) ON DELETE SET NULL ON UPDATE NO ACTION'
		);
	}

	/**
	 * MySQL Down Migration
	 *
	 * MySQL drops a foreign key by its own name rather than by the `CONSTRAINT` keyword.
	 *
	 * @param queryRunner
	 */
	public async mysqlDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await this.dropForeignKey(queryRunner, 'payment_method_token', 'FK_payment_method_token_address');
		await this.dropForeignKey(queryRunner, 'address_role', 'FK_address_role_address');
	}

	/**
	 * Adds one constraint, when every part of it is there to be constrained.
	 *
	 * Four states are skipped rather than failed, and each is a state a real installation reaches: the
	 * table may never have been created (a deployment that runs the kernel without the instruments); it
	 * may exist without the column (a database synchronised from an older entity set); the constraint
	 * may already be there, whether this file added it or the creating migration did; and the address
	 * table itself may be absent, which is the one case where the column exists and must keep pointing
	 * at nothing rather than fail the boot.
	 *
	 * @param queryRunner The migration's runner.
	 * @param table The table carrying the foreign key column.
	 * @param column The foreign key column.
	 * @param constraint The constraint's name, as the creating migrations spell it.
	 * @param statement The dialect's `ALTER TABLE … ADD CONSTRAINT` statement.
	 */
	private async addForeignKey(
		queryRunner: QueryRunner,
		table: string,
		column: string,
		constraint: string,
		statement: string
	): Promise<void> {
		if (!(await queryRunner.hasTable('address'))) {
			return;
		}

		if (!(await queryRunner.hasTable(table))) {
			return;
		}

		if (!(await queryRunner.hasColumn(table, column))) {
			return;
		}

		if (await this.hasForeignKey(queryRunner, table, constraint)) {
			return;
		}

		await queryRunner.query(statement);
		console.log(chalk.yellow(`${this.name}: added ${constraint} on ${table}("${column}") → "address"("id").`));
	}

	/**
	 * Drops one constraint when it is present.
	 *
	 * The probe is the same one the up path uses, so a revert of a database where the constraint never
	 * existed is a no-op rather than a failure — and the statement is only issued for a table that
	 * still exists, because reverting the kernel in order drops the pivot before the address book.
	 *
	 * @param queryRunner The migration's runner.
	 * @param table The table carrying the constraint.
	 * @param constraint The constraint's name.
	 */
	private async dropForeignKey(queryRunner: QueryRunner, table: string, constraint: string): Promise<void> {
		if (!(await queryRunner.hasTable(table))) {
			return;
		}

		if (!(await this.hasForeignKey(queryRunner, table, constraint))) {
			return;
		}

		const quote = (await queryRunner.connection.options.type) === DatabaseTypeEnum.mysql ? '`' : '"';
		const keyword = quote === '`' ? 'DROP FOREIGN KEY' : 'DROP CONSTRAINT';

		await queryRunner.query(`ALTER TABLE ${quote}${table}${quote} ${keyword} ${quote}${constraint}${quote}`);
	}

	/**
	 * Whether a table already carries a foreign key of one name.
	 *
	 * TypeORM's query runner answers `hasTable` and `hasColumn` directly but has no `hasConstraint`, so
	 * the question is asked of the table's own metadata: a constraint is present exactly when the table
	 * lists a foreign key under that name. Both the up and the down path use this one probe, which is
	 * what keeps a re-run and a revert idempotent.
	 *
	 * @param queryRunner The migration's runner.
	 * @param table The table to read.
	 * @param constraint The constraint's name.
	 * @returns True when the table already declares that foreign key.
	 */
	private async hasForeignKey(queryRunner: QueryRunner, table: string, constraint: string): Promise<boolean> {
		const existing = await queryRunner.getTable(table);

		return Boolean(existing?.foreignKeys?.some((foreignKey) => foreignKey.name === constraint));
	}
}
