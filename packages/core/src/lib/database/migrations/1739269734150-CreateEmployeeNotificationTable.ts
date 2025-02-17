import { MigrationInterface, QueryRunner } from 'typeorm';
import * as chalk from 'chalk';
import { DatabaseTypeEnum } from '@gauzy/config';

export class CreateEmployeeNotificationTable1739269734150 implements MigrationInterface {
	name = 'CreateEmployeeNotificationTable1739269734150';

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
			`CREATE TABLE "employee_notification" ("deletedAt" TIMESTAMP, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "id" uuid NOT NULL DEFAULT gen_random_uuid(), "isActive" boolean DEFAULT true, "isArchived" boolean DEFAULT false, "archivedAt" TIMESTAMP, "tenantId" uuid, "organizationId" uuid, "entity" character varying NOT NULL, "entityId" character varying NOT NULL, "title" character varying, "message" character varying, "type" integer, "isRead" boolean NOT NULL DEFAULT false, "readAt" TIMESTAMP, "onHoldUntil" TIMESTAMP, "sentById" uuid, "receiverId" uuid, CONSTRAINT "PK_4123ffa3739c135a12cea285964" PRIMARY KEY ("id"))`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_d966bfd3404cbb285ac27f10da" ON "employee_notification" ("isActive") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_8b7d5e4ea44334201702b94439" ON "employee_notification" ("isArchived") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_6f82155f53ac73b468200ee995" ON "employee_notification" ("tenantId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_a7740fc0a794549142743373f7" ON "employee_notification" ("organizationId") `
		);
		await queryRunner.query(`CREATE INDEX "IDX_d7df050beb5ed8c5b72243c1f5" ON "employee_notification" ("entity") `);
		await queryRunner.query(
			`CREATE INDEX "IDX_8ca39a79d0dfd72bb8b9c9b0da" ON "employee_notification" ("entityId") `
		);
		await queryRunner.query(`CREATE INDEX "IDX_72b91233f9b7e95df7ab0dc12c" ON "employee_notification" ("type") `);
		await queryRunner.query(
			`CREATE INDEX "IDX_84554498767210c8b960dc2c7b" ON "employee_notification" ("sentById") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_da490fa82625eb794ec5336fbd" ON "employee_notification" ("receiverId") `
		);
		await queryRunner.query(
			`ALTER TABLE "employee_notification" ADD CONSTRAINT "FK_6f82155f53ac73b468200ee995b" FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "employee_notification" ADD CONSTRAINT "FK_a7740fc0a794549142743373f7c" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE`
		);
		await queryRunner.query(
			`ALTER TABLE "employee_notification" ADD CONSTRAINT "FK_84554498767210c8b960dc2c7b5" FOREIGN KEY ("sentById") REFERENCES "employee"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "employee_notification" ADD CONSTRAINT "FK_da490fa82625eb794ec5336fbd5" FOREIGN KEY ("receiverId") REFERENCES "employee"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
	}

	/**
	 * PostgresDB Down Migration
	 *
	 * @param queryRunner
	 */
	public async postgresDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(`ALTER TABLE "employee_notification" DROP CONSTRAINT "FK_da490fa82625eb794ec5336fbd5"`);
		await queryRunner.query(`ALTER TABLE "employee_notification" DROP CONSTRAINT "FK_84554498767210c8b960dc2c7b5"`);
		await queryRunner.query(`ALTER TABLE "employee_notification" DROP CONSTRAINT "FK_a7740fc0a794549142743373f7c"`);
		await queryRunner.query(`ALTER TABLE "employee_notification" DROP CONSTRAINT "FK_6f82155f53ac73b468200ee995b"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_da490fa82625eb794ec5336fbd"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_84554498767210c8b960dc2c7b"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_72b91233f9b7e95df7ab0dc12c"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_8ca39a79d0dfd72bb8b9c9b0da"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_d7df050beb5ed8c5b72243c1f5"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_a7740fc0a794549142743373f7"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_6f82155f53ac73b468200ee995"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_8b7d5e4ea44334201702b94439"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_d966bfd3404cbb285ac27f10da"`);
		await queryRunner.query(`DROP TABLE "employee_notification"`);
	}

	/**
	 * SqliteDB and BetterSQlite3DB Up Migration
	 *
	 * @param queryRunner
	 */
	public async sqliteUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(
			`CREATE TABLE "employee_notification" ("deletedAt" datetime, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "id" varchar PRIMARY KEY NOT NULL, "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "tenantId" varchar, "organizationId" varchar, "entity" varchar NOT NULL, "entityId" varchar NOT NULL, "title" varchar, "message" varchar, "type" integer, "isRead" boolean NOT NULL DEFAULT (0), "readAt" datetime, "onHoldUntil" datetime, "sentById" varchar, "receiverId" varchar)`
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_d966bfd3404cbb285ac27f10da" ON "employee_notification" ("isActive") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_8b7d5e4ea44334201702b94439" ON "employee_notification" ("isArchived") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_6f82155f53ac73b468200ee995" ON "employee_notification" ("tenantId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_a7740fc0a794549142743373f7" ON "employee_notification" ("organizationId") `
		);
		await queryRunner.query(`CREATE INDEX "IDX_d7df050beb5ed8c5b72243c1f5" ON "employee_notification" ("entity") `);
		await queryRunner.query(
			`CREATE INDEX "IDX_8ca39a79d0dfd72bb8b9c9b0da" ON "employee_notification" ("entityId") `
		);
		await queryRunner.query(`CREATE INDEX "IDX_72b91233f9b7e95df7ab0dc12c" ON "employee_notification" ("type") `);
		await queryRunner.query(
			`CREATE INDEX "IDX_84554498767210c8b960dc2c7b" ON "employee_notification" ("sentById") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_da490fa82625eb794ec5336fbd" ON "employee_notification" ("receiverId") `
		);
		await queryRunner.query(`DROP INDEX "IDX_d966bfd3404cbb285ac27f10da"`);
		await queryRunner.query(`DROP INDEX "IDX_8b7d5e4ea44334201702b94439"`);
		await queryRunner.query(`DROP INDEX "IDX_6f82155f53ac73b468200ee995"`);
		await queryRunner.query(`DROP INDEX "IDX_a7740fc0a794549142743373f7"`);
		await queryRunner.query(`DROP INDEX "IDX_d7df050beb5ed8c5b72243c1f5"`);
		await queryRunner.query(`DROP INDEX "IDX_8ca39a79d0dfd72bb8b9c9b0da"`);
		await queryRunner.query(`DROP INDEX "IDX_72b91233f9b7e95df7ab0dc12c"`);
		await queryRunner.query(`DROP INDEX "IDX_84554498767210c8b960dc2c7b"`);
		await queryRunner.query(`DROP INDEX "IDX_da490fa82625eb794ec5336fbd"`);
		await queryRunner.query(
			`CREATE TABLE "temporary_employee_notification" ("deletedAt" datetime, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "id" varchar PRIMARY KEY NOT NULL, "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "tenantId" varchar, "organizationId" varchar, "entity" varchar NOT NULL, "entityId" varchar NOT NULL, "title" varchar, "message" varchar, "type" integer, "isRead" boolean NOT NULL DEFAULT (0), "readAt" datetime, "onHoldUntil" datetime, "sentById" varchar, "receiverId" varchar, CONSTRAINT "FK_6f82155f53ac73b468200ee995b" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_a7740fc0a794549142743373f7c" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_84554498767210c8b960dc2c7b5" FOREIGN KEY ("sentById") REFERENCES "employee" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_da490fa82625eb794ec5336fbd5" FOREIGN KEY ("receiverId") REFERENCES "employee" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`
		);
		await queryRunner.query(
			`INSERT INTO "temporary_employee_notification"("deletedAt", "createdAt", "updatedAt", "id", "isActive", "isArchived", "archivedAt", "tenantId", "organizationId", "entity", "entityId", "title", "message", "type", "isRead", "readAt", "onHoldUntil", "sentById", "receiverId") SELECT "deletedAt", "createdAt", "updatedAt", "id", "isActive", "isArchived", "archivedAt", "tenantId", "organizationId", "entity", "entityId", "title", "message", "type", "isRead", "readAt", "onHoldUntil", "sentById", "receiverId" FROM "employee_notification"`
		);
		await queryRunner.query(`DROP TABLE "employee_notification"`);
		await queryRunner.query(`ALTER TABLE "temporary_employee_notification" RENAME TO "employee_notification"`);
		await queryRunner.query(
			`CREATE INDEX "IDX_d966bfd3404cbb285ac27f10da" ON "employee_notification" ("isActive") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_8b7d5e4ea44334201702b94439" ON "employee_notification" ("isArchived") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_6f82155f53ac73b468200ee995" ON "employee_notification" ("tenantId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_a7740fc0a794549142743373f7" ON "employee_notification" ("organizationId") `
		);
		await queryRunner.query(`CREATE INDEX "IDX_d7df050beb5ed8c5b72243c1f5" ON "employee_notification" ("entity") `);
		await queryRunner.query(
			`CREATE INDEX "IDX_8ca39a79d0dfd72bb8b9c9b0da" ON "employee_notification" ("entityId") `
		);
		await queryRunner.query(`CREATE INDEX "IDX_72b91233f9b7e95df7ab0dc12c" ON "employee_notification" ("type") `);
		await queryRunner.query(
			`CREATE INDEX "IDX_84554498767210c8b960dc2c7b" ON "employee_notification" ("sentById") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_da490fa82625eb794ec5336fbd" ON "employee_notification" ("receiverId") `
		);
	}

	/**
	 * SqliteDB and BetterSQlite3DB Down Migration
	 *
	 * @param queryRunner
	 */
	public async sqliteDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(`DROP INDEX "IDX_da490fa82625eb794ec5336fbd"`);
		await queryRunner.query(`DROP INDEX "IDX_84554498767210c8b960dc2c7b"`);
		await queryRunner.query(`DROP INDEX "IDX_72b91233f9b7e95df7ab0dc12c"`);
		await queryRunner.query(`DROP INDEX "IDX_8ca39a79d0dfd72bb8b9c9b0da"`);
		await queryRunner.query(`DROP INDEX "IDX_d7df050beb5ed8c5b72243c1f5"`);
		await queryRunner.query(`DROP INDEX "IDX_a7740fc0a794549142743373f7"`);
		await queryRunner.query(`DROP INDEX "IDX_6f82155f53ac73b468200ee995"`);
		await queryRunner.query(`DROP INDEX "IDX_8b7d5e4ea44334201702b94439"`);
		await queryRunner.query(`DROP INDEX "IDX_d966bfd3404cbb285ac27f10da"`);
		await queryRunner.query(`ALTER TABLE "employee_notification" RENAME TO "temporary_employee_notification"`);
		await queryRunner.query(
			`CREATE TABLE "employee_notification" ("deletedAt" datetime, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "id" varchar PRIMARY KEY NOT NULL, "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "tenantId" varchar, "organizationId" varchar, "entity" varchar NOT NULL, "entityId" varchar NOT NULL, "title" varchar, "message" varchar, "type" integer, "isRead" boolean NOT NULL DEFAULT (0), "readAt" datetime, "onHoldUntil" datetime, "sentById" varchar, "receiverId" varchar)`
		);
		await queryRunner.query(
			`INSERT INTO "employee_notification"("deletedAt", "createdAt", "updatedAt", "id", "isActive", "isArchived", "archivedAt", "tenantId", "organizationId", "entity", "entityId", "title", "message", "type", "isRead", "readAt", "onHoldUntil", "sentById", "receiverId") SELECT "deletedAt", "createdAt", "updatedAt", "id", "isActive", "isArchived", "archivedAt", "tenantId", "organizationId", "entity", "entityId", "title", "message", "type", "isRead", "readAt", "onHoldUntil", "sentById", "receiverId" FROM "temporary_employee_notification"`
		);
		await queryRunner.query(`DROP TABLE "temporary_employee_notification"`);
		await queryRunner.query(
			`CREATE INDEX "IDX_da490fa82625eb794ec5336fbd" ON "employee_notification" ("receiverId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_84554498767210c8b960dc2c7b" ON "employee_notification" ("sentById") `
		);
		await queryRunner.query(`CREATE INDEX "IDX_72b91233f9b7e95df7ab0dc12c" ON "employee_notification" ("type") `);
		await queryRunner.query(
			`CREATE INDEX "IDX_8ca39a79d0dfd72bb8b9c9b0da" ON "employee_notification" ("entityId") `
		);
		await queryRunner.query(`CREATE INDEX "IDX_d7df050beb5ed8c5b72243c1f5" ON "employee_notification" ("entity") `);
		await queryRunner.query(
			`CREATE INDEX "IDX_a7740fc0a794549142743373f7" ON "employee_notification" ("organizationId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_6f82155f53ac73b468200ee995" ON "employee_notification" ("tenantId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_8b7d5e4ea44334201702b94439" ON "employee_notification" ("isArchived") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_d966bfd3404cbb285ac27f10da" ON "employee_notification" ("isActive") `
		);
		await queryRunner.query(`DROP INDEX "IDX_da490fa82625eb794ec5336fbd"`);
		await queryRunner.query(`DROP INDEX "IDX_84554498767210c8b960dc2c7b"`);
		await queryRunner.query(`DROP INDEX "IDX_72b91233f9b7e95df7ab0dc12c"`);
		await queryRunner.query(`DROP INDEX "IDX_8ca39a79d0dfd72bb8b9c9b0da"`);
		await queryRunner.query(`DROP INDEX "IDX_d7df050beb5ed8c5b72243c1f5"`);
		await queryRunner.query(`DROP INDEX "IDX_a7740fc0a794549142743373f7"`);
		await queryRunner.query(`DROP INDEX "IDX_6f82155f53ac73b468200ee995"`);
		await queryRunner.query(`DROP INDEX "IDX_8b7d5e4ea44334201702b94439"`);
		await queryRunner.query(`DROP INDEX "IDX_d966bfd3404cbb285ac27f10da"`);
		await queryRunner.query(`DROP TABLE "employee_notification"`);
	}

	/**
	 * MySQL Up Migration
	 *
	 * @param queryRunner
	 */
	public async mysqlUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(
			`CREATE TABLE \`employee_notification\` (\`deletedAt\` datetime(6) NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`id\` varchar(36) NOT NULL, \`isActive\` tinyint NULL DEFAULT 1, \`isArchived\` tinyint NULL DEFAULT 0, \`archivedAt\` datetime NULL, \`tenantId\` varchar(255) NULL, \`organizationId\` varchar(255) NULL, \`entity\` varchar(255) NOT NULL, \`entityId\` varchar(255) NOT NULL, \`title\` varchar(255) NULL, \`message\` varchar(255) NULL, \`type\` int NULL, \`isRead\` tinyint NOT NULL DEFAULT 0, \`readAt\` datetime NULL, \`onHoldUntil\` datetime NULL, \`sentById\` varchar(255) NULL, \`receiverId\` varchar(255) NULL, INDEX \`IDX_d966bfd3404cbb285ac27f10da\` (\`isActive\`), INDEX \`IDX_8b7d5e4ea44334201702b94439\` (\`isArchived\`), INDEX \`IDX_6f82155f53ac73b468200ee995\` (\`tenantId\`), INDEX \`IDX_a7740fc0a794549142743373f7\` (\`organizationId\`), INDEX \`IDX_d7df050beb5ed8c5b72243c1f5\` (\`entity\`), INDEX \`IDX_8ca39a79d0dfd72bb8b9c9b0da\` (\`entityId\`), INDEX \`IDX_72b91233f9b7e95df7ab0dc12c\` (\`type\`), INDEX \`IDX_84554498767210c8b960dc2c7b\` (\`sentById\`), INDEX \`IDX_da490fa82625eb794ec5336fbd\` (\`receiverId\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`
		);
		await queryRunner.query(
			`ALTER TABLE \`employee_notification\` ADD CONSTRAINT \`FK_6f82155f53ac73b468200ee995b\` FOREIGN KEY (\`tenantId\`) REFERENCES \`tenant\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`employee_notification\` ADD CONSTRAINT \`FK_a7740fc0a794549142743373f7c\` FOREIGN KEY (\`organizationId\`) REFERENCES \`organization\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`
		);
		await queryRunner.query(
			`ALTER TABLE \`employee_notification\` ADD CONSTRAINT \`FK_84554498767210c8b960dc2c7b5\` FOREIGN KEY (\`sentById\`) REFERENCES \`employee\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`employee_notification\` ADD CONSTRAINT \`FK_da490fa82625eb794ec5336fbd5\` FOREIGN KEY (\`receiverId\`) REFERENCES \`employee\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
	}

	/**
	 * MySQL Down Migration
	 *
	 * @param queryRunner
	 */
	public async mysqlDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(
			`ALTER TABLE \`employee_notification\` DROP FOREIGN KEY \`FK_da490fa82625eb794ec5336fbd5\``
		);
		await queryRunner.query(
			`ALTER TABLE \`employee_notification\` DROP FOREIGN KEY \`FK_84554498767210c8b960dc2c7b5\``
		);
		await queryRunner.query(
			`ALTER TABLE \`employee_notification\` DROP FOREIGN KEY \`FK_a7740fc0a794549142743373f7c\``
		);
		await queryRunner.query(
			`ALTER TABLE \`employee_notification\` DROP FOREIGN KEY \`FK_6f82155f53ac73b468200ee995b\``
		);
		await queryRunner.query(`DROP INDEX \`IDX_da490fa82625eb794ec5336fbd\` ON \`employee_notification\``);
		await queryRunner.query(`DROP INDEX \`IDX_84554498767210c8b960dc2c7b\` ON \`employee_notification\``);
		await queryRunner.query(`DROP INDEX \`IDX_72b91233f9b7e95df7ab0dc12c\` ON \`employee_notification\``);
		await queryRunner.query(`DROP INDEX \`IDX_8ca39a79d0dfd72bb8b9c9b0da\` ON \`employee_notification\``);
		await queryRunner.query(`DROP INDEX \`IDX_d7df050beb5ed8c5b72243c1f5\` ON \`employee_notification\``);
		await queryRunner.query(`DROP INDEX \`IDX_a7740fc0a794549142743373f7\` ON \`employee_notification\``);
		await queryRunner.query(`DROP INDEX \`IDX_6f82155f53ac73b468200ee995\` ON \`employee_notification\``);
		await queryRunner.query(`DROP INDEX \`IDX_8b7d5e4ea44334201702b94439\` ON \`employee_notification\``);
		await queryRunner.query(`DROP INDEX \`IDX_d966bfd3404cbb285ac27f10da\` ON \`employee_notification\``);
		await queryRunner.query(`DROP TABLE \`employee_notification\``);
	}
}
