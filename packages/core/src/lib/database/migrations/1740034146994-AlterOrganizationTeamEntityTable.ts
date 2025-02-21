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
	public async sqliteUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		// Step 1: Drop all the indexes on the old "organization_team" table.
		console.log(`Step 1: Drop all the indexes on the old "organization_team" table`);
		await queryRunner.query(`DROP INDEX "IDX_38f1d96e8c2d59e4f0f84209ab"`);
		await queryRunner.query(`DROP INDEX "IDX_722d648e0b83267d4a66332ccb"`);
		await queryRunner.query(`DROP INDEX "IDX_51e91be110fa0b8e70066f5727"`);
		await queryRunner.query(`DROP INDEX "IDX_da625f694eb1e23e585f301008"`);
		await queryRunner.query(`DROP INDEX "IDX_103ae3eb65f4b091efc55cb532"`);
		await queryRunner.query(`DROP INDEX "IDX_eef1c19a0cb5321223cfe3286c"`);
		await queryRunner.query(`DROP INDEX "IDX_176f5ed3c4534f3110d423d569"`);
		await queryRunner.query(`DROP INDEX "IDX_e22ab0f1236b1a07785b641727"`);

		// Step 2: Create a new temporary "temporary_organization_team" table.
		console.log('Step 2: Creating temporary table: temporary_organization_team.');
		await queryRunner.query(
			`CREATE TABLE "temporary_organization_team" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "organizationId" varchar, "name" varchar NOT NULL, "prefix" varchar, "createdById" varchar, "public" boolean DEFAULT (0), "profile_link" varchar, "logo" varchar, "imageId" varchar, "color" varchar, "emoji" varchar, "teamSize" varchar, "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "deletedAt" datetime, "shareProfileView" boolean DEFAULT (1), "requirePlanToTrack" boolean NOT NULL DEFAULT (0), "archivedAt" datetime, CONSTRAINT "FK_51e91be110fa0b8e70066f5727f" FOREIGN KEY ("imageId") REFERENCES "image_asset" ("id") ON DELETE SET NULL ON UPDATE NO ACTION, CONSTRAINT "FK_eef1c19a0cb5321223cfe3286c4" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_176f5ed3c4534f3110d423d5690" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`
		);

		// Step 3: Insert data from the old "organization_team" to the new temporary table.
		console.log(`Step 3: Insert data from the old "organization_team" to the new temporary table`);
		await queryRunner.query(
			`INSERT INTO "temporary_organization_team"("id", "createdAt", "updatedAt", "tenantId", "organizationId", "name", "prefix", "createdById", "public", "profile_link", "logo", "imageId", "color", "emoji", "teamSize", "isActive", "isArchived", "deletedAt", "shareProfileView", "requirePlanToTrack", "archivedAt") SELECT "id", "createdAt", "updatedAt", "tenantId", "organizationId", "name", "prefix", "createdById", "public", "profile_link", "logo", "imageId", "color", "emoji", "teamSize", "isActive", "isArchived", "deletedAt", "shareProfileView", "requirePlanToTrack", "archivedAt" FROM "organization_team"`
		);
		await queryRunner.query(`DROP TABLE "organization_team"`);
		await queryRunner.query(`ALTER TABLE "temporary_organization_team" RENAME TO "organization_team"`);
		await queryRunner.query(`CREATE INDEX "IDX_38f1d96e8c2d59e4f0f84209ab" ON "organization_team" ("isArchived") `);
		await queryRunner.query(`CREATE INDEX "IDX_722d648e0b83267d4a66332ccb" ON "organization_team" ("isActive") `);
		await queryRunner.query(`CREATE INDEX "IDX_51e91be110fa0b8e70066f5727" ON "organization_team" ("imageId") `);
		await queryRunner.query(
			`CREATE INDEX "IDX_da625f694eb1e23e585f301008" ON "organization_team" ("createdById") `
		);
		await queryRunner.query(`CREATE INDEX "IDX_103ae3eb65f4b091efc55cb532" ON "organization_team" ("name") `);
		await queryRunner.query(
			`CREATE INDEX "IDX_eef1c19a0cb5321223cfe3286c" ON "organization_team" ("organizationId") `
		);
		await queryRunner.query(`CREATE INDEX "IDX_176f5ed3c4534f3110d423d569" ON "organization_team" ("tenantId") `);
		await queryRunner.query(
			`CREATE INDEX "IDX_e22ab0f1236b1a07785b641727" ON "organization_team" ("profile_link") `
		);
		await queryRunner.query(`DROP INDEX "IDX_da625f694eb1e23e585f301008"`);
		await queryRunner.query(`DROP INDEX "IDX_38f1d96e8c2d59e4f0f84209ab"`);
		await queryRunner.query(`DROP INDEX "IDX_722d648e0b83267d4a66332ccb"`);
		await queryRunner.query(`DROP INDEX "IDX_51e91be110fa0b8e70066f5727"`);
		await queryRunner.query(`DROP INDEX "IDX_103ae3eb65f4b091efc55cb532"`);
		await queryRunner.query(`DROP INDEX "IDX_eef1c19a0cb5321223cfe3286c"`);
		await queryRunner.query(`DROP INDEX "IDX_176f5ed3c4534f3110d423d569"`);
		await queryRunner.query(`DROP INDEX "IDX_e22ab0f1236b1a07785b641727"`);

		// Step 4: Create a new temporary "temporary_organization_team" table.
		console.log('Step 4: Creating temporary table: temporary_organization_team.');
		await queryRunner.query(
			`CREATE TABLE "temporary_organization_team" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "organizationId" varchar, "name" varchar NOT NULL, "prefix" varchar, "createdByUserId" varchar, "public" boolean DEFAULT (0), "profile_link" varchar, "logo" varchar, "imageId" varchar, "color" varchar, "emoji" varchar, "teamSize" varchar, "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "deletedAt" datetime, "shareProfileView" boolean DEFAULT (1), "requirePlanToTrack" boolean NOT NULL DEFAULT (0), "archivedAt" datetime, CONSTRAINT "FK_51e91be110fa0b8e70066f5727f" FOREIGN KEY ("imageId") REFERENCES "image_asset" ("id") ON DELETE SET NULL ON UPDATE NO ACTION, CONSTRAINT "FK_eef1c19a0cb5321223cfe3286c4" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_176f5ed3c4534f3110d423d5690" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`
		);

		// Step 5: Insert data from the old "organization_team" to the new temporary table.
		console.log(`Step 5: Insert data from the old "organization_team" to the new temporary table`);
		await queryRunner.query(
			`INSERT INTO "temporary_organization_team"("id", "createdAt", "updatedAt", "tenantId", "organizationId", "name", "prefix", "createdByUserId", "public", "profile_link", "logo", "imageId", "color", "emoji", "teamSize", "isActive", "isArchived", "deletedAt", "shareProfileView", "requirePlanToTrack", "archivedAt") SELECT "id", "createdAt", "updatedAt", "tenantId", "organizationId", "name", "prefix", "createdById", "public", "profile_link", "logo", "imageId", "color", "emoji", "teamSize", "isActive", "isArchived", "deletedAt", "shareProfileView", "requirePlanToTrack", "archivedAt" FROM "organization_team"`
		);
		await queryRunner.query(`DROP TABLE "organization_team"`);
		await queryRunner.query(`ALTER TABLE "temporary_organization_team" RENAME TO "organization_team"`);
		await queryRunner.query(`CREATE INDEX "IDX_38f1d96e8c2d59e4f0f84209ab" ON "organization_team" ("isArchived") `);
		await queryRunner.query(`CREATE INDEX "IDX_722d648e0b83267d4a66332ccb" ON "organization_team" ("isActive") `);
		await queryRunner.query(`CREATE INDEX "IDX_51e91be110fa0b8e70066f5727" ON "organization_team" ("imageId") `);
		await queryRunner.query(`CREATE INDEX "IDX_103ae3eb65f4b091efc55cb532" ON "organization_team" ("name") `);
		await queryRunner.query(
			`CREATE INDEX "IDX_eef1c19a0cb5321223cfe3286c" ON "organization_team" ("organizationId") `
		);
		await queryRunner.query(`CREATE INDEX "IDX_176f5ed3c4534f3110d423d569" ON "organization_team" ("tenantId") `);
		await queryRunner.query(
			`CREATE INDEX "IDX_e22ab0f1236b1a07785b641727" ON "organization_team" ("profile_link") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_507bfec137b2f8bf283cb1f08d" ON "organization_team" ("createdByUserId") `
		);
		await queryRunner.query(`DROP INDEX "IDX_38f1d96e8c2d59e4f0f84209ab"`);
		await queryRunner.query(`DROP INDEX "IDX_722d648e0b83267d4a66332ccb"`);
		await queryRunner.query(`DROP INDEX "IDX_51e91be110fa0b8e70066f5727"`);
		await queryRunner.query(`DROP INDEX "IDX_103ae3eb65f4b091efc55cb532"`);
		await queryRunner.query(`DROP INDEX "IDX_eef1c19a0cb5321223cfe3286c"`);
		await queryRunner.query(`DROP INDEX "IDX_176f5ed3c4534f3110d423d569"`);
		await queryRunner.query(`DROP INDEX "IDX_e22ab0f1236b1a07785b641727"`);
		await queryRunner.query(`DROP INDEX "IDX_507bfec137b2f8bf283cb1f08d"`);

		// Step 6: Create a new temporary "temporary_organization_team" table.
		console.log('Step 6: Creating temporary table: temporary_organization_team.');
		await queryRunner.query(
			`CREATE TABLE "temporary_organization_team" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "organizationId" varchar, "name" varchar NOT NULL, "prefix" varchar, "createdByUserId" varchar, "public" boolean DEFAULT (0), "profile_link" varchar, "logo" varchar, "imageId" varchar, "color" varchar, "emoji" varchar, "teamSize" varchar, "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "deletedAt" datetime, "shareProfileView" boolean DEFAULT (1), "requirePlanToTrack" boolean NOT NULL DEFAULT (0), "archivedAt" datetime, CONSTRAINT "FK_51e91be110fa0b8e70066f5727f" FOREIGN KEY ("imageId") REFERENCES "image_asset" ("id") ON DELETE SET NULL ON UPDATE NO ACTION, CONSTRAINT "FK_eef1c19a0cb5321223cfe3286c4" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_176f5ed3c4534f3110d423d5690" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_507bfec137b2f8bf283cb1f08d0" FOREIGN KEY ("createdByUserId") REFERENCES "user" ("id") ON DELETE SET NULL ON UPDATE NO ACTION)`
		);

		// Step 6: Insert data from the old "organization_team" to the new temporary table.
		console.log(`Step 6: Insert data from the old "organization_team" to the new temporary table`);
		await queryRunner.query(
			`INSERT INTO "temporary_organization_team"("id", "createdAt", "updatedAt", "tenantId", "organizationId", "name", "prefix", "createdByUserId", "public", "profile_link", "logo", "imageId", "color", "emoji", "teamSize", "isActive", "isArchived", "deletedAt", "shareProfileView", "requirePlanToTrack", "archivedAt") SELECT "id", "createdAt", "updatedAt", "tenantId", "organizationId", "name", "prefix", "createdByUserId", "public", "profile_link", "logo", "imageId", "color", "emoji", "teamSize", "isActive", "isArchived", "deletedAt", "shareProfileView", "requirePlanToTrack", "archivedAt" FROM "organization_team"`
		);
		await queryRunner.query(`DROP TABLE "organization_team"`);
		await queryRunner.query(`ALTER TABLE "temporary_organization_team" RENAME TO "organization_team"`);

		// Step 7: Create indexes on the new "organization_team" table.
		console.log(`Step 7: Create indexes on the new "organization_team" table`);
		await queryRunner.query(`CREATE INDEX "IDX_38f1d96e8c2d59e4f0f84209ab" ON "organization_team" ("isArchived") `);
		await queryRunner.query(`CREATE INDEX "IDX_722d648e0b83267d4a66332ccb" ON "organization_team" ("isActive") `);
		await queryRunner.query(`CREATE INDEX "IDX_51e91be110fa0b8e70066f5727" ON "organization_team" ("imageId") `);
		await queryRunner.query(`CREATE INDEX "IDX_103ae3eb65f4b091efc55cb532" ON "organization_team" ("name") `);
		await queryRunner.query(
			`CREATE INDEX "IDX_eef1c19a0cb5321223cfe3286c" ON "organization_team" ("organizationId") `
		);
		await queryRunner.query(`CREATE INDEX "IDX_176f5ed3c4534f3110d423d569" ON "organization_team" ("tenantId") `);
		await queryRunner.query(
			`CREATE INDEX "IDX_e22ab0f1236b1a07785b641727" ON "organization_team" ("profile_link") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_507bfec137b2f8bf283cb1f08d" ON "organization_team" ("createdByUserId") `
		);
	}

	/**
	 * SqliteDB and BetterSQlite3DB Down Migration
	 *
	 * @param queryRunner
	 */
	public async sqliteDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		// Step 1: Drop all the indexes on the old "organization_team" table.
		console.log(`Step 1: Drop all the indexes on the old "organization_team" table`);
		await queryRunner.query(`DROP INDEX "IDX_507bfec137b2f8bf283cb1f08d"`);
		await queryRunner.query(`DROP INDEX "IDX_e22ab0f1236b1a07785b641727"`);
		await queryRunner.query(`DROP INDEX "IDX_176f5ed3c4534f3110d423d569"`);
		await queryRunner.query(`DROP INDEX "IDX_eef1c19a0cb5321223cfe3286c"`);
		await queryRunner.query(`DROP INDEX "IDX_103ae3eb65f4b091efc55cb532"`);
		await queryRunner.query(`DROP INDEX "IDX_51e91be110fa0b8e70066f5727"`);
		await queryRunner.query(`DROP INDEX "IDX_722d648e0b83267d4a66332ccb"`);
		await queryRunner.query(`DROP INDEX "IDX_38f1d96e8c2d59e4f0f84209ab"`);

		// Step 2: Rename the current "organization_team" table to "temporary_organization_team".
		console.log('Step 2: Renaming "organization_team" to "temporary_organization_team"...');
		await queryRunner.query(`ALTER TABLE "organization_team" RENAME TO "temporary_organization_team"`);

		// Step 3: Create the new "organization_team" table with the restored schema.
		console.log('Step 3: Creating new "organization_team" table with restored schema...');
		await queryRunner.query(
			`CREATE TABLE "organization_team" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "organizationId" varchar, "name" varchar NOT NULL, "prefix" varchar, "createdByUserId" varchar, "public" boolean DEFAULT (0), "profile_link" varchar, "logo" varchar, "imageId" varchar, "color" varchar, "emoji" varchar, "teamSize" varchar, "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "deletedAt" datetime, "shareProfileView" boolean DEFAULT (1), "requirePlanToTrack" boolean NOT NULL DEFAULT (0), "archivedAt" datetime, CONSTRAINT "FK_51e91be110fa0b8e70066f5727f" FOREIGN KEY ("imageId") REFERENCES "image_asset" ("id") ON DELETE SET NULL ON UPDATE NO ACTION, CONSTRAINT "FK_eef1c19a0cb5321223cfe3286c4" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_176f5ed3c4534f3110d423d5690" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`
		);

		// Step 4: Insert data into the new "organization_team" table from "temporary_organization_team".
		console.log('Step 4: Inserting data into "organization_team" from "temporary_organization_team"...');
		await queryRunner.query(
			`INSERT INTO "organization_team"("id", "createdAt", "updatedAt", "tenantId", "organizationId", "name", "prefix", "createdByUserId", "public", "profile_link", "logo", "imageId", "color", "emoji", "teamSize", "isActive", "isArchived", "deletedAt", "shareProfileView", "requirePlanToTrack", "archivedAt") SELECT "id", "createdAt", "updatedAt", "tenantId", "organizationId", "name", "prefix", "createdByUserId", "public", "profile_link", "logo", "imageId", "color", "emoji", "teamSize", "isActive", "isArchived", "deletedAt", "shareProfileView", "requirePlanToTrack", "archivedAt" FROM "temporary_organization_team"`
		);
		await queryRunner.query(`DROP TABLE "temporary_organization_team"`);
		await queryRunner.query(
			`CREATE INDEX "IDX_507bfec137b2f8bf283cb1f08d" ON "organization_team" ("createdByUserId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_e22ab0f1236b1a07785b641727" ON "organization_team" ("profile_link") `
		);
		await queryRunner.query(`CREATE INDEX "IDX_176f5ed3c4534f3110d423d569" ON "organization_team" ("tenantId") `);
		await queryRunner.query(
			`CREATE INDEX "IDX_eef1c19a0cb5321223cfe3286c" ON "organization_team" ("organizationId") `
		);
		await queryRunner.query(`CREATE INDEX "IDX_103ae3eb65f4b091efc55cb532" ON "organization_team" ("name") `);
		await queryRunner.query(`CREATE INDEX "IDX_51e91be110fa0b8e70066f5727" ON "organization_team" ("imageId") `);
		await queryRunner.query(`CREATE INDEX "IDX_722d648e0b83267d4a66332ccb" ON "organization_team" ("isActive") `);
		await queryRunner.query(`CREATE INDEX "IDX_38f1d96e8c2d59e4f0f84209ab" ON "organization_team" ("isArchived") `);
		await queryRunner.query(`DROP INDEX "IDX_507bfec137b2f8bf283cb1f08d"`);
		await queryRunner.query(`DROP INDEX "IDX_e22ab0f1236b1a07785b641727"`);
		await queryRunner.query(`DROP INDEX "IDX_176f5ed3c4534f3110d423d569"`);
		await queryRunner.query(`DROP INDEX "IDX_eef1c19a0cb5321223cfe3286c"`);
		await queryRunner.query(`DROP INDEX "IDX_103ae3eb65f4b091efc55cb532"`);
		await queryRunner.query(`DROP INDEX "IDX_51e91be110fa0b8e70066f5727"`);
		await queryRunner.query(`DROP INDEX "IDX_722d648e0b83267d4a66332ccb"`);
		await queryRunner.query(`DROP INDEX "IDX_38f1d96e8c2d59e4f0f84209ab"`);
		await queryRunner.query(`ALTER TABLE "organization_team" RENAME TO "temporary_organization_team"`);

		// Step 5: Create the new "organization_team" table with the restored schema.
		console.log('Step 5: Creating new "organization_team" table with restored schema...');
		await queryRunner.query(
			`CREATE TABLE "organization_team" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "organizationId" varchar, "name" varchar NOT NULL, "prefix" varchar, "createdById" varchar, "public" boolean DEFAULT (0), "profile_link" varchar, "logo" varchar, "imageId" varchar, "color" varchar, "emoji" varchar, "teamSize" varchar, "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "deletedAt" datetime, "shareProfileView" boolean DEFAULT (1), "requirePlanToTrack" boolean NOT NULL DEFAULT (0), "archivedAt" datetime, CONSTRAINT "FK_51e91be110fa0b8e70066f5727f" FOREIGN KEY ("imageId") REFERENCES "image_asset" ("id") ON DELETE SET NULL ON UPDATE NO ACTION, CONSTRAINT "FK_eef1c19a0cb5321223cfe3286c4" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_176f5ed3c4534f3110d423d5690" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`
		);

		// Step 6: Insert data into the new "organization_team" table from "temporary_organization_team".
		console.log('Step 6: Inserting data into "organization_team" from "temporary_organization_team"...');
		await queryRunner.query(
			`INSERT INTO "organization_team"("id", "createdAt", "updatedAt", "tenantId", "organizationId", "name", "prefix", "createdById", "public", "profile_link", "logo", "imageId", "color", "emoji", "teamSize", "isActive", "isArchived", "deletedAt", "shareProfileView", "requirePlanToTrack", "archivedAt") SELECT "id", "createdAt", "updatedAt", "tenantId", "organizationId", "name", "prefix", "createdByUserId", "public", "profile_link", "logo", "imageId", "color", "emoji", "teamSize", "isActive", "isArchived", "deletedAt", "shareProfileView", "requirePlanToTrack", "archivedAt" FROM "temporary_organization_team"`
		);
		await queryRunner.query(`DROP TABLE "temporary_organization_team"`);
		await queryRunner.query(
			`CREATE INDEX "IDX_e22ab0f1236b1a07785b641727" ON "organization_team" ("profile_link") `
		);
		await queryRunner.query(`CREATE INDEX "IDX_176f5ed3c4534f3110d423d569" ON "organization_team" ("tenantId") `);
		await queryRunner.query(
			`CREATE INDEX "IDX_eef1c19a0cb5321223cfe3286c" ON "organization_team" ("organizationId") `
		);
		await queryRunner.query(`CREATE INDEX "IDX_103ae3eb65f4b091efc55cb532" ON "organization_team" ("name") `);
		await queryRunner.query(`CREATE INDEX "IDX_51e91be110fa0b8e70066f5727" ON "organization_team" ("imageId") `);
		await queryRunner.query(`CREATE INDEX "IDX_722d648e0b83267d4a66332ccb" ON "organization_team" ("isActive") `);
		await queryRunner.query(`CREATE INDEX "IDX_38f1d96e8c2d59e4f0f84209ab" ON "organization_team" ("isArchived") `);
		await queryRunner.query(
			`CREATE INDEX "IDX_da625f694eb1e23e585f301008" ON "organization_team" ("createdById") `
		);
		await queryRunner.query(`DROP INDEX "IDX_e22ab0f1236b1a07785b641727"`);
		await queryRunner.query(`DROP INDEX "IDX_176f5ed3c4534f3110d423d569"`);
		await queryRunner.query(`DROP INDEX "IDX_eef1c19a0cb5321223cfe3286c"`);
		await queryRunner.query(`DROP INDEX "IDX_103ae3eb65f4b091efc55cb532"`);
		await queryRunner.query(`DROP INDEX "IDX_da625f694eb1e23e585f301008"`);
		await queryRunner.query(`DROP INDEX "IDX_51e91be110fa0b8e70066f5727"`);
		await queryRunner.query(`DROP INDEX "IDX_722d648e0b83267d4a66332ccb"`);
		await queryRunner.query(`DROP INDEX "IDX_38f1d96e8c2d59e4f0f84209ab"`);
		await queryRunner.query(`ALTER TABLE "organization_team" RENAME TO "temporary_organization_team"`);

		// Step 7: Create the new "organization_team" table with the restored schema.
		console.log('Step 7: Creating new "organization_team" table...');
		await queryRunner.query(
			`CREATE TABLE "organization_team" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "organizationId" varchar, "name" varchar NOT NULL, "prefix" varchar, "createdById" varchar, "public" boolean DEFAULT (0), "profile_link" varchar, "logo" varchar, "imageId" varchar, "color" varchar, "emoji" varchar, "teamSize" varchar, "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "deletedAt" datetime, "shareProfileView" boolean DEFAULT (1), "requirePlanToTrack" boolean NOT NULL DEFAULT (0), "archivedAt" datetime, CONSTRAINT "FK_51e91be110fa0b8e70066f5727f" FOREIGN KEY ("imageId") REFERENCES "image_asset" ("id") ON DELETE SET NULL ON UPDATE NO ACTION, CONSTRAINT "FK_da625f694eb1e23e585f3010082" FOREIGN KEY ("createdById") REFERENCES "user" ("id") ON DELETE SET NULL ON UPDATE NO ACTION, CONSTRAINT "FK_eef1c19a0cb5321223cfe3286c4" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_176f5ed3c4534f3110d423d5690" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`
		);

		// Step 8: Insert data into the new "organization_team" table from "temporary_organization_team".
		console.log('Step 8: Inserting data into "organization_team" from "temporary_organization_team"...');
		await queryRunner.query(
			`INSERT INTO "organization_team"("id", "createdAt", "updatedAt", "tenantId", "organizationId", "name", "prefix", "createdById", "public", "profile_link", "logo", "imageId", "color", "emoji", "teamSize", "isActive", "isArchived", "deletedAt", "shareProfileView", "requirePlanToTrack", "archivedAt") SELECT "id", "createdAt", "updatedAt", "tenantId", "organizationId", "name", "prefix", "createdById", "public", "profile_link", "logo", "imageId", "color", "emoji", "teamSize", "isActive", "isArchived", "deletedAt", "shareProfileView", "requirePlanToTrack", "archivedAt" FROM "temporary_organization_team"`
		);

		// Step 9: Drop the old "organization_team" table and rename the temporary table.
		console.log('Step 9: Dropping the old "temporary_organization_team" table...');
		await queryRunner.query(`DROP TABLE "temporary_organization_team"`);

		// Step 10: Create final indexes on the new "organization_team" table.
		console.log('Step 10: Creating indexes on the new "organization_team" table...');
		await queryRunner.query(
			`CREATE INDEX "IDX_e22ab0f1236b1a07785b641727" ON "organization_team" ("profile_link") `
		);
		await queryRunner.query(`CREATE INDEX "IDX_176f5ed3c4534f3110d423d569" ON "organization_team" ("tenantId") `);
		await queryRunner.query(
			`CREATE INDEX "IDX_eef1c19a0cb5321223cfe3286c" ON "organization_team" ("organizationId") `
		);
		await queryRunner.query(`CREATE INDEX "IDX_103ae3eb65f4b091efc55cb532" ON "organization_team" ("name") `);
		await queryRunner.query(
			`CREATE INDEX "IDX_da625f694eb1e23e585f301008" ON "organization_team" ("createdById") `
		);
		await queryRunner.query(`CREATE INDEX "IDX_51e91be110fa0b8e70066f5727" ON "organization_team" ("imageId") `);
		await queryRunner.query(`CREATE INDEX "IDX_722d648e0b83267d4a66332ccb" ON "organization_team" ("isActive") `);
		await queryRunner.query(`CREATE INDEX "IDX_38f1d96e8c2d59e4f0f84209ab" ON "organization_team" ("isArchived") `);
	}

	/**
	 * MySQL Up Migration
	 *
	 * @param queryRunner
	 */
	public async mysqlUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		// Step 1: Drop the existing foreign key constraint on "createdById" in the "organization_team" table.
		console.log('Step 1: Dropping foreign key constraint on "createdById" from "organization_team"...');
		await queryRunner.query(
			`ALTER TABLE \`organization_team\` DROP FOREIGN KEY \`FK_da625f694eb1e23e585f3010082\``
		);

		// Step 2: Drop the existing index on "createdById".
		console.log('Step 2: Dropping index "createdById" from "organization_team"...');
		await queryRunner.query(`DROP INDEX \`IDX_da625f694eb1e23e585f301008\` ON \`organization_team\``);

		// Step 3: Renaming column "createdById" to "createdByUserId" in the "organization_team" table.
		console.log('Step 3: Renaming column "createdById" to "createdByUserId" in "organization_team"...');
		await queryRunner.query(
			`ALTER TABLE \`organization_team\` CHANGE \`createdById\` \`createdByUserId\` varchar(255) NULL`
		);

		// Step 4: Create a new index for the "createdByUserId" column.
		console.log('Step 4: Creating index "createdByUserId" on "organization_team"...');
		await queryRunner.query(
			`CREATE INDEX \`IDX_507bfec137b2f8bf283cb1f08d\` ON \`organization_team\` (\`createdByUserId\`)`
		);

		// Step 5: Add a new foreign key constraint for the "createdByUserId" column.
		console.log(`Step 5: Adding foreign key constraint for "createdByUserId"...`);
		await queryRunner.query(
			`ALTER TABLE \`organization_team\`
			ADD CONSTRAINT \`FK_507bfec137b2f8bf283cb1f08d0\` FOREIGN KEY (\`createdByUserId\`) REFERENCES \`user\`(\`id\`)
			ON DELETE SET NULL ON UPDATE NO ACTION`
		);
	}

	/**
	 * MySQL Down Migration
	 *
	 * @param queryRunner
	 */
	public async mysqlDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		// Step 1: Drop the foreign key constraint on "createdByUserId" in the "organization_team" table.
		console.log(`Step 1: Dropping foreign key constraint on "createdByUserId" from "organization_team"...`);
		await queryRunner.query(
			`ALTER TABLE \`organization_team\` DROP FOREIGN KEY \`FK_507bfec137b2f8bf283cb1f08d0\``
		);

		// Step 2: Drop the index associated with the "createdByUserId" column.
		console.log('Step 2: Dropping index "createdByUserId" from "organization_team"...');
		await queryRunner.query(`DROP INDEX \`IDX_507bfec137b2f8bf283cb1f08d\` ON \`organization_team\``);

		// Step 3: Rename the column "createdByUserId" to "createdById" in the "organization_team" table.
		console.log('Step 3: Renaming column "createdByUserId" to "createdById" in "organization_team"...');
		await queryRunner.query(
			`ALTER TABLE \`organization_team\` CHANGE \`createdByUserId\` \`createdById\` varchar(255) NULL`
		);

		// Step 4: Create a new index for the "createdById" column.
		console.log('Step 4: Creating index "createdById" on "organization_team"...');
		await queryRunner.query(
			`CREATE INDEX \`IDX_da625f694eb1e23e585f301008\` ON \`organization_team\` (\`createdById\`)`
		);

		// Step 5: Add a new foreign key constraint for the "createdById" column.
		console.log(`Step 5: Adding foreign key constraint for "createdById"...`);
		await queryRunner.query(
			`ALTER TABLE \`organization_team\`
			ADD CONSTRAINT \`FK_da625f694eb1e23e585f3010082\` FOREIGN KEY (\`createdById\`) REFERENCES \`user\`(\`id\`)
			ON DELETE SET NULL ON UPDATE NO ACTION`
		);
	}
}
