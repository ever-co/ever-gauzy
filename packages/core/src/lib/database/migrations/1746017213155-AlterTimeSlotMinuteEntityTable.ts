import { MigrationInterface, QueryRunner } from 'typeorm';
import * as chalk from 'chalk';
import { DatabaseTypeEnum } from '@gauzy/config';

export class AlterTimeSlotMinuteEntityTable1746017213155 implements MigrationInterface {
	name = 'AlterTimeSlotMinuteEntityTable1746017213155';

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
		console.log(chalk.yellow(this.name + ' reverting changes!'));

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
		await queryRunner.query(`ALTER TABLE "time_slot_minute" ADD "location" integer NOT NULL DEFAULT 0`);
		await queryRunner.query(`ALTER TABLE "time_slot_minute" ADD "kbMouseActivity" jsonb`);
		await queryRunner.query(`ALTER TABLE "time_slot_minute" ADD "locationActivity" jsonb`);
		await queryRunner.query(`ALTER TABLE "time_slot_minute" ADD "customActivity" jsonb`);
	}

	/**
	 * PostgresDB Down Migration
	 *
	 * @param queryRunner
	 */
	public async postgresDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(`ALTER TABLE "time_slot_minute" DROP COLUMN "customActivity"`);
		await queryRunner.query(`ALTER TABLE "time_slot_minute" DROP COLUMN "locationActivity"`);
		await queryRunner.query(`ALTER TABLE "time_slot_minute" DROP COLUMN "kbMouseActivity"`);
		await queryRunner.query(`ALTER TABLE "time_slot_minute" DROP COLUMN "location"`);
	}

	/**
	 * SqliteDB and BetterSQlite3DB Up Migration
	 *
	 * @param queryRunner
	 */
	public async sqliteUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(`DROP INDEX "IDX_5bc34e99b09a687ad3fe9f8538"`);
		await queryRunner.query(`DROP INDEX "IDX_40e829b85b6414c85ae25f05b8"`);
		await queryRunner.query(`DROP INDEX "IDX_9272701d3da8bd8507f316c915"`);
		await queryRunner.query(`DROP INDEX "IDX_82c5edbd179359212f16f0d386"`);
		await queryRunner.query(`DROP INDEX "IDX_c7f72cb68b22b8ab988158e4d2"`);
		await queryRunner.query(`DROP INDEX "IDX_8260fdc7862ca27d8cf10e6290"`);
		await queryRunner.query(`DROP INDEX "IDX_a3eeb9629f550c367bb752855e"`);
		await queryRunner.query(`DROP INDEX "IDX_7b8440953eeff74641d33cc293"`);
		await queryRunner.query(
			`CREATE TABLE "temporary_time_slot_minute" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "organizationId" varchar, "keyboard" integer NOT NULL DEFAULT (0), "mouse" integer NOT NULL DEFAULT (0), "datetime" datetime NOT NULL, "timeSlotId" varchar NOT NULL, "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "deletedAt" datetime, "archivedAt" datetime, "createdByUserId" varchar, "updatedByUserId" varchar, "deletedByUserId" varchar, "location" integer NOT NULL DEFAULT (0), "kbMouseActivity" text, "locationActivity" text, "customActivity" text, CONSTRAINT "UQ_0ac1d2777eefcee82db52ca3660" UNIQUE ("timeSlotId", "datetime"), CONSTRAINT "FK_5bc34e99b09a687ad3fe9f85383" FOREIGN KEY ("deletedByUserId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_40e829b85b6414c85ae25f05b8d" FOREIGN KEY ("createdByUserId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_9272701d3da8bd8507f316c9154" FOREIGN KEY ("timeSlotId") REFERENCES "time_slot" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_82c5edbd179359212f16f0d386a" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_c7f72cb68b22b8ab988158e4d26" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_7b8440953eeff74641d33cc2937" FOREIGN KEY ("updatedByUserId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`
		);
		await queryRunner.query(
			`INSERT INTO "temporary_time_slot_minute"("id", "createdAt", "updatedAt", "tenantId", "organizationId", "keyboard", "mouse", "datetime", "timeSlotId", "isActive", "isArchived", "deletedAt", "archivedAt", "createdByUserId", "updatedByUserId", "deletedByUserId") SELECT "id", "createdAt", "updatedAt", "tenantId", "organizationId", "keyboard", "mouse", "datetime", "timeSlotId", "isActive", "isArchived", "deletedAt", "archivedAt", "createdByUserId", "updatedByUserId", "deletedByUserId" FROM "time_slot_minute"`
		);
		await queryRunner.query(`DROP TABLE "time_slot_minute"`);
		await queryRunner.query(`ALTER TABLE "temporary_time_slot_minute" RENAME TO "time_slot_minute"`);
		await queryRunner.query(
			`CREATE INDEX "IDX_5bc34e99b09a687ad3fe9f8538" ON "time_slot_minute" ("deletedByUserId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_40e829b85b6414c85ae25f05b8" ON "time_slot_minute" ("createdByUserId") `
		);
		await queryRunner.query(`CREATE INDEX "IDX_9272701d3da8bd8507f316c915" ON "time_slot_minute" ("timeSlotId") `);
		await queryRunner.query(
			`CREATE INDEX "IDX_82c5edbd179359212f16f0d386" ON "time_slot_minute" ("organizationId") `
		);
		await queryRunner.query(`CREATE INDEX "IDX_c7f72cb68b22b8ab988158e4d2" ON "time_slot_minute" ("tenantId") `);
		await queryRunner.query(`CREATE INDEX "IDX_8260fdc7862ca27d8cf10e6290" ON "time_slot_minute" ("isActive") `);
		await queryRunner.query(`CREATE INDEX "IDX_a3eeb9629f550c367bb752855e" ON "time_slot_minute" ("isArchived") `);
		await queryRunner.query(
			`CREATE INDEX "IDX_7b8440953eeff74641d33cc293" ON "time_slot_minute" ("updatedByUserId") `
		);
	}

	/**
	 * SqliteDB and BetterSQlite3DB Down Migration
	 *
	 * @param queryRunner
	 */
	public async sqliteDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(`DROP INDEX "IDX_7b8440953eeff74641d33cc293"`);
		await queryRunner.query(`DROP INDEX "IDX_a3eeb9629f550c367bb752855e"`);
		await queryRunner.query(`DROP INDEX "IDX_8260fdc7862ca27d8cf10e6290"`);
		await queryRunner.query(`DROP INDEX "IDX_c7f72cb68b22b8ab988158e4d2"`);
		await queryRunner.query(`DROP INDEX "IDX_82c5edbd179359212f16f0d386"`);
		await queryRunner.query(`DROP INDEX "IDX_9272701d3da8bd8507f316c915"`);
		await queryRunner.query(`DROP INDEX "IDX_40e829b85b6414c85ae25f05b8"`);
		await queryRunner.query(`DROP INDEX "IDX_5bc34e99b09a687ad3fe9f8538"`);
		await queryRunner.query(`ALTER TABLE "time_slot_minute" RENAME TO "temporary_time_slot_minute"`);
		await queryRunner.query(
			`CREATE TABLE "time_slot_minute" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "organizationId" varchar, "keyboard" integer NOT NULL DEFAULT (0), "mouse" integer NOT NULL DEFAULT (0), "datetime" datetime NOT NULL, "timeSlotId" varchar NOT NULL, "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "deletedAt" datetime, "archivedAt" datetime, "createdByUserId" varchar, "updatedByUserId" varchar, "deletedByUserId" varchar, CONSTRAINT "UQ_0ac1d2777eefcee82db52ca3660" UNIQUE ("timeSlotId", "datetime"), CONSTRAINT "FK_5bc34e99b09a687ad3fe9f85383" FOREIGN KEY ("deletedByUserId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_40e829b85b6414c85ae25f05b8d" FOREIGN KEY ("createdByUserId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_9272701d3da8bd8507f316c9154" FOREIGN KEY ("timeSlotId") REFERENCES "time_slot" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_82c5edbd179359212f16f0d386a" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_c7f72cb68b22b8ab988158e4d26" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_7b8440953eeff74641d33cc2937" FOREIGN KEY ("updatedByUserId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`
		);
		await queryRunner.query(
			`INSERT INTO "time_slot_minute"("id", "createdAt", "updatedAt", "tenantId", "organizationId", "keyboard", "mouse", "datetime", "timeSlotId", "isActive", "isArchived", "deletedAt", "archivedAt", "createdByUserId", "updatedByUserId", "deletedByUserId") SELECT "id", "createdAt", "updatedAt", "tenantId", "organizationId", "keyboard", "mouse", "datetime", "timeSlotId", "isActive", "isArchived", "deletedAt", "archivedAt", "createdByUserId", "updatedByUserId", "deletedByUserId" FROM "temporary_time_slot_minute"`
		);
		await queryRunner.query(`DROP TABLE "temporary_time_slot_minute"`);
		await queryRunner.query(
			`CREATE INDEX "IDX_7b8440953eeff74641d33cc293" ON "time_slot_minute" ("updatedByUserId") `
		);
		await queryRunner.query(`CREATE INDEX "IDX_a3eeb9629f550c367bb752855e" ON "time_slot_minute" ("isArchived") `);
		await queryRunner.query(`CREATE INDEX "IDX_8260fdc7862ca27d8cf10e6290" ON "time_slot_minute" ("isActive") `);
		await queryRunner.query(`CREATE INDEX "IDX_c7f72cb68b22b8ab988158e4d2" ON "time_slot_minute" ("tenantId") `);
		await queryRunner.query(
			`CREATE INDEX "IDX_82c5edbd179359212f16f0d386" ON "time_slot_minute" ("organizationId") `
		);
		await queryRunner.query(`CREATE INDEX "IDX_9272701d3da8bd8507f316c915" ON "time_slot_minute" ("timeSlotId") `);
		await queryRunner.query(
			`CREATE INDEX "IDX_40e829b85b6414c85ae25f05b8" ON "time_slot_minute" ("createdByUserId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_5bc34e99b09a687ad3fe9f8538" ON "time_slot_minute" ("deletedByUserId") `
		);
	}

	/**
	 * MySQL Up Migration
	 *
	 * @param queryRunner
	 */
	public async mysqlUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(`ALTER TABLE \`time_slot_minute\` ADD \`location\` int NOT NULL DEFAULT 0`);
		await queryRunner.query(`ALTER TABLE \`time_slot_minute\` ADD \`kbMouseActivity\` json NULL`);
		await queryRunner.query(`ALTER TABLE \`time_slot_minute\` ADD \`locationActivity\` json NULL`);
		await queryRunner.query(`ALTER TABLE \`time_slot_minute\` ADD \`customActivity\` json NULL`);
	}

	/**
	 * MySQL Down Migration
	 *
	 * @param queryRunner
	 */
	public async mysqlDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(`ALTER TABLE \`time_slot_minute\` DROP COLUMN \`customActivity\``);
		await queryRunner.query(`ALTER TABLE \`time_slot_minute\` DROP COLUMN \`locationActivity\``);
		await queryRunner.query(`ALTER TABLE \`time_slot_minute\` DROP COLUMN \`kbMouseActivity\``);
		await queryRunner.query(`ALTER TABLE \`time_slot_minute\` DROP COLUMN \`location\``);
	}
}
