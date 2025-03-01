import { MigrationInterface, QueryRunner } from 'typeorm';
import * as chalk from 'chalk';
import { DatabaseTypeEnum } from '@gauzy/config';

export class AlterEmployeeNotificationEntityTable1739881882070 implements MigrationInterface {
	name = 'AlterEmployeeNotificationEntityTable1739881882070';

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
		await queryRunner.query(`ALTER TABLE "employee_notification" DROP CONSTRAINT "FK_84554498767210c8b960dc2c7b5"`);
		await queryRunner.query(`ALTER TABLE "employee_notification" DROP CONSTRAINT "FK_da490fa82625eb794ec5336fbd5"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_84554498767210c8b960dc2c7b"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_da490fa82625eb794ec5336fbd"`);
		await queryRunner.query(`ALTER TABLE "employee_notification" DROP COLUMN "sentById"`);
		await queryRunner.query(`ALTER TABLE "employee_notification" DROP COLUMN "receiverId"`);
		await queryRunner.query(`ALTER TABLE "employee_notification" ADD "sentByEmployeeId" uuid`);
		await queryRunner.query(`ALTER TABLE "employee_notification" ADD "receiverEmployeeId" uuid`);
		await queryRunner.query(
			`CREATE INDEX "IDX_a218a9bd93a882a32e33d6c35b" ON "employee_notification" ("sentByEmployeeId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_dd1a1a634c937f77be394ceaca" ON "employee_notification" ("receiverEmployeeId") `
		);
		await queryRunner.query(
			`ALTER TABLE "employee_notification"
			ADD CONSTRAINT "FK_a218a9bd93a882a32e33d6c35b8"
			FOREIGN KEY ("sentByEmployeeId") REFERENCES "employee"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "employee_notification"
			ADD CONSTRAINT "FK_dd1a1a634c937f77be394ceaca4"
			FOREIGN KEY ("receiverEmployeeId") REFERENCES "employee"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
	}

	/**
	 * PostgresDB Down Migration
	 *
	 * @param queryRunner
	 */
	public async postgresDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(`ALTER TABLE "employee_notification" DROP CONSTRAINT "FK_dd1a1a634c937f77be394ceaca4"`);
		await queryRunner.query(`ALTER TABLE "employee_notification" DROP CONSTRAINT "FK_a218a9bd93a882a32e33d6c35b8"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_dd1a1a634c937f77be394ceaca"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_a218a9bd93a882a32e33d6c35b"`);
		await queryRunner.query(`ALTER TABLE "employee_notification" DROP COLUMN "receiverEmployeeId"`);
		await queryRunner.query(`ALTER TABLE "employee_notification" DROP COLUMN "sentByEmployeeId"`);
		await queryRunner.query(`ALTER TABLE "employee_notification" ADD "receiverId" uuid`);
		await queryRunner.query(`ALTER TABLE "employee_notification" ADD "sentById" uuid`);
		await queryRunner.query(
			`CREATE INDEX "IDX_da490fa82625eb794ec5336fbd" ON "employee_notification" ("receiverId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_84554498767210c8b960dc2c7b" ON "employee_notification" ("sentById") `
		);
		await queryRunner.query(
			`ALTER TABLE "employee_notification"
			ADD CONSTRAINT "FK_da490fa82625eb794ec5336fbd5"
			FOREIGN KEY ("receiverId") REFERENCES "employee"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "employee_notification"
			ADD CONSTRAINT "FK_84554498767210c8b960dc2c7b5"
			FOREIGN KEY ("sentById") REFERENCES "employee"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
	}

	/**
	 * SqliteDB and BetterSQlite3DB Up Migration
	 *
	 * @param queryRunner
	 */
	public async sqliteUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(`DROP INDEX "IDX_da490fa82625eb794ec5336fbd"`);
		await queryRunner.query(`DROP INDEX "IDX_84554498767210c8b960dc2c7b"`);
		await queryRunner.query(`DROP INDEX "IDX_72b91233f9b7e95df7ab0dc12c"`);
		await queryRunner.query(`DROP INDEX "IDX_8ca39a79d0dfd72bb8b9c9b0da"`);
		await queryRunner.query(`DROP INDEX "IDX_d7df050beb5ed8c5b72243c1f5"`);
		await queryRunner.query(`DROP INDEX "IDX_a7740fc0a794549142743373f7"`);
		await queryRunner.query(`DROP INDEX "IDX_6f82155f53ac73b468200ee995"`);
		await queryRunner.query(`DROP INDEX "IDX_8b7d5e4ea44334201702b94439"`);
		await queryRunner.query(`DROP INDEX "IDX_d966bfd3404cbb285ac27f10da"`);
		await queryRunner.query(
			`CREATE TABLE "temporary_employee_notification" ("deletedAt" datetime, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "id" varchar PRIMARY KEY NOT NULL, "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "tenantId" varchar, "organizationId" varchar, "entity" varchar NOT NULL, "entityId" varchar NOT NULL, "title" varchar, "message" varchar, "type" integer, "isRead" boolean NOT NULL DEFAULT (0), "readAt" datetime, "onHoldUntil" datetime, "sentById" varchar, "receiverId" varchar, CONSTRAINT "FK_a7740fc0a794549142743373f7c" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_6f82155f53ac73b468200ee995b" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`
		);
		await queryRunner.query(
			`INSERT INTO "temporary_employee_notification"("deletedAt", "createdAt", "updatedAt", "id", "isActive", "isArchived", "archivedAt", "tenantId", "organizationId", "entity", "entityId", "title", "message", "type", "isRead", "readAt", "onHoldUntil", "sentById", "receiverId") SELECT "deletedAt", "createdAt", "updatedAt", "id", "isActive", "isArchived", "archivedAt", "tenantId", "organizationId", "entity", "entityId", "title", "message", "type", "isRead", "readAt", "onHoldUntil", "sentById", "receiverId" FROM "employee_notification"`
		);
		await queryRunner.query(`DROP TABLE "employee_notification"`);
		await queryRunner.query(`ALTER TABLE "temporary_employee_notification" RENAME TO "employee_notification"`);
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
		await queryRunner.query(
			`CREATE TABLE "temporary_employee_notification" ("deletedAt" datetime, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "id" varchar PRIMARY KEY NOT NULL, "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "tenantId" varchar, "organizationId" varchar, "entity" varchar NOT NULL, "entityId" varchar NOT NULL, "title" varchar, "message" varchar, "type" integer, "isRead" boolean NOT NULL DEFAULT (0), "readAt" datetime, "onHoldUntil" datetime, CONSTRAINT "FK_a7740fc0a794549142743373f7c" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_6f82155f53ac73b468200ee995b" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`
		);
		await queryRunner.query(
			`INSERT INTO "temporary_employee_notification"("deletedAt", "createdAt", "updatedAt", "id", "isActive", "isArchived", "archivedAt", "tenantId", "organizationId", "entity", "entityId", "title", "message", "type", "isRead", "readAt", "onHoldUntil") SELECT "deletedAt", "createdAt", "updatedAt", "id", "isActive", "isArchived", "archivedAt", "tenantId", "organizationId", "entity", "entityId", "title", "message", "type", "isRead", "readAt", "onHoldUntil" FROM "employee_notification"`
		);
		await queryRunner.query(`DROP TABLE "employee_notification"`);
		await queryRunner.query(`ALTER TABLE "temporary_employee_notification" RENAME TO "employee_notification"`);
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
		await queryRunner.query(`DROP INDEX "IDX_72b91233f9b7e95df7ab0dc12c"`);
		await queryRunner.query(`DROP INDEX "IDX_8ca39a79d0dfd72bb8b9c9b0da"`);
		await queryRunner.query(`DROP INDEX "IDX_d7df050beb5ed8c5b72243c1f5"`);
		await queryRunner.query(`DROP INDEX "IDX_a7740fc0a794549142743373f7"`);
		await queryRunner.query(`DROP INDEX "IDX_6f82155f53ac73b468200ee995"`);
		await queryRunner.query(`DROP INDEX "IDX_8b7d5e4ea44334201702b94439"`);
		await queryRunner.query(`DROP INDEX "IDX_d966bfd3404cbb285ac27f10da"`);
		await queryRunner.query(
			`CREATE TABLE "temporary_employee_notification" ("deletedAt" datetime, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "id" varchar PRIMARY KEY NOT NULL, "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "tenantId" varchar, "organizationId" varchar, "entity" varchar NOT NULL, "entityId" varchar NOT NULL, "title" varchar, "message" varchar, "type" integer, "isRead" boolean NOT NULL DEFAULT (0), "readAt" datetime, "onHoldUntil" datetime, "sentByEmployeeId" varchar, "receiverEmployeeId" varchar, CONSTRAINT "FK_a7740fc0a794549142743373f7c" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_6f82155f53ac73b468200ee995b" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`
		);
		await queryRunner.query(
			`INSERT INTO "temporary_employee_notification"("deletedAt", "createdAt", "updatedAt", "id", "isActive", "isArchived", "archivedAt", "tenantId", "organizationId", "entity", "entityId", "title", "message", "type", "isRead", "readAt", "onHoldUntil") SELECT "deletedAt", "createdAt", "updatedAt", "id", "isActive", "isArchived", "archivedAt", "tenantId", "organizationId", "entity", "entityId", "title", "message", "type", "isRead", "readAt", "onHoldUntil" FROM "employee_notification"`
		);
		await queryRunner.query(`DROP TABLE "employee_notification"`);
		await queryRunner.query(`ALTER TABLE "temporary_employee_notification" RENAME TO "employee_notification"`);
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
		await queryRunner.query(
			`CREATE INDEX "IDX_a218a9bd93a882a32e33d6c35b" ON "employee_notification" ("sentByEmployeeId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_dd1a1a634c937f77be394ceaca" ON "employee_notification" ("receiverEmployeeId") `
		);
		await queryRunner.query(`DROP INDEX "IDX_72b91233f9b7e95df7ab0dc12c"`);
		await queryRunner.query(`DROP INDEX "IDX_8ca39a79d0dfd72bb8b9c9b0da"`);
		await queryRunner.query(`DROP INDEX "IDX_d7df050beb5ed8c5b72243c1f5"`);
		await queryRunner.query(`DROP INDEX "IDX_a7740fc0a794549142743373f7"`);
		await queryRunner.query(`DROP INDEX "IDX_6f82155f53ac73b468200ee995"`);
		await queryRunner.query(`DROP INDEX "IDX_8b7d5e4ea44334201702b94439"`);
		await queryRunner.query(`DROP INDEX "IDX_d966bfd3404cbb285ac27f10da"`);
		await queryRunner.query(`DROP INDEX "IDX_a218a9bd93a882a32e33d6c35b"`);
		await queryRunner.query(`DROP INDEX "IDX_dd1a1a634c937f77be394ceaca"`);
		await queryRunner.query(
			`CREATE TABLE "temporary_employee_notification" ("deletedAt" datetime, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "id" varchar PRIMARY KEY NOT NULL, "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "tenantId" varchar, "organizationId" varchar, "entity" varchar NOT NULL, "entityId" varchar NOT NULL, "title" varchar, "message" varchar, "type" integer, "isRead" boolean NOT NULL DEFAULT (0), "readAt" datetime, "onHoldUntil" datetime, "sentByEmployeeId" varchar, "receiverEmployeeId" varchar, CONSTRAINT "FK_a7740fc0a794549142743373f7c" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_6f82155f53ac73b468200ee995b" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_a218a9bd93a882a32e33d6c35b8" FOREIGN KEY ("sentByEmployeeId") REFERENCES "employee" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_dd1a1a634c937f77be394ceaca4" FOREIGN KEY ("receiverEmployeeId") REFERENCES "employee" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`
		);
		await queryRunner.query(
			`INSERT INTO "temporary_employee_notification"("deletedAt", "createdAt", "updatedAt", "id", "isActive", "isArchived", "archivedAt", "tenantId", "organizationId", "entity", "entityId", "title", "message", "type", "isRead", "readAt", "onHoldUntil", "sentByEmployeeId", "receiverEmployeeId") SELECT "deletedAt", "createdAt", "updatedAt", "id", "isActive", "isArchived", "archivedAt", "tenantId", "organizationId", "entity", "entityId", "title", "message", "type", "isRead", "readAt", "onHoldUntil", "sentByEmployeeId", "receiverEmployeeId" FROM "employee_notification"`
		);
		await queryRunner.query(`DROP TABLE "employee_notification"`);
		await queryRunner.query(`ALTER TABLE "temporary_employee_notification" RENAME TO "employee_notification"`);
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
		await queryRunner.query(
			`CREATE INDEX "IDX_a218a9bd93a882a32e33d6c35b" ON "employee_notification" ("sentByEmployeeId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_dd1a1a634c937f77be394ceaca" ON "employee_notification" ("receiverEmployeeId") `
		);
	}

	/**
	 * SqliteDB and BetterSQlite3DB Down Migration
	 *
	 * @param queryRunner
	 */
	public async sqliteDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(`DROP INDEX "IDX_dd1a1a634c937f77be394ceaca"`);
		await queryRunner.query(`DROP INDEX "IDX_a218a9bd93a882a32e33d6c35b"`);
		await queryRunner.query(`DROP INDEX "IDX_d966bfd3404cbb285ac27f10da"`);
		await queryRunner.query(`DROP INDEX "IDX_8b7d5e4ea44334201702b94439"`);
		await queryRunner.query(`DROP INDEX "IDX_6f82155f53ac73b468200ee995"`);
		await queryRunner.query(`DROP INDEX "IDX_a7740fc0a794549142743373f7"`);
		await queryRunner.query(`DROP INDEX "IDX_d7df050beb5ed8c5b72243c1f5"`);
		await queryRunner.query(`DROP INDEX "IDX_8ca39a79d0dfd72bb8b9c9b0da"`);
		await queryRunner.query(`DROP INDEX "IDX_72b91233f9b7e95df7ab0dc12c"`);
		await queryRunner.query(`ALTER TABLE "employee_notification" RENAME TO "temporary_employee_notification"`);
		await queryRunner.query(
			`CREATE TABLE "employee_notification" ("deletedAt" datetime, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "id" varchar PRIMARY KEY NOT NULL, "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "tenantId" varchar, "organizationId" varchar, "entity" varchar NOT NULL, "entityId" varchar NOT NULL, "title" varchar, "message" varchar, "type" integer, "isRead" boolean NOT NULL DEFAULT (0), "readAt" datetime, "onHoldUntil" datetime, "sentByEmployeeId" varchar, "receiverEmployeeId" varchar, CONSTRAINT "FK_a7740fc0a794549142743373f7c" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_6f82155f53ac73b468200ee995b" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`
		);
		await queryRunner.query(
			`INSERT INTO "employee_notification"("deletedAt", "createdAt", "updatedAt", "id", "isActive", "isArchived", "archivedAt", "tenantId", "organizationId", "entity", "entityId", "title", "message", "type", "isRead", "readAt", "onHoldUntil", "sentByEmployeeId", "receiverEmployeeId") SELECT "deletedAt", "createdAt", "updatedAt", "id", "isActive", "isArchived", "archivedAt", "tenantId", "organizationId", "entity", "entityId", "title", "message", "type", "isRead", "readAt", "onHoldUntil", "sentByEmployeeId", "receiverEmployeeId" FROM "temporary_employee_notification"`
		);
		await queryRunner.query(`DROP TABLE "temporary_employee_notification"`);
		await queryRunner.query(
			`CREATE INDEX "IDX_dd1a1a634c937f77be394ceaca" ON "employee_notification" ("receiverEmployeeId") `
		);
		await queryRunner.query(
			`CREATE INDEX "IDX_a218a9bd93a882a32e33d6c35b" ON "employee_notification" ("sentByEmployeeId") `
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
		await queryRunner.query(`DROP INDEX "IDX_dd1a1a634c937f77be394ceaca"`);
		await queryRunner.query(`DROP INDEX "IDX_a218a9bd93a882a32e33d6c35b"`);
		await queryRunner.query(`DROP INDEX "IDX_d966bfd3404cbb285ac27f10da"`);
		await queryRunner.query(`DROP INDEX "IDX_8b7d5e4ea44334201702b94439"`);
		await queryRunner.query(`DROP INDEX "IDX_6f82155f53ac73b468200ee995"`);
		await queryRunner.query(`DROP INDEX "IDX_a7740fc0a794549142743373f7"`);
		await queryRunner.query(`DROP INDEX "IDX_d7df050beb5ed8c5b72243c1f5"`);
		await queryRunner.query(`DROP INDEX "IDX_8ca39a79d0dfd72bb8b9c9b0da"`);
		await queryRunner.query(`DROP INDEX "IDX_72b91233f9b7e95df7ab0dc12c"`);
		await queryRunner.query(`ALTER TABLE "employee_notification" RENAME TO "temporary_employee_notification"`);
		await queryRunner.query(
			`CREATE TABLE "employee_notification" ("deletedAt" datetime, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "id" varchar PRIMARY KEY NOT NULL, "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "tenantId" varchar, "organizationId" varchar, "entity" varchar NOT NULL, "entityId" varchar NOT NULL, "title" varchar, "message" varchar, "type" integer, "isRead" boolean NOT NULL DEFAULT (0), "readAt" datetime, "onHoldUntil" datetime, CONSTRAINT "FK_a7740fc0a794549142743373f7c" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_6f82155f53ac73b468200ee995b" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`
		);
		await queryRunner.query(
			`INSERT INTO "employee_notification"("deletedAt", "createdAt", "updatedAt", "id", "isActive", "isArchived", "archivedAt", "tenantId", "organizationId", "entity", "entityId", "title", "message", "type", "isRead", "readAt", "onHoldUntil") SELECT "deletedAt", "createdAt", "updatedAt", "id", "isActive", "isArchived", "archivedAt", "tenantId", "organizationId", "entity", "entityId", "title", "message", "type", "isRead", "readAt", "onHoldUntil" FROM "temporary_employee_notification"`
		);
		await queryRunner.query(`DROP TABLE "temporary_employee_notification"`);
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
		await queryRunner.query(`DROP INDEX "IDX_d966bfd3404cbb285ac27f10da"`);
		await queryRunner.query(`DROP INDEX "IDX_8b7d5e4ea44334201702b94439"`);
		await queryRunner.query(`DROP INDEX "IDX_6f82155f53ac73b468200ee995"`);
		await queryRunner.query(`DROP INDEX "IDX_a7740fc0a794549142743373f7"`);
		await queryRunner.query(`DROP INDEX "IDX_d7df050beb5ed8c5b72243c1f5"`);
		await queryRunner.query(`DROP INDEX "IDX_8ca39a79d0dfd72bb8b9c9b0da"`);
		await queryRunner.query(`DROP INDEX "IDX_72b91233f9b7e95df7ab0dc12c"`);
		await queryRunner.query(`ALTER TABLE "employee_notification" RENAME TO "temporary_employee_notification"`);
		await queryRunner.query(
			`CREATE TABLE "employee_notification" ("deletedAt" datetime, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "id" varchar PRIMARY KEY NOT NULL, "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "tenantId" varchar, "organizationId" varchar, "entity" varchar NOT NULL, "entityId" varchar NOT NULL, "title" varchar, "message" varchar, "type" integer, "isRead" boolean NOT NULL DEFAULT (0), "readAt" datetime, "onHoldUntil" datetime, "sentById" varchar, "receiverId" varchar, CONSTRAINT "FK_a7740fc0a794549142743373f7c" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_6f82155f53ac73b468200ee995b" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`
		);
		await queryRunner.query(
			`INSERT INTO "employee_notification"("deletedAt", "createdAt", "updatedAt", "id", "isActive", "isArchived", "archivedAt", "tenantId", "organizationId", "entity", "entityId", "title", "message", "type", "isRead", "readAt", "onHoldUntil") SELECT "deletedAt", "createdAt", "updatedAt", "id", "isActive", "isArchived", "archivedAt", "tenantId", "organizationId", "entity", "entityId", "title", "message", "type", "isRead", "readAt", "onHoldUntil" FROM "temporary_employee_notification"`
		);
		await queryRunner.query(`DROP TABLE "temporary_employee_notification"`);
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
		await queryRunner.query(`ALTER TABLE "employee_notification" RENAME TO "temporary_employee_notification"`);
		await queryRunner.query(
			`CREATE TABLE "employee_notification" ("deletedAt" datetime, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "id" varchar PRIMARY KEY NOT NULL, "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "tenantId" varchar, "organizationId" varchar, "entity" varchar NOT NULL, "entityId" varchar NOT NULL, "title" varchar, "message" varchar, "type" integer, "isRead" boolean NOT NULL DEFAULT (0), "readAt" datetime, "onHoldUntil" datetime, "sentById" varchar, "receiverId" varchar, CONSTRAINT "FK_da490fa82625eb794ec5336fbd5" FOREIGN KEY ("receiverId") REFERENCES "employee" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_84554498767210c8b960dc2c7b5" FOREIGN KEY ("sentById") REFERENCES "employee" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_a7740fc0a794549142743373f7c" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_6f82155f53ac73b468200ee995b" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`
		);
		await queryRunner.query(
			`INSERT INTO "employee_notification"("deletedAt", "createdAt", "updatedAt", "id", "isActive", "isArchived", "archivedAt", "tenantId", "organizationId", "entity", "entityId", "title", "message", "type", "isRead", "readAt", "onHoldUntil", "sentById", "receiverId") SELECT "deletedAt", "createdAt", "updatedAt", "id", "isActive", "isArchived", "archivedAt", "tenantId", "organizationId", "entity", "entityId", "title", "message", "type", "isRead", "readAt", "onHoldUntil", "sentById", "receiverId" FROM "temporary_employee_notification"`
		);
		await queryRunner.query(`DROP TABLE "temporary_employee_notification"`);
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
	 * MySQL Up Migration
	 *
	 * @param queryRunner
	 */
	public async mysqlUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(
			`ALTER TABLE \`employee_notification\` DROP FOREIGN KEY \`FK_84554498767210c8b960dc2c7b5\``
		);
		await queryRunner.query(
			`ALTER TABLE \`employee_notification\` DROP FOREIGN KEY \`FK_da490fa82625eb794ec5336fbd5\``
		);
		await queryRunner.query(`DROP INDEX \`IDX_84554498767210c8b960dc2c7b\` ON \`employee_notification\``);
		await queryRunner.query(`DROP INDEX \`IDX_da490fa82625eb794ec5336fbd\` ON \`employee_notification\``);
		await queryRunner.query(`ALTER TABLE \`employee_notification\` DROP COLUMN \`sentById\``);
		await queryRunner.query(`ALTER TABLE \`employee_notification\` DROP COLUMN \`receiverId\``);
		await queryRunner.query(`ALTER TABLE \`employee_notification\` ADD \`sentByEmployeeId\` varchar(255) NULL`);
		await queryRunner.query(`ALTER TABLE \`employee_notification\` ADD \`receiverEmployeeId\` varchar(255) NULL`);
		await queryRunner.query(
			`CREATE INDEX \`IDX_a218a9bd93a882a32e33d6c35b\` ON \`employee_notification\` (\`sentByEmployeeId\`)`
		);
		await queryRunner.query(
			`CREATE INDEX \`IDX_dd1a1a634c937f77be394ceaca\` ON \`employee_notification\` (\`receiverEmployeeId\`)`
		);
		await queryRunner.query(
			`ALTER TABLE \`employee_notification\`
			ADD CONSTRAINT \`FK_a218a9bd93a882a32e33d6c35b8\`
			FOREIGN KEY (\`sentByEmployeeId\`) REFERENCES \`employee\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`employee_notification\`
			ADD CONSTRAINT \`FK_dd1a1a634c937f77be394ceaca4\`
			FOREIGN KEY (\`receiverEmployeeId\`) REFERENCES \`employee\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
	}

	/**
	 * MySQL Down Migration
	 *
	 * @param queryRunner
	 */
	public async mysqlDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(
			`ALTER TABLE \`employee_notification\` DROP FOREIGN KEY \`FK_dd1a1a634c937f77be394ceaca4\``
		);
		await queryRunner.query(
			`ALTER TABLE \`employee_notification\` DROP FOREIGN KEY \`FK_a218a9bd93a882a32e33d6c35b8\``
		);
		await queryRunner.query(`DROP INDEX \`IDX_dd1a1a634c937f77be394ceaca\` ON \`employee_notification\``);
		await queryRunner.query(`DROP INDEX \`IDX_a218a9bd93a882a32e33d6c35b\` ON \`employee_notification\``);
		await queryRunner.query(`ALTER TABLE \`employee_notification\` DROP COLUMN \`receiverEmployeeId\``);
		await queryRunner.query(`ALTER TABLE \`employee_notification\` DROP COLUMN \`sentByEmployeeId\``);
		await queryRunner.query(`ALTER TABLE \`employee_notification\` ADD \`receiverId\` varchar(255) NULL`);
		await queryRunner.query(`ALTER TABLE \`employee_notification\` ADD \`sentById\` varchar(255) NULL`);
		await queryRunner.query(
			`CREATE INDEX \`IDX_da490fa82625eb794ec5336fbd\` ON \`employee_notification\` (\`receiverId\`)`
		);
		await queryRunner.query(
			`CREATE INDEX \`IDX_84554498767210c8b960dc2c7b\` ON \`employee_notification\` (\`sentById\`)`
		);
		await queryRunner.query(
			`ALTER TABLE \`employee_notification\`
			ADD CONSTRAINT \`FK_da490fa82625eb794ec5336fbd5\`
			FOREIGN KEY (\`receiverId\`) REFERENCES \`employee\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`employee_notification\`
			ADD CONSTRAINT \`FK_84554498767210c8b960dc2c7b5\`
			FOREIGN KEY (\`sentById\`) REFERENCES \`employee\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
	}
}
