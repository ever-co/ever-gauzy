import { MigrationInterface, QueryRunner } from 'typeorm';
import * as chalk from 'chalk';
import { DatabaseTypeEnum } from '@gauzy/config';

/**
 * Make `tenant.stripeCustomerId` unique.
 *
 * Two tenants must never point at one Stripe customer. Whichever of them opened the billing page
 * would be reading the other's invoices, card and subscription, and could cancel it — so this is a
 * tenant-isolation boundary, not a tidiness constraint, and it belongs in the schema rather than
 * only in the two code paths that write the column.
 *
 * Both of those paths already refuse to create a duplicate. They are checks-then-write, though, so
 * two concurrent requests can both pass the check before either writes; the database is the only
 * place that can actually make it impossible. Application code keeps the friendly refusal, this
 * keeps the guarantee.
 *
 * A UNIQUE index still permits many NULLs on every dialect we support (Postgres, MySQL and SQLite
 * all treat NULLs as distinct here), which matters because NULL is the normal state: every
 * self-hosted install and every tenant created before billing was configured leaves it unset.
 *
 * There is nothing to clean up first. The column was introduced one migration ago and is written
 * only when a Stripe key is configured, so no deployment can hold a duplicate yet — which is exactly
 * why this is worth doing now rather than after the first collision.
 */
export class UniqueTenantStripeCustomer1790000009000 implements MigrationInterface {
	name = 'UniqueTenantStripeCustomer1790000009000';

	public async up(queryRunner: QueryRunner): Promise<void> {
		console.log(chalk.yellow(`${this.name} start running!`));

		// Cast first: TypeORM's own option union does not include every DatabaseTypeEnum member,
		// so switching on the raw value will not narrow. The sibling migration does the same.
		const type = queryRunner.connection.options.type as DatabaseTypeEnum;

		switch (type) {
			case DatabaseTypeEnum.postgres:
				await queryRunner.query(`DROP INDEX "IDX_tenant_stripe_customer_id"`);
				await queryRunner.query(
					`CREATE UNIQUE INDEX "IDX_tenant_stripe_customer_id" ON "tenant" ("stripeCustomerId")`
				);
				break;

			case DatabaseTypeEnum.sqlite:
			case DatabaseTypeEnum.betterSqlite3:
				await queryRunner.query(`DROP INDEX "IDX_tenant_stripe_customer_id"`);
				await queryRunner.query(
					`CREATE UNIQUE INDEX "IDX_tenant_stripe_customer_id" ON "tenant" ("stripeCustomerId")`
				);
				break;

			case DatabaseTypeEnum.mysql:
				// MySQL alone cannot drop an index without naming its table.
				await queryRunner.query('DROP INDEX `IDX_tenant_stripe_customer_id` ON `tenant`');
				await queryRunner.query(
					'CREATE UNIQUE INDEX `IDX_tenant_stripe_customer_id` ON `tenant` (`stripeCustomerId`)'
				);
				break;

			default:
				throw new Error(`Unsupported database: ${type}`);
		}
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		console.log(chalk.yellow(`${this.name} reverting changes!`));

		// Cast first: TypeORM's own option union does not include every DatabaseTypeEnum member,
		// so switching on the raw value will not narrow. The sibling migration does the same.
		const type = queryRunner.connection.options.type as DatabaseTypeEnum;

		switch (type) {
			case DatabaseTypeEnum.postgres:
				await queryRunner.query(`DROP INDEX "IDX_tenant_stripe_customer_id"`);
				await queryRunner.query(`CREATE INDEX "IDX_tenant_stripe_customer_id" ON "tenant" ("stripeCustomerId")`);
				break;

			case DatabaseTypeEnum.sqlite:
			case DatabaseTypeEnum.betterSqlite3:
				await queryRunner.query(`DROP INDEX "IDX_tenant_stripe_customer_id"`);
				await queryRunner.query(`CREATE INDEX "IDX_tenant_stripe_customer_id" ON "tenant" ("stripeCustomerId")`);
				break;

			case DatabaseTypeEnum.mysql:
				await queryRunner.query('DROP INDEX `IDX_tenant_stripe_customer_id` ON `tenant`');
				await queryRunner.query(
					'CREATE INDEX `IDX_tenant_stripe_customer_id` ON `tenant` (`stripeCustomerId`)'
				);
				break;

			default:
				throw new Error(`Unsupported database: ${type}`);
		}
	}
}
