import { MigrationInterface, QueryRunner } from 'typeorm';
import * as chalk from 'chalk';
import { DatabaseTypeEnum } from '@gauzy/config';

export class AlterDailyPlanAddTeamRelation1724062299873 implements MigrationInterface {
	name = 'AlterDailyPlanAddTeamRelation1724062299873';

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
		await queryRunner.query(`ALTER TABLE "daily_plan" ADD "organizationTeamId" uuid`);
		await queryRunner.query(
			`CREATE INDEX "IDX_b022c2b684c35dcc63c22850f1" ON "daily_plan" ("organizationTeamId") `
		);
		await queryRunner.query(
			`ALTER TABLE "daily_plan" ADD CONSTRAINT "FK_b022c2b684c35dcc63c22850f13" FOREIGN KEY ("organizationTeamId") REFERENCES "organization_team"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
	}

	/**
	 * PostgresDB Down Migration
	 *
	 * @param queryRunner
	 */
	public async postgresDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(`ALTER TABLE "daily_plan" DROP CONSTRAINT "FK_b022c2b684c35dcc63c22850f13"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_b022c2b684c35dcc63c22850f1"`);
		await queryRunner.query(`ALTER TABLE "daily_plan" DROP COLUMN "organizationTeamId"`);
	}

	/**
	 * SqliteDB and BetterSQlite3DB Up Migration
	 *
	 * @param queryRunner
	 */
	public async sqliteUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(`DROP INDEX "IDX_f2cf366f3f08e31784b056df88"`);
		await queryRunner.query(`DROP INDEX "IDX_9779a35ef1338bafb7b90714f1"`);
		await queryRunner.query(`DROP INDEX "IDX_ecb357a3764a7344c633a257d7"`);
		await queryRunner.query(`DROP INDEX "IDX_ce5e588780497b05cd6267e20e"`);
		await queryRunner.query(`DROP INDEX "IDX_903b08cd4c8025e73316342452"`);
		await queryRunner.query(
			`CREATE TABLE "temporary_daily_plan" ("deletedAt" datetime, "id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "tenantId" varchar, "organizationId" varchar, "date" datetime NOT NULL, "workTimePlanned" decimal NOT NULL, "status" varchar NOT NULL, "employeeId" varchar, "organizationTeamId" varchar, CONSTRAINT "FK_f2cf366f3f08e31784b056df880" FOREIGN KEY ("employeeId") REFERENCES "employee" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_9779a35ef1338bafb7b90714f16" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_ecb357a3764a7344c633a257d76" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`
		);
		await queryRunner.query(
			`INSERT INTO "temporary_daily_plan"("deletedAt", "id", "createdAt", "updatedAt", "isActive", "isArchived", "tenantId", "organizationId", "date", "workTimePlanned", "status", "employeeId") SELECT "deletedAt", "id", "createdAt", "updatedAt", "isActive", "isArchived", "tenantId", "organizationId", "date", "workTimePlanned", "status", "employeeId" FROM "daily_plan"`
		);
		await queryRunner.query(`DROP TABLE "daily_plan"`);
		await queryRunner.query(`ALTER TABLE "temporary_daily_plan" RENAME TO "daily_plan"`);
		await queryRunner.query(`CREATE INDEX "IDX_f2cf366f3f08e31784b056df88" ON "daily_plan" ("employeeId") `);
		await queryRunner.query(`CREATE INDEX "IDX_9779a35ef1338bafb7b90714f1" ON "daily_plan" ("organizationId") `);
		await queryRunner.query(`CREATE INDEX "IDX_ecb357a3764a7344c633a257d7" ON "daily_plan" ("tenantId") `);
		await queryRunner.query(`CREATE INDEX "IDX_ce5e588780497b05cd6267e20e" ON "daily_plan" ("isArchived") `);
		await queryRunner.query(`CREATE INDEX "IDX_903b08cd4c8025e73316342452" ON "daily_plan" ("isActive") `);
		await queryRunner.query(
			`CREATE INDEX "IDX_b022c2b684c35dcc63c22850f1" ON "daily_plan" ("organizationTeamId") `
		);
		await queryRunner.query(`DROP INDEX "IDX_f2cf366f3f08e31784b056df88"`);
		await queryRunner.query(`DROP INDEX "IDX_9779a35ef1338bafb7b90714f1"`);
		await queryRunner.query(`DROP INDEX "IDX_ecb357a3764a7344c633a257d7"`);
		await queryRunner.query(`DROP INDEX "IDX_ce5e588780497b05cd6267e20e"`);
		await queryRunner.query(`DROP INDEX "IDX_903b08cd4c8025e73316342452"`);
		await queryRunner.query(`DROP INDEX "IDX_b022c2b684c35dcc63c22850f1"`);
		await queryRunner.query(
			`CREATE TABLE "temporary_daily_plan" ("deletedAt" datetime, "id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "tenantId" varchar, "organizationId" varchar, "date" datetime NOT NULL, "workTimePlanned" decimal NOT NULL, "status" varchar NOT NULL, "employeeId" varchar, "organizationTeamId" varchar, CONSTRAINT "FK_f2cf366f3f08e31784b056df880" FOREIGN KEY ("employeeId") REFERENCES "employee" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_9779a35ef1338bafb7b90714f16" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_ecb357a3764a7344c633a257d76" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_b022c2b684c35dcc63c22850f13" FOREIGN KEY ("organizationTeamId") REFERENCES "organization_team" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`
		);
		await queryRunner.query(
			`INSERT INTO "temporary_daily_plan"("deletedAt", "id", "createdAt", "updatedAt", "isActive", "isArchived", "tenantId", "organizationId", "date", "workTimePlanned", "status", "employeeId", "organizationTeamId") SELECT "deletedAt", "id", "createdAt", "updatedAt", "isActive", "isArchived", "tenantId", "organizationId", "date", "workTimePlanned", "status", "employeeId", "organizationTeamId" FROM "daily_plan"`
		);
		await queryRunner.query(`DROP TABLE "daily_plan"`);
		await queryRunner.query(`ALTER TABLE "temporary_daily_plan" RENAME TO "daily_plan"`);
		await queryRunner.query(`CREATE INDEX "IDX_f2cf366f3f08e31784b056df88" ON "daily_plan" ("employeeId") `);
		await queryRunner.query(`CREATE INDEX "IDX_9779a35ef1338bafb7b90714f1" ON "daily_plan" ("organizationId") `);
		await queryRunner.query(`CREATE INDEX "IDX_ecb357a3764a7344c633a257d7" ON "daily_plan" ("tenantId") `);
		await queryRunner.query(`CREATE INDEX "IDX_ce5e588780497b05cd6267e20e" ON "daily_plan" ("isArchived") `);
		await queryRunner.query(`CREATE INDEX "IDX_903b08cd4c8025e73316342452" ON "daily_plan" ("isActive") `);
		await queryRunner.query(
			`CREATE INDEX "IDX_b022c2b684c35dcc63c22850f1" ON "daily_plan" ("organizationTeamId") `
		);
	}

	/**
	 * SqliteDB and BetterSQlite3DB Down Migration
	 *
	 * @param queryRunner
	 */
	public async sqliteDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(`DROP INDEX "IDX_b022c2b684c35dcc63c22850f1"`);
		await queryRunner.query(`DROP INDEX "IDX_903b08cd4c8025e73316342452"`);
		await queryRunner.query(`DROP INDEX "IDX_ce5e588780497b05cd6267e20e"`);
		await queryRunner.query(`DROP INDEX "IDX_ecb357a3764a7344c633a257d7"`);
		await queryRunner.query(`DROP INDEX "IDX_9779a35ef1338bafb7b90714f1"`);
		await queryRunner.query(`DROP INDEX "IDX_f2cf366f3f08e31784b056df88"`);
		await queryRunner.query(`ALTER TABLE "daily_plan" RENAME TO "temporary_daily_plan"`);
		await queryRunner.query(
			`CREATE TABLE "daily_plan" ("deletedAt" datetime, "id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "tenantId" varchar, "organizationId" varchar, "date" datetime NOT NULL, "workTimePlanned" decimal NOT NULL, "status" varchar NOT NULL, "employeeId" varchar, "organizationTeamId" varchar, CONSTRAINT "FK_f2cf366f3f08e31784b056df880" FOREIGN KEY ("employeeId") REFERENCES "employee" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_9779a35ef1338bafb7b90714f16" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_ecb357a3764a7344c633a257d76" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`
		);
		await queryRunner.query(
			`INSERT INTO "daily_plan"("deletedAt", "id", "createdAt", "updatedAt", "isActive", "isArchived", "tenantId", "organizationId", "date", "workTimePlanned", "status", "employeeId", "organizationTeamId") SELECT "deletedAt", "id", "createdAt", "updatedAt", "isActive", "isArchived", "tenantId", "organizationId", "date", "workTimePlanned", "status", "employeeId", "organizationTeamId" FROM "temporary_daily_plan"`
		);
		await queryRunner.query(`DROP TABLE "temporary_daily_plan"`);
		await queryRunner.query(
			`CREATE INDEX "IDX_b022c2b684c35dcc63c22850f1" ON "daily_plan" ("organizationTeamId") `
		);
		await queryRunner.query(`CREATE INDEX "IDX_903b08cd4c8025e73316342452" ON "daily_plan" ("isActive") `);
		await queryRunner.query(`CREATE INDEX "IDX_ce5e588780497b05cd6267e20e" ON "daily_plan" ("isArchived") `);
		await queryRunner.query(`CREATE INDEX "IDX_ecb357a3764a7344c633a257d7" ON "daily_plan" ("tenantId") `);
		await queryRunner.query(`CREATE INDEX "IDX_9779a35ef1338bafb7b90714f1" ON "daily_plan" ("organizationId") `);
		await queryRunner.query(`CREATE INDEX "IDX_f2cf366f3f08e31784b056df88" ON "daily_plan" ("employeeId") `);
		await queryRunner.query(`DROP INDEX "IDX_b022c2b684c35dcc63c22850f1"`);
		await queryRunner.query(`DROP INDEX "IDX_903b08cd4c8025e73316342452"`);
		await queryRunner.query(`DROP INDEX "IDX_ce5e588780497b05cd6267e20e"`);
		await queryRunner.query(`DROP INDEX "IDX_ecb357a3764a7344c633a257d7"`);
		await queryRunner.query(`DROP INDEX "IDX_9779a35ef1338bafb7b90714f1"`);
		await queryRunner.query(`DROP INDEX "IDX_f2cf366f3f08e31784b056df88"`);
		await queryRunner.query(`ALTER TABLE "daily_plan" RENAME TO "temporary_daily_plan"`);
		await queryRunner.query(
			`CREATE TABLE "daily_plan" ("deletedAt" datetime, "id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "tenantId" varchar, "organizationId" varchar, "date" datetime NOT NULL, "workTimePlanned" decimal NOT NULL, "status" varchar NOT NULL, "employeeId" varchar, CONSTRAINT "FK_f2cf366f3f08e31784b056df880" FOREIGN KEY ("employeeId") REFERENCES "employee" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_9779a35ef1338bafb7b90714f16" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_ecb357a3764a7344c633a257d76" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`
		);
		await queryRunner.query(
			`INSERT INTO "daily_plan"("deletedAt", "id", "createdAt", "updatedAt", "isActive", "isArchived", "tenantId", "organizationId", "date", "workTimePlanned", "status", "employeeId") SELECT "deletedAt", "id", "createdAt", "updatedAt", "isActive", "isArchived", "tenantId", "organizationId", "date", "workTimePlanned", "status", "employeeId" FROM "temporary_daily_plan"`
		);
		await queryRunner.query(`DROP TABLE "temporary_daily_plan"`);
		await queryRunner.query(`CREATE INDEX "IDX_903b08cd4c8025e73316342452" ON "daily_plan" ("isActive") `);
		await queryRunner.query(`CREATE INDEX "IDX_ce5e588780497b05cd6267e20e" ON "daily_plan" ("isArchived") `);
		await queryRunner.query(`CREATE INDEX "IDX_ecb357a3764a7344c633a257d7" ON "daily_plan" ("tenantId") `);
		await queryRunner.query(`CREATE INDEX "IDX_9779a35ef1338bafb7b90714f1" ON "daily_plan" ("organizationId") `);
		await queryRunner.query(`CREATE INDEX "IDX_f2cf366f3f08e31784b056df88" ON "daily_plan" ("employeeId") `);
	}

	/**
	 * MySQL Up Migration
	 *
	 * @param queryRunner
	 */
	public async mysqlUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(`ALTER TABLE \`daily_plan\` ADD \`organizationTeamId\` varchar(255) NULL`);
		await queryRunner.query(
			`CREATE INDEX \`IDX_b022c2b684c35dcc63c22850f1\` ON \`daily_plan\` (\`organizationTeamId\`)`
		);
		await queryRunner.query(
			`ALTER TABLE \`daily_plan\` ADD CONSTRAINT \`FK_b022c2b684c35dcc63c22850f13\` FOREIGN KEY (\`organizationTeamId\`) REFERENCES \`organization_team\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
	}

	/**
	 * MySQL Down Migration
	 *
	 * @param queryRunner
	 */
	public async mysqlDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(`ALTER TABLE \`daily_plan\` DROP FOREIGN KEY \`FK_b022c2b684c35dcc63c22850f13\``);
		await queryRunner.query(`DROP INDEX \`IDX_b022c2b684c35dcc63c22850f1\` ON \`daily_plan\``);
		await queryRunner.query(`ALTER TABLE \`daily_plan\` DROP COLUMN \`organizationTeamId\``);
	}
}
