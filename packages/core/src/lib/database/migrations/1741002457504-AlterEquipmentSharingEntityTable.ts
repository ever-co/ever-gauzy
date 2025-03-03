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
	public async sqliteUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		// Step 1: Drop existing indexes.
		console.log('Step 1: Dropping existing indexes');
		await queryRunner.query(`DROP INDEX "IDX_0d491ffab5a4d82c939abb34ce"`);
		await queryRunner.query(`DROP INDEX "IDX_2e2c8ba7c8f08f3dca8ff4214a"`);
		await queryRunner.query(`DROP INDEX "IDX_0ecfe0ce0cd2b197249d5f1c10"`);
		await queryRunner.query(`DROP INDEX "IDX_acad51a6362806fc499e583e40"`);
		await queryRunner.query(`DROP INDEX "IDX_ea9254be07ae4a8604f0aaab19"`);
		await queryRunner.query(`DROP INDEX "IDX_fa525e61fb3d8d9efec0f364a4"`);
		await queryRunner.query(`DROP INDEX "IDX_70ff31cefa0f578f6fa82d2bcc"`);
		await queryRunner.query(`DROP INDEX "IDX_a734598f5637cf1501288331e3"`);
		await queryRunner.query(`DROP INDEX "IDX_3febe3cf1c4c2809555fe43eac"`);

		// Step 2: Create temporary table.
		console.log('Step 2: Creating "temporary_equipment_sharing" table');
		await queryRunner.query(
			`CREATE TABLE "temporary_equipment_sharing" (
				"id" varchar PRIMARY KEY NOT NULL,
				"createdAt" datetime NOT NULL DEFAULT (datetime('now')),
				"updatedAt" datetime NOT NULL DEFAULT (datetime('now')),
				"tenantId" varchar,
				"organizationId" varchar,
				"name" varchar,
				"shareRequestDay" datetime,
				"shareStartDay" datetime,
				"shareEndDay" datetime,
				"status" integer NOT NULL,
				"equipmentId" varchar,
				"equipmentSharingPolicyId" varchar,
				"isActive" boolean DEFAULT (1),
				"isArchived" boolean DEFAULT (0),
				"deletedAt" datetime,
				"archivedAt" datetime,
				"createdByUserId" varchar,
				"updatedByUserId" varchar,
				"deletedByUserId" varchar,
				CONSTRAINT "FK_0d491ffab5a4d82c939abb34ce1" FOREIGN KEY ("deletedByUserId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION,
				CONSTRAINT "FK_2e2c8ba7c8f08f3dca8ff4214a6" FOREIGN KEY ("createdByUserId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION,
				CONSTRAINT "FK_0ecfe0ce0cd2b197249d5f1c105" FOREIGN KEY ("equipmentSharingPolicyId") REFERENCES "equipment_sharing_policy" ("id") ON DELETE CASCADE ON UPDATE NO ACTION,
				CONSTRAINT "FK_acad51a6362806fc499e583e402" FOREIGN KEY ("equipmentId") REFERENCES "equipment" ("id") ON DELETE CASCADE ON UPDATE NO ACTION,
				CONSTRAINT "FK_ea9254be07ae4a8604f0aaab196" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
				CONSTRAINT "FK_fa525e61fb3d8d9efec0f364a4b" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION,
				CONSTRAINT "FK_3febe3cf1c4c2809555fe43eac2" FOREIGN KEY ("updatedByUserId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION
			)`
		);

		// Step 3: Copy data from the old table to the temporary table.
		console.log('Step 3: Copying data from "equipment_sharing" to "temporary_equipment_sharing"');
		await queryRunner.query(
			`INSERT INTO "temporary_equipment_sharing" (
				"id",
				"createdAt",
				"updatedAt",
				"tenantId",
				"organizationId",
				"name",
				"shareRequestDay",
				"shareStartDay",
				"shareEndDay",
				"status",
				"equipmentId",
				"equipmentSharingPolicyId",
				"isActive",
				"isArchived",
				"deletedAt",
				"archivedAt",
				"createdByUserId",
				"updatedByUserId",
				"deletedByUserId"
			)
			SELECT
				"id",
				"createdAt",
				"updatedAt",
				"tenantId",
				"organizationId",
				"name",
				"shareRequestDay",
				"shareStartDay",
				"shareEndDay",
				"status",
				"equipmentId",
				"equipmentSharingPolicyId",
				"isActive",
				"isArchived",
				"deletedAt",
				"archivedAt",
				"createdByUserId",
				"updatedByUserId",
				"deletedByUserId"
			FROM "equipment_sharing"`
		);

		// Step 4: Drop the original equipment_sharing table.
		console.log('Step 4: Dropping original "equipment_sharing" table');
		await queryRunner.query(`DROP TABLE "equipment_sharing"`);

		// Step 5: Rename temporary_equipment_sharing to equipment_sharing.
		console.log('Step 5: Renaming "temporary_equipment_sharing" to "equipment_sharing"');
		await queryRunner.query(`ALTER TABLE "temporary_equipment_sharing" RENAME TO "equipment_sharing"`);

		// Step 6: Recreate indexes on the new equipment_sharing table.
		console.log('Step 6: Recreating indexes on "equipment_sharing"');
		await queryRunner.query(
			`CREATE INDEX "IDX_0d491ffab5a4d82c939abb34ce" ON "equipment_sharing" ("deletedByUserId")`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_2e2c8ba7c8f08f3dca8ff4214a" ON "equipment_sharing" ("createdByUserId")`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_0ecfe0ce0cd2b197249d5f1c10" ON "equipment_sharing" ("equipmentSharingPolicyId")`
		);
		await queryRunner.query(`CREATE INDEX "IDX_acad51a6362806fc499e583e40" ON "equipment_sharing" ("equipmentId")`);
		await queryRunner.query(
			`CREATE INDEX "IDX_ea9254be07ae4a8604f0aaab19" ON "equipment_sharing" ("organizationId")`
		);
		await queryRunner.query(`CREATE INDEX "IDX_fa525e61fb3d8d9efec0f364a4" ON "equipment_sharing" ("tenantId")`);
		await queryRunner.query(`CREATE INDEX "IDX_70ff31cefa0f578f6fa82d2bcc" ON "equipment_sharing" ("isActive")`);
		await queryRunner.query(`CREATE INDEX "IDX_a734598f5637cf1501288331e3" ON "equipment_sharing" ("isArchived")`);
		await queryRunner.query(
			`CREATE INDEX "IDX_3febe3cf1c4c2809555fe43eac" ON "equipment_sharing" ("updatedByUserId")`
		);
	}

	/**
	 * SqliteDB and BetterSQlite3DB Down Migration
	 *
	 * @param queryRunner
	 */
	public async sqliteDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		// Step 1: Drop existing indexes on equipment_sharing.
		console.log('Step 1: Dropping existing indexes on "equipment_sharing"');
		await queryRunner.query(`DROP INDEX "IDX_3febe3cf1c4c2809555fe43eac"`);
		await queryRunner.query(`DROP INDEX "IDX_a734598f5637cf1501288331e3"`);
		await queryRunner.query(`DROP INDEX "IDX_70ff31cefa0f578f6fa82d2bcc"`);
		await queryRunner.query(`DROP INDEX "IDX_fa525e61fb3d8d9efec0f364a4"`);
		await queryRunner.query(`DROP INDEX "IDX_ea9254be07ae4a8604f0aaab19"`);
		await queryRunner.query(`DROP INDEX "IDX_acad51a6362806fc499e583e40"`);
		await queryRunner.query(`DROP INDEX "IDX_0ecfe0ce0cd2b197249d5f1c10"`);
		await queryRunner.query(`DROP INDEX "IDX_2e2c8ba7c8f08f3dca8ff4214a"`);
		await queryRunner.query(`DROP INDEX "IDX_0d491ffab5a4d82c939abb34ce"`);

		// Step 2: Rename the current equipment_sharing table to temporary_equipment_sharing.
		console.log('Step 2: Renaming "equipment_sharing" to "temporary_equipment_sharing"');
		await queryRunner.query(`ALTER TABLE "equipment_sharing" RENAME TO "temporary_equipment_sharing"`);

		// Step 3: Create the new equipment_sharing table with the legacy columns re-added.
		console.log('Step 3: Creating new "equipment_sharing" table with legacy columns');
		await queryRunner.query(
			`CREATE TABLE "equipment_sharing" (
				"id" varchar PRIMARY KEY NOT NULL,
				"createdAt" datetime NOT NULL DEFAULT (datetime('now')),
				"updatedAt" datetime NOT NULL DEFAULT (datetime('now')),
				"tenantId" varchar,
				"organizationId" varchar,
				"name" varchar,
				"shareRequestDay" datetime,
				"shareStartDay" datetime,
				"shareEndDay" datetime,
				"status" integer NOT NULL,
				"createdBy" varchar,
				"createdByName" varchar,
				"equipmentId" varchar,
				"equipmentSharingPolicyId" varchar,
				"isActive" boolean DEFAULT (1),
				"isArchived" boolean DEFAULT (0),
				"deletedAt" datetime,
				"archivedAt" datetime,
				"createdByUserId" varchar,
				"updatedByUserId" varchar,
				"deletedByUserId" varchar,
				CONSTRAINT "FK_0d491ffab5a4d82c939abb34ce1" FOREIGN KEY ("deletedByUserId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION,
				CONSTRAINT "FK_2e2c8ba7c8f08f3dca8ff4214a6" FOREIGN KEY ("createdByUserId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION,
				CONSTRAINT "FK_0ecfe0ce0cd2b197249d5f1c105" FOREIGN KEY ("equipmentSharingPolicyId") REFERENCES "equipment_sharing_policy" ("id") ON DELETE CASCADE ON UPDATE NO ACTION,
				CONSTRAINT "FK_acad51a6362806fc499e583e402" FOREIGN KEY ("equipmentId") REFERENCES "equipment" ("id") ON DELETE CASCADE ON UPDATE NO ACTION,
				CONSTRAINT "FK_ea9254be07ae4a8604f0aaab196" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
				CONSTRAINT "FK_fa525e61fb3d8d9efec0f364a4b" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION,
				CONSTRAINT "FK_3febe3cf1c4c2809555fe43eac2" FOREIGN KEY ("updatedByUserId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION
			)`
		);

		// Step 4: Copy data from the temporary_equipment_sharing table into the new equipment_sharing table.
		console.log('Step 4: Copying data from "temporary_equipment_sharing" to new "equipment_sharing"');
		await queryRunner.query(
			`INSERT INTO "equipment_sharing" (
				"id",
				"createdAt",
				"updatedAt",
				"tenantId",
				"organizationId",
				"name",
				"shareRequestDay",
				"shareStartDay",
				"shareEndDay",
				"status",
				"equipmentId",
				"equipmentSharingPolicyId",
				"isActive",
				"isArchived",
				"deletedAt",
				"archivedAt",
				"createdByUserId",
				"updatedByUserId",
				"deletedByUserId"
			)
			SELECT
				"id",
				"createdAt",
				"updatedAt",
				"tenantId",
				"organizationId",
				"name",
				"shareRequestDay",
				"shareStartDay",
				"shareEndDay",
				"status",
				"equipmentId",
				"equipmentSharingPolicyId",
				"isActive",
				"isArchived",
				"deletedAt",
				"archivedAt",
				"createdByUserId",
				"updatedByUserId",
				"deletedByUserId"
			FROM "temporary_equipment_sharing"`
		);

		// Step 5: Drop the temporary_equipment_sharing table.
		console.log('Step 5: Dropping "temporary_equipment_sharing" table');
		await queryRunner.query(`DROP TABLE "temporary_equipment_sharing"`);

		// Step 6: Recreate indexes on the new equipment_sharing table.
		console.log('Step 6: Recreating indexes on "equipment_sharing"');
		await queryRunner.query(
			`CREATE INDEX "IDX_3febe3cf1c4c2809555fe43eac" ON "equipment_sharing" ("updatedByUserId") `
		);
		await queryRunner.query(`CREATE INDEX "IDX_a734598f5637cf1501288331e3" ON "equipment_sharing" ("isArchived") `);
		await queryRunner.query(`CREATE INDEX "IDX_70ff31cefa0f578f6fa82d2bcc" ON "equipment_sharing" ("isActive") `);
		await queryRunner.query(`CREATE INDEX "IDX_fa525e61fb3d8d9efec0f364a4" ON "equipment_sharing" ("tenantId") `);
		await queryRunner.query(
			`CREATE INDEX "IDX_ea9254be07ae4a8604f0aaab19" ON "equipment_sharing" ("organizationId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_acad51a6362806fc499e583e40" ON "equipment_sharing" ("equipmentId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_0ecfe0ce0cd2b197249d5f1c10" ON "equipment_sharing" ("equipmentSharingPolicyId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_2e2c8ba7c8f08f3dca8ff4214a" ON "equipment_sharing" ("createdByUserId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_0d491ffab5a4d82c939abb34ce" ON "equipment_sharing" ("deletedByUserId") `
		);
	}

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
