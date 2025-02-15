import { MigrationInterface, QueryRunner } from 'typeorm';
import * as chalk from 'chalk';
import { DatabaseTypeEnum } from '@gauzy/config';

export class AlterActivityLogEntityTable1739602849367 implements MigrationInterface {
	name = 'AlterActivityLogEntityTable1739602849367';

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
		// Step 1: Drop the existing foreign key constraint on "creatorId" in the "activity_log" table.
		console.log('Step 1: Dropping foreign key constraint on "creatorId" from "activity_log"...');
		await queryRunner.query(`ALTER TABLE "activity_log" DROP CONSTRAINT "FK_b6e9a5c3e1ee65a3bcb8a00de2b"`);

		// Step 2: Drop the existing index on "creatorId".
		console.log('Step 2: Dropping index "IDX_b6e9a5c3e1ee65a3bcb8a00de2" from "activity_log"...');
		await queryRunner.query(`DROP INDEX "public"."IDX_b6e9a5c3e1ee65a3bcb8a00de2"`);

		// Step 3: Add new column "employeeId" of type uuid.
		console.log('Step 3: Adding new column "employeeId" to "activity_log"...');
		await queryRunner.query(`ALTER TABLE "activity_log" ADD "employeeId" uuid`);

		// Step 4: Copy data from "creatorId" to "employeeId" using employee mapping.
		console.log('Step 4: Copying data from "creatorId" to "employeeId" via employee table mapping...');
		await queryRunner.query(`
			UPDATE "activity_log" al
			SET "employeeId" = (
				SELECT e.id
				FROM "employee" e
				WHERE e."userId" = al."creatorId"
				ORDER BY e."createdAt" DESC
				LIMIT 1
			)
			WHERE al."creatorId" IS NOT NULL
		`);

		// Step 5: Drop the old "creatorId" column.
		console.log('Step 5: Dropping column "creatorId" from "activity_log"...');
		await queryRunner.query(`ALTER TABLE "activity_log" DROP COLUMN "creatorId"`);

		// Step 6: Recreate the index on "employeeId" in "activity_log".
		console.log('Step 6: Recreate the index on "employeeId" in "activity_log"...');
		await queryRunner.query(`CREATE INDEX "IDX_071945a9d4a2322fde08010292" ON "activity_log" ("employeeId")`);

		// Step 7: Add a new foreign key constraint on "employeeId" referencing "employee"("id").
		console.log('Step 7: Adding foreign key constraint on "employeeId" referencing "employee"(id)...');
		await queryRunner.query(`
		   ALTER TABLE "activity_log"
		   ADD CONSTRAINT "FK_071945a9d4a2322fde08010292c"
		   FOREIGN KEY ("employeeId") REFERENCES "employee"("id") ON DELETE CASCADE ON UPDATE NO ACTION
		`);
	}

	/**
	 * PostgresDB Down Migration
	 *
	 * @param queryRunner
	 */
	public async postgresDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		// Step 1: Drop the foreign key constraint on column "employeeId".
		console.log('Step 1: Dropping foreign key constraint on "employeeId" from "activity_log"...');
		await queryRunner.query(`ALTER TABLE "activity_log" DROP CONSTRAINT "FK_071945a9d4a2322fde08010292c"`);

		// Step 2: Drop the index on "employeeId".
		console.log('Step 2: Dropping index "IDX_071945a9d4a2322fde08010292" from "activity_log"...');
		await queryRunner.query(`DROP INDEX "public"."IDX_071945a9d4a2322fde08010292"`);

		// Step 3: Add back the old column "creatorId".
		console.log('Step 3: Adding column "creatorId" back to "activity_log"...');
		await queryRunner.query(`ALTER TABLE "activity_log" ADD "creatorId" uuid`);

		// Step 4: Copy data from "employeeId" to "creatorId" using employee mapping.
		console.log('Step 4: Copying data from "employeeId" to "creatorId" via employee table mapping...');
		await queryRunner.query(`
			UPDATE "activity_log" AS al
			SET "creatorId" = (
				SELECT e."userId"
				FROM "employee" AS e
				WHERE e."id" = al."employeeId"
				ORDER BY e."createdAt" DESC
				LIMIT 1
			)
			WHERE al."employeeId" IS NOT NULL;
		`);

		// Step 5: Drop the new column "employeeId".
		console.log('Step 5: Dropping column "employeeId" from "activity_log"...');
		await queryRunner.query(`ALTER TABLE "activity_log" DROP COLUMN "employeeId"`);

		// Step 6: Recreate the index on the restored "creatorId" column.
		console.log('Step 6: Creating index on "creatorId" in "activity_log"...');
		await queryRunner.query(`CREATE INDEX "IDX_b6e9a5c3e1ee65a3bcb8a00de2" ON "activity_log" ("creatorId")`);

		// Step 7: Re-add the original foreign key constraint on "creatorId" referencing "user"(id).
		console.log('Step 7: Adding foreign key constraint on "creatorId" referencing "user"(id)...');
		await queryRunner.query(`
			ALTER TABLE "activity_log"
			ADD CONSTRAINT "FK_b6e9a5c3e1ee65a3bcb8a00de2b"
			FOREIGN KEY ("creatorId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION
		`);
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
