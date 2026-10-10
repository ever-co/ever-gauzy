import { MigrationInterface, QueryRunner } from 'typeorm';
import * as chalk from 'chalk';
import { DatabaseTypeEnum } from '@gauzy/config';

/**
 * Adds the foreign key of the party's price list.
 *
 * `organization_contact.priceListId` is created by the kernel migration that extends the party table,
 * without its constraint: a core migration never waits for a plugin to be installed, and the column
 * references a table this package owns. This migration is the other half of that boundary — it runs
 * after `CreatePricingTables1791000000120` created `price_list`, and adds the constraint the column
 * was created without.
 *
 * The delete rule is `SET NULL`, not `CASCADE`: a party is a CRM record that outlives a commercial
 * agreement, so deleting a price list must leave the contact in place with no list assigned rather
 * than delete the contact. The index over the column belongs to the kernel migration that created it,
 * so it is not created again here.
 */
export class AddPriceListForeignKeys1791000000130 implements MigrationInterface {
	name = 'AddPriceListForeignKeys1791000000130';

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
			`ALTER TABLE "organization_contact" ADD CONSTRAINT "FK_organization_contact_price_list" FOREIGN KEY ("priceListId") REFERENCES "price_list"("id") ON DELETE SET NULL ON UPDATE NO ACTION`
		);
	}

	/**
	 * PostgresDB Down Migration
	 *
	 * @param queryRunner
	 */
	public async postgresDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(
			`ALTER TABLE "organization_contact" DROP CONSTRAINT "FK_organization_contact_price_list"`
		);
	}

	/**
	 * SqliteDB and BetterSQlite3DB Up Migration
	 *
	 * SQLite cannot add a constraint to a table after it has been created, so the column stays without
	 * its foreign key on this dialect — the same boundary the repository's own migrations document.
	 * The column exists and is indexed; the service that assigns a party's price list resolves the
	 * list inside the caller's own organization and refuses an unknown one, so the referential rule is
	 * enforced where it is written rather than by the database.
	 *
	 * @param queryRunner
	 */
	public async sqliteUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		void queryRunner;
	}

	/**
	 * SqliteDB and BetterSQlite3DB Down Migration
	 *
	 * The inverse of a no-op: there is no constraint to drop on this dialect.
	 *
	 * @param queryRunner
	 */
	public async sqliteDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		void queryRunner;
	}

	/**
	 * MySQL Up Migration
	 *
	 * @param queryRunner
	 */
	public async mysqlUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(
			`ALTER TABLE \`organization_contact\` ADD CONSTRAINT \`FK_organization_contact_price_list\` FOREIGN KEY (\`priceListId\`) REFERENCES \`price_list\`(\`id\`) ON DELETE SET NULL ON UPDATE NO ACTION`
		);
	}

	/**
	 * MySQL Down Migration
	 *
	 * @param queryRunner
	 */
	public async mysqlDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(
			`ALTER TABLE \`organization_contact\` DROP FOREIGN KEY \`FK_organization_contact_price_list\``
		);
	}
}
