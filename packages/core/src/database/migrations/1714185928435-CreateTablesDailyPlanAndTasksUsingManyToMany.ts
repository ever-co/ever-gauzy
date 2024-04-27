import { MigrationInterface, QueryRunner } from 'typeorm';
import { yellow } from 'chalk';
import { DatabaseTypeEnum } from '@gauzy/config';

export class CreateTablesDailyPlanAndTasksUsingManyToMany1714185928435 implements MigrationInterface {
	name = 'CreateTablesDailyPlanAndTasksUsingManyToMany1714185928435';

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
		await queryRunner.query(
			`CREATE TABLE "daily_plan" ("deletedAt" TIMESTAMP, "id" uuid NOT NULL DEFAULT gen_random_uuid(), "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "isActive" boolean DEFAULT true, "isArchived" boolean DEFAULT false, "tenantId" uuid, "organizationId" uuid, "date" TIMESTAMP NOT NULL, "workTimePlanned" TIMESTAMP NOT NULL, "status" character varying NOT NULL, "employeeId" uuid, CONSTRAINT "PK_5a8376283b3afaec53d740b9657" PRIMARY KEY ("id"))`
		);
		await queryRunner.query(`CREATE INDEX "IDX_903b08cd4c8025e73316342452" ON "daily_plan" ("isActive") `);
		await queryRunner.query(`CREATE INDEX "IDX_ce5e588780497b05cd6267e20e" ON "daily_plan" ("isArchived") `);
		await queryRunner.query(`CREATE INDEX "IDX_ecb357a3764a7344c633a257d7" ON "daily_plan" ("tenantId") `);
		await queryRunner.query(`CREATE INDEX "IDX_9779a35ef1338bafb7b90714f1" ON "daily_plan" ("organizationId") `);
		await queryRunner.query(`CREATE INDEX "IDX_f2cf366f3f08e31784b056df88" ON "daily_plan" ("employeeId") `);
		await queryRunner.query(
			`CREATE TABLE "daily_plan_task" ("dailyPlanId" uuid NOT NULL, "taskId" uuid NOT NULL, CONSTRAINT "PK_2111449e8a69dacccd7b4cf3063" PRIMARY KEY ("dailyPlanId", "taskId"))`
		);
		await queryRunner.query(`CREATE INDEX "IDX_44d86eb47db0ffbf7e79bf7ff0" ON "daily_plan_task" ("dailyPlanId") `);
		await queryRunner.query(`CREATE INDEX "IDX_791067c0a03b37ab50578e60d4" ON "daily_plan_task" ("taskId") `);
		await queryRunner.query(
			`ALTER TABLE "daily_plan" ADD CONSTRAINT "FK_ecb357a3764a7344c633a257d76" FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "daily_plan" ADD CONSTRAINT "FK_9779a35ef1338bafb7b90714f16" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE`
		);
		await queryRunner.query(
			`ALTER TABLE "daily_plan" ADD CONSTRAINT "FK_f2cf366f3f08e31784b056df880" FOREIGN KEY ("employeeId") REFERENCES "employee"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "daily_plan_task" ADD CONSTRAINT "FK_44d86eb47db0ffbf7e79bf7ff0d" FOREIGN KEY ("dailyPlanId") REFERENCES "daily_plan"("id") ON DELETE CASCADE ON UPDATE CASCADE`
		);
		await queryRunner.query(
			`ALTER TABLE "daily_plan_task" ADD CONSTRAINT "FK_791067c0a03b37ab50578e60d4d" FOREIGN KEY ("taskId") REFERENCES "task"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
	}

	/**
	 * PostgresDB Down Migration
	 *
	 * @param queryRunner
	 */
	public async postgresDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(`ALTER TABLE "daily_plan_task" DROP CONSTRAINT "FK_791067c0a03b37ab50578e60d4d"`);
		await queryRunner.query(`ALTER TABLE "daily_plan_task" DROP CONSTRAINT "FK_44d86eb47db0ffbf7e79bf7ff0d"`);
		await queryRunner.query(`ALTER TABLE "daily_plan" DROP CONSTRAINT "FK_f2cf366f3f08e31784b056df880"`);
		await queryRunner.query(`ALTER TABLE "daily_plan" DROP CONSTRAINT "FK_9779a35ef1338bafb7b90714f16"`);
		await queryRunner.query(`ALTER TABLE "daily_plan" DROP CONSTRAINT "FK_ecb357a3764a7344c633a257d76"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_791067c0a03b37ab50578e60d4"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_44d86eb47db0ffbf7e79bf7ff0"`);
		await queryRunner.query(`DROP TABLE "daily_plan_task"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_f2cf366f3f08e31784b056df88"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_9779a35ef1338bafb7b90714f1"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_ecb357a3764a7344c633a257d7"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_ce5e588780497b05cd6267e20e"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_903b08cd4c8025e73316342452"`);
		await queryRunner.query(`DROP TABLE "daily_plan"`);
	}

	/**
	 * SqliteDB and BetterSQlite3DB Up Migration
	 *
	 * @param queryRunner
	 */
	public async sqliteUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(
			`CREATE TABLE "daily_plan" ("deletedAt" datetime, "id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "tenantId" varchar, "organizationId" varchar, "date" datetime NOT NULL, "workTimePlanned" datetime NOT NULL, "status" varchar NOT NULL, "employeeId" varchar)`
		);
		await queryRunner.query(`CREATE INDEX "IDX_903b08cd4c8025e73316342452" ON "daily_plan" ("isActive") `);
		await queryRunner.query(`CREATE INDEX "IDX_ce5e588780497b05cd6267e20e" ON "daily_plan" ("isArchived") `);
		await queryRunner.query(`CREATE INDEX "IDX_ecb357a3764a7344c633a257d7" ON "daily_plan" ("tenantId") `);
		await queryRunner.query(`CREATE INDEX "IDX_9779a35ef1338bafb7b90714f1" ON "daily_plan" ("organizationId") `);
		await queryRunner.query(`CREATE INDEX "IDX_f2cf366f3f08e31784b056df88" ON "daily_plan" ("employeeId") `);
		await queryRunner.query(
			`CREATE TABLE "daily_plan_task" ("dailyPlanId" varchar NOT NULL, "taskId" varchar NOT NULL, PRIMARY KEY ("dailyPlanId", "taskId"))`
		);
		await queryRunner.query(`CREATE INDEX "IDX_44d86eb47db0ffbf7e79bf7ff0" ON "daily_plan_task" ("dailyPlanId") `);
		await queryRunner.query(`CREATE INDEX "IDX_791067c0a03b37ab50578e60d4" ON "daily_plan_task" ("taskId") `);
		await queryRunner.query(`DROP INDEX "IDX_903b08cd4c8025e73316342452"`);
		await queryRunner.query(`DROP INDEX "IDX_ce5e588780497b05cd6267e20e"`);
		await queryRunner.query(`DROP INDEX "IDX_ecb357a3764a7344c633a257d7"`);
		await queryRunner.query(`DROP INDEX "IDX_9779a35ef1338bafb7b90714f1"`);
		await queryRunner.query(`DROP INDEX "IDX_f2cf366f3f08e31784b056df88"`);
		await queryRunner.query(
			`CREATE TABLE "temporary_daily_plan" ("deletedAt" datetime, "id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "tenantId" varchar, "organizationId" varchar, "date" datetime NOT NULL, "workTimePlanned" datetime NOT NULL, "status" varchar NOT NULL, "employeeId" varchar, CONSTRAINT "FK_ecb357a3764a7344c633a257d76" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_9779a35ef1338bafb7b90714f16" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_f2cf366f3f08e31784b056df880" FOREIGN KEY ("employeeId") REFERENCES "employee" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`
		);
		await queryRunner.query(
			`INSERT INTO "temporary_daily_plan"("deletedAt", "id", "createdAt", "updatedAt", "isActive", "isArchived", "tenantId", "organizationId", "date", "workTimePlanned", "status", "employeeId") SELECT "deletedAt", "id", "createdAt", "updatedAt", "isActive", "isArchived", "tenantId", "organizationId", "date", "workTimePlanned", "status", "employeeId" FROM "daily_plan"`
		);
		await queryRunner.query(`DROP TABLE "daily_plan"`);
		await queryRunner.query(`ALTER TABLE "temporary_daily_plan" RENAME TO "daily_plan"`);
		await queryRunner.query(`CREATE INDEX "IDX_903b08cd4c8025e73316342452" ON "daily_plan" ("isActive") `);
		await queryRunner.query(`CREATE INDEX "IDX_ce5e588780497b05cd6267e20e" ON "daily_plan" ("isArchived") `);
		await queryRunner.query(`CREATE INDEX "IDX_ecb357a3764a7344c633a257d7" ON "daily_plan" ("tenantId") `);
		await queryRunner.query(`CREATE INDEX "IDX_9779a35ef1338bafb7b90714f1" ON "daily_plan" ("organizationId") `);
		await queryRunner.query(`CREATE INDEX "IDX_f2cf366f3f08e31784b056df88" ON "daily_plan" ("employeeId") `);
		await queryRunner.query(`DROP INDEX "IDX_44d86eb47db0ffbf7e79bf7ff0"`);
		await queryRunner.query(`DROP INDEX "IDX_791067c0a03b37ab50578e60d4"`);
		await queryRunner.query(
			`CREATE TABLE "temporary_daily_plan_task" ("dailyPlanId" varchar NOT NULL, "taskId" varchar NOT NULL, CONSTRAINT "FK_44d86eb47db0ffbf7e79bf7ff0d" FOREIGN KEY ("dailyPlanId") REFERENCES "daily_plan" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_791067c0a03b37ab50578e60d4d" FOREIGN KEY ("taskId") REFERENCES "task" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, PRIMARY KEY ("dailyPlanId", "taskId"))`
		);
		await queryRunner.query(
			`INSERT INTO "temporary_daily_plan_task"("dailyPlanId", "taskId") SELECT "dailyPlanId", "taskId" FROM "daily_plan_task"`
		);
		await queryRunner.query(`DROP TABLE "daily_plan_task"`);
		await queryRunner.query(`ALTER TABLE "temporary_daily_plan_task" RENAME TO "daily_plan_task"`);
		await queryRunner.query(`CREATE INDEX "IDX_44d86eb47db0ffbf7e79bf7ff0" ON "daily_plan_task" ("dailyPlanId") `);
		await queryRunner.query(`CREATE INDEX "IDX_791067c0a03b37ab50578e60d4" ON "daily_plan_task" ("taskId") `);
	}

	/**
	 * SqliteDB and BetterSQlite3DB Down Migration
	 *
	 * @param queryRunner
	 */
	public async sqliteDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(`DROP INDEX "IDX_791067c0a03b37ab50578e60d4"`);
		await queryRunner.query(`DROP INDEX "IDX_44d86eb47db0ffbf7e79bf7ff0"`);
		await queryRunner.query(`ALTER TABLE "daily_plan_task" RENAME TO "temporary_daily_plan_task"`);
		await queryRunner.query(
			`CREATE TABLE "daily_plan_task" ("dailyPlanId" varchar NOT NULL, "taskId" varchar NOT NULL, PRIMARY KEY ("dailyPlanId", "taskId"))`
		);
		await queryRunner.query(
			`INSERT INTO "daily_plan_task"("dailyPlanId", "taskId") SELECT "dailyPlanId", "taskId" FROM "temporary_daily_plan_task"`
		);
		await queryRunner.query(`DROP TABLE "temporary_daily_plan_task"`);
		await queryRunner.query(`CREATE INDEX "IDX_791067c0a03b37ab50578e60d4" ON "daily_plan_task" ("taskId") `);
		await queryRunner.query(`CREATE INDEX "IDX_44d86eb47db0ffbf7e79bf7ff0" ON "daily_plan_task" ("dailyPlanId") `);
		await queryRunner.query(`DROP INDEX "IDX_f2cf366f3f08e31784b056df88"`);
		await queryRunner.query(`DROP INDEX "IDX_9779a35ef1338bafb7b90714f1"`);
		await queryRunner.query(`DROP INDEX "IDX_ecb357a3764a7344c633a257d7"`);
		await queryRunner.query(`DROP INDEX "IDX_ce5e588780497b05cd6267e20e"`);
		await queryRunner.query(`DROP INDEX "IDX_903b08cd4c8025e73316342452"`);
		await queryRunner.query(`ALTER TABLE "daily_plan" RENAME TO "temporary_daily_plan"`);
		await queryRunner.query(
			`CREATE TABLE "daily_plan" ("deletedAt" datetime, "id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "tenantId" varchar, "organizationId" varchar, "date" datetime NOT NULL, "workTimePlanned" datetime NOT NULL, "status" varchar NOT NULL, "employeeId" varchar)`
		);
		await queryRunner.query(
			`INSERT INTO "daily_plan"("deletedAt", "id", "createdAt", "updatedAt", "isActive", "isArchived", "tenantId", "organizationId", "date", "workTimePlanned", "status", "employeeId") SELECT "deletedAt", "id", "createdAt", "updatedAt", "isActive", "isArchived", "tenantId", "organizationId", "date", "workTimePlanned", "status", "employeeId" FROM "temporary_daily_plan"`
		);
		await queryRunner.query(`DROP TABLE "temporary_daily_plan"`);
		await queryRunner.query(`CREATE INDEX "IDX_f2cf366f3f08e31784b056df88" ON "daily_plan" ("employeeId") `);
		await queryRunner.query(`CREATE INDEX "IDX_9779a35ef1338bafb7b90714f1" ON "daily_plan" ("organizationId") `);
		await queryRunner.query(`CREATE INDEX "IDX_ecb357a3764a7344c633a257d7" ON "daily_plan" ("tenantId") `);
		await queryRunner.query(`CREATE INDEX "IDX_ce5e588780497b05cd6267e20e" ON "daily_plan" ("isArchived") `);
		await queryRunner.query(`CREATE INDEX "IDX_903b08cd4c8025e73316342452" ON "daily_plan" ("isActive") `);
		await queryRunner.query(`DROP INDEX "IDX_791067c0a03b37ab50578e60d4"`);
		await queryRunner.query(`DROP INDEX "IDX_44d86eb47db0ffbf7e79bf7ff0"`);
		await queryRunner.query(`DROP TABLE "daily_plan_task"`);
		await queryRunner.query(`DROP INDEX "IDX_f2cf366f3f08e31784b056df88"`);
		await queryRunner.query(`DROP INDEX "IDX_9779a35ef1338bafb7b90714f1"`);
		await queryRunner.query(`DROP INDEX "IDX_ecb357a3764a7344c633a257d7"`);
		await queryRunner.query(`DROP INDEX "IDX_ce5e588780497b05cd6267e20e"`);
		await queryRunner.query(`DROP INDEX "IDX_903b08cd4c8025e73316342452"`);
		await queryRunner.query(`DROP TABLE "daily_plan"`);
	}

	/**
	 * MySQL Up Migration
	 *
	 * @param queryRunner
	 */
	public async mysqlUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(
			`CREATE TABLE \`daily_plan\` (\`deletedAt\` datetime(6) NULL, \`id\` varchar(36) NOT NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`isActive\` tinyint NULL DEFAULT 1, \`isArchived\` tinyint NULL DEFAULT 0, \`tenantId\` varchar(255) NULL, \`organizationId\` varchar(255) NULL, \`date\` datetime NOT NULL, \`workTimePlanned\` datetime NOT NULL, \`status\` varchar(255) NOT NULL, \`employeeId\` varchar(255) NULL, INDEX \`IDX_903b08cd4c8025e73316342452\` (\`isActive\`), INDEX \`IDX_ce5e588780497b05cd6267e20e\` (\`isArchived\`), INDEX \`IDX_ecb357a3764a7344c633a257d7\` (\`tenantId\`), INDEX \`IDX_9779a35ef1338bafb7b90714f1\` (\`organizationId\`), INDEX \`IDX_f2cf366f3f08e31784b056df88\` (\`employeeId\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`
		);
		await queryRunner.query(
			`CREATE TABLE \`daily_plan_task\` (\`dailyPlanId\` varchar(36) NOT NULL, \`taskId\` varchar(36) NOT NULL, INDEX \`IDX_44d86eb47db0ffbf7e79bf7ff0\` (\`dailyPlanId\`), INDEX \`IDX_791067c0a03b37ab50578e60d4\` (\`taskId\`), PRIMARY KEY (\`dailyPlanId\`, \`taskId\`)) ENGINE=InnoDB`
		);
		await queryRunner.query(
			`ALTER TABLE \`daily_plan\` ADD CONSTRAINT \`FK_ecb357a3764a7344c633a257d76\` FOREIGN KEY (\`tenantId\`) REFERENCES \`tenant\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`daily_plan\` ADD CONSTRAINT \`FK_9779a35ef1338bafb7b90714f16\` FOREIGN KEY (\`organizationId\`) REFERENCES \`organization\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`
		);
		await queryRunner.query(
			`ALTER TABLE \`daily_plan\` ADD CONSTRAINT \`FK_f2cf366f3f08e31784b056df880\` FOREIGN KEY (\`employeeId\`) REFERENCES \`employee\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`daily_plan_task\` ADD CONSTRAINT \`FK_44d86eb47db0ffbf7e79bf7ff0d\` FOREIGN KEY (\`dailyPlanId\`) REFERENCES \`daily_plan\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`
		);
		await queryRunner.query(
			`ALTER TABLE \`daily_plan_task\` ADD CONSTRAINT \`FK_791067c0a03b37ab50578e60d4d\` FOREIGN KEY (\`taskId\`) REFERENCES \`task\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
	}

	/**
	 * MySQL Down Migration
	 *
	 * @param queryRunner
	 */
	public async mysqlDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(`ALTER TABLE \`daily_plan_task\` DROP FOREIGN KEY \`FK_791067c0a03b37ab50578e60d4d\``);
		await queryRunner.query(`ALTER TABLE \`daily_plan_task\` DROP FOREIGN KEY \`FK_44d86eb47db0ffbf7e79bf7ff0d\``);
		await queryRunner.query(`ALTER TABLE \`daily_plan\` DROP FOREIGN KEY \`FK_f2cf366f3f08e31784b056df880\``);
		await queryRunner.query(`ALTER TABLE \`daily_plan\` DROP FOREIGN KEY \`FK_9779a35ef1338bafb7b90714f16\``);
		await queryRunner.query(`ALTER TABLE \`daily_plan\` DROP FOREIGN KEY \`FK_ecb357a3764a7344c633a257d76\``);
		await queryRunner.query(`DROP INDEX \`IDX_791067c0a03b37ab50578e60d4\` ON \`daily_plan_task\``);
		await queryRunner.query(`DROP INDEX \`IDX_44d86eb47db0ffbf7e79bf7ff0\` ON \`daily_plan_task\``);
		await queryRunner.query(`DROP TABLE \`daily_plan_task\``);
		await queryRunner.query(`DROP INDEX \`IDX_f2cf366f3f08e31784b056df88\` ON \`daily_plan\``);
		await queryRunner.query(`DROP INDEX \`IDX_9779a35ef1338bafb7b90714f1\` ON \`daily_plan\``);
		await queryRunner.query(`DROP INDEX \`IDX_ecb357a3764a7344c633a257d7\` ON \`daily_plan\``);
		await queryRunner.query(`DROP INDEX \`IDX_ce5e588780497b05cd6267e20e\` ON \`daily_plan\``);
		await queryRunner.query(`DROP INDEX \`IDX_903b08cd4c8025e73316342452\` ON \`daily_plan\``);
		await queryRunner.query(`DROP TABLE \`daily_plan\``);
	}
}
