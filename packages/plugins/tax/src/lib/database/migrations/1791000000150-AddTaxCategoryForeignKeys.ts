import { MigrationInterface, QueryRunner } from 'typeorm';
import * as chalk from 'chalk';
import { DatabaseTypeEnum } from '@gauzy/config';

/**
 * Adds the two foreign keys that point at `tax_category`.
 *
 * Both columns are created by the core kernel — `product_variant.taxCategoryId` with the product
 * extension and `organization_contact.taxCategoryId` with the party extension — and neither carries its
 * constraint there, because a core migration never waits for a plugin to be installed. This set is what
 * creates their target, so this is the migration that constrains them, and it runs after
 * `CreateTaxTables1791000000140` for exactly that reason.
 *
 * Both are optional references and both are `SET NULL`: a variant that loses its tax category falls back
 * to the organization's default category and then to the legacy per-variant tax value, and a party that
 * loses one is taxed like any other party. Neither deletion may take a product or a customer with it.
 */
export class AddTaxCategoryForeignKeys1791000000150 implements MigrationInterface {
	name = 'AddTaxCategoryForeignKeys1791000000150';

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
		await queryRunner.query(
			`ALTER TABLE "product_variant" ADD CONSTRAINT "FK_product_variant_tax_category" FOREIGN KEY ("taxCategoryId") REFERENCES "tax_category"("id") ON DELETE SET NULL ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "organization_contact" ADD CONSTRAINT "FK_organization_contact_tax_category" FOREIGN KEY ("taxCategoryId") REFERENCES "tax_category"("id") ON DELETE SET NULL ON UPDATE NO ACTION`
		);
	}

	/**
	 * PostgresDB Down Migration
	 *
	 * @param queryRunner
	 */
	public async postgresDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(
			`ALTER TABLE "organization_contact" DROP CONSTRAINT "FK_organization_contact_tax_category"`
		);
		await queryRunner.query(`ALTER TABLE "product_variant" DROP CONSTRAINT "FK_product_variant_tax_category"`);
	}

	/**
	 * SqliteDB and BetterSQlite3DB Up Migration
	 *
	 * A SQLite table cannot be given a foreign key after it was created, and rebuilding a core table from
	 * a plugin migration is not an option: the columns of `product_variant` and `organization_contact` are
	 * owned by the kernel, and a copy taken here would drift from them. The two constraints are therefore
	 * declared when those tables are created on SQLite — which is what the kernel's own extension
	 * migrations and the ORM's schema synchronisation do — and this body is deliberately empty. SQLite
	 * does not enforce foreign keys unless `PRAGMA foreign_keys` is on, so nothing is left unenforced by
	 * the omission; the rule is the service check on the dialect.
	 *
	 * @param queryRunner
	 */
	public async sqliteUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		return;
	}

	/**
	 * SqliteDB and BetterSQlite3DB Down Migration
	 *
	 * See the Up body: there is no constraint on a SQLite database for this migration to drop.
	 *
	 * @param queryRunner
	 */
	public async sqliteDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		return;
	}

	/**
	 * MySQL Up Migration
	 *
	 * @param queryRunner
	 */
	public async mysqlUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(
			`ALTER TABLE \`product_variant\` ADD CONSTRAINT \`FK_product_variant_tax_category\` FOREIGN KEY (\`taxCategoryId\`) REFERENCES \`tax_category\`(\`id\`) ON DELETE SET NULL ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`organization_contact\` ADD CONSTRAINT \`FK_organization_contact_tax_category\` FOREIGN KEY (\`taxCategoryId\`) REFERENCES \`tax_category\`(\`id\`) ON DELETE SET NULL ON UPDATE NO ACTION`
		);
	}

	/**
	 * MySQL Down Migration
	 *
	 * @param queryRunner
	 */
	public async mysqlDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(
			`ALTER TABLE \`organization_contact\` DROP FOREIGN KEY \`FK_organization_contact_tax_category\``
		);
		await queryRunner.query(`ALTER TABLE \`product_variant\` DROP FOREIGN KEY \`FK_product_variant_tax_category\``);
	}
}
