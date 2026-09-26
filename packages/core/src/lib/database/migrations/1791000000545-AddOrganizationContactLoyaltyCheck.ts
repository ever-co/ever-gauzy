import { MigrationInterface, QueryRunner } from 'typeorm';
import * as chalk from 'chalk';
import { DatabaseTypeEnum } from '@gauzy/config';
import {
	addCheckConstraint,
	dropCheckConstraint,
	ICheckConstraintDefinition
} from '../check-constraint.helper';

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
 * it hold for every writer — the redemption path, an import, a seed and a manual correction alike. The
 * same rule is enforced at the point of write by `OrganizationContactSubscriber`, which is what carries
 * it on the embedded dialect.
 *
 * ## Dialects
 *
 * PostgreSQL and MySQL enforce a `CHECK`; MySQL only began *enforcing* `CHECK` in 8.0.16 — on an older
 * server the constraint is parsed and ignored, which is why the same rule is also enforced at the point
 * of write. SQLite cannot add a `CHECK` to an existing table at all, so its branch is a documented no-op
 * and the rule there is the write-time check plus the nightly audit that compares stored rows against the
 * documented invariants.
 *
 * The probes and the dialect choice are the shared helper's; this class states only what is being added.
 */
export class AddOrganizationContactLoyaltyCheck1791000000545 implements MigrationInterface {
	name = 'AddOrganizationContactLoyaltyCheck1791000000545';

	/** The one rule this tick carries. */
	private static readonly CONSTRAINTS: readonly ICheckConstraintDefinition[] = [
		{
			table: 'organization_contact',
			name: 'CHK_organization_contact_loyalty_nonneg',
			columns: ['loyaltyPoints'],
			postgres: `ALTER TABLE "organization_contact" ADD CONSTRAINT "CHK_organization_contact_loyalty_nonneg" CHECK ("loyaltyPoints" >= 0)`,
			mysql: `ALTER TABLE \`organization_contact\` ADD CONSTRAINT \`CHK_organization_contact_loyalty_nonneg\` CHECK (\`loyaltyPoints\` >= 0)`
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
	 * SqliteDB Up Migration
	 *
	 * @param queryRunner
	 */
	public async sqliteUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await this.addAll(queryRunner);
	}

	/**
	 * SqliteDB Down Migration
	 *
	 * @param queryRunner
	 */
	public async sqliteDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await this.dropAll(queryRunner);
	}

	/**
	 * PostgresDB Up Migration
	 *
	 * @param queryRunner
	 */
	public async postgresUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await this.addAll(queryRunner);
	}

	/**
	 * PostgresDB Down Migration
	 *
	 * @param queryRunner
	 */
	public async postgresDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await this.dropAll(queryRunner);
	}

	/**
	 * MySQL Up Migration
	 *
	 * @param queryRunner
	 */
	public async mysqlUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await this.addAll(queryRunner);
	}

	/**
	 * MySQL Down Migration
	 *
	 * @param queryRunner
	 */
	public async mysqlDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await this.dropAll(queryRunner);
	}

	/**
	 * Adds every rule this tick carries.
	 *
	 * @param queryRunner The runner the migration is executing on.
	 */
	private async addAll(queryRunner: QueryRunner): Promise<void> {
		for (const constraint of AddOrganizationContactLoyaltyCheck1791000000545.CONSTRAINTS) {
			await addCheckConstraint(queryRunner, constraint, this.name);
		}
	}

	/**
	 * Drops every rule this tick carries.
	 *
	 * @param queryRunner The runner the migration is executing on.
	 */
	private async dropAll(queryRunner: QueryRunner): Promise<void> {
		for (const constraint of AddOrganizationContactLoyaltyCheck1791000000545.CONSTRAINTS) {
			await dropCheckConstraint(queryRunner, constraint);
		}
	}
}
