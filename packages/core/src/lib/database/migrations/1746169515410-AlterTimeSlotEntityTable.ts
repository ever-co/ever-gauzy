import { MigrationInterface, QueryRunner } from 'typeorm';
import * as chalk from 'chalk';
import { DatabaseTypeEnum } from '@gauzy/config';

export class AlterTimeSlotEntityTable1746169515410 implements MigrationInterface {
	name = 'AlterTimeSlotEntityTable1746169515410';

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
		await queryRunner.query(`ALTER TABLE "time_slot" ADD "location" integer NOT NULL DEFAULT 0`);
		await queryRunner.query(`ALTER TABLE "time_slot" ADD "kbMouseActivity" jsonb`);
		await queryRunner.query(`ALTER TABLE "time_slot" ADD "locationActivity" jsonb`);
		await queryRunner.query(`ALTER TABLE "time_slot" ADD "customActivity" jsonb`);
	}

	/**
	 * PostgresDB Down Migration
	 *
	 * @param queryRunner
	 */
	public async postgresDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(`ALTER TABLE "time_slot" DROP COLUMN "customActivity"`);
		await queryRunner.query(`ALTER TABLE "time_slot" DROP COLUMN "locationActivity"`);
		await queryRunner.query(`ALTER TABLE "time_slot" DROP COLUMN "kbMouseActivity"`);
		await queryRunner.query(`ALTER TABLE "time_slot" DROP COLUMN "location"`);
	}

	/**
	 * SqliteDB and BetterSQlite3DB Up Migration
	 *
	 * @param queryRunner
	 */
	public async sqliteUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(`DROP INDEX "IDX_9445b0316f60bd53c29661247a"`);
		await queryRunner.query(`DROP INDEX "IDX_d40a78a0d0a6e64e8d15f32db6"`);
		await queryRunner.query(`DROP INDEX "IDX_7913305b850c7afc89b6ed96a3"`);
		await queryRunner.query(`DROP INDEX "IDX_c6e7d1075bfd97eea6643b1479"`);
		await queryRunner.query(`DROP INDEX "IDX_f44e721669d5c6bed32cd6a3bf"`);
		await queryRunner.query(`DROP INDEX "IDX_0c707825a7c2ecc4e186b07ebf"`);
		await queryRunner.query(`DROP INDEX "IDX_b8284109257b5137256b5b3e84"`);
		await queryRunner.query(`DROP INDEX "IDX_b407841271245501dd1a8c7551"`);
		await queryRunner.query(`DROP INDEX "IDX_645a6bc3f1141d4a111a3166d8"`);
		await queryRunner.query(`DROP INDEX "IDX_81060c5dbe69efa1f3b6e1a2e5"`);
		await queryRunner.query(`DROP INDEX "IDX_596e0e849822aa09ec0d4a1052"`);
		await queryRunner.query(
			`CREATE TABLE "temporary_time_slot" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "organizationId" varchar, "duration" integer NOT NULL DEFAULT (0), "keyboard" integer NOT NULL DEFAULT (0), "mouse" integer NOT NULL DEFAULT (0), "overall" integer NOT NULL DEFAULT (0), "startedAt" datetime NOT NULL, "employeeId" varchar NOT NULL, "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "deletedAt" datetime, "archivedAt" datetime, "createdByUserId" varchar, "updatedByUserId" varchar, "deletedByUserId" varchar, "location" integer NOT NULL DEFAULT (0), "kbMouseActivity" text, "locationActivity" text, "customActivity" text, CONSTRAINT "FK_9445b0316f60bd53c29661247a1" FOREIGN KEY ("deletedByUserId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_d40a78a0d0a6e64e8d15f32db63" FOREIGN KEY ("createdByUserId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_7913305b850c7afc89b6ed96a30" FOREIGN KEY ("employeeId") REFERENCES "employee" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_b8284109257b5137256b5b3e848" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_b407841271245501dd1a8c75513" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_596e0e849822aa09ec0d4a10521" FOREIGN KEY ("updatedByUserId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`
		);
		await queryRunner.query(
			`INSERT INTO "temporary_time_slot"("id", "createdAt", "updatedAt", "tenantId", "organizationId", "duration", "keyboard", "mouse", "overall", "startedAt", "employeeId", "isActive", "isArchived", "deletedAt", "archivedAt", "createdByUserId", "updatedByUserId", "deletedByUserId") SELECT "id", "createdAt", "updatedAt", "tenantId", "organizationId", "duration", "keyboard", "mouse", "overall", "startedAt", "employeeId", "isActive", "isArchived", "deletedAt", "archivedAt", "createdByUserId", "updatedByUserId", "deletedByUserId" FROM "time_slot"`
		);
		await queryRunner.query(`DROP TABLE "time_slot"`);
		await queryRunner.query(`ALTER TABLE "temporary_time_slot" RENAME TO "time_slot"`);
		await queryRunner.query(`CREATE INDEX "IDX_9445b0316f60bd53c29661247a" ON "time_slot" ("deletedByUserId") `);
		await queryRunner.query(`CREATE INDEX "IDX_d40a78a0d0a6e64e8d15f32db6" ON "time_slot" ("createdByUserId") `);
		await queryRunner.query(`CREATE INDEX "IDX_7913305b850c7afc89b6ed96a3" ON "time_slot" ("employeeId") `);
		await queryRunner.query(`CREATE INDEX "IDX_c6e7d1075bfd97eea6643b1479" ON "time_slot" ("startedAt") `);
		await queryRunner.query(`CREATE INDEX "IDX_f44e721669d5c6bed32cd6a3bf" ON "time_slot" ("overall") `);
		await queryRunner.query(`CREATE INDEX "IDX_0c707825a7c2ecc4e186b07ebf" ON "time_slot" ("duration") `);
		await queryRunner.query(`CREATE INDEX "IDX_b8284109257b5137256b5b3e84" ON "time_slot" ("tenantId") `);
		await queryRunner.query(`CREATE INDEX "IDX_b407841271245501dd1a8c7551" ON "time_slot" ("organizationId") `);
		await queryRunner.query(`CREATE INDEX "IDX_645a6bc3f1141d4a111a3166d8" ON "time_slot" ("isActive") `);
		await queryRunner.query(`CREATE INDEX "IDX_81060c5dbe69efa1f3b6e1a2e5" ON "time_slot" ("isArchived") `);
		await queryRunner.query(`CREATE INDEX "IDX_596e0e849822aa09ec0d4a1052" ON "time_slot" ("updatedByUserId") `);
	}

	/**
	 * SqliteDB and BetterSQlite3DB Down Migration
	 *
	 * @param queryRunner
	 */
	public async sqliteDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(`DROP INDEX "IDX_596e0e849822aa09ec0d4a1052"`);
		await queryRunner.query(`DROP INDEX "IDX_81060c5dbe69efa1f3b6e1a2e5"`);
		await queryRunner.query(`DROP INDEX "IDX_645a6bc3f1141d4a111a3166d8"`);
		await queryRunner.query(`DROP INDEX "IDX_b407841271245501dd1a8c7551"`);
		await queryRunner.query(`DROP INDEX "IDX_b8284109257b5137256b5b3e84"`);
		await queryRunner.query(`DROP INDEX "IDX_0c707825a7c2ecc4e186b07ebf"`);
		await queryRunner.query(`DROP INDEX "IDX_f44e721669d5c6bed32cd6a3bf"`);
		await queryRunner.query(`DROP INDEX "IDX_c6e7d1075bfd97eea6643b1479"`);
		await queryRunner.query(`DROP INDEX "IDX_7913305b850c7afc89b6ed96a3"`);
		await queryRunner.query(`DROP INDEX "IDX_d40a78a0d0a6e64e8d15f32db6"`);
		await queryRunner.query(`DROP INDEX "IDX_9445b0316f60bd53c29661247a"`);
		await queryRunner.query(`ALTER TABLE "time_slot" RENAME TO "temporary_time_slot"`);
		await queryRunner.query(
			`CREATE TABLE "time_slot" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "organizationId" varchar, "duration" integer NOT NULL DEFAULT (0), "keyboard" integer NOT NULL DEFAULT (0), "mouse" integer NOT NULL DEFAULT (0), "overall" integer NOT NULL DEFAULT (0), "startedAt" datetime NOT NULL, "employeeId" varchar NOT NULL, "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "deletedAt" datetime, "archivedAt" datetime, "createdByUserId" varchar, "updatedByUserId" varchar, "deletedByUserId" varchar, CONSTRAINT "FK_9445b0316f60bd53c29661247a1" FOREIGN KEY ("deletedByUserId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_d40a78a0d0a6e64e8d15f32db63" FOREIGN KEY ("createdByUserId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_7913305b850c7afc89b6ed96a30" FOREIGN KEY ("employeeId") REFERENCES "employee" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_b8284109257b5137256b5b3e848" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_b407841271245501dd1a8c75513" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_596e0e849822aa09ec0d4a10521" FOREIGN KEY ("updatedByUserId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`
		);
		await queryRunner.query(
			`INSERT INTO "time_slot"("id", "createdAt", "updatedAt", "tenantId", "organizationId", "duration", "keyboard", "mouse", "overall", "startedAt", "employeeId", "isActive", "isArchived", "deletedAt", "archivedAt", "createdByUserId", "updatedByUserId", "deletedByUserId") SELECT "id", "createdAt", "updatedAt", "tenantId", "organizationId", "duration", "keyboard", "mouse", "overall", "startedAt", "employeeId", "isActive", "isArchived", "deletedAt", "archivedAt", "createdByUserId", "updatedByUserId", "deletedByUserId" FROM "temporary_time_slot"`
		);
		await queryRunner.query(`DROP TABLE "temporary_time_slot"`);
		await queryRunner.query(`CREATE INDEX "IDX_596e0e849822aa09ec0d4a1052" ON "time_slot" ("updatedByUserId") `);
		await queryRunner.query(`CREATE INDEX "IDX_81060c5dbe69efa1f3b6e1a2e5" ON "time_slot" ("isArchived") `);
		await queryRunner.query(`CREATE INDEX "IDX_645a6bc3f1141d4a111a3166d8" ON "time_slot" ("isActive") `);
		await queryRunner.query(`CREATE INDEX "IDX_b407841271245501dd1a8c7551" ON "time_slot" ("organizationId") `);
		await queryRunner.query(`CREATE INDEX "IDX_b8284109257b5137256b5b3e84" ON "time_slot" ("tenantId") `);
		await queryRunner.query(`CREATE INDEX "IDX_0c707825a7c2ecc4e186b07ebf" ON "time_slot" ("duration") `);
		await queryRunner.query(`CREATE INDEX "IDX_f44e721669d5c6bed32cd6a3bf" ON "time_slot" ("overall") `);
		await queryRunner.query(`CREATE INDEX "IDX_c6e7d1075bfd97eea6643b1479" ON "time_slot" ("startedAt") `);
		await queryRunner.query(`CREATE INDEX "IDX_7913305b850c7afc89b6ed96a3" ON "time_slot" ("employeeId") `);
		await queryRunner.query(`CREATE INDEX "IDX_d40a78a0d0a6e64e8d15f32db6" ON "time_slot" ("createdByUserId") `);
		await queryRunner.query(`CREATE INDEX "IDX_9445b0316f60bd53c29661247a" ON "time_slot" ("deletedByUserId") `);
	}

	/**
	 * MySQL Up Migration
	 *
	 * @param queryRunner
	 */
	public async mysqlUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(`ALTER TABLE \`time_slot\` ADD \`location\` int NOT NULL DEFAULT '0'`);
		await queryRunner.query(`ALTER TABLE \`time_slot\` ADD \`kbMouseActivity\` json NULL`);
		await queryRunner.query(`ALTER TABLE \`time_slot\` ADD \`locationActivity\` json NULL`);
		await queryRunner.query(`ALTER TABLE \`time_slot\` ADD \`customActivity\` json NULL`);
	}

	/**
	 * MySQL Down Migration
	 *
	 * @param queryRunner
	 */
	public async mysqlDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(`ALTER TABLE \`time_slot\` DROP COLUMN \`customActivity\``);
		await queryRunner.query(`ALTER TABLE \`time_slot\` DROP COLUMN \`locationActivity\``);
		await queryRunner.query(`ALTER TABLE \`time_slot\` DROP COLUMN \`kbMouseActivity\``);
		await queryRunner.query(`ALTER TABLE \`time_slot\` DROP COLUMN \`location\``);
	}
}
