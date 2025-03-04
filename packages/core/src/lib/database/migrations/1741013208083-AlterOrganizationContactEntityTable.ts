import { MigrationInterface, QueryRunner } from 'typeorm';
import * as chalk from 'chalk';
import { DatabaseTypeEnum } from '@gauzy/config';

export class AlterOrganizationContactEntityTable1741013208083 implements MigrationInterface {
	name = 'AlterOrganizationContactEntityTable1741013208083';

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
		// Step 1: Copy data from "createdBy" to "createdByUserId"
		console.log('Step 1: Copying data from createdBy to createdByUserId');
		await queryRunner.query(`UPDATE "organization_contact" SET "createdByUserId" = "createdBy"::uuid`);

		// Step 2: Drop the "createdBy" column
		console.log('Step 2: Dropping column createdBy');
		await queryRunner.query(`ALTER TABLE "organization_contact" DROP COLUMN "createdBy"`);
	}

	/**
	 * PostgresDB Down Migration
	 *
	 * @param queryRunner
	 */
	public async postgresDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		// Step 1: Re-add the "createdBy" column
		console.log('Step 1: Adding column createdBy');
		await queryRunner.query(`ALTER TABLE "organization_contact" ADD "createdBy" character varying`);

		// Step 2: Copy data from "createdByUserId" to "createdBy"
		console.log('Step 2: Copying data from createdByUserId to createdBy');
		await queryRunner.query(`UPDATE "organization_contact" SET "createdBy" = "createdByUserId"::text`);
	}

	/**
	 * SqliteDB and BetterSQlite3DB Up Migration
	 *
	 * @param queryRunner
	 */
	public async sqliteUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		// Step 1: Drop existing indexes.
		console.log('Step 1: Dropping existing indexes');
		await queryRunner.query(`DROP INDEX "IDX_f8df3dea1e42ef16ae7f411304"`);
		await queryRunner.query(`DROP INDEX "IDX_53bb1086e10d553249483b267c"`);
		await queryRunner.query(`DROP INDEX "IDX_8cfcdc6bc8fb55e273d9ace5fd"`);
		await queryRunner.query(`DROP INDEX "IDX_a86d2e378b953cb39261f457d2"`);
		await queryRunner.query(`DROP INDEX "IDX_de33f92e042365d196d959e774"`);
		await queryRunner.query(`DROP INDEX "IDX_6200736cb4d3617b004e5b647f"`);
		await queryRunner.query(`DROP INDEX "IDX_e68c43e315ad3aaea4e99cf461"`);
		await queryRunner.query(`DROP INDEX "IDX_53627a383c9817dbf1164d7dc6"`);
		await queryRunner.query(`DROP INDEX "IDX_f91783c7a8565c648b65635efc"`);
		await queryRunner.query(`DROP INDEX "IDX_b5589e035e86d23ebb54ea2728"`);

		// Step 2: Create temporary table.
		console.log('Step 2: Creating "temporary_organization_contact" table');
		await queryRunner.query(
			`CREATE TABLE "temporary_organization_contact" (
				"id" varchar PRIMARY KEY NOT NULL,
				"createdAt" datetime NOT NULL DEFAULT (datetime('now')),
				"updatedAt" datetime NOT NULL DEFAULT (datetime('now')),
				"tenantId" varchar,
				"organizationId" varchar,
				"name" varchar NOT NULL,
				"primaryEmail" varchar,
				"primaryPhone" varchar,
				"inviteStatus" varchar,
				"notes" varchar,
				"contactType" varchar CHECK("contactType" IN ('CLIENT','CUSTOMER','LEAD')) NOT NULL DEFAULT ('CLIENT'),
				"imageUrl" varchar(500),
				"budget" integer,
				"budgetType" varchar CHECK("budgetType" IN ('hours','cost')) DEFAULT ('cost'),
				"contactId" varchar,
				"imageId" varchar,
				"isActive" boolean DEFAULT (1),
				"isArchived" boolean DEFAULT (0),
				"deletedAt" datetime,
				"archivedAt" datetime,
				"createdByUserId" varchar,
				"updatedByUserId" varchar,
				"deletedByUserId" varchar,
				CONSTRAINT "REL_a86d2e378b953cb39261f457d2" UNIQUE ("contactId"),
				CONSTRAINT "FK_f8df3dea1e42ef16ae7f4113048" FOREIGN KEY ("deletedByUserId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION,
				CONSTRAINT "FK_53bb1086e10d553249483b267cf" FOREIGN KEY ("createdByUserId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION,
				CONSTRAINT "FK_8cfcdc6bc8fb55e273d9ace5fd5" FOREIGN KEY ("imageId") REFERENCES "image_asset" ("id") ON DELETE SET NULL ON UPDATE NO ACTION,
				CONSTRAINT "FK_a86d2e378b953cb39261f457d26" FOREIGN KEY ("contactId") REFERENCES "contact" ("id") ON DELETE SET NULL ON UPDATE NO ACTION,
				CONSTRAINT "FK_6200736cb4d3617b004e5b647ff" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
				CONSTRAINT "FK_e68c43e315ad3aaea4e99cf461d" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION,
				CONSTRAINT "FK_b5589e035e86d23ebb54ea2728c" FOREIGN KEY ("updatedByUserId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION
			)`
		);

		// Step 3: Copy data from the old table to the temporary table.
		console.log('Step 3: Copying data from "organization_contact" to "temporary_organization_contact"');
		await queryRunner.query(
			`INSERT INTO "temporary_organization_contact" (
				"id",
				"createdAt",
				"updatedAt",
				"tenantId",
				"organizationId",
				"name",
				"primaryEmail",
				"primaryPhone",
				"inviteStatus",
				"notes",
				"contactType",
				"imageUrl",
				"budget",
				"budgetType",
				"contactId",
				"imageId",
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
				"primaryEmail",
				"primaryPhone",
				"inviteStatus",
				"notes",
				"contactType",
				"imageUrl",
				"budget",
				"budgetType",
				"contactId",
				"imageId",
				"isActive",
				"isArchived",
				"deletedAt",
				"archivedAt",
				"createdByUserId",
				"updatedByUserId",
				"deletedByUserId"
			FROM "organization_contact"`
		);

		// Step 4: Drop the original organization_contact table.
		console.log('Step 4: Dropping original "organization_contact" table');
		await queryRunner.query(`DROP TABLE "organization_contact"`);

		// Step 5: Rename temporary_organization_contact to organization_contact.
		console.log('Step 5: Renaming "temporary_organization_contact" to "organization_contact"');
		await queryRunner.query(`ALTER TABLE "temporary_organization_contact" RENAME TO "organization_contact"`);

		// Step 6: Recreate indexes on the new organization_contact table.
		console.log('Step 6: Recreating indexes on "organization_contact"');
		await queryRunner.query(
			`CREATE INDEX "IDX_f8df3dea1e42ef16ae7f411304" ON "organization_contact" ("deletedByUserId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_53bb1086e10d553249483b267c" ON "organization_contact" ("createdByUserId") `
		);
		await queryRunner.query(`CREATE INDEX "IDX_8cfcdc6bc8fb55e273d9ace5fd" ON "organization_contact" ("imageId") `);
		await queryRunner.query(
			`CREATE INDEX "IDX_a86d2e378b953cb39261f457d2" ON "organization_contact" ("contactId") `
		);
		await queryRunner.query(`CREATE INDEX "IDX_de33f92e042365d196d959e774" ON "organization_contact" ("name") `);
		await queryRunner.query(
			`CREATE INDEX "IDX_6200736cb4d3617b004e5b647f" ON "organization_contact" ("organizationId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_e68c43e315ad3aaea4e99cf461" ON "organization_contact" ("tenantId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_53627a383c9817dbf1164d7dc6" ON "organization_contact" ("isActive") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_f91783c7a8565c648b65635efc" ON "organization_contact" ("isArchived") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_b5589e035e86d23ebb54ea2728" ON "organization_contact" ("updatedByUserId") `
		);
	}

	/**
	 * SqliteDB and BetterSQlite3DB Down Migration
	 *
	 * @param queryRunner
	 */
	public async sqliteDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		// Step 1: Drop existing indexes on organization_contact.
		console.log('Step 1: Dropping existing indexes on "organization_contact"');
		await queryRunner.query(`DROP INDEX "IDX_b5589e035e86d23ebb54ea2728"`);
		await queryRunner.query(`DROP INDEX "IDX_f91783c7a8565c648b65635efc"`);
		await queryRunner.query(`DROP INDEX "IDX_53627a383c9817dbf1164d7dc6"`);
		await queryRunner.query(`DROP INDEX "IDX_e68c43e315ad3aaea4e99cf461"`);
		await queryRunner.query(`DROP INDEX "IDX_6200736cb4d3617b004e5b647f"`);
		await queryRunner.query(`DROP INDEX "IDX_de33f92e042365d196d959e774"`);
		await queryRunner.query(`DROP INDEX "IDX_a86d2e378b953cb39261f457d2"`);
		await queryRunner.query(`DROP INDEX "IDX_8cfcdc6bc8fb55e273d9ace5fd"`);
		await queryRunner.query(`DROP INDEX "IDX_53bb1086e10d553249483b267c"`);
		await queryRunner.query(`DROP INDEX "IDX_f8df3dea1e42ef16ae7f411304"`);

		// Step 2: Rename the current organization_contact table to temporary_organization_contact.
		console.log('Step 2: Renaming "organization_contact" to "temporary_organization_contact"');
		await queryRunner.query(`ALTER TABLE "organization_contact" RENAME TO "temporary_organization_contact"`);

		// Step 3: Create the new organization_contact table with legacy columns re-added.
		console.log('Step 3: Creating new "organization_contact" table with legacy columns');
		await queryRunner.query(
			`CREATE TABLE "organization_contact" (
				"id" varchar PRIMARY KEY NOT NULL,
				"createdAt" datetime NOT NULL DEFAULT (datetime('now')),
				"updatedAt" datetime NOT NULL DEFAULT (datetime('now')),
				"tenantId" varchar,
				"organizationId" varchar,
				"name" varchar NOT NULL,
				"primaryEmail" varchar,
				"primaryPhone" varchar,
				"inviteStatus" varchar,
				"notes" varchar,
				"contactType" varchar CHECK("contactType" IN ('CLIENT','CUSTOMER','LEAD')) NOT NULL DEFAULT ('CLIENT'),
				"imageUrl" varchar(500),
				"budget" integer,
				"budgetType" varchar CHECK("budgetType" IN ('hours','cost')) DEFAULT ('cost'),
				"createdBy" varchar,
				"contactId" varchar,
				"imageId" varchar,
				"isActive" boolean DEFAULT (1),
				"isArchived" boolean DEFAULT (0),
				"deletedAt" datetime,
				"archivedAt" datetime,
				"createdByUserId" varchar,
				"updatedByUserId" varchar,
				"deletedByUserId" varchar,
				CONSTRAINT "REL_a86d2e378b953cb39261f457d2" UNIQUE ("contactId"),
				CONSTRAINT "FK_f8df3dea1e42ef16ae7f4113048" FOREIGN KEY ("deletedByUserId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION,
				CONSTRAINT "FK_53bb1086e10d553249483b267cf" FOREIGN KEY ("createdByUserId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION,
				CONSTRAINT "FK_8cfcdc6bc8fb55e273d9ace5fd5" FOREIGN KEY ("imageId") REFERENCES "image_asset" ("id") ON DELETE SET NULL ON UPDATE NO ACTION,
				CONSTRAINT "FK_a86d2e378b953cb39261f457d26" FOREIGN KEY ("contactId") REFERENCES "contact" ("id") ON DELETE SET NULL ON UPDATE NO ACTION,
				CONSTRAINT "FK_6200736cb4d3617b004e5b647ff" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
				CONSTRAINT "FK_e68c43e315ad3aaea4e99cf461d" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION,
				CONSTRAINT "FK_b5589e035e86d23ebb54ea2728c" FOREIGN KEY ("updatedByUserId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION
			)`
		);

		// Step 4: Copy data from the temporary_organization_contact table into the new organization_contact table.
		console.log('Step 4: Copying data from "temporary_organization_contact" to new "organization_contact"');
		await queryRunner.query(
			`INSERT INTO "organization_contact" (
					"id",
					"createdAt",
					"updatedAt",
					"tenantId",
					"organizationId",
					"name",
					"primaryEmail",
					"primaryPhone",
					"inviteStatus",
					"notes",
					"contactType",
					"imageUrl",
					"budget",
					"budgetType",
					"contactId",
					"imageId",
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
					"primaryEmail",
					"primaryPhone",
					"inviteStatus",
					"notes",
					"contactType",
					"imageUrl",
					"budget",
					"budgetType",
					"contactId",
					"imageId",
					"isActive",
					"isArchived",
					"deletedAt",
					"archivedAt",
					"createdByUserId",
					"updatedByUserId",
					"deletedByUserId"
			  FROM "temporary_organization_contact"`
		);

		// Step 5: Drop the temporary_organization_contact table.
		console.log('Step 5: Dropping "temporary_organization_contact" table');
		await queryRunner.query(`DROP TABLE "temporary_organization_contact"`);

		// Step 6: Recreate indexes on the new organization_contact table.
		console.log('Step 6: Recreating indexes on "organization_contact"');
		await queryRunner.query(
			`CREATE INDEX "IDX_b5589e035e86d23ebb54ea2728" ON "organization_contact" ("updatedByUserId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_f91783c7a8565c648b65635efc" ON "organization_contact" ("isArchived") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_53627a383c9817dbf1164d7dc6" ON "organization_contact" ("isActive") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_e68c43e315ad3aaea4e99cf461" ON "organization_contact" ("tenantId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_6200736cb4d3617b004e5b647f" ON "organization_contact" ("organizationId") `
		);
		await queryRunner.query(`CREATE INDEX "IDX_de33f92e042365d196d959e774" ON "organization_contact" ("name") `);
		await queryRunner.query(
			`CREATE INDEX "IDX_a86d2e378b953cb39261f457d2" ON "organization_contact" ("contactId") `
		);
		await queryRunner.query(`CREATE INDEX "IDX_8cfcdc6bc8fb55e273d9ace5fd" ON "organization_contact" ("imageId") `);
		await queryRunner.query(
			`CREATE INDEX "IDX_53bb1086e10d553249483b267c" ON "organization_contact" ("createdByUserId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_f8df3dea1e42ef16ae7f411304" ON "organization_contact" ("deletedByUserId") `
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
		await queryRunner.query(`UPDATE \`organization_contact\` SET \`createdByUserId\` = \`createdBy\``);

		// Step 2: Drop the "createdBy" column
		console.log('Step 2: Dropping column createdBy');
		await queryRunner.query(`ALTER TABLE \`organization_contact\` DROP COLUMN \`createdBy\``);
	}

	/**
	 * MySQL Down Migration
	 *
	 * @param queryRunner
	 */
	public async mysqlDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		// Step 1: Re-add the "createdBy" column
		console.log('Step 1: Adding column createdBy');
		await queryRunner.query(`ALTER TABLE \`organization_contact\` ADD \`createdBy\` varchar(255) NULL`);

		// Step 2: Copy data from "createdByUserId" to "createdBy"
		console.log('Step 2: Copying data from createdByUserId to createdBy');
		await queryRunner.query(`UPDATE \`organization_contact\` SET \`createdBy\` = \`createdByUserId\``);
	}
}
