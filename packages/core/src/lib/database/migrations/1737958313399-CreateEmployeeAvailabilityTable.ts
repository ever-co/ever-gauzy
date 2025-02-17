import { MigrationInterface, QueryRunner } from 'typeorm';
import * as chalk from 'chalk';
import { DatabaseTypeEnum } from '@gauzy/config';

export class CreateEmployeeAvailabilityTable1737958313399 implements MigrationInterface {
	name = 'CreateEmployeeAvailabilityTable1737958313399';

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
		await queryRunner.query(
			`CREATE TABLE "employee_availability" ("deletedAt" TIMESTAMP, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "id" uuid NOT NULL DEFAULT gen_random_uuid(), "isActive" boolean DEFAULT true, "isArchived" boolean DEFAULT false, "archivedAt" TIMESTAMP, "tenantId" uuid, "organizationId" uuid, "startDate" TIMESTAMP NOT NULL, "endDate" TIMESTAMP NOT NULL, "dayOfWeek" integer NOT NULL, "availabilityStatus" integer NOT NULL, "availabilityNotes" text, "employeeId" uuid NOT NULL, CONSTRAINT "PK_8c252ae622cac6f708bc79aa3e7" PRIMARY KEY ("id"))`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_4df1dc5482972ff5344b670f78" ON "employee_availability" ("isActive") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_1c5a1979ce3d47b895f11f7395" ON "employee_availability" ("isArchived") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_981ccd9a51cc8706cbf8cdbdfb" ON "employee_availability" ("tenantId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_9324ccb5291bd98d5fba6349f7" ON "employee_availability" ("organizationId") `
		);
		await queryRunner.query(
			`ALTER TABLE "employee_availability" ADD CONSTRAINT "FK_981ccd9a51cc8706cbf8cdbdfb6" FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "employee_availability" ADD CONSTRAINT "FK_9324ccb5291bd98d5fba6349f75" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE`
		);
		await queryRunner.query(
			`ALTER TABLE "employee_availability" ADD CONSTRAINT "FK_63a5d274ac6ca68482e50f8f99a" FOREIGN KEY ("employeeId") REFERENCES "employee"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
	}

	/**
	 * PostgresDB Down Migration
	 *
	 * @param queryRunner
	 */
	public async postgresDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(`ALTER TABLE "employee_availability" DROP CONSTRAINT "FK_63a5d274ac6ca68482e50f8f99a"`);
		await queryRunner.query(`ALTER TABLE "employee_availability" DROP CONSTRAINT "FK_9324ccb5291bd98d5fba6349f75"`);
		await queryRunner.query(`ALTER TABLE "employee_availability" DROP CONSTRAINT "FK_981ccd9a51cc8706cbf8cdbdfb6"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_9324ccb5291bd98d5fba6349f7"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_981ccd9a51cc8706cbf8cdbdfb"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_1c5a1979ce3d47b895f11f7395"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_4df1dc5482972ff5344b670f78"`);
		await queryRunner.query(`DROP TABLE "employee_availability"`);
	}

	/**
	 * SqliteDB and BetterSQlite3DB Up Migration
	 *
	 * @param queryRunner
	 */
	public async sqliteUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(
			`CREATE TABLE "employee_availability" ("deletedAt" datetime, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "id" varchar PRIMARY KEY NOT NULL, "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "tenantId" varchar, "organizationId" varchar, "startDate" datetime NOT NULL, "endDate" datetime NOT NULL, "dayOfWeek" integer NOT NULL, "availabilityStatus" integer NOT NULL, "availabilityNotes" text, "employeeId" varchar NOT NULL)`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_4df1dc5482972ff5344b670f78" ON "employee_availability" ("isActive") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_1c5a1979ce3d47b895f11f7395" ON "employee_availability" ("isArchived") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_981ccd9a51cc8706cbf8cdbdfb" ON "employee_availability" ("tenantId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_9324ccb5291bd98d5fba6349f7" ON "employee_availability" ("organizationId") `
		);
		await queryRunner.query(`DROP INDEX "IDX_4df1dc5482972ff5344b670f78"`);
		await queryRunner.query(`DROP INDEX "IDX_1c5a1979ce3d47b895f11f7395"`);
		await queryRunner.query(`DROP INDEX "IDX_981ccd9a51cc8706cbf8cdbdfb"`);
		await queryRunner.query(`DROP INDEX "IDX_9324ccb5291bd98d5fba6349f7"`);
		await queryRunner.query(
			`CREATE TABLE "temporary_employee_availability" ("deletedAt" datetime, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "id" varchar PRIMARY KEY NOT NULL, "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "tenantId" varchar, "organizationId" varchar, "startDate" datetime NOT NULL, "endDate" datetime NOT NULL, "dayOfWeek" integer NOT NULL, "availabilityStatus" integer NOT NULL, "availabilityNotes" text, "employeeId" varchar NOT NULL, CONSTRAINT "FK_981ccd9a51cc8706cbf8cdbdfb6" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_9324ccb5291bd98d5fba6349f75" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_63a5d274ac6ca68482e50f8f99a" FOREIGN KEY ("employeeId") REFERENCES "employee" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`
		);
		await queryRunner.query(
			`INSERT INTO "temporary_employee_availability"("deletedAt", "createdAt", "updatedAt", "id", "isActive", "isArchived", "archivedAt", "tenantId", "organizationId", "startDate", "endDate", "dayOfWeek", "availabilityStatus", "availabilityNotes", "employeeId") SELECT "deletedAt", "createdAt", "updatedAt", "id", "isActive", "isArchived", "archivedAt", "tenantId", "organizationId", "startDate", "endDate", "dayOfWeek", "availabilityStatus", "availabilityNotes", "employeeId" FROM "employee_availability"`
		);
		await queryRunner.query(`DROP TABLE "employee_availability"`);
		await queryRunner.query(`ALTER TABLE "temporary_employee_availability" RENAME TO "employee_availability"`);
		await queryRunner.query(
			`CREATE INDEX "IDX_4df1dc5482972ff5344b670f78" ON "employee_availability" ("isActive") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_1c5a1979ce3d47b895f11f7395" ON "employee_availability" ("isArchived") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_981ccd9a51cc8706cbf8cdbdfb" ON "employee_availability" ("tenantId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_9324ccb5291bd98d5fba6349f7" ON "employee_availability" ("organizationId") `
		);
	}

	/**
	 * SqliteDB and BetterSQlite3DB Down Migration
	 *
	 * @param queryRunner
	 */
	public async sqliteDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(`DROP INDEX "IDX_9324ccb5291bd98d5fba6349f7"`);
		await queryRunner.query(`DROP INDEX "IDX_981ccd9a51cc8706cbf8cdbdfb"`);
		await queryRunner.query(`DROP INDEX "IDX_1c5a1979ce3d47b895f11f7395"`);
		await queryRunner.query(`DROP INDEX "IDX_4df1dc5482972ff5344b670f78"`);
		await queryRunner.query(`ALTER TABLE "employee_availability" RENAME TO "temporary_employee_availability"`);
		await queryRunner.query(
			`CREATE TABLE "employee_availability" ("deletedAt" datetime, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "id" varchar PRIMARY KEY NOT NULL, "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "tenantId" varchar, "organizationId" varchar, "startDate" datetime NOT NULL, "endDate" datetime NOT NULL, "dayOfWeek" integer NOT NULL, "availabilityStatus" integer NOT NULL, "availabilityNotes" text, "employeeId" varchar NOT NULL)`
		);
		await queryRunner.query(
			`INSERT INTO "employee_availability"("deletedAt", "createdAt", "updatedAt", "id", "isActive", "isArchived", "archivedAt", "tenantId", "organizationId", "startDate", "endDate", "dayOfWeek", "availabilityStatus", "availabilityNotes", "employeeId") SELECT "deletedAt", "createdAt", "updatedAt", "id", "isActive", "isArchived", "archivedAt", "tenantId", "organizationId", "startDate", "endDate", "dayOfWeek", "availabilityStatus", "availabilityNotes", "employeeId" FROM "temporary_employee_availability"`
		);
		await queryRunner.query(`DROP TABLE "temporary_employee_availability"`);
		await queryRunner.query(
			`CREATE INDEX "IDX_9324ccb5291bd98d5fba6349f7" ON "employee_availability" ("organizationId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_981ccd9a51cc8706cbf8cdbdfb" ON "employee_availability" ("tenantId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_1c5a1979ce3d47b895f11f7395" ON "employee_availability" ("isArchived") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_4df1dc5482972ff5344b670f78" ON "employee_availability" ("isActive") `
		);
		await queryRunner.query(`DROP INDEX "IDX_9324ccb5291bd98d5fba6349f7"`);
		await queryRunner.query(`DROP INDEX "IDX_981ccd9a51cc8706cbf8cdbdfb"`);
		await queryRunner.query(`DROP INDEX "IDX_1c5a1979ce3d47b895f11f7395"`);
		await queryRunner.query(`DROP INDEX "IDX_4df1dc5482972ff5344b670f78"`);
		await queryRunner.query(`DROP TABLE "employee_availability"`);
	}

	/**
	 * MySQL Up Migration
	 *
	 * @param queryRunner
	 */
	public async mysqlUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(
			`CREATE TABLE \`employee_availability\` (\`deletedAt\` datetime(6) NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`id\` varchar(36) NOT NULL, \`isActive\` tinyint NULL DEFAULT 1, \`isArchived\` tinyint NULL DEFAULT 0, \`archivedAt\` datetime NULL, \`tenantId\` varchar(255) NULL, \`organizationId\` varchar(255) NULL, \`startDate\` datetime NOT NULL, \`endDate\` datetime NOT NULL, \`dayOfWeek\` int NOT NULL, \`availabilityStatus\` int NOT NULL, \`availabilityNotes\` text NULL, \`employeeId\` varchar(255) NOT NULL, INDEX \`IDX_4df1dc5482972ff5344b670f78\` (\`isActive\`), INDEX \`IDX_1c5a1979ce3d47b895f11f7395\` (\`isArchived\`), INDEX \`IDX_981ccd9a51cc8706cbf8cdbdfb\` (\`tenantId\`), INDEX \`IDX_9324ccb5291bd98d5fba6349f7\` (\`organizationId\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`
		);
		await queryRunner.query(
			`ALTER TABLE \`employee_availability\` ADD CONSTRAINT \`FK_981ccd9a51cc8706cbf8cdbdfb6\` FOREIGN KEY (\`tenantId\`) REFERENCES \`tenant\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`employee_availability\` ADD CONSTRAINT \`FK_9324ccb5291bd98d5fba6349f75\` FOREIGN KEY (\`organizationId\`) REFERENCES \`organization\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`
		);
		await queryRunner.query(
			`ALTER TABLE \`employee_availability\` ADD CONSTRAINT \`FK_63a5d274ac6ca68482e50f8f99a\` FOREIGN KEY (\`employeeId\`) REFERENCES \`employee\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
	}

	/**
	 * MySQL Down Migration
	 *
	 * @param queryRunner
	 */
	public async mysqlDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(
			`ALTER TABLE \`employee_availability\` DROP FOREIGN KEY \`FK_63a5d274ac6ca68482e50f8f99a\``
		);
		await queryRunner.query(
			`ALTER TABLE \`employee_availability\` DROP FOREIGN KEY \`FK_9324ccb5291bd98d5fba6349f75\``
		);
		await queryRunner.query(
			`ALTER TABLE \`employee_availability\` DROP FOREIGN KEY \`FK_981ccd9a51cc8706cbf8cdbdfb6\``
		);
		await queryRunner.query(`DROP INDEX \`IDX_9324ccb5291bd98d5fba6349f7\` ON \`employee_availability\``);
		await queryRunner.query(`DROP INDEX \`IDX_981ccd9a51cc8706cbf8cdbdfb\` ON \`employee_availability\``);
		await queryRunner.query(`DROP INDEX \`IDX_1c5a1979ce3d47b895f11f7395\` ON \`employee_availability\``);
		await queryRunner.query(`DROP INDEX \`IDX_4df1dc5482972ff5344b670f78\` ON \`employee_availability\``);
		await queryRunner.query(`DROP TABLE \`employee_availability\``);
	}
}
