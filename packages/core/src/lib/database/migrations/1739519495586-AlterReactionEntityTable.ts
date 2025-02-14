import { MigrationInterface, QueryRunner } from 'typeorm';
import * as chalk from 'chalk';
import { DatabaseTypeEnum } from '@gauzy/config';

export class AlterReactionEntityTable1739519495586 implements MigrationInterface {
	name = 'AlterReactionEntityTable1739519495586';

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
		// Step 1: Drop the foreign key constraint on "creatorId".
		console.log('Step 1: Dropping foreign key constraint "FK_58350b19ecd6a1e287a09d36a2e" from "reaction"...');
		await queryRunner.query(`ALTER TABLE "reaction" DROP CONSTRAINT "FK_58350b19ecd6a1e287a09d36a2e"`);

		// Step 2: Drop the index on "creatorId".
		console.log('Step 2: Dropping index "IDX_58350b19ecd6a1e287a09d36a2" from "reaction"...');
		await queryRunner.query(`DROP INDEX "public"."IDX_58350b19ecd6a1e287a09d36a2"`);

		// Step 3: Add new column "actorType".
		console.log('Step 3: Adding new column "actorType" to "reaction"...');
		await queryRunner.query(`ALTER TABLE "reaction" ADD "actorType" integer`);

		// Step 4: Add new column "employeeId".
		console.log('Step 4: Adding new column "employeeId" to "reaction"...');
		await queryRunner.query(`ALTER TABLE "reaction" ADD "employeeId" uuid`);

		// Step 5: Copy data from "creatorId" to "employeeId".
		console.log('Step 5: Copying data from "creatorId" to "employeeId"...');
		await queryRunner.query(`
			UPDATE "reaction" r
			SET "employeeId" = e.id, "actorType" = 1
			FROM "employee" e
			WHERE r."creatorId" = e."userId" AND r."creatorId" IS NOT NULL
		`);

		// Step 6: Drop the old "creatorId" column.
		console.log('Step 6: Dropping column "creatorId" from "reaction"...');
		await queryRunner.query(`ALTER TABLE "reaction" DROP COLUMN "creatorId"`);

		// Step 7: Create indexes on "actorType" and "employeeId".
		console.log('Step 7: Creating indexes on "actorType" and "employeeId"...');
		await queryRunner.query(`CREATE INDEX "IDX_72b52e83a89835be1b2b95aa84" ON "reaction" ("actorType")`);
		await queryRunner.query(`CREATE INDEX "IDX_b58c2c0e374c57e48dbddc93e1" ON "reaction" ("employeeId")`);

		// Step 8: Add foreign key constraint on "employeeId" referencing "employee".
		console.log('Step 8: Adding foreign key constraint on "employeeId"...');
		await queryRunner.query(
			`ALTER TABLE "reaction"
			ADD CONSTRAINT "FK_b58c2c0e374c57e48dbddc93e1e"
			FOREIGN KEY ("employeeId") REFERENCES "employee"("id") ON DELETE CASCADE ON UPDATE CASCADE`
		);
	}

	/**
	 * PostgresDB Down Migration
	 *
	 * @param queryRunner
	 */
	public async postgresDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		// Step 1: Drop the foreign key constraint on "employeeId".
		console.log('Step 1: Dropping foreign key constraint "FK_b58c2c0e374c57e48dbddc93e1e" from "reaction"...');
		await queryRunner.query(`ALTER TABLE "reaction" DROP CONSTRAINT "FK_b58c2c0e374c57e48dbddc93e1e"`);

		// Step 2: Drop indexes on "employeeId" and "actorType".
		console.log('Step 2: Dropping indexes on "employeeId" and "actorType" from "reaction"...');
		await queryRunner.query(`DROP INDEX "public"."IDX_b58c2c0e374c57e48dbddc93e1"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_72b52e83a89835be1b2b95aa84"`);

		// Step 3: Re-add the old column "creatorId".
		console.log('Step 3: Adding column "creatorId" back to "reaction"...');
		await queryRunner.query(`ALTER TABLE "reaction" ADD "creatorId" uuid`);

		// Step 4: Copy data from "employeeId" to "creatorId" via employee table mapping.
		console.log('Step 4: Copying data from "employeeId" to "creatorId" via employee table mapping...');
		await queryRunner.query(`
			UPDATE "reaction" r
			SET "creatorId" = e."userId"
			FROM "employee" e
			WHERE r."employeeId" = e.id AND r."employeeId" IS NOT NULL
		`);

		// Step 5: Drop the new columns "employeeId" and "actorType".
		console.log('Step 5: Dropping columns "employeeId" and "actorType" from "reaction"...');
		await queryRunner.query(`ALTER TABLE "reaction" DROP COLUMN "employeeId"`);
		await queryRunner.query(`ALTER TABLE "reaction" DROP COLUMN "actorType"`);

		// Step 6: Recreate the index on the restored "creatorId" column.
		console.log('Step 6: Creating index on "creatorId" in "reaction"...');
		await queryRunner.query(`CREATE INDEX "IDX_58350b19ecd6a1e287a09d36a2" ON "reaction" ("creatorId")`);

		// Step 7: Re-add the original foreign key constraint on "creatorId" referencing "user"(id).
		console.log('Step 7: Adding foreign key constraint on "creatorId" referencing "user"(id)...');
		await queryRunner.query(`
			ALTER TABLE "reaction"
			ADD CONSTRAINT "FK_58350b19ecd6a1e287a09d36a2e"
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
	public async mysqlUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		// Step 1: Drop the foreign key constraint on "creatorId".
		console.log('Step 1: Dropping foreign key constraint "FK_58350b19ecd6a1e287a09d36a2e" from "reaction"...');
		await queryRunner.query(`ALTER TABLE \`reaction\` DROP FOREIGN KEY \`FK_58350b19ecd6a1e287a09d36a2e\``);

		// Step 2: Drop the index on "creatorId".
		console.log('Step 2: Dropping index "IDX_58350b19ecd6a1e287a09d36a2" from "reaction"...');
		await queryRunner.query(`DROP INDEX \`IDX_58350b19ecd6a1e287a09d36a2\` ON \`reaction\``);

		// Step 3: Add new columns "actorType" and "employeeId".
		console.log('Step 3: Adding new columns "actorType" and "employeeId" to "reaction"...');
		// Here, we set actorType's default value to 1 (i.e. ActorTypeEnum.User).
		await queryRunner.query(`ALTER TABLE \`reaction\` ADD \`actorType\` int DEFAULT 1`);
		await queryRunner.query(`ALTER TABLE \`reaction\` ADD \`employeeId\` varchar(255) NULL`);

		// Step 4: Copy data from "creatorId" to "employeeId" using employee mapping.
		console.log('Step 4: Copying data from "creatorId" to "employeeId" via employee table mapping...');
		await queryRunner.query(`
			UPDATE \`reaction\` r
			JOIN \`employee\` e ON r.\`creatorId\` = e.\`userId\`
			SET r.\`employeeId\` = e.\`id\`, r.\`actorType\` = 1
			WHERE r.\`creatorId\` IS NOT NULL
		`);

		// Step 5: Drop the old "creatorId" column.
		console.log('Step 5: Dropping column "creatorId" from "reaction"...');
		await queryRunner.query(`ALTER TABLE \`reaction\` DROP COLUMN \`creatorId\``);

		// Step 6: Create new indexes on "actorType" and "employeeId".
		console.log('Step 6: Creating indexes on "actorType" and "employeeId" in "reaction"...');
		await queryRunner.query(`CREATE INDEX \`IDX_72b52e83a89835be1b2b95aa84\` ON \`reaction\` (\`actorType\`)`);
		await queryRunner.query(`CREATE INDEX \`IDX_b58c2c0e374c57e48dbddc93e1\` ON \`reaction\` (\`employeeId\`)`);

		// Step 7: Add foreign key constraint on "employeeId" referencing "employee"(id).
		console.log('Step 7: Adding foreign key constraint on "employeeId" referencing "employee"(id)...');
		await queryRunner.query(`
			ALTER TABLE \`reaction\`
			ADD CONSTRAINT \`FK_b58c2c0e374c57e48dbddc93e1e\`
			FOREIGN KEY (\`employeeId\`) REFERENCES \`employee\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE
		`);
	}

	/**
	 * MySQL Down Migration
	 *
	 * @param queryRunner
	 */
	public async mysqlDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		// Step 1: Drop the foreign key constraint on "employeeId".
		console.log('Step 1: Dropping foreign key constraint on "employeeId" from "reaction"...');
		await queryRunner.query(`ALTER TABLE \`reaction\` DROP FOREIGN KEY \`FK_b58c2c0e374c57e48dbddc93e1e\``);

		// Step 2: Drop indexes on "employeeId" and "actorType".
		console.log('Step 2: Dropping indexes on "employeeId" and "actorType" from "reaction"...');
		await queryRunner.query(`DROP INDEX \`IDX_b58c2c0e374c57e48dbddc93e1\` ON \`reaction\``);
		await queryRunner.query(`DROP INDEX \`IDX_72b52e83a89835be1b2b95aa84\` ON \`reaction\``);

		// Step 3: Add back the old column "creatorId".
		console.log('Step 3: Adding column "creatorId" back to "reaction"...');
		await queryRunner.query(`ALTER TABLE \`reaction\` ADD \`creatorId\` varchar(255) NULL`);

		// Step 4: Copy data from "employeeId" to "creatorId" using employee mapping.
		console.log('Step 4: Copying data from "employeeId" to "creatorId" via employee table mapping...');
		await queryRunner.query(`
			UPDATE \`reaction\` r
			JOIN \`employee\` e ON r.\`employeeId\` = e.\`id\`
			SET r.\`creatorId\` = e.\`userId\`
			WHERE r.\`employeeId\` IS NOT NULL
		`);

		// Step 5: Drop the new columns "employeeId" and "actorType".
		console.log('Step 5: Dropping columns "employeeId" and "actorType" from "reaction"...');
		await queryRunner.query(`ALTER TABLE \`reaction\` DROP COLUMN \`employeeId\``);
		await queryRunner.query(`ALTER TABLE \`reaction\` DROP COLUMN \`actorType\``);

		// Step 6: Recreate the index on the restored "creatorId" column.
		console.log('Step 6: Creating index on "creatorId" in "reaction"...');
		await queryRunner.query(`CREATE INDEX \`IDX_58350b19ecd6a1e287a09d36a2\` ON \`reaction\` (\`creatorId\`)`);

		// Step 7: Re-add the original foreign key constraint on "creatorId" referencing "user"(id).
		console.log('Step 7: Adding foreign key constraint on "creatorId" referencing "user"(id)...');
		await queryRunner.query(`
		   ALTER TABLE \`reaction\`
		   ADD CONSTRAINT \`FK_58350b19ecd6a1e287a09d36a2e\`
		   FOREIGN KEY (\`creatorId\`) REFERENCES \`user\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION
		`);
	}
}
