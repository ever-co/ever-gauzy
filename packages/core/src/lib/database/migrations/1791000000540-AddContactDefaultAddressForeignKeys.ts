import { MigrationInterface, QueryRunner } from 'typeorm';
import * as chalk from 'chalk';
import { DatabaseTypeEnum } from '@gauzy/config';

/**
 * Adds the two default-address references a party carries, now that the address book exists.
 *
 * ## Why they were missing
 *
 * `organization_contact.defaultShippingAddressId` and `.defaultBillingAddressId` were added as plain
 * columns by `1791000000095-AlterCoreTablesForExtensions`, which runs **before** the address book was
 * delivered. A constraint onto a table that does not exist cannot be created, so the two columns were
 * left unconstrained, and `1791000000092-CreateAddressTable` — which runs after `0095` — is what makes
 * them constrainable now.
 *
 * The columns are the **authority** for the party's defaults rather than a mirror of anything: the
 * address row's own booleans are the mirror, and the address-role pivot is the third location the same
 * fact is kept in step across. A default that names nothing is therefore the state these constraints
 * exist to prevent: without them a party could be left pointing at an address row that was removed.
 *
 * `ON DELETE SET NULL` is the action, and it is the one the specification states (`05` §2.8): removing
 * an address clears the default rather than refusing the removal or deleting the party, because "this
 * party has no default shipping address" is a state the checkout handles and a cascaded contact is not.
 *
 * ## Dialects
 *
 * PostgreSQL and MySQL add the constraints, each probed so an installation that already has them and a
 * re-run are both no-ops. SQLite cannot add a constraint to an existing table, so its branch is a
 * documented no-op: an installation created by this migration set carries the two columns
 * unconstrained, exactly as `0095` left them, because the address table did not exist when it ran and
 * `0092` cannot retro-fit a constraint onto a table it did not create.
 */
export class AddContactDefaultAddressForeignKeys1791000000540 implements MigrationInterface {
	name = 'AddContactDefaultAddressForeignKeys1791000000540';

	/** The two references, with the constraint each is known by. */
	private static readonly REFERENCES: ReadonlyArray<{
		readonly column: string;
		readonly constraint: string;
	}> = [
		{ column: 'defaultShippingAddressId', constraint: 'FK_organization_contact_default_shipping_address' },
		{ column: 'defaultBillingAddressId', constraint: 'FK_organization_contact_default_billing_address' }
	];

	/** The table the references hang off, and the table they point at. */
	private static readonly TABLE = 'organization_contact';
	private static readonly TARGET = 'address';

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
	 * SQLite cannot add a constraint to an existing table, so there is nothing this migration can do on
	 * that dialect: the two columns stay exactly as `1791000000095-AlterCoreTablesForExtensions` added
	 * them. The method exists, rather than the branch being folded into `up`, because every migration in
	 * this platform declares one per dialect and a reader has to be able to see that SQLite was
	 * considered rather than forgotten.
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
		for (const reference of AddContactDefaultAddressForeignKeys1791000000540.REFERENCES) {
			await this.addForeignKey(
				queryRunner,
				reference,
				`ALTER TABLE "organization_contact" ADD CONSTRAINT "${reference.constraint}" FOREIGN KEY ("${reference.column}") REFERENCES "address"("id") ON DELETE SET NULL ON UPDATE NO ACTION`
			);
		}
	}

	/**
	 * PostgresDB Down Migration
	 *
	 * @param queryRunner
	 */
	public async postgresDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		for (const reference of AddContactDefaultAddressForeignKeys1791000000540.REFERENCES) {
			if (!(await this.hasForeignKey(queryRunner, reference.constraint))) continue;

			await queryRunner.query(
				`ALTER TABLE "organization_contact" DROP CONSTRAINT "${reference.constraint}"`
			);
		}
	}

	/**
	 * MySQL Up Migration
	 *
	 * @param queryRunner
	 */
	public async mysqlUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		for (const reference of AddContactDefaultAddressForeignKeys1791000000540.REFERENCES) {
			await this.addForeignKey(
				queryRunner,
				reference,
				`ALTER TABLE \`organization_contact\` ADD CONSTRAINT \`${reference.constraint}\` FOREIGN KEY (\`${reference.column}\`) REFERENCES \`address\`(\`id\`) ON DELETE SET NULL ON UPDATE NO ACTION`
			);
		}
	}

	/**
	 * MySQL Down Migration
	 *
	 * @param queryRunner
	 */
	public async mysqlDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		for (const reference of AddContactDefaultAddressForeignKeys1791000000540.REFERENCES) {
			if (!(await this.hasForeignKey(queryRunner, reference.constraint))) continue;

			await queryRunner.query(
				`ALTER TABLE \`organization_contact\` DROP CONSTRAINT \`${reference.constraint}\``
			);
		}
	}

	/**
	 * Adds one constraint when the column, its target and the absence of the constraint all allow it.
	 *
	 * The probes are what make the migration safe on three kinds of installation: one that never had the
	 * address book, one that already carries the constraint because its own set created it, and one where
	 * the column was never added at all.
	 *
	 * @param queryRunner The runner the migration is executing on.
	 * @param reference The column and constraint name to add.
	 * @param statement The dialect's own ALTER statement.
	 */
	private async addForeignKey(
		queryRunner: QueryRunner,
		reference: { readonly column: string; readonly constraint: string },
		statement: string
	): Promise<void> {
		if (!(await queryRunner.hasTable(AddContactDefaultAddressForeignKeys1791000000540.TARGET))) return;
		if (!(await queryRunner.hasTable(AddContactDefaultAddressForeignKeys1791000000540.TABLE))) return;
		if (!(await queryRunner.hasColumn(AddContactDefaultAddressForeignKeys1791000000540.TABLE, reference.column))) {
			return;
		}
		if (await this.hasForeignKey(queryRunner, reference.constraint)) return;

		await queryRunner.query(statement);
		console.log(
			chalk.yellow(
				`${this.name}: added ${reference.constraint} on organization_contact("${reference.column}") → "address"("id").`
			)
		);
	}

	/**
	 * Whether the contact table already carries a constraint of a given name.
	 *
	 * Read through the table metadata rather than through `information_schema`, because that is the one
	 * description of a table all three dialects answer through TypeORM and this migration needs the same
	 * answer on each.
	 *
	 * @param queryRunner The runner the migration is executing on.
	 * @param name The constraint name.
	 * @returns Whether the constraint is already there.
	 */
	private async hasForeignKey(queryRunner: QueryRunner, name: string): Promise<boolean> {
		try {
			const table = await queryRunner.getTable(AddContactDefaultAddressForeignKeys1791000000540.TABLE);

			return Boolean(table?.foreignKeys?.some((foreignKey) => foreignKey.name === name));
		} catch {
			// A table that cannot be described is a table this migration has nothing to add to.
			return true;
		}
	}
}
