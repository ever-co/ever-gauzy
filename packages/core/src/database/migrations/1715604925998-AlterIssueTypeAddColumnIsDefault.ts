import { MigrationInterface, QueryRunner } from 'typeorm';
import { yellow } from 'chalk';
import { DatabaseTypeEnum } from '@gauzy/config';

export class AlterIssueTypeAddColumnIsDefault1715604925998 implements MigrationInterface {
	name = 'AlterIssueTypeAddColumnIsDefault1715604925998';

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
		await queryRunner.query(`ALTER TABLE "employee_job_preset" DROP CONSTRAINT "FK_7ae5b4d4bdec77971dab319f2e2"`);
		await queryRunner.query(`ALTER TABLE "issue_type" ADD "isDefault" boolean NOT NULL DEFAULT false`);
		await queryRunner.query(
			`ALTER TABLE "employee_job_preset" ADD CONSTRAINT "FK_7ae5b4d4bdec77971dab319f2e2" FOREIGN KEY ("jobPresetId") REFERENCES "job_preset"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`
		);
	}

	/**
	 * PostgresDB Down Migration
	 *
	 * @param queryRunner
	 */
	public async postgresDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(`ALTER TABLE "employee_job_preset" DROP CONSTRAINT "FK_7ae5b4d4bdec77971dab319f2e2"`);
		await queryRunner.query(`ALTER TABLE "issue_type" DROP COLUMN "isDefault"`);
		await queryRunner.query(
			`ALTER TABLE "employee_job_preset" ADD CONSTRAINT "FK_7ae5b4d4bdec77971dab319f2e2" FOREIGN KEY ("jobPresetId") REFERENCES "job_preset"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`
		);
	}

	/**
	 * SqliteDB and BetterSQlite3DB Up Migration
	 *
	 * @param queryRunner
	 */
	public async sqliteUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(`DROP INDEX "IDX_7ae5b4d4bdec77971dab319f2e"`);
		await queryRunner.query(`DROP INDEX "IDX_68e75e49f06409fd385b4f8774"`);
		await queryRunner.query(
			`CREATE TABLE "temporary_employee_job_preset" ("jobPresetId" varchar NOT NULL, "employeeId" varchar NOT NULL, CONSTRAINT "FK_68e75e49f06409fd385b4f87746" FOREIGN KEY ("employeeId") REFERENCES "employee" ("id") ON DELETE CASCADE ON UPDATE CASCADE, PRIMARY KEY ("jobPresetId", "employeeId"))`
		);
		await queryRunner.query(
			`INSERT INTO "temporary_employee_job_preset"("jobPresetId", "employeeId") SELECT "jobPresetId", "employeeId" FROM "employee_job_preset"`
		);
		await queryRunner.query(`DROP TABLE "employee_job_preset"`);
		await queryRunner.query(`ALTER TABLE "temporary_employee_job_preset" RENAME TO "employee_job_preset"`);
		await queryRunner.query(
			`CREATE INDEX "IDX_7ae5b4d4bdec77971dab319f2e" ON "employee_job_preset" ("jobPresetId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_68e75e49f06409fd385b4f8774" ON "employee_job_preset" ("employeeId") `
		);
		await queryRunner.query(`DROP INDEX "IDX_586513cceb16777fd14a17bfe1"`);
		await queryRunner.query(`DROP INDEX "IDX_131331557078611a68b4a5b2e7"`);
		await queryRunner.query(`DROP INDEX "IDX_33779b0395f72af0b50dc526d1"`);
		await queryRunner.query(`DROP INDEX "IDX_af2d743ed61571bcdc5d9a27a0"`);
		await queryRunner.query(`DROP INDEX "IDX_4af451ab46a94e94394c72d911"`);
		await queryRunner.query(`DROP INDEX "IDX_16dbef9d1b2b422abdce8ee3ae"`);
		await queryRunner.query(`DROP INDEX "IDX_8b12c913c39c72fe5980427c96"`);
		await queryRunner.query(`DROP INDEX "IDX_722ce5d7535524b96c6d03f7c4"`);
		await queryRunner.query(`DROP INDEX "IDX_1909e9bae7d8b2c920b3e4d859"`);
		await queryRunner.query(
			`CREATE TABLE "temporary_issue_type" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "organizationId" varchar, "name" varchar NOT NULL, "value" varchar NOT NULL, "description" varchar, "icon" varchar, "color" varchar, "isSystem" boolean NOT NULL DEFAULT (0), "imageId" varchar, "projectId" varchar, "organizationTeamId" varchar, "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "deletedAt" datetime, "isDefault" boolean NOT NULL DEFAULT (0), CONSTRAINT "FK_586513cceb16777fd14a17bfe10" FOREIGN KEY ("organizationTeamId") REFERENCES "organization_team" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_131331557078611a68b4a5b2e7e" FOREIGN KEY ("projectId") REFERENCES "organization_project" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_33779b0395f72af0b50dc526d1d" FOREIGN KEY ("imageId") REFERENCES "image_asset" ("id") ON DELETE SET NULL ON UPDATE NO ACTION, CONSTRAINT "FK_16dbef9d1b2b422abdce8ee3ae2" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_8b12c913c39c72fe5980427c963" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`
		);
		await queryRunner.query(
			`INSERT INTO "temporary_issue_type"("id", "createdAt", "updatedAt", "tenantId", "organizationId", "name", "value", "description", "icon", "color", "isSystem", "imageId", "projectId", "organizationTeamId", "isActive", "isArchived", "deletedAt") SELECT "id", "createdAt", "updatedAt", "tenantId", "organizationId", "name", "value", "description", "icon", "color", "isSystem", "imageId", "projectId", "organizationTeamId", "isActive", "isArchived", "deletedAt" FROM "issue_type"`
		);
		await queryRunner.query(`DROP TABLE "issue_type"`);
		await queryRunner.query(`ALTER TABLE "temporary_issue_type" RENAME TO "issue_type"`);
		await queryRunner.query(
			`CREATE INDEX "IDX_586513cceb16777fd14a17bfe1" ON "issue_type" ("organizationTeamId") `
		);
		await queryRunner.query(`CREATE INDEX "IDX_131331557078611a68b4a5b2e7" ON "issue_type" ("projectId") `);
		await queryRunner.query(`CREATE INDEX "IDX_33779b0395f72af0b50dc526d1" ON "issue_type" ("imageId") `);
		await queryRunner.query(`CREATE INDEX "IDX_af2d743ed61571bcdc5d9a27a0" ON "issue_type" ("value") `);
		await queryRunner.query(`CREATE INDEX "IDX_4af451ab46a94e94394c72d911" ON "issue_type" ("name") `);
		await queryRunner.query(`CREATE INDEX "IDX_16dbef9d1b2b422abdce8ee3ae" ON "issue_type" ("organizationId") `);
		await queryRunner.query(`CREATE INDEX "IDX_8b12c913c39c72fe5980427c96" ON "issue_type" ("tenantId") `);
		await queryRunner.query(`CREATE INDEX "IDX_722ce5d7535524b96c6d03f7c4" ON "issue_type" ("isActive") `);
		await queryRunner.query(`CREATE INDEX "IDX_1909e9bae7d8b2c920b3e4d859" ON "issue_type" ("isArchived") `);
		await queryRunner.query(`DROP INDEX "IDX_7ae5b4d4bdec77971dab319f2e"`);
		await queryRunner.query(`DROP INDEX "IDX_68e75e49f06409fd385b4f8774"`);
		await queryRunner.query(
			`CREATE TABLE "temporary_employee_job_preset" ("jobPresetId" varchar NOT NULL, "employeeId" varchar NOT NULL, CONSTRAINT "FK_68e75e49f06409fd385b4f87746" FOREIGN KEY ("employeeId") REFERENCES "employee" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_7ae5b4d4bdec77971dab319f2e2" FOREIGN KEY ("jobPresetId") REFERENCES "job_preset" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION, PRIMARY KEY ("jobPresetId", "employeeId"))`
		);
		await queryRunner.query(
			`INSERT INTO "temporary_employee_job_preset"("jobPresetId", "employeeId") SELECT "jobPresetId", "employeeId" FROM "employee_job_preset"`
		);
		await queryRunner.query(`DROP TABLE "employee_job_preset"`);
		await queryRunner.query(`ALTER TABLE "temporary_employee_job_preset" RENAME TO "employee_job_preset"`);
		await queryRunner.query(
			`CREATE INDEX "IDX_7ae5b4d4bdec77971dab319f2e" ON "employee_job_preset" ("jobPresetId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_68e75e49f06409fd385b4f8774" ON "employee_job_preset" ("employeeId") `
		);
	}

	/**
	 * SqliteDB and BetterSQlite3DB Down Migration
	 *
	 * @param queryRunner
	 */
	public async sqliteDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(`DROP INDEX "IDX_68e75e49f06409fd385b4f8774"`);
		await queryRunner.query(`DROP INDEX "IDX_7ae5b4d4bdec77971dab319f2e"`);
		await queryRunner.query(`ALTER TABLE "employee_job_preset" RENAME TO "temporary_employee_job_preset"`);
		await queryRunner.query(
			`CREATE TABLE "employee_job_preset" ("jobPresetId" varchar NOT NULL, "employeeId" varchar NOT NULL, CONSTRAINT "FK_68e75e49f06409fd385b4f87746" FOREIGN KEY ("employeeId") REFERENCES "employee" ("id") ON DELETE CASCADE ON UPDATE CASCADE, PRIMARY KEY ("jobPresetId", "employeeId"))`
		);
		await queryRunner.query(
			`INSERT INTO "employee_job_preset"("jobPresetId", "employeeId") SELECT "jobPresetId", "employeeId" FROM "temporary_employee_job_preset"`
		);
		await queryRunner.query(`DROP TABLE "temporary_employee_job_preset"`);
		await queryRunner.query(
			`CREATE INDEX "IDX_68e75e49f06409fd385b4f8774" ON "employee_job_preset" ("employeeId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_7ae5b4d4bdec77971dab319f2e" ON "employee_job_preset" ("jobPresetId") `
		);
		await queryRunner.query(`DROP INDEX "IDX_1909e9bae7d8b2c920b3e4d859"`);
		await queryRunner.query(`DROP INDEX "IDX_722ce5d7535524b96c6d03f7c4"`);
		await queryRunner.query(`DROP INDEX "IDX_8b12c913c39c72fe5980427c96"`);
		await queryRunner.query(`DROP INDEX "IDX_16dbef9d1b2b422abdce8ee3ae"`);
		await queryRunner.query(`DROP INDEX "IDX_4af451ab46a94e94394c72d911"`);
		await queryRunner.query(`DROP INDEX "IDX_af2d743ed61571bcdc5d9a27a0"`);
		await queryRunner.query(`DROP INDEX "IDX_33779b0395f72af0b50dc526d1"`);
		await queryRunner.query(`DROP INDEX "IDX_131331557078611a68b4a5b2e7"`);
		await queryRunner.query(`DROP INDEX "IDX_586513cceb16777fd14a17bfe1"`);
		await queryRunner.query(`ALTER TABLE "issue_type" RENAME TO "temporary_issue_type"`);
		await queryRunner.query(
			`CREATE TABLE "issue_type" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "organizationId" varchar, "name" varchar NOT NULL, "value" varchar NOT NULL, "description" varchar, "icon" varchar, "color" varchar, "isSystem" boolean NOT NULL DEFAULT (0), "imageId" varchar, "projectId" varchar, "organizationTeamId" varchar, "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "deletedAt" datetime, CONSTRAINT "FK_586513cceb16777fd14a17bfe10" FOREIGN KEY ("organizationTeamId") REFERENCES "organization_team" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_131331557078611a68b4a5b2e7e" FOREIGN KEY ("projectId") REFERENCES "organization_project" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_33779b0395f72af0b50dc526d1d" FOREIGN KEY ("imageId") REFERENCES "image_asset" ("id") ON DELETE SET NULL ON UPDATE NO ACTION, CONSTRAINT "FK_16dbef9d1b2b422abdce8ee3ae2" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_8b12c913c39c72fe5980427c963" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`
		);
		await queryRunner.query(
			`INSERT INTO "issue_type"("id", "createdAt", "updatedAt", "tenantId", "organizationId", "name", "value", "description", "icon", "color", "isSystem", "imageId", "projectId", "organizationTeamId", "isActive", "isArchived", "deletedAt") SELECT "id", "createdAt", "updatedAt", "tenantId", "organizationId", "name", "value", "description", "icon", "color", "isSystem", "imageId", "projectId", "organizationTeamId", "isActive", "isArchived", "deletedAt" FROM "temporary_issue_type"`
		);
		await queryRunner.query(`DROP TABLE "temporary_issue_type"`);
		await queryRunner.query(`CREATE INDEX "IDX_1909e9bae7d8b2c920b3e4d859" ON "issue_type" ("isArchived") `);
		await queryRunner.query(`CREATE INDEX "IDX_722ce5d7535524b96c6d03f7c4" ON "issue_type" ("isActive") `);
		await queryRunner.query(`CREATE INDEX "IDX_8b12c913c39c72fe5980427c96" ON "issue_type" ("tenantId") `);
		await queryRunner.query(`CREATE INDEX "IDX_16dbef9d1b2b422abdce8ee3ae" ON "issue_type" ("organizationId") `);
		await queryRunner.query(`CREATE INDEX "IDX_4af451ab46a94e94394c72d911" ON "issue_type" ("name") `);
		await queryRunner.query(`CREATE INDEX "IDX_af2d743ed61571bcdc5d9a27a0" ON "issue_type" ("value") `);
		await queryRunner.query(`CREATE INDEX "IDX_33779b0395f72af0b50dc526d1" ON "issue_type" ("imageId") `);
		await queryRunner.query(`CREATE INDEX "IDX_131331557078611a68b4a5b2e7" ON "issue_type" ("projectId") `);
		await queryRunner.query(
			`CREATE INDEX "IDX_586513cceb16777fd14a17bfe1" ON "issue_type" ("organizationTeamId") `
		);
		await queryRunner.query(`DROP INDEX "IDX_68e75e49f06409fd385b4f8774"`);
		await queryRunner.query(`DROP INDEX "IDX_7ae5b4d4bdec77971dab319f2e"`);
		await queryRunner.query(`ALTER TABLE "employee_job_preset" RENAME TO "temporary_employee_job_preset"`);
		await queryRunner.query(
			`CREATE TABLE "employee_job_preset" ("jobPresetId" varchar NOT NULL, "employeeId" varchar NOT NULL, CONSTRAINT "FK_7ae5b4d4bdec77971dab319f2e2" FOREIGN KEY ("jobPresetId") REFERENCES "job_preset" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION, CONSTRAINT "FK_68e75e49f06409fd385b4f87746" FOREIGN KEY ("employeeId") REFERENCES "employee" ("id") ON DELETE CASCADE ON UPDATE CASCADE, PRIMARY KEY ("jobPresetId", "employeeId"))`
		);
		await queryRunner.query(
			`INSERT INTO "employee_job_preset"("jobPresetId", "employeeId") SELECT "jobPresetId", "employeeId" FROM "temporary_employee_job_preset"`
		);
		await queryRunner.query(`DROP TABLE "temporary_employee_job_preset"`);
		await queryRunner.query(
			`CREATE INDEX "IDX_68e75e49f06409fd385b4f8774" ON "employee_job_preset" ("employeeId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_7ae5b4d4bdec77971dab319f2e" ON "employee_job_preset" ("jobPresetId") `
		);
	}

	/**
	 * MySQL Up Migration
	 *
	 * @param queryRunner
	 */
	public async mysqlUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(
			`ALTER TABLE \`employee_job_preset\` DROP FOREIGN KEY \`FK_7ae5b4d4bdec77971dab319f2e2\``
		);
		await queryRunner.query(`ALTER TABLE \`issue_type\` ADD \`isDefault\` tinyint NOT NULL DEFAULT 0`);
		await queryRunner.query(
			`ALTER TABLE \`employee_job_preset\` ADD CONSTRAINT \`FK_7ae5b4d4bdec77971dab319f2e2\` FOREIGN KEY (\`jobPresetId\`) REFERENCES \`job_preset\`(\`id\`) ON DELETE NO ACTION ON UPDATE NO ACTION`
		);
	}

	/**
	 * MySQL Down Migration
	 *
	 * @param queryRunner
	 */
	public async mysqlDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(
			`ALTER TABLE \`employee_job_preset\` DROP FOREIGN KEY \`FK_7ae5b4d4bdec77971dab319f2e2\``
		);
		await queryRunner.query(`ALTER TABLE \`issue_type\` DROP COLUMN \`isDefault\``);
		await queryRunner.query(
			`ALTER TABLE \`employee_job_preset\` ADD CONSTRAINT \`FK_7ae5b4d4bdec77971dab319f2e2\` FOREIGN KEY (\`jobPresetId\`) REFERENCES \`job_preset\`(\`id\`) ON DELETE NO ACTION ON UPDATE NO ACTION`
		);
	}
}
