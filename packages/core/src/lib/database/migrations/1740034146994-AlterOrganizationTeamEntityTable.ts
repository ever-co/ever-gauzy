import { MigrationInterface, QueryRunner } from 'typeorm';
import * as chalk from 'chalk';
import { DatabaseTypeEnum } from '@gauzy/config';

export class AlterOrganizationTeamEntityTable1740034146994 implements MigrationInterface {
	name = 'AlterOrganizationTeamEntityTable1740034146994';

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
		// Step 1: Drop the existing foreign key constraint on "createdById" in the "organization_team" table.
		console.log('Step 1: Dropping foreign key constraint on "createdById" from "organization_team"...');
		await queryRunner.query(`ALTER TABLE "organization_team" DROP CONSTRAINT "FK_da625f694eb1e23e585f3010082"`);

		// Step 2: Drop the existing index on "createdById".
		console.log('Step 2: Dropping index "createdById" from "organization_team"...');
		await queryRunner.query(`DROP INDEX "public"."IDX_da625f694eb1e23e585f301008"`);

		// Step 3: Renaming column "createdById" to "createdByUserId" in the "organization_team" table.
		console.log('Step 3: Renaming column "createdById" to "createdByUserId" in "organization_team"...');
		await queryRunner.query(`ALTER TABLE "organization_team" RENAME COLUMN "createdById" TO "createdByUserId"`);

		// Step 4: Create a new index for the "createdByUserId" column.
		console.log('Step 4: Creating index "createdByUserId" on "organization_team"...');
		await queryRunner.query(
			`CREATE INDEX "IDX_507bfec137b2f8bf283cb1f08d" ON "organization_team" ("createdByUserId") `
		);

		// Step 5: Add a new foreign key constraint for the "createdByUserId" column.
		console.log(`Step 5: Adding foreign key constraint for "createdByUserId"...`);
		await queryRunner.query(
			`ALTER TABLE "organization_team"
			ADD CONSTRAINT "FK_507bfec137b2f8bf283cb1f08d0" FOREIGN KEY ("createdByUserId") REFERENCES "user"("id")
			ON DELETE SET NULL ON UPDATE NO ACTION`
		);
	}

	/**
	 * PostgresDB Down Migration
	 *
	 * @param queryRunner
	 */
	public async postgresDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		// Step 1: Drop the foreign key constraint on "createdByUserId" in the "organization_team" table.
		console.log(`Step 1: Dropping foreign key constraint on "createdByUserId" from "organization_team"...`);
		await queryRunner.query(`ALTER TABLE "organization_team" DROP CONSTRAINT "FK_507bfec137b2f8bf283cb1f08d0"`);

		// Step 2: Drop the index associated with the "createdByUserId" column.
		console.log('Step 2: Dropping index "createdByUserId" from "organization_team"...');
		await queryRunner.query(`DROP INDEX "public"."IDX_507bfec137b2f8bf283cb1f08d"`);

		// Step 3: Rename the column "createdByUserId" to "createdById" in the "organization_team" table.
		console.log('Step 3: Renaming column "createdByUserId" to "createdById" in "organization_team"...');
		await queryRunner.query(`ALTER TABLE "organization_team" RENAME COLUMN "createdByUserId" TO "createdById"`);

		// Step 4: Create a new index for the "createdById" column.
		console.log('Step 4: Creating index "createdById" on "organization_team"...');
		await queryRunner.query(
			`CREATE INDEX "IDX_da625f694eb1e23e585f301008" ON "organization_team" ("createdById") `
		);

		// Step 5: Add a new foreign key constraint for the "createdById" column.
		console.log(`Step 5: Adding foreign key constraint for "createdById"...`);
		await queryRunner.query(
			`ALTER TABLE "organization_team"
			ADD CONSTRAINT "FK_da625f694eb1e23e585f3010082" FOREIGN KEY ("createdById") REFERENCES "user"("id")
			ON DELETE SET NULL ON UPDATE NO ACTION`
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
