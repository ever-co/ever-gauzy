import { MigrationInterface, QueryRunner } from 'typeorm';
import * as chalk from 'chalk';
import { DatabaseTypeEnum } from '@gauzy/config';

/**
 * `tenant.stripeCustomerId` — the Stripe customer a tenant bills through on hosted deployments.
 *
 * Persisted rather than resolved from the owner's email on each request: an email is mutable and is
 * not unique across Stripe customers, so it cannot identify a billing account reliably. The
 * registration guard still matches on email, but only because at that point no tenant exists yet.
 *
 * Nullable with no default, and nothing in the platform requires it: every self-hosted install, and
 * every tenant created before billing was configured, simply leaves it NULL.
 *
 * Indexed because both the billing endpoints and the Stripe webhook resolve a tenant by this value.
 *
 * SQLite takes a plain `ALTER TABLE … ADD COLUMN` here — nullable, no constraint — so the table is
 * not rebuilt through a `temporary_*` copy. That copy would have to restate `tenant`'s full current
 * DDL and every one of its indexes, and one stale column there silently drops data. The matching
 * `DROP COLUMN` needs SQLite >= 3.35; the bundled better-sqlite3 ships 3.51.
 */
export class AddTenantStripeCustomerId1790000008000 implements MigrationInterface {
	name = 'AddTenantStripeCustomerId1790000008000';

	/** Each driver's four statements, already quoted the way that driver expects. */
	private static readonly DIALECTS = {
		postgres: {
			addColumn: `ALTER TABLE "tenant" ADD "stripeCustomerId" character varying`,
			createIndex: `CREATE INDEX "IDX_tenant_stripe_customer_id" ON "tenant" ("stripeCustomerId")`,
			dropIndex: `DROP INDEX "IDX_tenant_stripe_customer_id"`,
			dropColumn: `ALTER TABLE "tenant" DROP COLUMN "stripeCustomerId"`
		},
		sqlite: {
			addColumn: `ALTER TABLE "tenant" ADD COLUMN "stripeCustomerId" varchar`,
			createIndex: `CREATE INDEX "IDX_tenant_stripe_customer_id" ON "tenant" ("stripeCustomerId")`,
			dropIndex: `DROP INDEX "IDX_tenant_stripe_customer_id"`,
			dropColumn: `ALTER TABLE "tenant" DROP COLUMN "stripeCustomerId"`
		},
		mysql: {
			addColumn: 'ALTER TABLE `tenant` ADD `stripeCustomerId` varchar(255) NULL',
			createIndex: 'CREATE INDEX `IDX_tenant_stripe_customer_id` ON `tenant` (`stripeCustomerId`)',
			// MySQL is the odd one out: it cannot drop an index without naming its table.
			dropIndex: 'DROP INDEX `IDX_tenant_stripe_customer_id` ON `tenant`',
			dropColumn: 'ALTER TABLE `tenant` DROP COLUMN `stripeCustomerId`'
		}
	} as const;

	public async up(queryRunner: QueryRunner): Promise<void> {
		console.log(chalk.yellow(`${this.name} start running!`));

		const dialect = this.dialectFor(queryRunner);
		await queryRunner.query(dialect.addColumn);
		await queryRunner.query(dialect.createIndex);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		console.log(chalk.yellow(`${this.name} reverting changes!`));

		const dialect = this.dialectFor(queryRunner);
		await queryRunner.query(dialect.dropIndex);
		await queryRunner.query(dialect.dropColumn);
	}

	/** Resolves the connection's driver to its dialect entry; both SQLite drivers share one. */
	private dialectFor(queryRunner: QueryRunner) {
		const type = queryRunner.connection.options.type as DatabaseTypeEnum;

		if (type === DatabaseTypeEnum.postgres) return AddTenantStripeCustomerId1790000008000.DIALECTS.postgres;
		if (type === DatabaseTypeEnum.mysql) return AddTenantStripeCustomerId1790000008000.DIALECTS.mysql;
		if (type === DatabaseTypeEnum.sqlite || type === DatabaseTypeEnum.betterSqlite3) {
			return AddTenantStripeCustomerId1790000008000.DIALECTS.sqlite;
		}

		throw new Error(`Unsupported database: ${type}`);
	}
}
