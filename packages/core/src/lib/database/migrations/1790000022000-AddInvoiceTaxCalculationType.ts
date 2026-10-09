import { MigrationInterface, QueryRunner } from 'typeorm';
import * as chalk from 'chalk';
import { DatabaseTypeEnum } from '@gauzy/config';

/**
 * Adds `invoice.taxCalculationType`: how an invoice's second tax combines with the first — `SIMPLE`
 * (both on the item amount) or `COMPOSED` (the second on the amount plus the first). It was a field of
 * the add page only, so editing a compound invoice recalculated and saved it with simple tax.
 *
 * Nullable with no default: existing invoices keep NULL, which reads as SIMPLE — what every invoice was
 * recalculated with on edit until now. No existing row is read or written.
 *
 * Safe to run on a live database: on Postgres a nullable column without a default is a catalog-only
 * change. Running `up` twice is harmless (`IF NOT EXISTS` on Postgres, a column check elsewhere), and a
 * transaction-scoped advisory lock makes two API processes that boot at the same time against one
 * database run it one after the other.
 *
 * `down` drops the column.
 */
export class AddInvoiceTaxCalculationType1790000022000 implements MigrationInterface {
	name = 'AddInvoiceTaxCalculationType1790000022000';

	/** Advisory lock key that serialises concurrent runs of this migration on Postgres. */
	private readonly advisoryLockKey = 1790000022000;

	public async up(queryRunner: QueryRunner): Promise<void> {
		console.log(chalk.yellow(this.name + ' start running!'));

		switch (queryRunner.connection.options.type as DatabaseTypeEnum) {
			case DatabaseTypeEnum.postgres:
				if (queryRunner.isTransactionActive) {
					await queryRunner.query(`SELECT pg_advisory_xact_lock($1)`, [this.advisoryLockKey]);
				}
				await queryRunner.query(
					`ALTER TABLE "invoice" ADD COLUMN IF NOT EXISTS "taxCalculationType" character varying`
				);
				break;
			case DatabaseTypeEnum.sqlite:
			case DatabaseTypeEnum.betterSqlite3:
				if (!(await queryRunner.hasColumn('invoice', 'taxCalculationType'))) {
					await queryRunner.query(`ALTER TABLE "invoice" ADD COLUMN "taxCalculationType" varchar`);
				}
				break;
			case DatabaseTypeEnum.mysql:
				if (!(await queryRunner.hasColumn('invoice', 'taxCalculationType'))) {
					await queryRunner.query('ALTER TABLE `invoice` ADD `taxCalculationType` varchar(255) NULL');
				}
				break;
			default:
				throw new Error(`Unsupported database: ${queryRunner.connection.options.type}`);
		}
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		console.log(chalk.yellow(this.name + ' reverting changes!'));

		switch (queryRunner.connection.options.type as DatabaseTypeEnum) {
			case DatabaseTypeEnum.postgres:
				await queryRunner.query(`ALTER TABLE "invoice" DROP COLUMN IF EXISTS "taxCalculationType"`);
				break;
			case DatabaseTypeEnum.sqlite:
			case DatabaseTypeEnum.betterSqlite3:
				if (await queryRunner.hasColumn('invoice', 'taxCalculationType')) {
					await queryRunner.query(`ALTER TABLE "invoice" DROP COLUMN "taxCalculationType"`);
				}
				break;
			case DatabaseTypeEnum.mysql:
				if (await queryRunner.hasColumn('invoice', 'taxCalculationType')) {
					await queryRunner.query('ALTER TABLE `invoice` DROP COLUMN `taxCalculationType`');
				}
				break;
			default:
				throw new Error(`Unsupported database: ${queryRunner.connection.options.type}`);
		}
	}
}
