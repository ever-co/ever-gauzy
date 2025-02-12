import { MigrationInterface, QueryRunner } from 'typeorm';
import * as chalk from 'chalk';
import { DatabaseTypeEnum } from '@gauzy/config';

export class CreateEmployeeNotificationSettingTable1739273982991 implements MigrationInterface {
	name = 'CreateEmployeeNotificationSettingTable1739273982991';

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
			`CREATE TABLE "employee_notification_setting" ("deletedAt" TIMESTAMP, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "id" uuid NOT NULL DEFAULT gen_random_uuid(), "isActive" boolean DEFAULT true, "isArchived" boolean DEFAULT false, "archivedAt" TIMESTAMP, "tenantId" uuid, "organizationId" uuid, "payment" boolean NOT NULL DEFAULT true, "assignment" boolean NOT NULL DEFAULT true, "invitation" boolean NOT NULL DEFAULT true, "mention" boolean NOT NULL DEFAULT true, "comment" boolean NOT NULL DEFAULT true, "message" boolean NOT NULL DEFAULT true, "preferences" jsonb NOT NULL, "employeeId" uuid NOT NULL, CONSTRAINT "REL_4fe2b61315f7034a9de405aa1b" UNIQUE ("employeeId"), CONSTRAINT "PK_f1c4b730827d02d840d73611aa0" PRIMARY KEY ("id"))`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_56243ec0570e91d31bf22de5c5" ON "employee_notification_setting" ("isActive") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_a049d2a4675e734150d673cd74" ON "employee_notification_setting" ("isArchived") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_e195cdea7b9fe76e6386423733" ON "employee_notification_setting" ("tenantId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_7d3cf931870375d4dafd20efb4" ON "employee_notification_setting" ("organizationId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_4fe2b61315f7034a9de405aa1b" ON "employee_notification_setting" ("employeeId") `
		);
		await queryRunner.query(
			`ALTER TABLE "employee_notification_setting" ADD CONSTRAINT "FK_e195cdea7b9fe76e63864237333" FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "employee_notification_setting" ADD CONSTRAINT "FK_7d3cf931870375d4dafd20efb42" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE`
		);
		await queryRunner.query(
			`ALTER TABLE "employee_notification_setting" ADD CONSTRAINT "FK_4fe2b61315f7034a9de405aa1b9" FOREIGN KEY ("employeeId") REFERENCES "employee"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
	}

	/**
	 * PostgresDB Down Migration
	 *
	 * @param queryRunner
	 */
	public async postgresDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(
			`ALTER TABLE "employee_notification_setting" DROP CONSTRAINT "FK_4fe2b61315f7034a9de405aa1b9"`
		);
		await queryRunner.query(
			`ALTER TABLE "employee_notification_setting" DROP CONSTRAINT "FK_7d3cf931870375d4dafd20efb42"`
		);
		await queryRunner.query(
			`ALTER TABLE "employee_notification_setting" DROP CONSTRAINT "FK_e195cdea7b9fe76e63864237333"`
		);
		await queryRunner.query(`DROP INDEX "public"."IDX_4fe2b61315f7034a9de405aa1b"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_7d3cf931870375d4dafd20efb4"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_e195cdea7b9fe76e6386423733"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_a049d2a4675e734150d673cd74"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_56243ec0570e91d31bf22de5c5"`);
		await queryRunner.query(`DROP TABLE "employee_notification_setting"`);
	}

	/**
	 * SqliteDB and BetterSQlite3DB Up Migration
	 *
	 * @param queryRunner
	 */
	public async sqliteUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(
			`CREATE TABLE "employee_notification_setting" ("deletedAt" datetime, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "id" varchar PRIMARY KEY NOT NULL, "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "tenantId" varchar, "organizationId" varchar, "payment" boolean NOT NULL DEFAULT (1), "assignment" boolean NOT NULL DEFAULT (1), "invitation" boolean NOT NULL DEFAULT (1), "mention" boolean NOT NULL DEFAULT (1), "comment" boolean NOT NULL DEFAULT (1), "message" boolean NOT NULL DEFAULT (1), "preferences" text NOT NULL, "employeeId" varchar NOT NULL, CONSTRAINT "REL_4fe2b61315f7034a9de405aa1b" UNIQUE ("employeeId"))`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_56243ec0570e91d31bf22de5c5" ON "employee_notification_setting" ("isActive") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_a049d2a4675e734150d673cd74" ON "employee_notification_setting" ("isArchived") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_e195cdea7b9fe76e6386423733" ON "employee_notification_setting" ("tenantId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_7d3cf931870375d4dafd20efb4" ON "employee_notification_setting" ("organizationId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_4fe2b61315f7034a9de405aa1b" ON "employee_notification_setting" ("employeeId") `
		);
		await queryRunner.query(`DROP INDEX "IDX_56243ec0570e91d31bf22de5c5"`);
		await queryRunner.query(`DROP INDEX "IDX_a049d2a4675e734150d673cd74"`);
		await queryRunner.query(`DROP INDEX "IDX_e195cdea7b9fe76e6386423733"`);
		await queryRunner.query(`DROP INDEX "IDX_7d3cf931870375d4dafd20efb4"`);
		await queryRunner.query(`DROP INDEX "IDX_4fe2b61315f7034a9de405aa1b"`);
		await queryRunner.query(
			`CREATE TABLE "temporary_employee_notification_setting" ("deletedAt" datetime, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "id" varchar PRIMARY KEY NOT NULL, "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "tenantId" varchar, "organizationId" varchar, "payment" boolean NOT NULL DEFAULT (1), "assignment" boolean NOT NULL DEFAULT (1), "invitation" boolean NOT NULL DEFAULT (1), "mention" boolean NOT NULL DEFAULT (1), "comment" boolean NOT NULL DEFAULT (1), "message" boolean NOT NULL DEFAULT (1), "preferences" text NOT NULL, "employeeId" varchar NOT NULL, CONSTRAINT "REL_4fe2b61315f7034a9de405aa1b" UNIQUE ("employeeId"), CONSTRAINT "FK_e195cdea7b9fe76e63864237333" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_7d3cf931870375d4dafd20efb42" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_4fe2b61315f7034a9de405aa1b9" FOREIGN KEY ("employeeId") REFERENCES "employee" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`
		);
		await queryRunner.query(
			`INSERT INTO "temporary_employee_notification_setting"("deletedAt", "createdAt", "updatedAt", "id", "isActive", "isArchived", "archivedAt", "tenantId", "organizationId", "payment", "assignment", "invitation", "mention", "comment", "message", "preferences", "employeeId") SELECT "deletedAt", "createdAt", "updatedAt", "id", "isActive", "isArchived", "archivedAt", "tenantId", "organizationId", "payment", "assignment", "invitation", "mention", "comment", "message", "preferences", "employeeId" FROM "employee_notification_setting"`
		);
		await queryRunner.query(`DROP TABLE "employee_notification_setting"`);
		await queryRunner.query(
			`ALTER TABLE "temporary_employee_notification_setting" RENAME TO "employee_notification_setting"`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_56243ec0570e91d31bf22de5c5" ON "employee_notification_setting" ("isActive") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_a049d2a4675e734150d673cd74" ON "employee_notification_setting" ("isArchived") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_e195cdea7b9fe76e6386423733" ON "employee_notification_setting" ("tenantId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_7d3cf931870375d4dafd20efb4" ON "employee_notification_setting" ("organizationId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_4fe2b61315f7034a9de405aa1b" ON "employee_notification_setting" ("employeeId") `
		);
	}

	/**
	 * SqliteDB and BetterSQlite3DB Down Migration
	 *
	 * @param queryRunner
	 */
	public async sqliteDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(`DROP INDEX "IDX_4fe2b61315f7034a9de405aa1b"`);
		await queryRunner.query(`DROP INDEX "IDX_7d3cf931870375d4dafd20efb4"`);
		await queryRunner.query(`DROP INDEX "IDX_e195cdea7b9fe76e6386423733"`);
		await queryRunner.query(`DROP INDEX "IDX_a049d2a4675e734150d673cd74"`);
		await queryRunner.query(`DROP INDEX "IDX_56243ec0570e91d31bf22de5c5"`);
		await queryRunner.query(
			`ALTER TABLE "employee_notification_setting" RENAME TO "temporary_employee_notification_setting"`
		);
		await queryRunner.query(
			`CREATE TABLE "employee_notification_setting" ("deletedAt" datetime, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "id" varchar PRIMARY KEY NOT NULL, "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "tenantId" varchar, "organizationId" varchar, "payment" boolean NOT NULL DEFAULT (1), "assignment" boolean NOT NULL DEFAULT (1), "invitation" boolean NOT NULL DEFAULT (1), "mention" boolean NOT NULL DEFAULT (1), "comment" boolean NOT NULL DEFAULT (1), "message" boolean NOT NULL DEFAULT (1), "preferences" text NOT NULL, "employeeId" varchar NOT NULL, CONSTRAINT "REL_4fe2b61315f7034a9de405aa1b" UNIQUE ("employeeId"))`
		);
		await queryRunner.query(
			`INSERT INTO "employee_notification_setting"("deletedAt", "createdAt", "updatedAt", "id", "isActive", "isArchived", "archivedAt", "tenantId", "organizationId", "payment", "assignment", "invitation", "mention", "comment", "message", "preferences", "employeeId") SELECT "deletedAt", "createdAt", "updatedAt", "id", "isActive", "isArchived", "archivedAt", "tenantId", "organizationId", "payment", "assignment", "invitation", "mention", "comment", "message", "preferences", "employeeId" FROM "temporary_employee_notification_setting"`
		);
		await queryRunner.query(`DROP TABLE "temporary_employee_notification_setting"`);
		await queryRunner.query(
			`CREATE INDEX "IDX_4fe2b61315f7034a9de405aa1b" ON "employee_notification_setting" ("employeeId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_7d3cf931870375d4dafd20efb4" ON "employee_notification_setting" ("organizationId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_e195cdea7b9fe76e6386423733" ON "employee_notification_setting" ("tenantId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_a049d2a4675e734150d673cd74" ON "employee_notification_setting" ("isArchived") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_56243ec0570e91d31bf22de5c5" ON "employee_notification_setting" ("isActive") `
		);
		await queryRunner.query(`DROP INDEX "IDX_4fe2b61315f7034a9de405aa1b"`);
		await queryRunner.query(`DROP INDEX "IDX_7d3cf931870375d4dafd20efb4"`);
		await queryRunner.query(`DROP INDEX "IDX_e195cdea7b9fe76e6386423733"`);
		await queryRunner.query(`DROP INDEX "IDX_a049d2a4675e734150d673cd74"`);
		await queryRunner.query(`DROP INDEX "IDX_56243ec0570e91d31bf22de5c5"`);
		await queryRunner.query(`DROP TABLE "employee_notification_setting"`);
	}

	/**
	 * MySQL Up Migration
	 *
	 * @param queryRunner
	 */
	public async mysqlUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(
			`CREATE TABLE \`employee_notification_setting\` (\`deletedAt\` datetime(6) NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`id\` varchar(36) NOT NULL, \`isActive\` tinyint NULL DEFAULT 1, \`isArchived\` tinyint NULL DEFAULT 0, \`archivedAt\` datetime NULL, \`tenantId\` varchar(255) NULL, \`organizationId\` varchar(255) NULL, \`payment\` tinyint NOT NULL DEFAULT 1, \`assignment\` tinyint NOT NULL DEFAULT 1, \`invitation\` tinyint NOT NULL DEFAULT 1, \`mention\` tinyint NOT NULL DEFAULT 1, \`comment\` tinyint NOT NULL DEFAULT 1, \`message\` tinyint NOT NULL DEFAULT 1, \`preferences\` json NOT NULL, \`employeeId\` varchar(255) NOT NULL, INDEX \`IDX_56243ec0570e91d31bf22de5c5\` (\`isActive\`), INDEX \`IDX_a049d2a4675e734150d673cd74\` (\`isArchived\`), INDEX \`IDX_e195cdea7b9fe76e6386423733\` (\`tenantId\`), INDEX \`IDX_7d3cf931870375d4dafd20efb4\` (\`organizationId\`), INDEX \`IDX_4fe2b61315f7034a9de405aa1b\` (\`employeeId\`), UNIQUE INDEX \`REL_4fe2b61315f7034a9de405aa1b\` (\`employeeId\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`
		);
		await queryRunner.query(
			`ALTER TABLE \`employee_notification_setting\` ADD CONSTRAINT \`FK_e195cdea7b9fe76e63864237333\` FOREIGN KEY (\`tenantId\`) REFERENCES \`tenant\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`employee_notification_setting\` ADD CONSTRAINT \`FK_7d3cf931870375d4dafd20efb42\` FOREIGN KEY (\`organizationId\`) REFERENCES \`organization\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`
		);
		await queryRunner.query(
			`ALTER TABLE \`employee_notification_setting\` ADD CONSTRAINT \`FK_4fe2b61315f7034a9de405aa1b9\` FOREIGN KEY (\`employeeId\`) REFERENCES \`employee\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
	}

	/**
	 * MySQL Down Migration
	 *
	 * @param queryRunner
	 */
	public async mysqlDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(
			`ALTER TABLE \`employee_notification_setting\` DROP FOREIGN KEY \`FK_4fe2b61315f7034a9de405aa1b9\``
		);
		await queryRunner.query(
			`ALTER TABLE \`employee_notification_setting\` DROP FOREIGN KEY \`FK_7d3cf931870375d4dafd20efb42\``
		);
		await queryRunner.query(
			`ALTER TABLE \`employee_notification_setting\` DROP FOREIGN KEY \`FK_e195cdea7b9fe76e63864237333\``
		);
		await queryRunner.query(`DROP INDEX \`REL_4fe2b61315f7034a9de405aa1b\` ON \`employee_notification_setting\``);
		await queryRunner.query(`DROP INDEX \`IDX_4fe2b61315f7034a9de405aa1b\` ON \`employee_notification_setting\``);
		await queryRunner.query(`DROP INDEX \`IDX_7d3cf931870375d4dafd20efb4\` ON \`employee_notification_setting\``);
		await queryRunner.query(`DROP INDEX \`IDX_e195cdea7b9fe76e6386423733\` ON \`employee_notification_setting\``);
		await queryRunner.query(`DROP INDEX \`IDX_a049d2a4675e734150d673cd74\` ON \`employee_notification_setting\``);
		await queryRunner.query(`DROP INDEX \`IDX_56243ec0570e91d31bf22de5c5\` ON \`employee_notification_setting\``);
		await queryRunner.query(`DROP TABLE \`employee_notification_setting\``);
	}
}
