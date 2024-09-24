import { MigrationInterface, QueryRunner } from 'typeorm';
import { yellow } from 'chalk';
import { v4 as uuidv4 } from 'uuid';
import { DatabaseTypeEnum } from '@gauzy/config';

export class AddColumnsToOrganizationProjectEmployeeEntity1726509769379 implements MigrationInterface {
	name = 'AddColumnsToOrganizationProjectEmployeeEntity1726509769379';

	/**
	 * Up Migration
	 *
	 * @param queryRunner
	 */
	public async up(queryRunner: QueryRunner): Promise<void> {
		console.log(yellow(this.name + ' start running!'));

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
		// Step 1: Drop existing foreign keys
		console.log('Step 1: Dropping existing foreign keys...');
		await queryRunner.query(
			`ALTER TABLE "organization_project_employee" DROP CONSTRAINT "FK_2ba868f42c2301075b7c141359e"`
		);
		await queryRunner.query(
			`ALTER TABLE "organization_project_employee" DROP CONSTRAINT "FK_6b5b0c3d994f59d9c800922257f"`
		);

		// Step 2: Add new columns
		console.log('Step 2: Adding new columns (deletedAt, tenantId, archivedAt, etc.)...');
		await queryRunner.query(`ALTER TABLE "organization_project_employee" ADD "deletedAt" TIMESTAMP`);
		await queryRunner.query(
			`ALTER TABLE "organization_project_employee" ADD "id" uuid NOT NULL DEFAULT gen_random_uuid()`
		);

		// Step 3: Modify primary keys
		console.log('Step 3: Modifying primary keys...');
		await queryRunner.query(
			`ALTER TABLE "organization_project_employee" DROP CONSTRAINT "PK_5be2464327d74ba4e2b2240aac4"`
		);
		await queryRunner.query(
			`ALTER TABLE "organization_project_employee" ADD CONSTRAINT "PK_ce1fc15962d70f8776be4e19c36" PRIMARY KEY ("employeeId", "organizationProjectId", "id")`
		);

		// Step 4: Add timestamps and status columns
		console.log('Step 4: Adding timestamps and status columns...');
		await queryRunner.query(
			`ALTER TABLE "organization_project_employee" ADD "createdAt" TIMESTAMP NOT NULL DEFAULT now()`
		);
		await queryRunner.query(
			`ALTER TABLE "organization_project_employee" ADD "updatedAt" TIMESTAMP NOT NULL DEFAULT now()`
		);
		await queryRunner.query(`ALTER TABLE "organization_project_employee" ADD "isActive" boolean DEFAULT true`);
		await queryRunner.query(`ALTER TABLE "organization_project_employee" ADD "isArchived" boolean DEFAULT false`);
		await queryRunner.query(`ALTER TABLE "organization_project_employee" ADD "archivedAt" TIMESTAMP`);
		await queryRunner.query(`ALTER TABLE "organization_project_employee" ADD "tenantId" uuid`);
		await queryRunner.query(`ALTER TABLE "organization_project_employee" ADD "organizationId" uuid`);
		await queryRunner.query(`ALTER TABLE "organization_project_employee" ADD "isManager" boolean DEFAULT false`);
		await queryRunner.query(`ALTER TABLE "organization_project_employee" ADD "assignedAt" TIMESTAMP`);
		await queryRunner.query(`ALTER TABLE "organization_project_employee" ADD "roleId" uuid`);

		// Step 5: Setting tenantId and organizationId for existing records in bulk
		console.log('Step 5: Setting tenantId and organizationId for existing records...');
		await queryRunner.query(`
			UPDATE "organization_project_employee" AS ope
			SET
				"tenantId" = op."tenantId",
				"organizationId" = op."organizationId"
			FROM "organization_project" AS op
			WHERE
				ope."organizationProjectId" = op."id";
		`);

		// Step 6: Modify primary keys again
		console.log('Step 6: Modifying primary keys again...');
		await queryRunner.query(
			`ALTER TABLE "organization_project_employee" DROP CONSTRAINT "PK_ce1fc15962d70f8776be4e19c36"`
		);
		await queryRunner.query(
			`ALTER TABLE "organization_project_employee" ADD CONSTRAINT "PK_ef7ed5fb243d49d55cecf1ae8bd" PRIMARY KEY ("employeeId", "id")`
		);
		await queryRunner.query(
			`ALTER TABLE "organization_project_employee" DROP CONSTRAINT "PK_ef7ed5fb243d49d55cecf1ae8bd"`
		);
		await queryRunner.query(
			`ALTER TABLE "organization_project_employee" ADD CONSTRAINT "PK_cb8069ff5917c90adbc48139147" PRIMARY KEY ("id")`
		);

		// Step 7: Create new indexes
		console.log('Step 7: Creating new indexes...');
		await queryRunner.query(
			`CREATE INDEX "IDX_f3d1102a8aa6442cdfce5d57c3" ON "organization_project_employee" ("isActive") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_abbe29504bb642647a69959cc0" ON "organization_project_employee" ("isArchived") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_a9abd98013154ec1edfa1ec18c" ON "organization_project_employee" ("tenantId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_a77a507b7402f0adb6a6b41e41" ON "organization_project_employee" ("organizationId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_509be755cdaf837c263ffaa6b6" ON "organization_project_employee" ("isManager") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_25de67f7f3f030438e3ecb1c0e" ON "organization_project_employee" ("assignedAt") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_1c5e006185395a6193ede3456c" ON "organization_project_employee" ("roleId") `
		);

		// Step 8: Recreate foreign keys
		console.log('Step 8: Recreating foreign keys...');
		await queryRunner.query(
			`ALTER TABLE "organization_project_employee" ADD CONSTRAINT "FK_a9abd98013154ec1edfa1ec18cd" FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "organization_project_employee" ADD CONSTRAINT "FK_a77a507b7402f0adb6a6b41e412" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE`
		);
		await queryRunner.query(
			`ALTER TABLE "organization_project_employee" ADD CONSTRAINT "FK_2ba868f42c2301075b7c141359e" FOREIGN KEY ("organizationProjectId") REFERENCES "organization_project"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "organization_project_employee" ADD CONSTRAINT "FK_6b5b0c3d994f59d9c800922257f" FOREIGN KEY ("employeeId") REFERENCES "employee"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "organization_project_employee" ADD CONSTRAINT "FK_1c5e006185395a6193ede3456c6" FOREIGN KEY ("roleId") REFERENCES "role"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);

		console.log('PostgresDB Up Migration completed.');
	}

	/**
	 * PostgresDB Down Migration
	 *
	 * @param queryRunner
	 */
	public async postgresDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		// Step 1: Drop foreign keys
		console.log('Step 1: Dropping foreign keys...');
		await queryRunner.query(
			`ALTER TABLE "organization_project_employee" DROP CONSTRAINT "FK_1c5e006185395a6193ede3456c6"`
		);
		await queryRunner.query(
			`ALTER TABLE "organization_project_employee" DROP CONSTRAINT "FK_6b5b0c3d994f59d9c800922257f"`
		);
		await queryRunner.query(
			`ALTER TABLE "organization_project_employee" DROP CONSTRAINT "FK_2ba868f42c2301075b7c141359e"`
		);
		await queryRunner.query(
			`ALTER TABLE "organization_project_employee" DROP CONSTRAINT "FK_a77a507b7402f0adb6a6b41e412"`
		);
		await queryRunner.query(
			`ALTER TABLE "organization_project_employee" DROP CONSTRAINT "FK_a9abd98013154ec1edfa1ec18cd"`
		);

		// Step 2: Drop indexes
		console.log('Step 2: Dropping indexes...');
		await queryRunner.query(`DROP INDEX "public"."IDX_1c5e006185395a6193ede3456c"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_25de67f7f3f030438e3ecb1c0e"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_509be755cdaf837c263ffaa6b6"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_a77a507b7402f0adb6a6b41e41"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_a9abd98013154ec1edfa1ec18c"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_abbe29504bb642647a69959cc0"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_f3d1102a8aa6442cdfce5d57c3"`);

		// Step 3: Modify primary keys and constraints
		console.log('Step 3: Modifying primary keys and constraints...');
		await queryRunner.query(
			`ALTER TABLE "organization_project_employee" DROP CONSTRAINT "PK_cb8069ff5917c90adbc48139147"`
		);
		await queryRunner.query(
			`ALTER TABLE "organization_project_employee" ADD CONSTRAINT "PK_ef7ed5fb243d49d55cecf1ae8bd" PRIMARY KEY ("employeeId", "id")`
		);
		await queryRunner.query(
			`ALTER TABLE "organization_project_employee" DROP CONSTRAINT "PK_ef7ed5fb243d49d55cecf1ae8bd"`
		);
		await queryRunner.query(
			`ALTER TABLE "organization_project_employee" ADD CONSTRAINT "PK_ce1fc15962d70f8776be4e19c36" PRIMARY KEY ("employeeId", "organizationProjectId", "id")`
		);

		// Step 4: Drop newly added columns
		console.log('Step 4: Dropping newly added columns...');
		await queryRunner.query(`ALTER TABLE "organization_project_employee" DROP COLUMN "roleId"`);
		await queryRunner.query(`ALTER TABLE "organization_project_employee" DROP COLUMN "assignedAt"`);
		await queryRunner.query(`ALTER TABLE "organization_project_employee" DROP COLUMN "isManager"`);
		await queryRunner.query(`ALTER TABLE "organization_project_employee" DROP COLUMN "organizationId"`);
		await queryRunner.query(`ALTER TABLE "organization_project_employee" DROP COLUMN "tenantId"`);
		await queryRunner.query(`ALTER TABLE "organization_project_employee" DROP COLUMN "archivedAt"`);
		await queryRunner.query(`ALTER TABLE "organization_project_employee" DROP COLUMN "isArchived"`);
		await queryRunner.query(`ALTER TABLE "organization_project_employee" DROP COLUMN "isActive"`);
		await queryRunner.query(`ALTER TABLE "organization_project_employee" DROP COLUMN "updatedAt"`);
		await queryRunner.query(`ALTER TABLE "organization_project_employee" DROP COLUMN "createdAt"`);

		// Step 5: Restore original primary key constraint
		console.log('Step 5: Restoring original primary key constraint...');
		await queryRunner.query(
			`ALTER TABLE "organization_project_employee" DROP CONSTRAINT "PK_ce1fc15962d70f8776be4e19c36"`
		);
		await queryRunner.query(
			`ALTER TABLE "organization_project_employee" ADD CONSTRAINT "PK_5be2464327d74ba4e2b2240aac4" PRIMARY KEY ("employeeId", "organizationProjectId")`
		);

		console.log('Step 6: Dropping newly added columns...');
		await queryRunner.query(`ALTER TABLE "organization_project_employee" DROP COLUMN "id"`);
		await queryRunner.query(`ALTER TABLE "organization_project_employee" DROP COLUMN "deletedAt"`);

		// Step 6: Recreate original foreign keys
		console.log('Step 7: Recreating original foreign keys...');
		await queryRunner.query(
			`ALTER TABLE "organization_project_employee" ADD CONSTRAINT "FK_6b5b0c3d994f59d9c800922257f" FOREIGN KEY ("employeeId") REFERENCES "employee"("id") ON DELETE CASCADE ON UPDATE CASCADE`
		);
		await queryRunner.query(
			`ALTER TABLE "organization_project_employee" ADD CONSTRAINT "FK_2ba868f42c2301075b7c141359e" FOREIGN KEY ("organizationProjectId") REFERENCES "organization_project"("id") ON DELETE CASCADE ON UPDATE CASCADE`
		);
	}

	/**
	 * SqliteDB and BetterSQLite3DB Up Migration
	 *
	 * @param queryRunner
	 */
	public async sqliteUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		// Step 1: Drop existing indexes to avoid conflicts during migration
		console.log('Step 1: Dropping existing indexes');
		await queryRunner.query(`DROP INDEX IF EXISTS "IDX_2ba868f42c2301075b7c141359"`);
		await queryRunner.query(`DROP INDEX IF EXISTS "IDX_6b5b0c3d994f59d9c800922257"`);

		// Step 2: Create a temporary table with the new schema (without constraints)
		console.log('Step 2: Creating temporary table with new schema');
		await queryRunner.query(`
			CREATE TABLE "temporary_organization_project_employee" (
				"employeeId" VARCHAR NOT NULL,
				"organizationProjectId" VARCHAR NOT NULL,
				"deletedAt" DATETIME,
				"id" VARCHAR PRIMARY KEY NOT NULL,
				"createdAt" DATETIME NOT NULL DEFAULT (DATETIME('now')),
				"updatedAt" DATETIME NOT NULL DEFAULT (DATETIME('now')),
				"isActive" BOOLEAN DEFAULT (1),
				"isArchived" BOOLEAN DEFAULT (0),
				"archivedAt" DATETIME,
				"tenantId" VARCHAR,
				"organizationId" VARCHAR,
				"isManager" BOOLEAN DEFAULT (0),
				"assignedAt" DATETIME,
				"roleId" VARCHAR
			)
		`);

		// Step 3: Copy data to the temporary table, generating UUIDs for the 'id' column
		console.log('Step 3: Copying data to temporary table with generated UUIDs for id column');
		await queryRunner.query(`
			INSERT INTO "temporary_organization_project_employee" (
				"employeeId",
				"organizationProjectId",
				"tenantId",
				"organizationId",
				"id"
			)
			SELECT
				ope."employeeId",
				ope."organizationProjectId",
				op."tenantId",
				op."organizationId",
				LOWER(hex(randomblob(4))) || '-' ||
				LOWER(hex(randomblob(2))) || '-' ||
				LOWER(hex(randomblob(2))) || '-' ||
				LOWER(hex(randomblob(2))) || '-' ||
				LOWER(hex(randomblob(6))) AS "id"
			FROM "organization_project_employee" AS ope
			INNER JOIN "organization_project" AS op ON ope."organizationProjectId" = op."id";
		`);

		// Step 4: Drop the old table
		console.log('Step 4: Dropping the old organization_project_employee table');
		await queryRunner.query(`DROP TABLE "organization_project_employee"`);

		// Step 5: Rename the temporary table to the original table name
		console.log('Step 5: Renaming temporary table to organization_project_employee');
		await queryRunner.query(
			`ALTER TABLE "temporary_organization_project_employee" RENAME TO "organization_project_employee"`
		);

		// Step 6: Recreate indexes on the new table
		console.log('Step 6: Recreating indexes on organization_project_employee');
		await queryRunner.query(
			`CREATE INDEX "IDX_2ba868f42c2301075b7c141359" ON "organization_project_employee" ("organizationProjectId")`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_6b5b0c3d994f59d9c800922257" ON "organization_project_employee" ("employeeId")`
		);

		// Step 7: Create a new temporary table with constraints
		console.log('Step 7: Creating a new temporary table with constraints');
		await queryRunner.query(`
			CREATE TABLE "temporary_organization_project_employee_with_constraints" (
				"employeeId" VARCHAR NOT NULL,
				"organizationProjectId" VARCHAR NOT NULL,
				"deletedAt" DATETIME,
				"id" VARCHAR PRIMARY KEY NOT NULL,
				"createdAt" DATETIME NOT NULL DEFAULT (DATETIME('now')),
				"updatedAt" DATETIME NOT NULL DEFAULT (DATETIME('now')),
				"isActive" BOOLEAN DEFAULT (1),
				"isArchived" BOOLEAN DEFAULT (0),
				"archivedAt" DATETIME,
				"tenantId" VARCHAR,
				"organizationId" VARCHAR,
				"isManager" BOOLEAN DEFAULT (0),
				"assignedAt" DATETIME,
				"roleId" VARCHAR,
				CONSTRAINT "FK_employee" FOREIGN KEY ("employeeId")
					REFERENCES "employee" ("id") ON DELETE CASCADE,
				CONSTRAINT "FK_organization_project" FOREIGN KEY ("organizationProjectId")
					REFERENCES "organization_project" ("id") ON DELETE CASCADE,
				CONSTRAINT "FK_tenant" FOREIGN KEY ("tenantId")
					REFERENCES "tenant" ("id") ON DELETE CASCADE,
				CONSTRAINT "FK_organization" FOREIGN KEY ("organizationId")
					REFERENCES "organization" ("id") ON DELETE CASCADE,
				CONSTRAINT "FK_role" FOREIGN KEY ("roleId")
					REFERENCES "role" ("id") ON DELETE CASCADE
			)
		`);

		// Step 8: Copy data from the current table into the new temporary table
		console.log('Step 8: Copying data into the temporary table with constraints');
		await queryRunner.query(`
			INSERT INTO "temporary_organization_project_employee_with_constraints" (
				"employeeId",
				"organizationProjectId",
				"tenantId",
				"organizationId",
				"id"
			)
			SELECT
				"employeeId",
				"organizationProjectId",
				"tenantId",
				"organizationId",
				"id"
			FROM "organization_project_employee"
		`);

		// Step 9: Drop the current table
		console.log('Step 9: Dropping the organization_project_employee table');
		await queryRunner.query(`DROP TABLE "organization_project_employee"`);

		// Step 10: Rename the temporary table to the original table name
		console.log(
			'Step 10: Renaming temporary_organization_project_employee_with_constraints to organization_project_employee'
		);
		await queryRunner.query(`
			ALTER TABLE "temporary_organization_project_employee_with_constraints" RENAME TO "organization_project_employee"
		`);

		// Step 11: Recreate indexes on the new table with constraints
		console.log('Step 11: Recreating indexes on the new table with constraints');
		await queryRunner.query(
			`CREATE INDEX "IDX_2ba868f42c2301075b7c141359" ON "organization_project_employee" ("organizationProjectId")`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_6b5b0c3d994f59d9c800922257" ON "organization_project_employee" ("employeeId")`
		);
		// Recreate any other indexes you require
		await queryRunner.query(
			`CREATE INDEX "IDX_f3d1102a8aa6442cdfce5d57c3" ON "organization_project_employee" ("isActive")`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_abbe29504bb642647a69959cc0" ON "organization_project_employee" ("isArchived")`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_a9abd98013154ec1edfa1ec18c" ON "organization_project_employee" ("tenantId")`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_a77a507b7402f0adb6a6b41e41" ON "organization_project_employee" ("organizationId")`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_509be755cdaf837c263ffaa6b6" ON "organization_project_employee" ("isManager")`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_25de67f7f3f030438e3ecb1c0e" ON "organization_project_employee" ("assignedAt")`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_1c5e006185395a6193ede3456c" ON "organization_project_employee" ("roleId")`
		);
	}

	/**
	 * SqliteDB and BetterSQLite3DB Down Migration
	 *
	 * @param queryRunner
	 */
	public async sqliteDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		// Step 1: Drop indexes related to new columns
		console.log('Step 1: Dropping indexes related to new columns');
		await queryRunner.query(`DROP INDEX IF EXISTS "IDX_1c5e006185395a6193ede3456c"`); // index on "roleId"
		await queryRunner.query(`DROP INDEX IF EXISTS "IDX_25de67f7f3f030438e3ecb1c0e"`); // index on "assignedAt"
		await queryRunner.query(`DROP INDEX IF EXISTS "IDX_509be755cdaf837c263ffaa6b6"`); // index on "isManager"
		await queryRunner.query(`DROP INDEX IF EXISTS "IDX_a77a507b7402f0adb6a6b41e41"`); // index on "organizationId"
		await queryRunner.query(`DROP INDEX IF EXISTS "IDX_a9abd98013154ec1edfa1ec18c"`); // index on "tenantId"
		await queryRunner.query(`DROP INDEX IF EXISTS "IDX_abbe29504bb642647a69959cc0"`); // index on "isArchived"
		await queryRunner.query(`DROP INDEX IF EXISTS "IDX_f3d1102a8aa6442cdfce5d57c3"`); // index on "isActive"
		await queryRunner.query(`DROP INDEX IF EXISTS "IDX_6b5b0c3d994f59d9c800922257"`); // index on "employeeId"
		await queryRunner.query(`DROP INDEX IF EXISTS "IDX_2ba868f42c2301075b7c141359"`); // index on "organizationProjectId"

		// Step 2: Create a temporary table with the original schema
		console.log('Step 2: Creating temporary table with original schema');
		await queryRunner.query(`
			CREATE TABLE "temporary_organization_project_employee" (
				"employeeId" VARCHAR NOT NULL,
				"organizationProjectId" VARCHAR NOT NULL,
				CONSTRAINT "FK_2ba868f42c2301075b7c141359e" FOREIGN KEY ("organizationProjectId")
					REFERENCES "organization_project" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
				CONSTRAINT "FK_6b5b0c3d994f59d9c800922257f" FOREIGN KEY ("employeeId")
					REFERENCES "employee" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
				PRIMARY KEY ("employeeId", "organizationProjectId")
			)
		`);

		// Step 3: Copy data from the current table to the temporary table, selecting only the original columns
		console.log('Step 3: Copying data to temporary table');
		await queryRunner.query(`
			INSERT INTO "temporary_organization_project_employee" (
				"employeeId",
				"organizationProjectId"
			)
			SELECT
				"employeeId", "organizationProjectId"
			FROM
				"organization_project_employee"
		`);

		// Step 4: Drop the current table
		console.log('Step 4: Dropping the current organization_project_employee table');
		await queryRunner.query(`DROP TABLE "organization_project_employee"`);

		// Step 5: Rename the temporary table to the original table name
		console.log('Step 5: Renaming temporary table to organization_project_employee');
		await queryRunner.query(`
			ALTER TABLE "temporary_organization_project_employee" RENAME TO "organization_project_employee"
		`);

		// Step 6: Recreate indexes on the original columns
		console.log('Step 6: Recreating indexes on the original columns');
		await queryRunner.query(
			`CREATE INDEX "IDX_6b5b0c3d994f59d9c800922257" ON "organization_project_employee" ("employeeId")`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_2ba868f42c2301075b7c141359" ON "organization_project_employee" ("organizationProjectId")`
		);
	}

	/**
	 * MySQL Up Migration
	 *
	 * @param queryRunner
	 */
	public async mysqlUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		// Step 1: Drop existing foreign keys
		console.log('Step 1: Dropping foreign keys...');
		await queryRunner.query(
			`ALTER TABLE \`organization_project_employee\` DROP FOREIGN KEY \`FK_2ba868f42c2301075b7c141359e\``
		);
		await queryRunner.query(
			`ALTER TABLE \`organization_project_employee\` DROP FOREIGN KEY \`FK_6b5b0c3d994f59d9c800922257f\``
		);

		// Step 2: Drop existing indexes that might conflict with column modifications
		console.log('Step 2: Dropping existing indexes...');
		await queryRunner.query(`DROP INDEX \`IDX_6b5b0c3d994f59d9c800922257\` ON \`organization_project_employee\``);
		await queryRunner.query(`DROP INDEX \`IDX_2ba868f42c2301075b7c141359\` ON \`organization_project_employee\``);

		// Step 3: Add new columns (deletedAt, tenantId, archivedAt, etc.)
		console.log('Step 3: Adding new columns...');
		await queryRunner.query(`ALTER TABLE \`organization_project_employee\` ADD \`deletedAt\` datetime(6) NULL`);
		await queryRunner.query(`ALTER TABLE \`organization_project_employee\` ADD \`tenantId\` varchar(255) NULL`);
		await queryRunner.query(`ALTER TABLE \`organization_project_employee\` ADD \`archivedAt\` datetime NULL`);
		await queryRunner.query(
			`ALTER TABLE \`organization_project_employee\` ADD \`organizationId\` varchar(255) NULL`
		);
		await queryRunner.query(
			`ALTER TABLE \`organization_project_employee\` ADD \`isManager\` tinyint NULL DEFAULT 0`
		);
		await queryRunner.query(`ALTER TABLE \`organization_project_employee\` ADD \`assignedAt\` datetime NULL`);
		await queryRunner.query(`ALTER TABLE \`organization_project_employee\` ADD \`roleId\` varchar(255) NULL`);
		await queryRunner.query(
			`ALTER TABLE \`organization_project_employee\` ADD \`isActive\` tinyint NULL DEFAULT 1`
		);
		await queryRunner.query(
			`ALTER TABLE \`organization_project_employee\` ADD \`isArchived\` tinyint NULL DEFAULT 0`
		);
		await queryRunner.query(
			`ALTER TABLE \`organization_project_employee\` ADD \`createdAt\` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6)`
		);
		await queryRunner.query(
			`ALTER TABLE \`organization_project_employee\` ADD \`updatedAt\` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6)`
		);

		// Step 4: Add 'id' column as nullable to allow old records to remain valid
		console.log('Step 4: Adding nullable id column...');
		await queryRunner.query(`ALTER TABLE \`organization_project_employee\` ADD \`id\` varchar(36) NULL`);

		// Step 5: Generate unique UUIDs for each existing record
		console.log('Step 5: Generating unique UUIDs for existing records...');

		// Fetch records where id is null
		const records = await queryRunner.query(`
			SELECT \`employeeId\`, \`organizationProjectId\`
			FROM \`organization_project_employee\`
			WHERE \`id\` IS NULL;
		`);
		console.log(`Retrieved ${records.length} records with NULL id.`);

		// Loop through each record and assign a unique UUID to the id column
		for (const { employeeId, organizationProjectId } of records) {
			const uuid = uuidv4();

			// Update the record with the generated UUID, tenantId, and organizationId
			await queryRunner.query(`
				UPDATE \`organization_project_employee\` AS ope
					JOIN \`organization_project\` AS op ON ope.\`organizationProjectId\` = op.\`id\`
				SET
					ope.\`id\` = ?,
					ope.\`tenantId\` = op.\`tenantId\`,
					ope.\`organizationId\` = op.\`organizationId\`
				WHERE
					ope.\`employeeId\` = ? AND
					ope.\`organizationProjectId\` = ?;
				`,
				[uuid, employeeId, organizationProjectId]
			);
			console.log(`Assigned UUID: ${uuid} to employeeId: ${employeeId}, organizationProjectId: ${organizationProjectId}`);
		}

		// Step 6: Alter 'id' column to NOT NULL after populating with UUIDs
		console.log('Step 6: Setting id column to NOT NULL...');
		await queryRunner.query(`ALTER TABLE \`organization_project_employee\` MODIFY \`id\` varchar(36) NOT NULL`);

		// Step 7: Make 'id' the only primary key
		console.log('Step 7: Setting id as the only primary key...');
		await queryRunner.query(`ALTER TABLE \`organization_project_employee\` DROP PRIMARY KEY`);
		await queryRunner.query(`ALTER TABLE \`organization_project_employee\` ADD PRIMARY KEY (\`id\`)`);

		// Step 8: Recreate indexes on new columns
		console.log('Step 8: Recreating indexes on new columns...');
		await queryRunner.query(
			`CREATE INDEX \`IDX_f3d1102a8aa6442cdfce5d57c3\` ON \`organization_project_employee\` (\`isActive\`)`
		);
		await queryRunner.query(
			`CREATE INDEX \`IDX_abbe29504bb642647a69959cc0\` ON \`organization_project_employee\` (\`isArchived\`)`
		);
		await queryRunner.query(
			`CREATE INDEX \`IDX_a9abd98013154ec1edfa1ec18c\` ON \`organization_project_employee\` (\`tenantId\`)`
		);
		await queryRunner.query(
			`CREATE INDEX \`IDX_a77a507b7402f0adb6a6b41e41\` ON \`organization_project_employee\` (\`organizationId\`)`
		);
		await queryRunner.query(
			`CREATE INDEX \`IDX_509be755cdaf837c263ffaa6b6\` ON \`organization_project_employee\` (\`isManager\`)`
		);
		await queryRunner.query(
			`CREATE INDEX \`IDX_25de67f7f3f030438e3ecb1c0e\` ON \`organization_project_employee\` (\`assignedAt\`)`
		);
		await queryRunner.query(
			`CREATE INDEX \`IDX_1c5e006185395a6193ede3456c\` ON \`organization_project_employee\` (\`roleId\`)`
		);

		// Step 9: Recreate foreign keys
		console.log('Step 8: Recreating foreign keys...');
		await queryRunner.query(
			`ALTER TABLE \`organization_project_employee\` ADD CONSTRAINT \`FK_a9abd98013154ec1edfa1ec18cd\` FOREIGN KEY (\`tenantId\`) REFERENCES \`tenant\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`organization_project_employee\` ADD CONSTRAINT \`FK_a77a507b7402f0adb6a6b41e412\` FOREIGN KEY (\`organizationId\`) REFERENCES \`organization\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`
		);
		await queryRunner.query(
			`ALTER TABLE \`organization_project_employee\` ADD CONSTRAINT \`FK_2ba868f42c2301075b7c141359e\` FOREIGN KEY (\`organizationProjectId\`) REFERENCES \`organization_project\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`organization_project_employee\` ADD CONSTRAINT \`FK_6b5b0c3d994f59d9c800922257f\` FOREIGN KEY (\`employeeId\`) REFERENCES \`employee\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`organization_project_employee\` ADD CONSTRAINT \`FK_1c5e006185395a6193ede3456c6\` FOREIGN KEY (\`roleId\`) REFERENCES \`role\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
	}

	/**
	 * MySQL Down Migration
	 *
	 * @param queryRunner
	 */
	public async mysqlDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		// Step 1: Drop existing foreign keys
		console.log('Step 1: Dropping existing foreign keys...');
		await queryRunner.query(
			`ALTER TABLE \`organization_project_employee\` DROP FOREIGN KEY \`FK_1c5e006185395a6193ede3456c6\``
		);
		await queryRunner.query(
			`ALTER TABLE \`organization_project_employee\` DROP FOREIGN KEY \`FK_6b5b0c3d994f59d9c800922257f\``
		);
		await queryRunner.query(
			`ALTER TABLE \`organization_project_employee\` DROP FOREIGN KEY \`FK_2ba868f42c2301075b7c141359e\``
		);
		await queryRunner.query(
			`ALTER TABLE \`organization_project_employee\` DROP FOREIGN KEY \`FK_a77a507b7402f0adb6a6b41e412\``
		);
		await queryRunner.query(
			`ALTER TABLE \`organization_project_employee\` DROP FOREIGN KEY \`FK_a9abd98013154ec1edfa1ec18cd\``
		);

		// Step 2: Drop existing indexes
		console.log('Step 2: Dropping existing indexes...');
		await queryRunner.query(`DROP INDEX \`IDX_1c5e006185395a6193ede3456c\` ON \`organization_project_employee\``);
		await queryRunner.query(`DROP INDEX \`IDX_25de67f7f3f030438e3ecb1c0e\` ON \`organization_project_employee\``);
		await queryRunner.query(`DROP INDEX \`IDX_509be755cdaf837c263ffaa6b6\` ON \`organization_project_employee\``);
		await queryRunner.query(`DROP INDEX \`IDX_a77a507b7402f0adb6a6b41e41\` ON \`organization_project_employee\``);
		await queryRunner.query(`DROP INDEX \`IDX_a9abd98013154ec1edfa1ec18c\` ON \`organization_project_employee\``);
		await queryRunner.query(`DROP INDEX \`IDX_abbe29504bb642647a69959cc0\` ON \`organization_project_employee\``);
		await queryRunner.query(`DROP INDEX \`IDX_f3d1102a8aa6442cdfce5d57c3\` ON \`organization_project_employee\``);

		// Step 3: Modify columns and primary keys
		console.log('Step 3: Modifying columns and primary keys...');
		await queryRunner.query(`ALTER TABLE \`organization_project_employee\` DROP COLUMN \`employeeId\``);
		await queryRunner.query(
			`ALTER TABLE \`organization_project_employee\` ADD \`employeeId\` varchar(36) NOT NULL`
		);
		await queryRunner.query(`ALTER TABLE \`organization_project_employee\` DROP PRIMARY KEY`);
		await queryRunner.query(
			`ALTER TABLE \`organization_project_employee\` ADD PRIMARY KEY (\`employeeId\`, \`id\`)`
		);
		await queryRunner.query(`ALTER TABLE \`organization_project_employee\` DROP COLUMN \`organizationProjectId\``);
		await queryRunner.query(
			`ALTER TABLE \`organization_project_employee\` ADD \`organizationProjectId\` varchar(36) NOT NULL`
		);
		await queryRunner.query(`ALTER TABLE \`organization_project_employee\` DROP PRIMARY KEY`);
		await queryRunner.query(
			`ALTER TABLE \`organization_project_employee\` ADD PRIMARY KEY (\`employeeId\`, \`organizationProjectId\`, \`id\`)`
		);
		await queryRunner.query(`ALTER TABLE \`organization_project_employee\` DROP COLUMN \`roleId\``);
		await queryRunner.query(`ALTER TABLE \`organization_project_employee\` DROP COLUMN \`assignedAt\``);
		await queryRunner.query(`ALTER TABLE \`organization_project_employee\` DROP COLUMN \`isManager\``);
		await queryRunner.query(`ALTER TABLE \`organization_project_employee\` DROP COLUMN \`organizationId\``);
		await queryRunner.query(`ALTER TABLE \`organization_project_employee\` DROP COLUMN \`tenantId\``);
		await queryRunner.query(`ALTER TABLE \`organization_project_employee\` DROP COLUMN \`archivedAt\``);
		await queryRunner.query(`ALTER TABLE \`organization_project_employee\` DROP COLUMN \`isArchived\``);
		await queryRunner.query(`ALTER TABLE \`organization_project_employee\` DROP COLUMN \`isActive\``);
		await queryRunner.query(`ALTER TABLE \`organization_project_employee\` DROP COLUMN \`updatedAt\``);
		await queryRunner.query(`ALTER TABLE \`organization_project_employee\` DROP COLUMN \`createdAt\``);
		await queryRunner.query(`ALTER TABLE \`organization_project_employee\` DROP PRIMARY KEY`);
		await queryRunner.query(
			`ALTER TABLE \`organization_project_employee\` ADD PRIMARY KEY (\`employeeId\`, \`organizationProjectId\`)`
		);
		await queryRunner.query(`ALTER TABLE \`organization_project_employee\` DROP COLUMN \`id\``);
		await queryRunner.query(`ALTER TABLE \`organization_project_employee\` DROP COLUMN \`deletedAt\``);

		// Step 4: Recreate original indexes
		console.log('Step 4: Recreating original indexes...');
		await queryRunner.query(
			`CREATE INDEX \`IDX_2ba868f42c2301075b7c141359\` ON \`organization_project_employee\` (\`organizationProjectId\`)`
		);
		await queryRunner.query(
			`CREATE INDEX \`IDX_6b5b0c3d994f59d9c800922257\` ON \`organization_project_employee\` (\`employeeId\`)`
		);

		// Step 5: Recreate original foreign keys
		console.log('Step 5: Recreating original foreign keys...');
		await queryRunner.query(
			`ALTER TABLE \`organization_project_employee\` ADD CONSTRAINT \`FK_6b5b0c3d994f59d9c800922257f\` FOREIGN KEY (\`employeeId\`) REFERENCES \`employee\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`
		);
		await queryRunner.query(
			`ALTER TABLE \`organization_project_employee\` ADD CONSTRAINT \`FK_2ba868f42c2301075b7c141359e\` FOREIGN KEY (\`organizationProjectId\`) REFERENCES \`organization_project\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`
		);
	}
}
