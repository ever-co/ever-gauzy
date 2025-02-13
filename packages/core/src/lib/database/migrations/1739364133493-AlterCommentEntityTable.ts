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
	public async sqliteUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		// Step 1: Drop existing indexes from the current "comment" table.
		console.log('Step 1: Dropping existing indexes from "comment"...');
		await queryRunner.query(`DROP INDEX "IDX_3620aeff4ac5c977176226017e"`);
		await queryRunner.query(`DROP INDEX "IDX_da3cd25ed3a6ce76770f00c3da"`);
		await queryRunner.query(`DROP INDEX "IDX_8f58834bed39f0f9e85f048eaf"`);
		await queryRunner.query(`DROP INDEX "IDX_a3422826753d4e6b079dea9834"`);
		await queryRunner.query(`DROP INDEX "IDX_097e339f6cb990306d19880a4c"`);
		await queryRunner.query(`DROP INDEX "IDX_2950cfa146fc50334efa61a70b"`);
		await queryRunner.query(`DROP INDEX "IDX_eecd6e41f9acb6bf59e474d518"`);
		await queryRunner.query(`DROP INDEX "IDX_b6bf60ecb9f6c398e349adff52"`);
		await queryRunner.query(`DROP INDEX "IDX_c9409c81aa283c1aae70fd5f4c"`);
		await queryRunner.query(`DROP INDEX "IDX_e3aebe2bd1c53467a07109be59"`);

		// Step 2: Create a temporary table with extra columns.
		console.log('Step 2: Creating temporary table "temporary_comment" with new columns...');
		await queryRunner.query(`
			CREATE TABLE "temporary_comment" (
				"deletedAt"           datetime,
				"id"                  varchar PRIMARY KEY NOT NULL,
				"createdAt"           datetime NOT NULL DEFAULT (datetime('now')),
				"updatedAt"           datetime NOT NULL DEFAULT (datetime('now')),
				"isActive"            boolean DEFAULT (1),
				"isArchived"          boolean DEFAULT (0),
				"archivedAt"          datetime,
				"tenantId"            varchar,
				"organizationId"      varchar,
				"entity"              varchar NOT NULL,
				"entityId"            varchar NOT NULL,
				"comment"             text NOT NULL,
				"actorType"           integer,
				"resolved"            boolean,
				"resolvedAt"          datetime,
				"editedAt"            datetime,
				"parentId"            varchar,
				"creatorId"           varchar,
				"resolvedById"        varchar,
				"employeeId"          varchar,
				"resolvedByEmployeeId" varchar,
				CONSTRAINT "FK_8f58834bed39f0f9e85f048eafe" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION,
				CONSTRAINT "FK_a3422826753d4e6b079dea98342" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
				CONSTRAINT "FK_e3aebe2bd1c53467a07109be596" FOREIGN KEY ("parentId") REFERENCES "comment" ("id") ON DELETE SET NULL ON UPDATE NO ACTION,
				CONSTRAINT "FK_7a88834dadfa6fe261268bfceef" FOREIGN KEY ("employeeId") REFERENCES "employee" ("id") ON DELETE CASCADE ON UPDATE NO ACTION,
				CONSTRAINT "FK_35cddb3e66a46587966b68a9217" FOREIGN KEY ("resolvedByEmployeeId") REFERENCES "employee" ("id") ON DELETE CASCADE ON UPDATE NO ACTION
			)
		`);

		// Step 3: Copy data from the old "comment" table into the temporary table.
		console.log('Step 3: Copying data from the existing "comment" table into "temporary_comment"...');
		await queryRunner.query(`
			INSERT INTO "temporary_comment" (
				"deletedAt",
				"id",
				"createdAt",
				"updatedAt",
				"isActive",
				"isArchived",
				"archivedAt",
				"tenantId",
				"organizationId",
				"entity",
				"entityId",
				"comment",
				"actorType",
				"resolved",
				"resolvedAt",
				"editedAt",
				"parentId",
				"creatorId",
				"resolvedById"
			)
			SELECT
				"deletedAt",
				"id",
				"createdAt",
				"updatedAt",
				"isActive",
				"isArchived",
				"archivedAt",
				"tenantId",
				"organizationId",
				"entity",
				"entityId",
				"comment",
				"actorType",
				"resolved",
				"resolvedAt",
				"editedAt",
				"parentId",
				"creatorId",
				"resolvedById"
			FROM "comment"
		`);

		// Step 4: Copy data from "creatorId" to "employeeId" using the employee mapping
		console.log('Step 4: Updating "employeeId" from "creatorId" via employee table mapping...');
		await queryRunner.query(`
			UPDATE "temporary_comment"
			SET "employeeId" = (
				SELECT e."id"
				FROM "employee" e
				WHERE e."userId" = "temporary_comment"."creatorId"
				LIMIT 1
			)
			WHERE "creatorId" IS NOT NULL
		`);

		// Step 5: Copy data from "resolvedById" to "resolvedByEmployeeId" using the employee mapping
		console.log('Step 5: Updating "resolvedByEmployeeId" from "resolvedById" via employee table mapping...');
		await queryRunner.query(`
			UPDATE "temporary_comment"
			SET "resolvedByEmployeeId" = (
				SELECT e."id"
				FROM "employee" e
				WHERE e."userId" = "temporary_comment"."resolvedById"
				LIMIT 1
			)
			WHERE "resolvedById" IS NOT NULL
		`);

		// Step 6: Recreate the "clean_comment" table without the old columns.
		console.log('Step 6: Recreating "clean_comment" table without old columns...');
		await queryRunner.query(`
			CREATE TABLE "clean_comment" (
				"deletedAt"           datetime,
				"id"                  varchar PRIMARY KEY NOT NULL,
				"createdAt"           datetime NOT NULL DEFAULT (datetime('now')),
				"updatedAt"           datetime NOT NULL DEFAULT (datetime('now')),
				"isActive"            boolean DEFAULT (1),
				"isArchived"          boolean DEFAULT (0),
				"archivedAt"          datetime,
				"tenantId"            varchar,
				"organizationId"      varchar,
				"entity"              varchar NOT NULL,
				"entityId"            varchar NOT NULL,
				"comment"             text NOT NULL,
				"actorType"           integer,
				"resolved"            boolean,
				"resolvedAt"          datetime,
				"editedAt"            datetime,
				"parentId"            varchar,
				"employeeId"          varchar,
				"resolvedByEmployeeId" varchar,
				CONSTRAINT "FK_8f58834bed39f0f9e85f048eafe" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION,
				CONSTRAINT "FK_a3422826753d4e6b079dea98342" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
				CONSTRAINT "FK_e3aebe2bd1c53467a07109be596" FOREIGN KEY ("parentId") REFERENCES "comment" ("id") ON DELETE SET NULL ON UPDATE NO ACTION,
				CONSTRAINT "FK_7a88834dadfa6fe261268bfceef" FOREIGN KEY ("employeeId") REFERENCES "employee" ("id") ON DELETE CASCADE ON UPDATE NO ACTION,
				CONSTRAINT "FK_35cddb3e66a46587966b68a9217" FOREIGN KEY ("resolvedByEmployeeId") REFERENCES "employee" ("id") ON DELETE CASCADE ON UPDATE NO ACTION
			)
		`);

		// Step 8: Copy data from the temporary table (which now has the new columns) into the new clean table.
		console.log('Step 8: Copying data into the new "clean_comment" table without old columns...');
		await queryRunner.query(`
			INSERT INTO "clean_comment" (
				"deletedAt",
				"id",
				"createdAt",
				"updatedAt",
				"isActive",
				"isArchived",
				"archivedAt",
				"tenantId",
				"organizationId",
				"entity",
				"entityId",
				"comment",
				"actorType",
				"resolved",
				"resolvedAt",
				"editedAt",
				"parentId",
				"employeeId",
				"resolvedByEmployeeId"
			)
			SELECT
				"deletedAt",
				"id",
				"createdAt",
				"updatedAt",
				"isActive",
				"isArchived",
				"archivedAt",
				"tenantId",
				"organizationId",
				"entity",
				"entityId",
				"comment",
				"actorType",
				"resolved",
				"resolvedAt",
				"editedAt",
				"parentId",
				"employeeId",
				"resolvedByEmployeeId"
			FROM "temporary_comment"
		`);

		// Step 9: Drop the old "comment" table and rename the new clean table.
		console.log(
			'Step 9: Dropping old "comment" table and renaming "clean_comment" to "comment" and dropping "temporary_comment"...'
		);
		await queryRunner.query(`DROP TABLE "comment"`);
		await queryRunner.query(`ALTER TABLE "clean_comment" RENAME TO "comment"`);
		await queryRunner.query(`DROP TABLE "temporary_comment"`);

		// Step 10: Create final indexes on the new "comment" table.
		console.log('Step 10: Creating indexes on the new "comment" table...');
		await queryRunner.query(`CREATE INDEX "IDX_3620aeff4ac5c977176226017e" ON "comment" ("isActive")`);
		await queryRunner.query(`CREATE INDEX "IDX_da3cd25ed3a6ce76770f00c3da" ON "comment" ("isArchived")`);
		await queryRunner.query(`CREATE INDEX "IDX_8f58834bed39f0f9e85f048eaf" ON "comment" ("tenantId")`);
		await queryRunner.query(`CREATE INDEX "IDX_a3422826753d4e6b079dea9834" ON "comment" ("organizationId")`);
		await queryRunner.query(`CREATE INDEX "IDX_097e339f6cb990306d19880a4c" ON "comment" ("entity")`);
		await queryRunner.query(`CREATE INDEX "IDX_2950cfa146fc50334efa61a70b" ON "comment" ("entityId")`);
		await queryRunner.query(`CREATE INDEX "IDX_eecd6e41f9acb6bf59e474d518" ON "comment" ("actorType")`);
		await queryRunner.query(`CREATE INDEX "IDX_e3aebe2bd1c53467a07109be59" ON "comment" ("parentId")`);
		await queryRunner.query(`CREATE INDEX "IDX_7a88834dadfa6fe261268bfcee" ON "comment" ("employeeId")`);
		await queryRunner.query(`CREATE INDEX "IDX_35cddb3e66a46587966b68a921" ON "comment" ("resolvedByEmployeeId")`);
	}

	/**
	 * SqliteDB and BetterSQlite3DB Down Migration
	 *
	 * @param queryRunner
	 */
	public async sqliteDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		// Step 1: Drop existing indexes from the final "comment" table.
		console.log('Step 1: Dropping existing indexes from "comment"...');
		await queryRunner.query(`DROP INDEX "IDX_35cddb3e66a46587966b68a921"`);
		await queryRunner.query(`DROP INDEX "IDX_7a88834dadfa6fe261268bfcee"`);
		await queryRunner.query(`DROP INDEX "IDX_e3aebe2bd1c53467a07109be59"`);
		await queryRunner.query(`DROP INDEX "IDX_eecd6e41f9acb6bf59e474d518"`);
		await queryRunner.query(`DROP INDEX "IDX_2950cfa146fc50334efa61a70b"`);
		await queryRunner.query(`DROP INDEX "IDX_097e339f6cb990306d19880a4c"`);
		await queryRunner.query(`DROP INDEX "IDX_a3422826753d4e6b079dea9834"`);
		await queryRunner.query(`DROP INDEX "IDX_8f58834bed39f0f9e85f048eaf"`);
		await queryRunner.query(`DROP INDEX "IDX_da3cd25ed3a6ce76770f00c3da"`);
		await queryRunner.query(`DROP INDEX "IDX_3620aeff4ac5c977176226017e"`);

		// Step 2: Rename the current "comment" table to "temporary_comment".
		console.log('Step 2: Renaming "comment" to "temporary_comment"...');
		await queryRunner.query(`ALTER TABLE "comment" RENAME TO "temporary_comment"`);

		// Step 3: Create a new "comment" table with the old schema.
		// This new table includes "creatorId" and "resolvedById" with their foreign key constraints.
		console.log('Step 3: Creating new "comment" table with old schema (with "creatorId" and "resolvedById")...');
		await queryRunner.query(`
			CREATE TABLE "comment" (
				"deletedAt"           datetime,
				"id"                  varchar PRIMARY KEY NOT NULL,
				"createdAt"           datetime NOT NULL DEFAULT (datetime('now')),
				"updatedAt"           datetime NOT NULL DEFAULT (datetime('now')),
				"isActive"            boolean DEFAULT (1),
				"isArchived"          boolean DEFAULT (0),
				"archivedAt"          datetime,
				"tenantId"            varchar,
				"organizationId"      varchar,
				"entity"              varchar NOT NULL,
				"entityId"            varchar NOT NULL,
				"comment"             text NOT NULL,
				"actorType"           integer,
				"resolved"            boolean,
				"resolvedAt"          datetime,
				"editedAt"            datetime,
				"parentId"            varchar,
				"creatorId"           varchar,
				"resolvedById"        varchar,
				"employeeId"          varchar,
				"resolvedByEmployeeId" varchar,
				CONSTRAINT "FK_8f58834bed39f0f9e85f048eafe" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION,
				CONSTRAINT "FK_a3422826753d4e6b079dea98342" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
				CONSTRAINT "FK_e3aebe2bd1c53467a07109be596" FOREIGN KEY ("parentId") REFERENCES "comment" ("id") ON DELETE SET NULL ON UPDATE NO ACTION
			)
		`);

		// Step 4: Copy data from the old "temporary_comment" table into the "comment" table.
		console.log('Step 4: Copying data from the existing "temporary_comment" table into "comment"...');
		await queryRunner.query(`
			INSERT INTO "comment" (
				"deletedAt",
				"id",
				"createdAt",
				"updatedAt",
				"isActive",
				"isArchived",
				"archivedAt",
				"tenantId",
				"organizationId",
				"entity",
				"entityId",
				"comment",
				"actorType",
				"resolved",
				"resolvedAt",
				"editedAt",
				"parentId",
				"employeeId",
				"resolvedByEmployeeId"
			)
			SELECT
				"deletedAt",
				"id",
				"createdAt",
				"updatedAt",
				"isActive",
				"isArchived",
				"archivedAt",
				"tenantId",
				"organizationId",
				"entity",
				"entityId",
				"comment",
				"actorType",
				"resolved",
				"resolvedAt",
				"editedAt",
				"parentId",
				"employeeId",
				"resolvedByEmployeeId"
			FROM "temporary_comment"
		`);

		// Step 5: Update "creatorId" from "employeeId" using employee table mapping
		console.log('Step 5: Updating "creatorId" from "employeeId" via employee table mapping...');
		await queryRunner.query(`
			UPDATE "comment"
			SET "creatorId" = (
				SELECT e."userId"
				FROM "employee" e
				WHERE e."id" = "comment"."employeeId"
				LIMIT 1
			)
			WHERE "employeeId" IS NOT NULL
		`);

		// Step 6: Update "resolvedById" from "resolvedByEmployeeId" using employee table mapping
		console.log('Step 6: Updating "resolvedById" from "resolvedByEmployeeId" via employee table mapping...');
		await queryRunner.query(`
			UPDATE "comment"
			SET "resolvedById" = (
				SELECT e."userId"
				FROM "employee" e
				WHERE e."id" = "comment"."resolvedByEmployeeId"
				LIMIT 1
			)
			WHERE "resolvedByEmployeeId" IS NOT NULL
		`);

		// Step 7: Drop the old "comment" table and rename the temporary table to it.
		console.log('Step 7: Dropping the old "temporary_comment" table and renaming the "comment" table to it...');
		await queryRunner.query(`DROP TABLE "temporary_comment"`);
		await queryRunner.query(`ALTER TABLE "comment" RENAME TO "temporary_comment"`);

		// Step 8: Recreating "comment" table with the new columns.
		console.log('Step 8: Recreating "comment" table with the new columns...');
		await queryRunner.query(`
			CREATE TABLE "comment" (
				"deletedAt" datetime,
				"id" varchar PRIMARY KEY NOT NULL,
				"createdAt" datetime NOT NULL DEFAULT (datetime('now')),
				"updatedAt" datetime NOT NULL DEFAULT (datetime('now')),
				"isActive" boolean DEFAULT (1),
				"isArchived" boolean DEFAULT (0),
				"archivedAt" datetime,
				"tenantId" varchar,
				"organizationId" varchar,
				"entity" varchar NOT NULL,
				"entityId" varchar NOT NULL,
				"comment" text NOT NULL,
				"actorType" integer,
				"resolved" boolean,
				"resolvedAt" datetime,
				"editedAt" datetime,
				"creatorId" varchar,
				"resolvedById" varchar,
				"parentId" varchar,
				CONSTRAINT "FK_8f58834bed39f0f9e85f048eafe" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION,
				CONSTRAINT "FK_a3422826753d4e6b079dea98342" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
				CONSTRAINT "FK_b6bf60ecb9f6c398e349adff52f" FOREIGN KEY ("creatorId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION,
				CONSTRAINT "FK_c9409c81aa283c1aae70fd5f4c3" FOREIGN KEY ("resolvedById") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION,
				CONSTRAINT "FK_e3aebe2bd1c53467a07109be596" FOREIGN KEY ("parentId") REFERENCES "comment" ("id") ON DELETE SET NULL ON UPDATE NO ACTION
			)
		`);

		// Step 9: Copy data from the old "temporary_comment" table into the "comment" table.
		console.log('Step 9: Copying data from the existing "temporary_comment" table into "comment"...');
		await queryRunner.query(`
			INSERT INTO "comment" (
				"deletedAt",
				"id",
				"createdAt",
				"updatedAt",
				"isActive",
				"isArchived",
				"archivedAt",
				"tenantId",
				"organizationId",
				"entity",
				"entityId",
				"comment",
				"actorType",
				"resolved",
				"resolvedAt",
				"editedAt",
				"creatorId",
				"resolvedById",
				"parentId"
			)
			SELECT
				"deletedAt",
				"id",
				"createdAt",
				"updatedAt",
				"isActive",
				"isArchived",
				"archivedAt",
				"tenantId",
				"organizationId",
				"entity",
				"entityId",
				"comment",
				"actorType",
				"resolved",
				"resolvedAt",
				"editedAt",
				"creatorId",
				"resolvedById",
				"parentId"
			FROM "temporary_comment"
		`);

		// Step 10: Dropping the old "temporary_comment" table.
		console.log('Step 10: Dropping the old "temporary_comment" table...');
		await queryRunner.query(`DROP TABLE "temporary_comment"`);

		// Step 11: Create final indexes on the new "comment" table.
		console.log('Step 11: Creating indexes on the new "comment" table...');
		await queryRunner.query(`CREATE INDEX "IDX_e3aebe2bd1c53467a07109be59" ON "comment" ("parentId") `);
		await queryRunner.query(`CREATE INDEX "IDX_c9409c81aa283c1aae70fd5f4c" ON "comment" ("resolvedById") `);
		await queryRunner.query(`CREATE INDEX "IDX_b6bf60ecb9f6c398e349adff52" ON "comment" ("creatorId") `);
		await queryRunner.query(`CREATE INDEX "IDX_eecd6e41f9acb6bf59e474d518" ON "comment" ("actorType") `);
		await queryRunner.query(`CREATE INDEX "IDX_2950cfa146fc50334efa61a70b" ON "comment" ("entityId") `);
		await queryRunner.query(`CREATE INDEX "IDX_097e339f6cb990306d19880a4c" ON "comment" ("entity") `);
		await queryRunner.query(`CREATE INDEX "IDX_a3422826753d4e6b079dea9834" ON "comment" ("organizationId") `);
		await queryRunner.query(`CREATE INDEX "IDX_8f58834bed39f0f9e85f048eaf" ON "comment" ("tenantId") `);
		await queryRunner.query(`CREATE INDEX "IDX_da3cd25ed3a6ce76770f00c3da" ON "comment" ("isArchived") `);
		await queryRunner.query(`CREATE INDEX "IDX_3620aeff4ac5c977176226017e" ON "comment" ("isActive") `);
	}

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
