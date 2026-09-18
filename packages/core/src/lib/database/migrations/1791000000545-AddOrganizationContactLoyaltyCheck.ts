import { MigrationInterface, QueryRunner } from 'typeorm';
import * as chalk from 'chalk';
import { DatabaseTypeEnum } from '@gauzy/config';

/**
 * Adds the check that a party's loyalty balance is never negative, now that the column it guards exists
 * on installations that were created before this migration set.
 *
 * ## Why it was missing
 *
 * `organization_contact.loyaltyPoints` was added as a plain column by
 * `1791000000095-AlterCoreTablesForExtensions`. That migration adds columns to tables it does not
 * create, so it can express a default but it cannot attach a rule to a table whose rows already exist —
 * a `CHECK` added to a populated table fails on the rows the rule would already refuse, and the
 * pre-existing rows of a live installation are exactly the rows this migration set may not assume
 * anything about. The companion constraint therefore runs on its own tick, after the column has been
 * backfilled to `0` by `0095`, and is the tick this migration occupies.
 *
 * ## Why the column carries a rule at all
 *
 * The balance is a **cache of the `LOYALTY` adjustment movements**, written by the ledger and read by a
 * checkout that needs one number rather than a sum. A cached sum can drift, and the one drift a rule can
 * catch at the storage layer is a negative balance: no sequence of movements produces one, so a negative
 * value is always a write that went wrong. The rule is stated where the value lands, which is what makes
 * it hold for every writer — the redemption path, an import, a seed and a manual correction alike.
 *
 * ## Dialects
 *
 * PostgreSQL and MySQL enforce a `CHECK`; the statement is a single `ALTER TABLE` each, probed so an
 * installation that already carries the constraint and a re-run are both no-ops. MySQL only began
 * *enforcing* `CHECK` in 8.0.16 — on an older server the constraint is parsed and ignored, which is why
 * the same rule is also enforced at the point of write by `OrganizationContactSubscriber`. SQLite cannot
 * add a `CHECK` to an existing table at all, so its branch is a documented no-op and the rule there is
 * the write-time check plus the nightly audit that compares stored rows against the documented
 * invariants.
 */
export class AddOrganizationContactLoyaltyCheck1791000000545 implements MigrationInterface {
	name = 'AddOrganizationContactLoyaltyCheck1791000000545';

	/** The table the rule is attached to, and the column it reads. */
	private static readonly TABLE = 'organization_contact';
	private static readonly COLUMN = 'loyaltyPoints';

	/** The constraint, and the rule it carries. */
	private static readonly CONSTRAINT = 'CHK_organization_contact_loyalty_nonneg';

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
	 * that dialect: `loyaltyPoints` stays exactly as `1791000000095-AlterCoreTablesForExtensions` added
	 * it, and the rule is carried by the write-time check and by the nightly audit. The method exists,
	 * rather than the branch being folded into `up`, because every migration in this platform declares
	 * one per dialect and a reader has to be able to see that SQLite was considered rather than
	 * forgotten.
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
		await this.addCheck(
			queryRunner,
			`ALTER TABLE "organization_contact" ADD CONSTRAINT "${AddOrganizationContactLoyaltyCheck1791000000545.CONSTRAINT}" CHECK ("loyaltyPoints" >= 0)`
		);
	}

	/**
	 * PostgresDB Down Migration
	 *
	 * @param queryRunner
	 */
	public async postgresDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		if (!(await this.hasCheck(queryRunner))) return;

		await queryRunner.query(
			`ALTER TABLE "organization_contact" DROP CONSTRAINT "${AddOrganizationContactLoyaltyCheck1791000000545.CONSTRAINT}"`
		);
	}

	/**
	 * MySQL Up Migration
	 *
	 * @param queryRunner
	 */
	public async mysqlUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await this.addCheck(
			queryRunner,
			`ALTER TABLE \`organization_contact\` ADD CONSTRAINT \`${AddOrganizationContactLoyaltyCheck1791000000545.CONSTRAINT}\` CHECK (\`loyaltyPoints\` >= 0)`
		);
	}

	/**
	 * MySQL Down Migration
	 *
	 * @param queryRunner
	 */
	public async mysqlDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		if (!(await this.hasCheck(queryRunner))) return;

		await queryRunner.query(
			`ALTER TABLE \`organization_contact\` DROP CONSTRAINT \`${AddOrganizationContactLoyaltyCheck1791000000545.CONSTRAINT}\``
		);
	}

	/**
	 * Adds the constraint when the column, the absence of the constraint and the table all allow it.
	 *
	 * The probes are what make the migration safe on three kinds of installation: one whose
	 * `organization_contact` predates the commercial columns, one that already carries the constraint
	 * because its own set created it, and one where a row the rule would refuse is already stored — in
	 * which case the `ALTER` fails loudly rather than being skipped, because a balance that is already
	 * negative is a defect the constraint exists to surface and the migration report is where it belongs.
	 *
	 * @param queryRunner The runner the migration is executing on.
	 * @param statement The dialect's own ALTER statement.
	 */
	private async addCheck(queryRunner: QueryRunner, statement: string): Promise<void> {
		const table = AddOrganizationContactLoyaltyCheck1791000000545.TABLE;

		if (!(await queryRunner.hasTable(table))) return;
		if (!(await queryRunner.hasColumn(table, AddOrganizationContactLoyaltyCheck1791000000545.COLUMN))) return;
		if (await this.hasCheck(queryRunner)) return;

		await queryRunner.query(statement);
		console.log(
			chalk.yellow(
				`${this.name}: added ${AddOrganizationContactLoyaltyCheck1791000000545.CONSTRAINT} on ${table}("${AddOrganizationContactLoyaltyCheck1791000000545.COLUMN}" >= 0).`
			)
		);
	}

	/**
	 * Whether the contact table already carries the constraint.
	 *
	 * Read through the table metadata rather than through `information_schema`, because that is the one
	 * description of a table all three dialects answer through TypeORM and this migration needs the same
	 * answer on each.
	 *
	 * @param queryRunner The runner the migration is executing on.
	 * @returns Whether the constraint is already there.
	 */
	private async hasCheck(queryRunner: QueryRunner): Promise<boolean> {
		try {
			const table = await queryRunner.getTable(AddOrganizationContactLoyaltyCheck1791000000545.TABLE);

			return Boolean(
				table?.checks?.some(
					(check) => check.name === AddOrganizationContactLoyaltyCheck1791000000545.CONSTRAINT
				)
			);
		} catch {
			// A table that cannot be described is a table this migration has nothing to add to.
			return true;
		}
	}
}
