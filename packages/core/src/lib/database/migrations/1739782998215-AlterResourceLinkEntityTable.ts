import { MigrationInterface, QueryRunner } from 'typeorm';
import * as chalk from 'chalk';
import { DatabaseTypeEnum } from '@gauzy/config';

export class AlterResourceLinkEntityTable1739782998215 implements MigrationInterface {
	name = 'AlterResourceLinkEntityTable1739782998215';

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
		// Step 1: Drop the old foreign key constraint
		console.log(`Step 1: Drop the old foreign key constraint`);
		await queryRunner.query(`ALTER TABLE "resource_link" DROP CONSTRAINT "FK_df91a85b49f78544da67aa9d9ad"`);

		// Step 2: Drop the index associated with the old creatorId
		console.log('Step 2: Dropping index "creatorId" from "resource_link"...');
		await queryRunner.query(`DROP INDEX "public"."IDX_df91a85b49f78544da67aa9d9a"`);

		// Step 3: Add new column "employeeId" of type uuid.
		console.log('Step 3: Adding new column "employeeId" to "resource_link"...');
		await queryRunner.query(`ALTER TABLE "resource_link" ADD "employeeId" uuid`);

		// Step 4: Copy data from "creatorId" to "employeeId" via employee table mapping
		console.log('Step 4: Copying data from "creatorId" to "employeeId" via employee table mapping...');
		await queryRunner.query(`
			UPDATE "resource_link" rl
			SET "employeeId" = (
				SELECT e."id"
				FROM "employee" e
				WHERE e."userId" = rl."creatorId"
				LIMIT 1
			)
			WHERE rl."creatorId" IS NOT NULL
		`);

		// Step 5: Drop the old "creatorId" column.
		console.log('Step 5: Dropping column "creatorId" from "resource_link"...');
		await queryRunner.query(`ALTER TABLE "resource_link" DROP COLUMN "creatorId"`);

		// Step 6: Recreate the index on "employeeId" in "resource_link".
		console.log('Step 6: Recreate the index on "employeeId" in "resource_link"...');
		await queryRunner.query(`CREATE INDEX "IDX_32a8e7615f4c28255bb50af109" ON "resource_link" ("employeeId")`);

		// Step 7: Add a new foreign key constraint for the employeeId column
		console.log('Step 7: Adding foreign key constraint for "employeeId"...');
		await queryRunner.query(`
			ALTER TABLE "resource_link"
			ADD CONSTRAINT "FK_32a8e7615f4c28255bb50af1098"
			FOREIGN KEY ("employeeId") REFERENCES "employee" ("id")
			ON DELETE CASCADE
			ON UPDATE NO ACTION
		`);
	}

	/**
	 * PostgresDB Down Migration
	 *
	 * @param queryRunner
	 */
	public async postgresDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		// Step 1: Drop the foreign key constraint on "employeeId"
		console.log('Step 1: Dropping the foreign key constraint on "employeeId"');
		await queryRunner.query(`ALTER TABLE "resource_link" DROP CONSTRAINT "FK_32a8e7615f4c28255bb50af1098"`);

		// Step 2: Drop the index associated with the "employeeId"
		console.log('Step 2: Dropping index "employeeId" from "resource_link"...');
		await queryRunner.query(`DROP INDEX "public"."IDX_32a8e7615f4c28255bb50af109"`);

		// Step 3: Add new column "employeeId" of type uuid.
		console.log('Step 3: Adding new column "creatorId" to "resource_link"...');
		await queryRunner.query(`ALTER TABLE "resource_link" ADD "creatorId" uuid`);

		// Step 4: Copy data from "creatorId" to "employeeId" using employee mapping.
		console.log('Step 4: Copying data from "employeeId" to "creatorId" via employee table mapping...');
		// Step 4: Copy data from "employeeId" to "creatorId" via employee table mapping
		console.log('Step 4: Copying data from "employeeId" to "creatorId" via employee table mapping...');
		await queryRunner.query(`
			UPDATE "resource_link" rl
			SET "creatorId" = (
				SELECT e."userId"
				FROM "employee" e
				WHERE e."id" = rl."employeeId"
				LIMIT 1
			)
			WHERE rl."employeeId" IS NOT NULL
		`);

		// Step 5: Drop the new column "employeeId".
		console.log('Step 5: Dropping column "employeeId" from "resource_link"...');
		await queryRunner.query(`ALTER TABLE "resource_link" DROP COLUMN "employeeId"`);

		// Step 4: Recreate the index for "creatorId"
		console.log('Step 4: Creating index on "creatorId"');
		await queryRunner.query(`CREATE INDEX "IDX_df91a85b49f78544da67aa9d9a" ON "resource_link" ("creatorId")`);

		// Step 5: Add the original foreign key constraint for "creatorId"
		console.log('Step 5: Adding the foreign key constraint for "creatorId"');
		await queryRunner.query(
			`ALTER TABLE "resource_link"
			ADD CONSTRAINT "FK_df91a85b49f78544da67aa9d9ad"
			FOREIGN KEY ("creatorId") REFERENCES "employee" ("userId")
			ON DELETE CASCADE
			ON UPDATE NO ACTION`
		);
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
	public async mysqlUpQueryRunner(queryRunner: QueryRunner): Promise<any> {}

	/**
	 * MySQL Down Migration
	 *
	 * @param queryRunner
	 */
	public async mysqlDownQueryRunner(queryRunner: QueryRunner): Promise<any> {}
}
