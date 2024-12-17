import { Logger } from '@nestjs/common';
import { MigrationInterface, QueryRunner } from 'typeorm';
import { yellow } from 'chalk';
import { DatabaseTypeEnum } from '@gauzy/config';

export class AlterEmployeeSettingAddSettingJsonFields1734434773692 implements MigrationInterface {
	name = 'AlterEmployeeSettingAddSettingJsonFields1734434773692';

	/**
	 * Up Migration
	 *
	 * @param queryRunner
	 */
	public async up(queryRunner: QueryRunner): Promise<void> {
		Logger.debug(yellow(this.name + ' start running!'), 'Migration');

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
		await queryRunner.query(`DROP INDEX "public"."IDX_710c71526edb89b2a7033abcdf"`);
		await queryRunner.query(`ALTER TABLE "employee_setting" DROP COLUMN "month"`);
		await queryRunner.query(`ALTER TABLE "employee_setting" DROP COLUMN "year"`);
		await queryRunner.query(`ALTER TABLE "employee_setting" DROP COLUMN "value"`);
		await queryRunner.query(`ALTER TABLE "employee_setting" DROP COLUMN "currency"`);
		await queryRunner.query(`ALTER TABLE "employee_setting" ADD "entityId" character varying`);
		await queryRunner.query(`ALTER TABLE "employee_setting" ADD "entity" character varying`);
		await queryRunner.query(`ALTER TABLE "employee_setting" ADD "data" jsonb`);
		await queryRunner.query(`ALTER TABLE "employee_setting" ADD "defaultData" jsonb`);
		await queryRunner.query(`DROP INDEX "public"."IDX_9537fae454ebebc98ee5adb3a2"`);
		await queryRunner.query(`ALTER TABLE "employee_setting" DROP COLUMN "settingType"`);
		await queryRunner.query(`ALTER TABLE "employee_setting" ADD "settingType" integer DEFAULT '0'`);
		await queryRunner.query(`CREATE INDEX "IDX_9537fae454ebebc98ee5adb3a2" ON "employee_setting" ("settingType") `);
		await queryRunner.query(`CREATE INDEX "IDX_cb9a229d96e9357c823e0c1940" ON "employee_setting" ("entityId") `);
		await queryRunner.query(`CREATE INDEX "IDX_4862a2b518e38fe3942e6be210" ON "employee_setting" ("entity") `);
	}

	/**
	 * PostgresDB Down Migration
	 *
	 * @param queryRunner
	 */
	public async postgresDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(`DROP INDEX "public"."IDX_4862a2b518e38fe3942e6be210"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_cb9a229d96e9357c823e0c1940"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_9537fae454ebebc98ee5adb3a2"`);
		await queryRunner.query(`ALTER TABLE "employee_setting" DROP COLUMN "settingType"`);
		await queryRunner.query(`ALTER TABLE "employee_setting" ADD "settingType" character varying NOT NULL`);
		await queryRunner.query(`CREATE INDEX "IDX_9537fae454ebebc98ee5adb3a2" ON "employee_setting" ("settingType") `);
		await queryRunner.query(`ALTER TABLE "employee_setting" DROP COLUMN "defaultData"`);
		await queryRunner.query(`ALTER TABLE "employee_setting" DROP COLUMN "data"`);
		await queryRunner.query(`ALTER TABLE "employee_setting" DROP COLUMN "entity"`);
		await queryRunner.query(`ALTER TABLE "employee_setting" DROP COLUMN "entityId"`);
		await queryRunner.query(`ALTER TABLE "employee_setting" ADD "currency" character varying NOT NULL`);
		await queryRunner.query(`ALTER TABLE "employee_setting" ADD "value" integer NOT NULL`);
		await queryRunner.query(`ALTER TABLE "employee_setting" ADD "year" integer NOT NULL`);
		await queryRunner.query(`ALTER TABLE "employee_setting" ADD "month" integer NOT NULL`);
		await queryRunner.query(`CREATE INDEX "IDX_710c71526edb89b2a7033abcdf" ON "employee_setting" ("currency") `);
	}

	/**
	 * SqliteDB and BetterSQlite3DB Up Migration
	 *
	 * @param queryRunner
	 */
	public async sqliteUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(`DROP INDEX "IDX_710c71526edb89b2a7033abcdf"`);
		await queryRunner.query(`DROP INDEX "IDX_01237d04f882cf1ea794678e8d"`);
		await queryRunner.query(`DROP INDEX "IDX_48fae30026b4e166a3445fee6d"`);
		await queryRunner.query(`DROP INDEX "IDX_9516a627a131626d2a5738a05a"`);
		await queryRunner.query(`DROP INDEX "IDX_56e96cd218a185ed59b5a8e786"`);
		await queryRunner.query(`DROP INDEX "IDX_9537fae454ebebc98ee5adb3a2"`);
		await queryRunner.query(`DROP INDEX "IDX_95ea18af6ef8123503d332240c"`);
		await queryRunner.query(
			`CREATE TABLE "temporary_employee_setting" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "organizationId" varchar, "settingType" varchar NOT NULL, "employeeId" varchar NOT NULL, "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "deletedAt" datetime, "archivedAt" datetime, CONSTRAINT "FK_9516a627a131626d2a5738a05a8" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_56e96cd218a185ed59b5a8e7869" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_95ea18af6ef8123503d332240c2" FOREIGN KEY ("employeeId") REFERENCES "employee" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`
		);
		await queryRunner.query(
			`INSERT INTO "temporary_employee_setting"("id", "createdAt", "updatedAt", "tenantId", "organizationId", "settingType", "employeeId", "isActive", "isArchived", "deletedAt", "archivedAt") SELECT "id", "createdAt", "updatedAt", "tenantId", "organizationId", "settingType", "employeeId", "isActive", "isArchived", "deletedAt", "archivedAt" FROM "employee_setting"`
		);
		await queryRunner.query(`DROP TABLE "employee_setting"`);
		await queryRunner.query(`ALTER TABLE "temporary_employee_setting" RENAME TO "employee_setting"`);
		await queryRunner.query(`CREATE INDEX "IDX_01237d04f882cf1ea794678e8d" ON "employee_setting" ("isArchived") `);
		await queryRunner.query(`CREATE INDEX "IDX_48fae30026b4e166a3445fee6d" ON "employee_setting" ("isActive") `);
		await queryRunner.query(`CREATE INDEX "IDX_9516a627a131626d2a5738a05a" ON "employee_setting" ("tenantId") `);
		await queryRunner.query(
			`CREATE INDEX "IDX_56e96cd218a185ed59b5a8e786" ON "employee_setting" ("organizationId") `
		);
		await queryRunner.query(`CREATE INDEX "IDX_9537fae454ebebc98ee5adb3a2" ON "employee_setting" ("settingType") `);
		await queryRunner.query(`CREATE INDEX "IDX_95ea18af6ef8123503d332240c" ON "employee_setting" ("employeeId") `);
		await queryRunner.query(`DROP INDEX "IDX_01237d04f882cf1ea794678e8d"`);
		await queryRunner.query(`DROP INDEX "IDX_48fae30026b4e166a3445fee6d"`);
		await queryRunner.query(`DROP INDEX "IDX_9516a627a131626d2a5738a05a"`);
		await queryRunner.query(`DROP INDEX "IDX_56e96cd218a185ed59b5a8e786"`);
		await queryRunner.query(`DROP INDEX "IDX_9537fae454ebebc98ee5adb3a2"`);
		await queryRunner.query(`DROP INDEX "IDX_95ea18af6ef8123503d332240c"`);
		await queryRunner.query(
			`CREATE TABLE "temporary_employee_setting" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "organizationId" varchar, "settingType" varchar NOT NULL, "employeeId" varchar NOT NULL, "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "deletedAt" datetime, "archivedAt" datetime, "entityId" varchar, "entity" varchar, "data" text, "defaultData" text, CONSTRAINT "FK_9516a627a131626d2a5738a05a8" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_56e96cd218a185ed59b5a8e7869" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_95ea18af6ef8123503d332240c2" FOREIGN KEY ("employeeId") REFERENCES "employee" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`
		);
		await queryRunner.query(
			`INSERT INTO "temporary_employee_setting"("id", "createdAt", "updatedAt", "tenantId", "organizationId", "settingType", "employeeId", "isActive", "isArchived", "deletedAt", "archivedAt") SELECT "id", "createdAt", "updatedAt", "tenantId", "organizationId", "settingType", "employeeId", "isActive", "isArchived", "deletedAt", "archivedAt" FROM "employee_setting"`
		);
		await queryRunner.query(`DROP TABLE "employee_setting"`);
		await queryRunner.query(`ALTER TABLE "temporary_employee_setting" RENAME TO "employee_setting"`);
		await queryRunner.query(`CREATE INDEX "IDX_01237d04f882cf1ea794678e8d" ON "employee_setting" ("isArchived") `);
		await queryRunner.query(`CREATE INDEX "IDX_48fae30026b4e166a3445fee6d" ON "employee_setting" ("isActive") `);
		await queryRunner.query(`CREATE INDEX "IDX_9516a627a131626d2a5738a05a" ON "employee_setting" ("tenantId") `);
		await queryRunner.query(
			`CREATE INDEX "IDX_56e96cd218a185ed59b5a8e786" ON "employee_setting" ("organizationId") `
		);
		await queryRunner.query(`CREATE INDEX "IDX_9537fae454ebebc98ee5adb3a2" ON "employee_setting" ("settingType") `);
		await queryRunner.query(`CREATE INDEX "IDX_95ea18af6ef8123503d332240c" ON "employee_setting" ("employeeId") `);
		await queryRunner.query(`DROP INDEX "IDX_01237d04f882cf1ea794678e8d"`);
		await queryRunner.query(`DROP INDEX "IDX_48fae30026b4e166a3445fee6d"`);
		await queryRunner.query(`DROP INDEX "IDX_9516a627a131626d2a5738a05a"`);
		await queryRunner.query(`DROP INDEX "IDX_56e96cd218a185ed59b5a8e786"`);
		await queryRunner.query(`DROP INDEX "IDX_9537fae454ebebc98ee5adb3a2"`);
		await queryRunner.query(`DROP INDEX "IDX_95ea18af6ef8123503d332240c"`);
		await queryRunner.query(
			`CREATE TABLE "temporary_employee_setting" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "organizationId" varchar, "settingType" integer DEFAULT (0), "employeeId" varchar NOT NULL, "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "deletedAt" datetime, "archivedAt" datetime, "entityId" varchar, "entity" varchar, "data" text, "defaultData" text, CONSTRAINT "FK_9516a627a131626d2a5738a05a8" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_56e96cd218a185ed59b5a8e7869" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_95ea18af6ef8123503d332240c2" FOREIGN KEY ("employeeId") REFERENCES "employee" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`
		);
		await queryRunner.query(
			`INSERT INTO "temporary_employee_setting"("id", "createdAt", "updatedAt", "tenantId", "organizationId", "settingType", "employeeId", "isActive", "isArchived", "deletedAt", "archivedAt", "entityId", "entity", "data", "defaultData") SELECT "id", "createdAt", "updatedAt", "tenantId", "organizationId", "settingType", "employeeId", "isActive", "isArchived", "deletedAt", "archivedAt", "entityId", "entity", "data", "defaultData" FROM "employee_setting"`
		);
		await queryRunner.query(`DROP TABLE "employee_setting"`);
		await queryRunner.query(`ALTER TABLE "temporary_employee_setting" RENAME TO "employee_setting"`);
		await queryRunner.query(`CREATE INDEX "IDX_01237d04f882cf1ea794678e8d" ON "employee_setting" ("isArchived") `);
		await queryRunner.query(`CREATE INDEX "IDX_48fae30026b4e166a3445fee6d" ON "employee_setting" ("isActive") `);
		await queryRunner.query(`CREATE INDEX "IDX_9516a627a131626d2a5738a05a" ON "employee_setting" ("tenantId") `);
		await queryRunner.query(
			`CREATE INDEX "IDX_56e96cd218a185ed59b5a8e786" ON "employee_setting" ("organizationId") `
		);
		await queryRunner.query(`CREATE INDEX "IDX_9537fae454ebebc98ee5adb3a2" ON "employee_setting" ("settingType") `);
		await queryRunner.query(`CREATE INDEX "IDX_95ea18af6ef8123503d332240c" ON "employee_setting" ("employeeId") `);
		await queryRunner.query(`CREATE INDEX "IDX_cb9a229d96e9357c823e0c1940" ON "employee_setting" ("entityId") `);
		await queryRunner.query(`CREATE INDEX "IDX_4862a2b518e38fe3942e6be210" ON "employee_setting" ("entity") `);
	}

	/**
	 * SqliteDB and BetterSQlite3DB Down Migration
	 *
	 * @param queryRunner
	 */
	public async sqliteDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(`DROP INDEX "IDX_4862a2b518e38fe3942e6be210"`);
		await queryRunner.query(`DROP INDEX "IDX_cb9a229d96e9357c823e0c1940"`);
		await queryRunner.query(`DROP INDEX "IDX_95ea18af6ef8123503d332240c"`);
		await queryRunner.query(`DROP INDEX "IDX_9537fae454ebebc98ee5adb3a2"`);
		await queryRunner.query(`DROP INDEX "IDX_56e96cd218a185ed59b5a8e786"`);
		await queryRunner.query(`DROP INDEX "IDX_9516a627a131626d2a5738a05a"`);
		await queryRunner.query(`DROP INDEX "IDX_48fae30026b4e166a3445fee6d"`);
		await queryRunner.query(`DROP INDEX "IDX_01237d04f882cf1ea794678e8d"`);
		await queryRunner.query(`ALTER TABLE "employee_setting" RENAME TO "temporary_employee_setting"`);
		await queryRunner.query(
			`CREATE TABLE "employee_setting" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "organizationId" varchar, "settingType" varchar NOT NULL, "employeeId" varchar NOT NULL, "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "deletedAt" datetime, "archivedAt" datetime, "entityId" varchar, "entity" varchar, "data" text, "defaultData" text, CONSTRAINT "FK_9516a627a131626d2a5738a05a8" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_56e96cd218a185ed59b5a8e7869" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_95ea18af6ef8123503d332240c2" FOREIGN KEY ("employeeId") REFERENCES "employee" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`
		);
		await queryRunner.query(
			`INSERT INTO "employee_setting"("id", "createdAt", "updatedAt", "tenantId", "organizationId", "settingType", "employeeId", "isActive", "isArchived", "deletedAt", "archivedAt", "entityId", "entity", "data", "defaultData") SELECT "id", "createdAt", "updatedAt", "tenantId", "organizationId", "settingType", "employeeId", "isActive", "isArchived", "deletedAt", "archivedAt", "entityId", "entity", "data", "defaultData" FROM "temporary_employee_setting"`
		);
		await queryRunner.query(`DROP TABLE "temporary_employee_setting"`);
		await queryRunner.query(`CREATE INDEX "IDX_95ea18af6ef8123503d332240c" ON "employee_setting" ("employeeId") `);
		await queryRunner.query(`CREATE INDEX "IDX_9537fae454ebebc98ee5adb3a2" ON "employee_setting" ("settingType") `);
		await queryRunner.query(
			`CREATE INDEX "IDX_56e96cd218a185ed59b5a8e786" ON "employee_setting" ("organizationId") `
		);
		await queryRunner.query(`CREATE INDEX "IDX_9516a627a131626d2a5738a05a" ON "employee_setting" ("tenantId") `);
		await queryRunner.query(`CREATE INDEX "IDX_48fae30026b4e166a3445fee6d" ON "employee_setting" ("isActive") `);
		await queryRunner.query(`CREATE INDEX "IDX_01237d04f882cf1ea794678e8d" ON "employee_setting" ("isArchived") `);
		await queryRunner.query(`DROP INDEX "IDX_95ea18af6ef8123503d332240c"`);
		await queryRunner.query(`DROP INDEX "IDX_9537fae454ebebc98ee5adb3a2"`);
		await queryRunner.query(`DROP INDEX "IDX_56e96cd218a185ed59b5a8e786"`);
		await queryRunner.query(`DROP INDEX "IDX_9516a627a131626d2a5738a05a"`);
		await queryRunner.query(`DROP INDEX "IDX_48fae30026b4e166a3445fee6d"`);
		await queryRunner.query(`DROP INDEX "IDX_01237d04f882cf1ea794678e8d"`);
		await queryRunner.query(`ALTER TABLE "employee_setting" RENAME TO "temporary_employee_setting"`);
		await queryRunner.query(
			`CREATE TABLE "employee_setting" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "organizationId" varchar, "settingType" varchar NOT NULL, "employeeId" varchar NOT NULL, "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "deletedAt" datetime, "archivedAt" datetime, CONSTRAINT "FK_9516a627a131626d2a5738a05a8" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_56e96cd218a185ed59b5a8e7869" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_95ea18af6ef8123503d332240c2" FOREIGN KEY ("employeeId") REFERENCES "employee" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`
		);
		await queryRunner.query(
			`INSERT INTO "employee_setting"("id", "createdAt", "updatedAt", "tenantId", "organizationId", "settingType", "employeeId", "isActive", "isArchived", "deletedAt", "archivedAt") SELECT "id", "createdAt", "updatedAt", "tenantId", "organizationId", "settingType", "employeeId", "isActive", "isArchived", "deletedAt", "archivedAt" FROM "temporary_employee_setting"`
		);
		await queryRunner.query(`DROP TABLE "temporary_employee_setting"`);
		await queryRunner.query(`CREATE INDEX "IDX_95ea18af6ef8123503d332240c" ON "employee_setting" ("employeeId") `);
		await queryRunner.query(`CREATE INDEX "IDX_9537fae454ebebc98ee5adb3a2" ON "employee_setting" ("settingType") `);
		await queryRunner.query(
			`CREATE INDEX "IDX_56e96cd218a185ed59b5a8e786" ON "employee_setting" ("organizationId") `
		);
		await queryRunner.query(`CREATE INDEX "IDX_9516a627a131626d2a5738a05a" ON "employee_setting" ("tenantId") `);
		await queryRunner.query(`CREATE INDEX "IDX_48fae30026b4e166a3445fee6d" ON "employee_setting" ("isActive") `);
		await queryRunner.query(`CREATE INDEX "IDX_01237d04f882cf1ea794678e8d" ON "employee_setting" ("isArchived") `);
		await queryRunner.query(`DROP INDEX "IDX_95ea18af6ef8123503d332240c"`);
		await queryRunner.query(`DROP INDEX "IDX_9537fae454ebebc98ee5adb3a2"`);
		await queryRunner.query(`DROP INDEX "IDX_56e96cd218a185ed59b5a8e786"`);
		await queryRunner.query(`DROP INDEX "IDX_9516a627a131626d2a5738a05a"`);
		await queryRunner.query(`DROP INDEX "IDX_48fae30026b4e166a3445fee6d"`);
		await queryRunner.query(`DROP INDEX "IDX_01237d04f882cf1ea794678e8d"`);
		await queryRunner.query(`ALTER TABLE "employee_setting" RENAME TO "temporary_employee_setting"`);
		await queryRunner.query(
			`CREATE TABLE "employee_setting" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "organizationId" varchar, "month" integer NOT NULL, "year" integer NOT NULL, "settingType" varchar NOT NULL, "value" integer NOT NULL, "currency" varchar NOT NULL, "employeeId" varchar NOT NULL, "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "deletedAt" datetime, "archivedAt" datetime, CONSTRAINT "FK_9516a627a131626d2a5738a05a8" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_56e96cd218a185ed59b5a8e7869" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_95ea18af6ef8123503d332240c2" FOREIGN KEY ("employeeId") REFERENCES "employee" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`
		);
		await queryRunner.query(
			`INSERT INTO "employee_setting"("id", "createdAt", "updatedAt", "tenantId", "organizationId", "settingType", "employeeId", "isActive", "isArchived", "deletedAt", "archivedAt") SELECT "id", "createdAt", "updatedAt", "tenantId", "organizationId", "settingType", "employeeId", "isActive", "isArchived", "deletedAt", "archivedAt" FROM "temporary_employee_setting"`
		);
		await queryRunner.query(`DROP TABLE "temporary_employee_setting"`);
		await queryRunner.query(`CREATE INDEX "IDX_95ea18af6ef8123503d332240c" ON "employee_setting" ("employeeId") `);
		await queryRunner.query(`CREATE INDEX "IDX_9537fae454ebebc98ee5adb3a2" ON "employee_setting" ("settingType") `);
		await queryRunner.query(
			`CREATE INDEX "IDX_56e96cd218a185ed59b5a8e786" ON "employee_setting" ("organizationId") `
		);
		await queryRunner.query(`CREATE INDEX "IDX_9516a627a131626d2a5738a05a" ON "employee_setting" ("tenantId") `);
		await queryRunner.query(`CREATE INDEX "IDX_48fae30026b4e166a3445fee6d" ON "employee_setting" ("isActive") `);
		await queryRunner.query(`CREATE INDEX "IDX_01237d04f882cf1ea794678e8d" ON "employee_setting" ("isArchived") `);
		await queryRunner.query(`CREATE INDEX "IDX_710c71526edb89b2a7033abcdf" ON "employee_setting" ("currency") `);
	}

	/**
	 * MySQL Up Migration
	 *
	 * @param queryRunner
	 */
	public async mysqlUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(`DROP INDEX \`IDX_710c71526edb89b2a7033abcdf\` ON \`employee_setting\``);
		await queryRunner.query(`ALTER TABLE \`employee_setting\` DROP COLUMN \`month\``);
		await queryRunner.query(`ALTER TABLE \`employee_setting\` DROP COLUMN \`year\``);
		await queryRunner.query(`ALTER TABLE \`employee_setting\` DROP COLUMN \`value\``);
		await queryRunner.query(`ALTER TABLE \`employee_setting\` DROP COLUMN \`currency\``);
		await queryRunner.query(`ALTER TABLE \`employee_setting\` ADD \`entityId\` varchar(255) NULL`);
		await queryRunner.query(`ALTER TABLE \`employee_setting\` ADD \`entity\` varchar(255) NULL`);
		await queryRunner.query(`ALTER TABLE \`employee_setting\` ADD \`data\` json NULL`);
		await queryRunner.query(`ALTER TABLE \`employee_setting\` ADD \`defaultData\` json NULL`);
		await queryRunner.query(`DROP INDEX \`IDX_9537fae454ebebc98ee5adb3a2\` ON \`employee_setting\``);
		await queryRunner.query(`ALTER TABLE \`employee_setting\` DROP COLUMN \`settingType\``);
		await queryRunner.query(`ALTER TABLE \`employee_setting\` ADD \`settingType\` int NULL DEFAULT '0'`);
		await queryRunner.query(
			`CREATE INDEX \`IDX_9537fae454ebebc98ee5adb3a2\` ON \`employee_setting\` (\`settingType\`)`
		);
		await queryRunner.query(
			`CREATE INDEX \`IDX_cb9a229d96e9357c823e0c1940\` ON \`employee_setting\` (\`entityId\`)`
		);
		await queryRunner.query(`CREATE INDEX \`IDX_4862a2b518e38fe3942e6be210\` ON \`employee_setting\` (\`entity\`)`);
	}

	/**
	 * MySQL Down Migration
	 *
	 * @param queryRunner
	 */
	public async mysqlDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(`DROP INDEX \`IDX_4862a2b518e38fe3942e6be210\` ON \`employee_setting\``);
		await queryRunner.query(`DROP INDEX \`IDX_cb9a229d96e9357c823e0c1940\` ON \`employee_setting\``);
		await queryRunner.query(`DROP INDEX \`IDX_9537fae454ebebc98ee5adb3a2\` ON \`employee_setting\``);
		await queryRunner.query(`ALTER TABLE \`employee_setting\` DROP COLUMN \`settingType\``);
		await queryRunner.query(`ALTER TABLE \`employee_setting\` ADD \`settingType\` varchar(255) NOT NULL`);
		await queryRunner.query(
			`CREATE INDEX \`IDX_9537fae454ebebc98ee5adb3a2\` ON \`employee_setting\` (\`settingType\`)`
		);
		await queryRunner.query(`ALTER TABLE \`employee_setting\` DROP COLUMN \`defaultData\``);
		await queryRunner.query(`ALTER TABLE \`employee_setting\` DROP COLUMN \`data\``);
		await queryRunner.query(`ALTER TABLE \`employee_setting\` DROP COLUMN \`entity\``);
		await queryRunner.query(`ALTER TABLE \`employee_setting\` DROP COLUMN \`entityId\``);
		await queryRunner.query(`ALTER TABLE \`employee_setting\` ADD \`currency\` varchar(255) NOT NULL`);
		await queryRunner.query(`ALTER TABLE \`employee_setting\` ADD \`value\` int NOT NULL`);
		await queryRunner.query(`ALTER TABLE \`employee_setting\` ADD \`year\` int NOT NULL`);
		await queryRunner.query(`ALTER TABLE \`employee_setting\` ADD \`month\` int NOT NULL`);
		await queryRunner.query(
			`CREATE INDEX \`IDX_710c71526edb89b2a7033abcdf\` ON \`employee_setting\` (\`currency\`)`
		);
	}
}
