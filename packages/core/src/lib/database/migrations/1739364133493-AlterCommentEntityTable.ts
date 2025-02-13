import { MigrationInterface, QueryRunner } from 'typeorm';
import * as chalk from 'chalk';
import { DatabaseTypeEnum } from '@gauzy/config';

export class AlterCommentEntityTable1739364133493 implements MigrationInterface {
	name = 'AlterCommentEntityTable1739364133493';

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
		// Step 1: Drop existing foreign keys on "creatorId" and "resolvedById"
		console.log('Step 1: Dropping existing foreign keys...');
		await queryRunner.query(`ALTER TABLE "comment" DROP CONSTRAINT "FK_b6bf60ecb9f6c398e349adff52f"`);
		await queryRunner.query(`ALTER TABLE "comment" DROP CONSTRAINT "FK_c9409c81aa283c1aae70fd5f4c3"`);

		// Step 2: Drop existing indexes on "creatorId" and "resolvedById"
		console.log('Step 2: Dropping existing indexes on "creatorId" and "resolvedById"...');
		await queryRunner.query(`DROP INDEX "public"."IDX_b6bf60ecb9f6c398e349adff52"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_c9409c81aa283c1aae70fd5f4c"`);

		// Step 3: Add new columns "employeeId" and "resolvedByEmployeeId"
		console.log('Step 3: Adding new columns "employeeId" and "resolvedByEmployeeId"...');
		await queryRunner.query(`ALTER TABLE "comment" ADD "employeeId" uuid`);
		await queryRunner.query(`ALTER TABLE "comment" ADD "resolvedByEmployeeId" uuid`);

		// Step 4: Copy data from "creatorId" to "employeeId" using the employee mapping
		console.log('Step 4: Copying data from "creatorId" to "employeeId" via employee table mapping...');
		await queryRunner.query(`
			UPDATE "comment"
			SET "employeeId" = e.id
			FROM "employee" e
			WHERE "comment"."creatorId" = e."userId" AND "comment"."creatorId" IS NOT NULL
		`);

		// Step 5: Copy data from "resolvedById" to "resolvedByEmployeeId" using the employee mapping
		console.log('Step 5: Copying data from "resolvedById" to "resolvedByEmployeeId" via employee table mapping...');
		await queryRunner.query(`
			UPDATE "comment"
			SET "resolvedByEmployeeId" = e.id
			FROM "employee" e
			WHERE "comment"."resolvedById" = e."userId" AND "comment"."resolvedById" IS NOT NULL
		`);

		// Step 6: Drop the old columns "creatorId" and "resolvedById"
		console.log('Step 6: Dropping old columns "creatorId" and "resolvedById"...');
		await queryRunner.query(`ALTER TABLE "comment" DROP COLUMN "creatorId"`);
		await queryRunner.query(`ALTER TABLE "comment" DROP COLUMN "resolvedById"`);

		// Step 7: Create indexes on the new columns "employeeId" and "resolvedByEmployeeId"
		console.log('Step 7: Creating indexes on "employeeId" and "resolvedByEmployeeId"...');
		await queryRunner.query(`CREATE INDEX "IDX_7a88834dadfa6fe261268bfcee" ON "comment" ("employeeId")`);
		await queryRunner.query(`CREATE INDEX "IDX_35cddb3e66a46587966b68a921" ON "comment" ("resolvedByEmployeeId")`);

		// Step 8: Add foreign key constraint for "employeeId"
		console.log('Step 8: Adding foreign key constraint for "employeeId"...');
		await queryRunner.query(`
			ALTER TABLE "comment"
			ADD CONSTRAINT "FK_7a88834dadfa6fe261268bfceef"
			FOREIGN KEY ("employeeId") REFERENCES "employee"("id") ON DELETE CASCADE ON UPDATE NO ACTION
		`);

		// Step 9: Add foreign key constraint for "resolvedByEmployeeId"
		console.log('Step 9: Adding foreign key constraint for "resolvedByEmployeeId"...');
		await queryRunner.query(`
			ALTER TABLE "comment"
			ADD CONSTRAINT "FK_35cddb3e66a46587966b68a9217"
			FOREIGN KEY ("resolvedByEmployeeId") REFERENCES "employee"("id") ON DELETE CASCADE ON UPDATE NO ACTION
		`);
	}

	/**
	 * PostgresDB Down Migration
	 *
	 * @param queryRunner
	 */
	public async postgresDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		// Step 1: Drop foreign key constraints for "resolvedByEmployeeId" and "employeeId"
		console.log('Step 1: Dropping foreign key constraints for "resolvedByEmployeeId" and "employeeId"...');
		await queryRunner.query(`ALTER TABLE "comment" DROP CONSTRAINT "FK_35cddb3e66a46587966b68a9217"`);
		await queryRunner.query(`ALTER TABLE "comment" DROP CONSTRAINT "FK_7a88834dadfa6fe261268bfceef"`);

		// Step 2: Drop indexes on "resolvedByEmployeeId" and "employeeId"
		console.log('Step 2: Dropping indexes on "resolvedByEmployeeId" and "employeeId"...');
		await queryRunner.query(`DROP INDEX "public"."IDX_35cddb3e66a46587966b68a921"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_7a88834dadfa6fe261268bfcee"`);

		// Step 3: Re-add the old columns "resolvedById" and "creatorId"
		console.log('Step 3: Adding columns "resolvedById" and "creatorId"...');
		await queryRunner.query(`ALTER TABLE "comment" ADD "resolvedById" uuid`);
		await queryRunner.query(`ALTER TABLE "comment" ADD "creatorId" uuid`);

		// Step 4: Copy data from "employeeId" to "creatorId" via employee table mapping
		console.log('Step 4: Copying data from "employeeId" to "creatorId" via employee table mapping...');
		await queryRunner.query(`
			UPDATE "comment"
			SET "creatorId" = e."userId"
			FROM "employee" e
			WHERE "comment"."employeeId" = e.id AND "comment"."employeeId" IS NOT NULL
		`);

		// Step 5: Copy data from "resolvedByEmployeeId" to "resolvedById" via employee table mapping
		console.log('Step 5: Copying data from "resolvedByEmployeeId" to "resolvedById" via employee table mapping...');
		await queryRunner.query(`
			UPDATE "comment"
			SET "resolvedById" = e."userId"
			FROM "employee" e
			WHERE "comment"."resolvedByEmployeeId" = e.id AND "comment"."resolvedByEmployeeId" IS NOT NULL
		`);

		// Step 6: Drop the new columns "resolvedByEmployeeId" and "employeeId"
		console.log('Step 6: Dropping columns "resolvedByEmployeeId" and "employeeId"...');
		await queryRunner.query(`ALTER TABLE "comment" DROP COLUMN "resolvedByEmployeeId"`);
		await queryRunner.query(`ALTER TABLE "comment" DROP COLUMN "employeeId"`);

		// Step 7: Create indexes on the restored columns "resolvedById" and "creatorId"
		console.log('Step 7: Creating indexes on "resolvedById" and "creatorId"...');
		await queryRunner.query(`CREATE INDEX "IDX_c9409c81aa283c1aae70fd5f4c" ON "comment" ("resolvedById")`);
		await queryRunner.query(`CREATE INDEX "IDX_b6bf60ecb9f6c398e349adff52" ON "comment" ("creatorId")`);

		// Step 8: Add foreign key constraint for "resolvedById" referencing "user"
		console.log('Step 8: Adding foreign key constraint for "resolvedById" referencing "user"...');
		await queryRunner.query(`
			ALTER TABLE "comment" ADD CONSTRAINT "FK_c9409c81aa283c1aae70fd5f4c3"
			FOREIGN KEY ("resolvedById") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION
    	`);

		// Step 9: Add foreign key constraint for "creatorId" referencing "user"
		console.log('Step 9: Adding foreign key constraint for "creatorId" referencing "user"...');
		await queryRunner.query(`
			ALTER TABLE "comment" ADD CONSTRAINT "FK_b6bf60ecb9f6c398e349adff52f"
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
		// Step 1: Drop existing foreign keys on "creatorId" and "resolvedById"
		console.log('Step 1: Dropping existing foreign keys...');
		await queryRunner.query(`ALTER TABLE \`comment\` DROP FOREIGN KEY \`FK_b6bf60ecb9f6c398e349adff52f\``);
		await queryRunner.query(`ALTER TABLE \`comment\` DROP FOREIGN KEY \`FK_c9409c81aa283c1aae70fd5f4c3\``);

		// Step 2: Drop existing indexes on "creatorId" and "resolvedById"
		console.log('Step 2: Dropping existing indexes on "creatorId" and "resolvedById"...');
		await queryRunner.query(`DROP INDEX \`IDX_c9409c81aa283c1aae70fd5f4c\` ON \`comment\``);
		await queryRunner.query(`DROP INDEX \`IDX_b6bf60ecb9f6c398e349adff52\` ON \`comment\``);

		// Step 3: Add new columns "employeeId" and "resolvedByEmployeeId".
		console.log('Step 3: Adding new columns "employeeId" and "resolvedByEmployeeId" to "comment"...');
		await queryRunner.query(`ALTER TABLE \`comment\` ADD \`employeeId\` varchar(255) NULL`);
		await queryRunner.query(`ALTER TABLE \`comment\` ADD \`resolvedByEmployeeId\` varchar(255) NULL`);

		// Step 4: Copy data from "creatorId" to "employeeId" using the employee mapping
		console.log('Step 4: Copying data from "creatorId" to "employeeId" via employee table mapping...');
		await queryRunner.query(`
			UPDATE \`comment\` c
			JOIN \`employee\` e ON c.\`creatorId\` = e.\`userId\`
			SET c.\`employeeId\` = e.\`id\`
			WHERE c.\`creatorId\` IS NOT NULL
		`);

		// Step 5: Copy data from "resolvedById" to "resolvedByEmployeeId" using the employee mapping
		console.log('Step 5: Copying data from "resolvedById" to "resolvedByEmployeeId" via employee table mapping...');
		await queryRunner.query(`
			UPDATE \`comment\` c
			JOIN \`employee\` e ON c.\`resolvedById\` = e.\`userId\`
			SET c.\`resolvedByEmployeeId\` = e.\`id\`
			WHERE c.\`resolvedById\` IS NOT NULL
		`);

		// Step 6: Drop the old columns "creatorId" and "resolvedById".
		console.log('Step 6: Dropping old columns "creatorId" and "resolvedById"...');
		await queryRunner.query(`ALTER TABLE \`comment\` DROP COLUMN \`creatorId\``);
		await queryRunner.query(`ALTER TABLE \`comment\` DROP COLUMN \`resolvedById\``);

		// Step 6: Create indexes on the new columns.
		console.log('Step 7: Creating indexes on "employeeId" and "resolvedByEmployeeId"...');
		await queryRunner.query(`CREATE INDEX \`IDX_7a88834dadfa6fe261268bfcee\` ON \`comment\` (\`employeeId\`)`);
		await queryRunner.query(
			`CREATE INDEX \`IDX_35cddb3e66a46587966b68a921\` ON \`comment\` (\`resolvedByEmployeeId\`)`
		);

		// Step 8: Add foreign key constraint for "employeeId"
		console.log('Step 8: Adding foreign key constraint for "employeeId"...');
		await queryRunner.query(`
		   ALTER TABLE \`comment\` ADD CONSTRAINT \`FK_7a88834dadfa6fe261268bfceef\`
		   FOREIGN KEY (\`employeeId\`) REFERENCES \`employee\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION
		`);

		// Step 9: Add foreign key constraint for "resolvedByEmployeeId"
		console.log('Step 9: Adding foreign key constraint for "resolvedByEmployeeId"...');
		await queryRunner.query(`
		   ALTER TABLE \`comment\` ADD CONSTRAINT \`FK_35cddb3e66a46587966b68a9217\`
		   FOREIGN KEY (\`resolvedByEmployeeId\`) REFERENCES \`employee\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION
		`);
	}

	/**
	 * MySQL Down Migration
	 *
	 * @param queryRunner
	 */
	public async mysqlDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		// Step 1: Drop foreign key constraints for "resolvedByEmployeeId" and "employeeId"
		console.log('Step 1: Dropping foreign key constraints for "resolvedByEmployeeId" and "employeeId"...');
		await queryRunner.query(`ALTER TABLE \`comment\` DROP FOREIGN KEY \`FK_35cddb3e66a46587966b68a9217\``);
		await queryRunner.query(`ALTER TABLE \`comment\` DROP FOREIGN KEY \`FK_7a88834dadfa6fe261268bfceef\``);

		// Step 2: Drop indexes on "resolvedByEmployeeId" and "employeeId"
		console.log('Step 2: Dropping indexes on "resolvedByEmployeeId" and "employeeId"...');
		await queryRunner.query(`DROP INDEX \`IDX_35cddb3e66a46587966b68a921\` ON \`comment\``);
		await queryRunner.query(`DROP INDEX \`IDX_7a88834dadfa6fe261268bfcee\` ON \`comment\``);

		// Step 3: Re-add the old columns "resolvedById" and "creatorId"
		console.log('Step 3: Adding columns "resolvedById" and "creatorId"...');
		await queryRunner.query(`ALTER TABLE \`comment\` ADD \`resolvedById\` varchar(255) NULL`);
		await queryRunner.query(`ALTER TABLE \`comment\` ADD \`creatorId\` varchar(255) NULL`);

		// Step 4: Copy data from "employeeId" to "creatorId" via employee table mapping
		console.log('Step 4: Copying data from "employeeId" to "creatorId" via employee table mapping...');
		await queryRunner.query(`
			UPDATE \`comment\` c
			JOIN \`employee\` e ON c.\`employeeId\` = e.\`id\`
			SET c.\`creatorId\` = e.\`userId\`
			WHERE c.\`employeeId\` IS NOT NULL
		`);

		// Step 5: Copy data from "resolvedByEmployeeId" to "resolvedById" via employee table mapping
		console.log('Step 5: Copying data from "resolvedByEmployeeId" to "resolvedById" via employee table mapping...');
		await queryRunner.query(`
			UPDATE \`comment\` c
			JOIN \`employee\` e ON c.\`resolvedByEmployeeId\` = e.\`id\`
			SET c.\`resolvedById\` = e.\`userId\`
			WHERE c.\`resolvedByEmployeeId\` IS NOT NULL
		`);

		// Step 6: Drop the new columns "resolvedByEmployeeId" and "employeeId"
		console.log('Step 6: Dropping columns "resolvedByEmployeeId" and "employeeId"...');
		await queryRunner.query(`ALTER TABLE \`comment\` DROP COLUMN \`resolvedByEmployeeId\``);
		await queryRunner.query(`ALTER TABLE \`comment\` DROP COLUMN \`employeeId\``);

		// Step 7: Create indexes on the restored columns "resolvedById" and "creatorId"
		console.log('Step 7: Creating indexes on "resolvedById" and "creatorId"...');
		await queryRunner.query(`CREATE INDEX \`IDX_b6bf60ecb9f6c398e349adff52\` ON \`comment\` (\`creatorId\`)`);
		await queryRunner.query(`CREATE INDEX \`IDX_c9409c81aa283c1aae70fd5f4c\` ON \`comment\` (\`resolvedById\`)`);

		// Step 8: Add foreign key constraint for "resolvedById" referencing "user"
		console.log('Step 8: Adding foreign key constraint for "resolvedById" referencing "user"...');
		await queryRunner.query(
			`ALTER TABLE \`comment\` ADD CONSTRAINT \`FK_c9409c81aa283c1aae70fd5f4c3\` FOREIGN KEY (\`resolvedById\`) REFERENCES \`user\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);

		// Step 9: Add foreign key constraint for "creatorId" referencing "user"
		console.log('Step 9: Adding foreign key constraint for "creatorId" referencing "user"...');
		await queryRunner.query(
			`ALTER TABLE \`comment\` ADD CONSTRAINT \`FK_b6bf60ecb9f6c398e349adff52f\` FOREIGN KEY (\`creatorId\`) REFERENCES \`user\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
	}
}
