import { MigrationInterface, QueryRunner } from 'typeorm';
import * as chalk from 'chalk';
import { DatabaseTypeEnum } from '@gauzy/config';

export class AlterEquipmentSharingEntityTable1741002457504 implements MigrationInterface {
	name = 'AlterEquipmentSharingEntityTable1741002457504';

	/**
	 * Up Migration
	 *
	 * @param queryRunner
	 */
	public async up(queryRunner: QueryRunner): Promise<void> {
		console.log(chalk.yellow(this.name + ' start running!'));

		switch (queryRunner.connection.options.type) {
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
		switch (queryRunner.connection.options.type) {
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
		// Step 1: Copy data from "createdBy" to "createdByUserId" with proper type casting to UUID.
		console.log('Step 1: Copying data from createdBy to createdByUserId with uuid casting');
		await queryRunner.query(`UPDATE "equipment_sharing" SET "createdByUserId" = "createdBy"::uuid`);

		// Step 2: Drop the old "createdBy" column.
		console.log('Step 2: Dropping column createdBy');
		await queryRunner.query(`ALTER TABLE "equipment_sharing" DROP COLUMN "createdBy"`);

		// Step 3: Drop the old "createdByName" column.
		console.log('Step 3: Dropping column createdByName');
		await queryRunner.query(`ALTER TABLE "equipment_sharing" DROP COLUMN "createdByName"`);
	}

	/**
	 * PostgresDB Down Migration
	 *
	 * @param queryRunner
	 */
	public async postgresDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		// Step 1: Re-add the "createdByName" column.
		console.log('Step 1: Adding column createdByName');
		await queryRunner.query(`ALTER TABLE "equipment_sharing" ADD "createdByName" character varying`);

		// Step 2: Re-add the "createdBy" column.
		console.log('Step 2: Adding column createdBy');
		await queryRunner.query(`ALTER TABLE "equipment_sharing" ADD "createdBy" character varying`);

		// Step 3: Copy data from "createdByUserId" to "createdBy", casting UUID to text.
		console.log('Step 3: Copying data from createdByUserId to createdBy with casting to text');
		await queryRunner.query(`UPDATE "equipment_sharing" SET "createdBy" = "createdByUserId"::text`);
	}

	/**
	 * SqliteDB and BetterSQlite3DB Up Migration
	 *
	 * @param queryRunner
	 */
	public async sqliteUpQueryRunner(queryRunner: QueryRunner): Promise<any> {}

	/**
	 * SqliteDB and BetterSQlite3DB Down Migration
	 *
	 * @param queryRunner
	 */
	public async sqliteDownQueryRunner(queryRunner: QueryRunner): Promise<any> {}

	/**
	 * MySQL Up Migration
	 *
	 * @param queryRunner
	 */
	public async mysqlUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		// Step 1: Copy data from "createdBy" to "createdByUserId"
		console.log('Step 1: Copying data from createdBy to createdByUserId');
		await queryRunner.query(`UPDATE \`equipment_sharing\` SET \`createdByUserId\` = \`createdBy\``);

		// Step 2: Drop the "createdBy" column
		console.log('Step 2: Dropping column createdBy');
		await queryRunner.query(`ALTER TABLE \`equipment_sharing\` DROP COLUMN \`createdBy\``);

		// Step 3: Drop the "createdByName" column
		console.log('Step 3: Dropping column createdByName');
		await queryRunner.query(`ALTER TABLE \`equipment_sharing\` DROP COLUMN \`createdByName\``);
	}

	/**
	 * MySQL Down Migration
	 *
	 * @param queryRunner
	 */
	public async mysqlDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		// Step 1: Adding column "createdByName"
		console.log('Step 1: Adding column "createdByName"');
		await queryRunner.query(`ALTER TABLE \`equipment_sharing\` ADD \`createdByName\` varchar(255) NULL`);

		// Step 2: Adding column "createdBy"
		console.log('Step 2: Adding column "createdBy"');
		await queryRunner.query(`ALTER TABLE \`equipment_sharing\` ADD \`createdBy\` varchar(255) NULL`);

		// Step 3: Copy data from "createdByUserId" to "createdBy"
		console.log('Step 3: Copy data from "createdByUserId" to "createdBy"');
		await queryRunner.query(`UPDATE \`equipment_sharing\` SET \`createdBy\` = \`createdByUserId\``);
	}
}
