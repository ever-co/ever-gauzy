/**
 * Adds the level-state columns the stock engine reads and writes to the platform's stock tables.
 *
 * `warehouse_product` and `warehouse_product_variant` already model stock on hand, so the inventory
 * ledger is written beside them rather than into a second stock table. The engine needs more of the
 * level state than the single `quantity` column those tables were created with — what is held by open
 * reservations, the buffer that has to stay unsold, what is already on its way, the backorder policy
 * and the counter the conditional level write is guarded by.
 *
 * These are pre-existing tables, so the columns are added here and not only on the entities: a column
 * declared on an entity but absent from a migration exists on an installation that was synchronised
 * from the entities and is missing on a clean install, where the first write that names it fails.
 *
 * Every column is nullable or defaulted, so nothing is rebuilt: the copy through a `temporary_*` table
 * that a generated migration uses would have to restate the full current DDL of both tables and every
 * one of their indexes, and a single stale column in that copy silently drops data. SQLite supports
 * plain `ALTER TABLE … ADD COLUMN` for added columns of this shape, and `DROP COLUMN` (down) needs
 * SQLite ≥ 3.35.
 */
import { MigrationInterface, QueryRunner } from 'typeorm';
import * as chalk from 'chalk';
import { DatabaseTypeEnum } from '@gauzy/config';

/**
 * Adds the stock-level columns to the level tables.
 */
export class AddStockLevelColumns1791000000090 implements MigrationInterface {
	name = 'AddStockLevelColumns1791000000090';

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
		await queryRunner.query(`ALTER TABLE "warehouse_product_variant" ADD "reservedQuantity" numeric DEFAULT '0'`);
		await queryRunner.query(`ALTER TABLE "warehouse_product_variant" ADD "safetyStock" numeric DEFAULT '0'`);
		await queryRunner.query(`ALTER TABLE "warehouse_product_variant" ADD "incomingQuantity" numeric DEFAULT '0'`);
		await queryRunner.query(`ALTER TABLE "warehouse_product_variant" ADD "backorderLimit" numeric`);
		await queryRunner.query(`ALTER TABLE "warehouse_product_variant" ADD "isUnlimited" boolean DEFAULT false`);
		await queryRunner.query(`ALTER TABLE "warehouse_product_variant" ADD "allowBackorder" boolean DEFAULT false`);
		await queryRunner.query(`ALTER TABLE "warehouse_product_variant" ADD "version" integer NOT NULL DEFAULT 1`);
		await queryRunner.query(`ALTER TABLE "warehouse_product" ADD "reservedQuantity" numeric DEFAULT '0'`);
	}

	/**
	 * PostgresDB Down Migration
	 *
	 * @param queryRunner
	 */
	public async postgresDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(`ALTER TABLE "warehouse_product" DROP COLUMN "reservedQuantity"`);
		await queryRunner.query(`ALTER TABLE "warehouse_product_variant" DROP COLUMN "version"`);
		await queryRunner.query(`ALTER TABLE "warehouse_product_variant" DROP COLUMN "allowBackorder"`);
		await queryRunner.query(`ALTER TABLE "warehouse_product_variant" DROP COLUMN "isUnlimited"`);
		await queryRunner.query(`ALTER TABLE "warehouse_product_variant" DROP COLUMN "backorderLimit"`);
		await queryRunner.query(`ALTER TABLE "warehouse_product_variant" DROP COLUMN "incomingQuantity"`);
		await queryRunner.query(`ALTER TABLE "warehouse_product_variant" DROP COLUMN "safetyStock"`);
		await queryRunner.query(`ALTER TABLE "warehouse_product_variant" DROP COLUMN "reservedQuantity"`);
	}

	/**
	 * SqliteDB and BetterSQlite3DB Up Migration
	 *
	 * @param queryRunner
	 */
	public async sqliteUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(`ALTER TABLE "warehouse_product_variant" ADD COLUMN "reservedQuantity" numeric DEFAULT (0)`);
		await queryRunner.query(`ALTER TABLE "warehouse_product_variant" ADD COLUMN "safetyStock" numeric DEFAULT (0)`);
		await queryRunner.query(`ALTER TABLE "warehouse_product_variant" ADD COLUMN "incomingQuantity" numeric DEFAULT (0)`);
		await queryRunner.query(`ALTER TABLE "warehouse_product_variant" ADD COLUMN "backorderLimit" numeric`);
		await queryRunner.query(`ALTER TABLE "warehouse_product_variant" ADD COLUMN "isUnlimited" boolean DEFAULT (0)`);
		await queryRunner.query(`ALTER TABLE "warehouse_product_variant" ADD COLUMN "allowBackorder" boolean DEFAULT (0)`);
		await queryRunner.query(`ALTER TABLE "warehouse_product_variant" ADD COLUMN "version" int NOT NULL DEFAULT (1)`);
		await queryRunner.query(`ALTER TABLE "warehouse_product" ADD COLUMN "reservedQuantity" numeric DEFAULT (0)`);
	}

	/**
	 * SqliteDB and BetterSQlite3DB Down Migration
	 *
	 * @param queryRunner
	 */
	public async sqliteDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(`ALTER TABLE "warehouse_product" DROP COLUMN "reservedQuantity"`);
		await queryRunner.query(`ALTER TABLE "warehouse_product_variant" DROP COLUMN "version"`);
		await queryRunner.query(`ALTER TABLE "warehouse_product_variant" DROP COLUMN "allowBackorder"`);
		await queryRunner.query(`ALTER TABLE "warehouse_product_variant" DROP COLUMN "isUnlimited"`);
		await queryRunner.query(`ALTER TABLE "warehouse_product_variant" DROP COLUMN "backorderLimit"`);
		await queryRunner.query(`ALTER TABLE "warehouse_product_variant" DROP COLUMN "incomingQuantity"`);
		await queryRunner.query(`ALTER TABLE "warehouse_product_variant" DROP COLUMN "safetyStock"`);
		await queryRunner.query(`ALTER TABLE "warehouse_product_variant" DROP COLUMN "reservedQuantity"`);
	}

	/**
	 * MySQL Up Migration
	 *
	 * @param queryRunner
	 */
	public async mysqlUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(`ALTER TABLE \`warehouse_product_variant\` ADD \`reservedQuantity\` decimal NULL DEFAULT '0'`);
		await queryRunner.query(`ALTER TABLE \`warehouse_product_variant\` ADD \`safetyStock\` decimal NULL DEFAULT '0'`);
		await queryRunner.query(`ALTER TABLE \`warehouse_product_variant\` ADD \`incomingQuantity\` decimal NULL DEFAULT '0'`);
		await queryRunner.query(`ALTER TABLE \`warehouse_product_variant\` ADD \`backorderLimit\` decimal NULL`);
		await queryRunner.query(`ALTER TABLE \`warehouse_product_variant\` ADD \`isUnlimited\` tinyint NULL DEFAULT 0`);
		await queryRunner.query(`ALTER TABLE \`warehouse_product_variant\` ADD \`allowBackorder\` tinyint NULL DEFAULT 0`);
		await queryRunner.query(`ALTER TABLE \`warehouse_product_variant\` ADD \`version\` int NOT NULL DEFAULT 1`);
		await queryRunner.query(`ALTER TABLE \`warehouse_product\` ADD \`reservedQuantity\` decimal NULL DEFAULT '0'`);
	}

	/**
	 * MySQL Down Migration
	 *
	 * @param queryRunner
	 */
	public async mysqlDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(`ALTER TABLE \`warehouse_product\` DROP COLUMN \`reservedQuantity\``);
		await queryRunner.query(`ALTER TABLE \`warehouse_product_variant\` DROP COLUMN \`version\``);
		await queryRunner.query(`ALTER TABLE \`warehouse_product_variant\` DROP COLUMN \`allowBackorder\``);
		await queryRunner.query(`ALTER TABLE \`warehouse_product_variant\` DROP COLUMN \`isUnlimited\``);
		await queryRunner.query(`ALTER TABLE \`warehouse_product_variant\` DROP COLUMN \`backorderLimit\``);
		await queryRunner.query(`ALTER TABLE \`warehouse_product_variant\` DROP COLUMN \`incomingQuantity\``);
		await queryRunner.query(`ALTER TABLE \`warehouse_product_variant\` DROP COLUMN \`safetyStock\``);
		await queryRunner.query(`ALTER TABLE \`warehouse_product_variant\` DROP COLUMN \`reservedQuantity\``);
	}
}
