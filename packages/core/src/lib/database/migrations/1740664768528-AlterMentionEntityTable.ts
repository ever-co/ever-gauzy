import { MigrationInterface, QueryRunner } from 'typeorm';
import * as chalk from 'chalk';
import { DatabaseTypeEnum } from '@gauzy/config';

export class AlterMentionEntityTable1740664768528 implements MigrationInterface {
	name = 'AlterMentionEntityTable1740664768528';

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
		await queryRunner.query(`ALTER TABLE "mention" DROP CONSTRAINT "FK_16a2deee0d7ea361950eed1b944"`);
		await queryRunner.query(`ALTER TABLE "mention" DROP CONSTRAINT "FK_34b0087a30379c86b470a4298ca"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_16a2deee0d7ea361950eed1b94"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_34b0087a30379c86b470a4298c"`);
		await queryRunner.query(`ALTER TABLE "mention" DROP COLUMN "mentionedUserId"`);
		await queryRunner.query(`ALTER TABLE "mention" DROP COLUMN "mentionById"`);
		await queryRunner.query(`ALTER TABLE "mention" ADD "actorType" integer`);
		await queryRunner.query(`ALTER TABLE "mention" ADD "mentionedEmployeeId" uuid NOT NULL`);
		await queryRunner.query(`ALTER TABLE "mention" ADD "employeeId" uuid`);
		await queryRunner.query(`CREATE INDEX "IDX_8a71b1017f6ea51d1913adcae4" ON "mention" ("actorType") `);
		await queryRunner.query(`CREATE INDEX "IDX_a123435acf8d70e5df978e759f" ON "mention" ("mentionedEmployeeId") `);
		await queryRunner.query(`CREATE INDEX "IDX_465f1a9281f338ae38cc961c2a" ON "mention" ("employeeId") `);
		await queryRunner.query(
			`ALTER TABLE "mention" ADD CONSTRAINT "FK_a123435acf8d70e5df978e759f9" FOREIGN KEY ("mentionedEmployeeId") REFERENCES "employee"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "mention" ADD CONSTRAINT "FK_465f1a9281f338ae38cc961c2a5" FOREIGN KEY ("employeeId") REFERENCES "employee"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
	}

	/**
	 * PostgresDB Down Migration
	 *
	 * @param queryRunner
	 */
	public async postgresDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(`ALTER TABLE "mention" DROP CONSTRAINT "FK_465f1a9281f338ae38cc961c2a5"`);
		await queryRunner.query(`ALTER TABLE "mention" DROP CONSTRAINT "FK_a123435acf8d70e5df978e759f9"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_465f1a9281f338ae38cc961c2a"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_a123435acf8d70e5df978e759f"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_8a71b1017f6ea51d1913adcae4"`);
		await queryRunner.query(`ALTER TABLE "mention" DROP COLUMN "employeeId"`);
		await queryRunner.query(`ALTER TABLE "mention" DROP COLUMN "mentionedEmployeeId"`);
		await queryRunner.query(`ALTER TABLE "mention" DROP COLUMN "actorType"`);
		await queryRunner.query(`ALTER TABLE "mention" ADD "mentionById" uuid NOT NULL`);
		await queryRunner.query(`ALTER TABLE "mention" ADD "mentionedUserId" uuid NOT NULL`);
		await queryRunner.query(`CREATE INDEX "IDX_34b0087a30379c86b470a4298c" ON "mention" ("mentionById") `);
		await queryRunner.query(`CREATE INDEX "IDX_16a2deee0d7ea361950eed1b94" ON "mention" ("mentionedUserId") `);
		await queryRunner.query(
			`ALTER TABLE "mention" ADD CONSTRAINT "FK_34b0087a30379c86b470a4298ca" FOREIGN KEY ("mentionById") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE "mention" ADD CONSTRAINT "FK_16a2deee0d7ea361950eed1b944" FOREIGN KEY ("mentionedUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
		);
	}

	/**
	 * SqliteDB and BetterSQlite3DB Up Migration
	 *
	 * @param queryRunner
	 */
	public async sqliteUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(`DROP INDEX "IDX_34b0087a30379c86b470a4298c"`);
		await queryRunner.query(`DROP INDEX "IDX_16a2deee0d7ea361950eed1b94"`);
		await queryRunner.query(`DROP INDEX "IDX_4f9397b277ec0791c5f9e2fd62"`);
		await queryRunner.query(`DROP INDEX "IDX_5b95805861f9de5cf7760a964a"`);
		await queryRunner.query(`DROP INDEX "IDX_3d6a8e3430779c21f04513cc5a"`);
		await queryRunner.query(`DROP INDEX "IDX_d01675da9ddf57bef5692fca8b"`);
		await queryRunner.query(`DROP INDEX "IDX_4f018d32b6d2e2c907833d0db1"`);
		await queryRunner.query(`DROP INDEX "IDX_580d84e23219b07f520131f927"`);
		await queryRunner.query(`DROP INDEX "IDX_9597d3f3afbf40e6ffd1b0ebc9"`);
		await queryRunner.query(`DROP INDEX "IDX_2c71b2f53b9162a94e1f02e40b"`);
		await queryRunner.query(
			`CREATE TABLE "temporary_mention" ("deletedAt" datetime, "id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "tenantId" varchar, "organizationId" varchar, "entityId" varchar NOT NULL, "entity" varchar NOT NULL, "parentEntityId" varchar, "parentEntityType" varchar, "mentionedUserId" varchar NOT NULL, "mentionById" varchar NOT NULL, CONSTRAINT "FK_4f018d32b6d2e2c907833d0db11" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_580d84e23219b07f520131f9271" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`
		);
		await queryRunner.query(
			`INSERT INTO "temporary_mention"("deletedAt", "id", "createdAt", "updatedAt", "isActive", "isArchived", "archivedAt", "tenantId", "organizationId", "entityId", "entity", "parentEntityId", "parentEntityType", "mentionedUserId", "mentionById") SELECT "deletedAt", "id", "createdAt", "updatedAt", "isActive", "isArchived", "archivedAt", "tenantId", "organizationId", "entityId", "entity", "parentEntityId", "parentEntityType", "mentionedUserId", "mentionById" FROM "mention"`
		);
		await queryRunner.query(`DROP TABLE "mention"`);
		await queryRunner.query(`ALTER TABLE "temporary_mention" RENAME TO "mention"`);
		await queryRunner.query(`CREATE INDEX "IDX_34b0087a30379c86b470a4298c" ON "mention" ("mentionById") `);
		await queryRunner.query(`CREATE INDEX "IDX_16a2deee0d7ea361950eed1b94" ON "mention" ("mentionedUserId") `);
		await queryRunner.query(`CREATE INDEX "IDX_4f9397b277ec0791c5f9e2fd62" ON "mention" ("parentEntityType") `);
		await queryRunner.query(`CREATE INDEX "IDX_5b95805861f9de5cf7760a964a" ON "mention" ("parentEntityId") `);
		await queryRunner.query(`CREATE INDEX "IDX_3d6a8e3430779c21f04513cc5a" ON "mention" ("entity") `);
		await queryRunner.query(`CREATE INDEX "IDX_d01675da9ddf57bef5692fca8b" ON "mention" ("entityId") `);
		await queryRunner.query(`CREATE INDEX "IDX_4f018d32b6d2e2c907833d0db1" ON "mention" ("organizationId") `);
		await queryRunner.query(`CREATE INDEX "IDX_580d84e23219b07f520131f927" ON "mention" ("tenantId") `);
		await queryRunner.query(`CREATE INDEX "IDX_9597d3f3afbf40e6ffd1b0ebc9" ON "mention" ("isArchived") `);
		await queryRunner.query(`CREATE INDEX "IDX_2c71b2f53b9162a94e1f02e40b" ON "mention" ("isActive") `);
		await queryRunner.query(`DROP INDEX "IDX_34b0087a30379c86b470a4298c"`);
		await queryRunner.query(`DROP INDEX "IDX_16a2deee0d7ea361950eed1b94"`);
		await queryRunner.query(`DROP INDEX "IDX_4f9397b277ec0791c5f9e2fd62"`);
		await queryRunner.query(`DROP INDEX "IDX_5b95805861f9de5cf7760a964a"`);
		await queryRunner.query(`DROP INDEX "IDX_3d6a8e3430779c21f04513cc5a"`);
		await queryRunner.query(`DROP INDEX "IDX_d01675da9ddf57bef5692fca8b"`);
		await queryRunner.query(`DROP INDEX "IDX_4f018d32b6d2e2c907833d0db1"`);
		await queryRunner.query(`DROP INDEX "IDX_580d84e23219b07f520131f927"`);
		await queryRunner.query(`DROP INDEX "IDX_9597d3f3afbf40e6ffd1b0ebc9"`);
		await queryRunner.query(`DROP INDEX "IDX_2c71b2f53b9162a94e1f02e40b"`);
		await queryRunner.query(
			`CREATE TABLE "temporary_mention" ("deletedAt" datetime, "id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "tenantId" varchar, "organizationId" varchar, "entityId" varchar NOT NULL, "entity" varchar NOT NULL, "parentEntityId" varchar, "parentEntityType" varchar, CONSTRAINT "FK_4f018d32b6d2e2c907833d0db11" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_580d84e23219b07f520131f9271" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`
		);
		await queryRunner.query(
			`INSERT INTO "temporary_mention"("deletedAt", "id", "createdAt", "updatedAt", "isActive", "isArchived", "archivedAt", "tenantId", "organizationId", "entityId", "entity", "parentEntityId", "parentEntityType") SELECT "deletedAt", "id", "createdAt", "updatedAt", "isActive", "isArchived", "archivedAt", "tenantId", "organizationId", "entityId", "entity", "parentEntityId", "parentEntityType" FROM "mention"`
		);
		await queryRunner.query(`DROP TABLE "mention"`);
		await queryRunner.query(`ALTER TABLE "temporary_mention" RENAME TO "mention"`);
		await queryRunner.query(`CREATE INDEX "IDX_4f9397b277ec0791c5f9e2fd62" ON "mention" ("parentEntityType") `);
		await queryRunner.query(`CREATE INDEX "IDX_5b95805861f9de5cf7760a964a" ON "mention" ("parentEntityId") `);
		await queryRunner.query(`CREATE INDEX "IDX_3d6a8e3430779c21f04513cc5a" ON "mention" ("entity") `);
		await queryRunner.query(`CREATE INDEX "IDX_d01675da9ddf57bef5692fca8b" ON "mention" ("entityId") `);
		await queryRunner.query(`CREATE INDEX "IDX_4f018d32b6d2e2c907833d0db1" ON "mention" ("organizationId") `);
		await queryRunner.query(`CREATE INDEX "IDX_580d84e23219b07f520131f927" ON "mention" ("tenantId") `);
		await queryRunner.query(`CREATE INDEX "IDX_9597d3f3afbf40e6ffd1b0ebc9" ON "mention" ("isArchived") `);
		await queryRunner.query(`CREATE INDEX "IDX_2c71b2f53b9162a94e1f02e40b" ON "mention" ("isActive") `);
		await queryRunner.query(`DROP INDEX "IDX_4f9397b277ec0791c5f9e2fd62"`);
		await queryRunner.query(`DROP INDEX "IDX_5b95805861f9de5cf7760a964a"`);
		await queryRunner.query(`DROP INDEX "IDX_3d6a8e3430779c21f04513cc5a"`);
		await queryRunner.query(`DROP INDEX "IDX_d01675da9ddf57bef5692fca8b"`);
		await queryRunner.query(`DROP INDEX "IDX_4f018d32b6d2e2c907833d0db1"`);
		await queryRunner.query(`DROP INDEX "IDX_580d84e23219b07f520131f927"`);
		await queryRunner.query(`DROP INDEX "IDX_9597d3f3afbf40e6ffd1b0ebc9"`);
		await queryRunner.query(`DROP INDEX "IDX_2c71b2f53b9162a94e1f02e40b"`);
		await queryRunner.query(
			`CREATE TABLE "temporary_mention" ("deletedAt" datetime, "id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "tenantId" varchar, "organizationId" varchar, "entityId" varchar NOT NULL, "entity" varchar NOT NULL, "parentEntityId" varchar, "parentEntityType" varchar, "actorType" integer, "mentionedEmployeeId" varchar NOT NULL, "employeeId" varchar, CONSTRAINT "FK_4f018d32b6d2e2c907833d0db11" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_580d84e23219b07f520131f9271" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`
		);
		await queryRunner.query(
			`INSERT INTO "temporary_mention"("deletedAt", "id", "createdAt", "updatedAt", "isActive", "isArchived", "archivedAt", "tenantId", "organizationId", "entityId", "entity", "parentEntityId", "parentEntityType") SELECT "deletedAt", "id", "createdAt", "updatedAt", "isActive", "isArchived", "archivedAt", "tenantId", "organizationId", "entityId", "entity", "parentEntityId", "parentEntityType" FROM "mention"`
		);
		await queryRunner.query(`DROP TABLE "mention"`);
		await queryRunner.query(`ALTER TABLE "temporary_mention" RENAME TO "mention"`);
		await queryRunner.query(`CREATE INDEX "IDX_4f9397b277ec0791c5f9e2fd62" ON "mention" ("parentEntityType") `);
		await queryRunner.query(`CREATE INDEX "IDX_5b95805861f9de5cf7760a964a" ON "mention" ("parentEntityId") `);
		await queryRunner.query(`CREATE INDEX "IDX_3d6a8e3430779c21f04513cc5a" ON "mention" ("entity") `);
		await queryRunner.query(`CREATE INDEX "IDX_d01675da9ddf57bef5692fca8b" ON "mention" ("entityId") `);
		await queryRunner.query(`CREATE INDEX "IDX_4f018d32b6d2e2c907833d0db1" ON "mention" ("organizationId") `);
		await queryRunner.query(`CREATE INDEX "IDX_580d84e23219b07f520131f927" ON "mention" ("tenantId") `);
		await queryRunner.query(`CREATE INDEX "IDX_9597d3f3afbf40e6ffd1b0ebc9" ON "mention" ("isArchived") `);
		await queryRunner.query(`CREATE INDEX "IDX_2c71b2f53b9162a94e1f02e40b" ON "mention" ("isActive") `);
		await queryRunner.query(`CREATE INDEX "IDX_8a71b1017f6ea51d1913adcae4" ON "mention" ("actorType") `);
		await queryRunner.query(`CREATE INDEX "IDX_a123435acf8d70e5df978e759f" ON "mention" ("mentionedEmployeeId") `);
		await queryRunner.query(`CREATE INDEX "IDX_465f1a9281f338ae38cc961c2a" ON "mention" ("employeeId") `);
		await queryRunner.query(`DROP INDEX "IDX_4f9397b277ec0791c5f9e2fd62"`);
		await queryRunner.query(`DROP INDEX "IDX_5b95805861f9de5cf7760a964a"`);
		await queryRunner.query(`DROP INDEX "IDX_3d6a8e3430779c21f04513cc5a"`);
		await queryRunner.query(`DROP INDEX "IDX_d01675da9ddf57bef5692fca8b"`);
		await queryRunner.query(`DROP INDEX "IDX_4f018d32b6d2e2c907833d0db1"`);
		await queryRunner.query(`DROP INDEX "IDX_580d84e23219b07f520131f927"`);
		await queryRunner.query(`DROP INDEX "IDX_9597d3f3afbf40e6ffd1b0ebc9"`);
		await queryRunner.query(`DROP INDEX "IDX_2c71b2f53b9162a94e1f02e40b"`);
		await queryRunner.query(`DROP INDEX "IDX_8a71b1017f6ea51d1913adcae4"`);
		await queryRunner.query(`DROP INDEX "IDX_a123435acf8d70e5df978e759f"`);
		await queryRunner.query(`DROP INDEX "IDX_465f1a9281f338ae38cc961c2a"`);
		await queryRunner.query(
			`CREATE TABLE "temporary_mention" ("deletedAt" datetime, "id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "tenantId" varchar, "organizationId" varchar, "entityId" varchar NOT NULL, "entity" varchar NOT NULL, "parentEntityId" varchar, "parentEntityType" varchar, "actorType" integer, "mentionedEmployeeId" varchar NOT NULL, "employeeId" varchar, CONSTRAINT "FK_4f018d32b6d2e2c907833d0db11" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_580d84e23219b07f520131f9271" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_a123435acf8d70e5df978e759f9" FOREIGN KEY ("mentionedEmployeeId") REFERENCES "employee" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_465f1a9281f338ae38cc961c2a5" FOREIGN KEY ("employeeId") REFERENCES "employee" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`
		);
		await queryRunner.query(
			`INSERT INTO "temporary_mention"("deletedAt", "id", "createdAt", "updatedAt", "isActive", "isArchived", "archivedAt", "tenantId", "organizationId", "entityId", "entity", "parentEntityId", "parentEntityType", "actorType", "mentionedEmployeeId", "employeeId") SELECT "deletedAt", "id", "createdAt", "updatedAt", "isActive", "isArchived", "archivedAt", "tenantId", "organizationId", "entityId", "entity", "parentEntityId", "parentEntityType", "actorType", "mentionedEmployeeId", "employeeId" FROM "mention"`
		);
		await queryRunner.query(`DROP TABLE "mention"`);
		await queryRunner.query(`ALTER TABLE "temporary_mention" RENAME TO "mention"`);
		await queryRunner.query(`CREATE INDEX "IDX_4f9397b277ec0791c5f9e2fd62" ON "mention" ("parentEntityType") `);
		await queryRunner.query(`CREATE INDEX "IDX_5b95805861f9de5cf7760a964a" ON "mention" ("parentEntityId") `);
		await queryRunner.query(`CREATE INDEX "IDX_3d6a8e3430779c21f04513cc5a" ON "mention" ("entity") `);
		await queryRunner.query(`CREATE INDEX "IDX_d01675da9ddf57bef5692fca8b" ON "mention" ("entityId") `);
		await queryRunner.query(`CREATE INDEX "IDX_4f018d32b6d2e2c907833d0db1" ON "mention" ("organizationId") `);
		await queryRunner.query(`CREATE INDEX "IDX_580d84e23219b07f520131f927" ON "mention" ("tenantId") `);
		await queryRunner.query(`CREATE INDEX "IDX_9597d3f3afbf40e6ffd1b0ebc9" ON "mention" ("isArchived") `);
		await queryRunner.query(`CREATE INDEX "IDX_2c71b2f53b9162a94e1f02e40b" ON "mention" ("isActive") `);
		await queryRunner.query(`CREATE INDEX "IDX_8a71b1017f6ea51d1913adcae4" ON "mention" ("actorType") `);
		await queryRunner.query(`CREATE INDEX "IDX_a123435acf8d70e5df978e759f" ON "mention" ("mentionedEmployeeId") `);
		await queryRunner.query(`CREATE INDEX "IDX_465f1a9281f338ae38cc961c2a" ON "mention" ("employeeId") `);
	}

	/**
	 * SqliteDB and BetterSQlite3DB Down Migration
	 *
	 * @param queryRunner
	 */
	public async sqliteDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(`DROP INDEX "IDX_465f1a9281f338ae38cc961c2a"`);
		await queryRunner.query(`DROP INDEX "IDX_a123435acf8d70e5df978e759f"`);
		await queryRunner.query(`DROP INDEX "IDX_8a71b1017f6ea51d1913adcae4"`);
		await queryRunner.query(`DROP INDEX "IDX_2c71b2f53b9162a94e1f02e40b"`);
		await queryRunner.query(`DROP INDEX "IDX_9597d3f3afbf40e6ffd1b0ebc9"`);
		await queryRunner.query(`DROP INDEX "IDX_580d84e23219b07f520131f927"`);
		await queryRunner.query(`DROP INDEX "IDX_4f018d32b6d2e2c907833d0db1"`);
		await queryRunner.query(`DROP INDEX "IDX_d01675da9ddf57bef5692fca8b"`);
		await queryRunner.query(`DROP INDEX "IDX_3d6a8e3430779c21f04513cc5a"`);
		await queryRunner.query(`DROP INDEX "IDX_5b95805861f9de5cf7760a964a"`);
		await queryRunner.query(`DROP INDEX "IDX_4f9397b277ec0791c5f9e2fd62"`);
		await queryRunner.query(`ALTER TABLE "mention" RENAME TO "temporary_mention"`);
		await queryRunner.query(
			`CREATE TABLE "mention" ("deletedAt" datetime, "id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "tenantId" varchar, "organizationId" varchar, "entityId" varchar NOT NULL, "entity" varchar NOT NULL, "parentEntityId" varchar, "parentEntityType" varchar, "actorType" integer, "mentionedEmployeeId" varchar NOT NULL, "employeeId" varchar, CONSTRAINT "FK_4f018d32b6d2e2c907833d0db11" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_580d84e23219b07f520131f9271" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`
		);
		await queryRunner.query(
			`INSERT INTO "mention"("deletedAt", "id", "createdAt", "updatedAt", "isActive", "isArchived", "archivedAt", "tenantId", "organizationId", "entityId", "entity", "parentEntityId", "parentEntityType", "actorType", "mentionedEmployeeId", "employeeId") SELECT "deletedAt", "id", "createdAt", "updatedAt", "isActive", "isArchived", "archivedAt", "tenantId", "organizationId", "entityId", "entity", "parentEntityId", "parentEntityType", "actorType", "mentionedEmployeeId", "employeeId" FROM "temporary_mention"`
		);
		await queryRunner.query(`DROP TABLE "temporary_mention"`);
		await queryRunner.query(`CREATE INDEX "IDX_465f1a9281f338ae38cc961c2a" ON "mention" ("employeeId") `);
		await queryRunner.query(`CREATE INDEX "IDX_a123435acf8d70e5df978e759f" ON "mention" ("mentionedEmployeeId") `);
		await queryRunner.query(`CREATE INDEX "IDX_8a71b1017f6ea51d1913adcae4" ON "mention" ("actorType") `);
		await queryRunner.query(`CREATE INDEX "IDX_2c71b2f53b9162a94e1f02e40b" ON "mention" ("isActive") `);
		await queryRunner.query(`CREATE INDEX "IDX_9597d3f3afbf40e6ffd1b0ebc9" ON "mention" ("isArchived") `);
		await queryRunner.query(`CREATE INDEX "IDX_580d84e23219b07f520131f927" ON "mention" ("tenantId") `);
		await queryRunner.query(`CREATE INDEX "IDX_4f018d32b6d2e2c907833d0db1" ON "mention" ("organizationId") `);
		await queryRunner.query(`CREATE INDEX "IDX_d01675da9ddf57bef5692fca8b" ON "mention" ("entityId") `);
		await queryRunner.query(`CREATE INDEX "IDX_3d6a8e3430779c21f04513cc5a" ON "mention" ("entity") `);
		await queryRunner.query(`CREATE INDEX "IDX_5b95805861f9de5cf7760a964a" ON "mention" ("parentEntityId") `);
		await queryRunner.query(`CREATE INDEX "IDX_4f9397b277ec0791c5f9e2fd62" ON "mention" ("parentEntityType") `);
		await queryRunner.query(`DROP INDEX "IDX_465f1a9281f338ae38cc961c2a"`);
		await queryRunner.query(`DROP INDEX "IDX_a123435acf8d70e5df978e759f"`);
		await queryRunner.query(`DROP INDEX "IDX_8a71b1017f6ea51d1913adcae4"`);
		await queryRunner.query(`DROP INDEX "IDX_2c71b2f53b9162a94e1f02e40b"`);
		await queryRunner.query(`DROP INDEX "IDX_9597d3f3afbf40e6ffd1b0ebc9"`);
		await queryRunner.query(`DROP INDEX "IDX_580d84e23219b07f520131f927"`);
		await queryRunner.query(`DROP INDEX "IDX_4f018d32b6d2e2c907833d0db1"`);
		await queryRunner.query(`DROP INDEX "IDX_d01675da9ddf57bef5692fca8b"`);
		await queryRunner.query(`DROP INDEX "IDX_3d6a8e3430779c21f04513cc5a"`);
		await queryRunner.query(`DROP INDEX "IDX_5b95805861f9de5cf7760a964a"`);
		await queryRunner.query(`DROP INDEX "IDX_4f9397b277ec0791c5f9e2fd62"`);
		await queryRunner.query(`ALTER TABLE "mention" RENAME TO "temporary_mention"`);
		await queryRunner.query(
			`CREATE TABLE "mention" ("deletedAt" datetime, "id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "tenantId" varchar, "organizationId" varchar, "entityId" varchar NOT NULL, "entity" varchar NOT NULL, "parentEntityId" varchar, "parentEntityType" varchar, CONSTRAINT "FK_4f018d32b6d2e2c907833d0db11" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_580d84e23219b07f520131f9271" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`
		);
		await queryRunner.query(
			`INSERT INTO "mention"("deletedAt", "id", "createdAt", "updatedAt", "isActive", "isArchived", "archivedAt", "tenantId", "organizationId", "entityId", "entity", "parentEntityId", "parentEntityType") SELECT "deletedAt", "id", "createdAt", "updatedAt", "isActive", "isArchived", "archivedAt", "tenantId", "organizationId", "entityId", "entity", "parentEntityId", "parentEntityType" FROM "temporary_mention"`
		);
		await queryRunner.query(`DROP TABLE "temporary_mention"`);
		await queryRunner.query(`CREATE INDEX "IDX_2c71b2f53b9162a94e1f02e40b" ON "mention" ("isActive") `);
		await queryRunner.query(`CREATE INDEX "IDX_9597d3f3afbf40e6ffd1b0ebc9" ON "mention" ("isArchived") `);
		await queryRunner.query(`CREATE INDEX "IDX_580d84e23219b07f520131f927" ON "mention" ("tenantId") `);
		await queryRunner.query(`CREATE INDEX "IDX_4f018d32b6d2e2c907833d0db1" ON "mention" ("organizationId") `);
		await queryRunner.query(`CREATE INDEX "IDX_d01675da9ddf57bef5692fca8b" ON "mention" ("entityId") `);
		await queryRunner.query(`CREATE INDEX "IDX_3d6a8e3430779c21f04513cc5a" ON "mention" ("entity") `);
		await queryRunner.query(`CREATE INDEX "IDX_5b95805861f9de5cf7760a964a" ON "mention" ("parentEntityId") `);
		await queryRunner.query(`CREATE INDEX "IDX_4f9397b277ec0791c5f9e2fd62" ON "mention" ("parentEntityType") `);
		await queryRunner.query(`DROP INDEX "IDX_2c71b2f53b9162a94e1f02e40b"`);
		await queryRunner.query(`DROP INDEX "IDX_9597d3f3afbf40e6ffd1b0ebc9"`);
		await queryRunner.query(`DROP INDEX "IDX_580d84e23219b07f520131f927"`);
		await queryRunner.query(`DROP INDEX "IDX_4f018d32b6d2e2c907833d0db1"`);
		await queryRunner.query(`DROP INDEX "IDX_d01675da9ddf57bef5692fca8b"`);
		await queryRunner.query(`DROP INDEX "IDX_3d6a8e3430779c21f04513cc5a"`);
		await queryRunner.query(`DROP INDEX "IDX_5b95805861f9de5cf7760a964a"`);
		await queryRunner.query(`DROP INDEX "IDX_4f9397b277ec0791c5f9e2fd62"`);
		await queryRunner.query(`ALTER TABLE "mention" RENAME TO "temporary_mention"`);
		await queryRunner.query(
			`CREATE TABLE "mention" ("deletedAt" datetime, "id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "tenantId" varchar, "organizationId" varchar, "entityId" varchar NOT NULL, "entity" varchar NOT NULL, "parentEntityId" varchar, "parentEntityType" varchar, "mentionedUserId" varchar NOT NULL, "mentionById" varchar NOT NULL, CONSTRAINT "FK_4f018d32b6d2e2c907833d0db11" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_580d84e23219b07f520131f9271" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`
		);
		await queryRunner.query(
			`INSERT INTO "mention"("deletedAt", "id", "createdAt", "updatedAt", "isActive", "isArchived", "archivedAt", "tenantId", "organizationId", "entityId", "entity", "parentEntityId", "parentEntityType") SELECT "deletedAt", "id", "createdAt", "updatedAt", "isActive", "isArchived", "archivedAt", "tenantId", "organizationId", "entityId", "entity", "parentEntityId", "parentEntityType" FROM "temporary_mention"`
		);
		await queryRunner.query(`DROP TABLE "temporary_mention"`);
		await queryRunner.query(`CREATE INDEX "IDX_2c71b2f53b9162a94e1f02e40b" ON "mention" ("isActive") `);
		await queryRunner.query(`CREATE INDEX "IDX_9597d3f3afbf40e6ffd1b0ebc9" ON "mention" ("isArchived") `);
		await queryRunner.query(`CREATE INDEX "IDX_580d84e23219b07f520131f927" ON "mention" ("tenantId") `);
		await queryRunner.query(`CREATE INDEX "IDX_4f018d32b6d2e2c907833d0db1" ON "mention" ("organizationId") `);
		await queryRunner.query(`CREATE INDEX "IDX_d01675da9ddf57bef5692fca8b" ON "mention" ("entityId") `);
		await queryRunner.query(`CREATE INDEX "IDX_3d6a8e3430779c21f04513cc5a" ON "mention" ("entity") `);
		await queryRunner.query(`CREATE INDEX "IDX_5b95805861f9de5cf7760a964a" ON "mention" ("parentEntityId") `);
		await queryRunner.query(`CREATE INDEX "IDX_4f9397b277ec0791c5f9e2fd62" ON "mention" ("parentEntityType") `);
		await queryRunner.query(`CREATE INDEX "IDX_16a2deee0d7ea361950eed1b94" ON "mention" ("mentionedUserId") `);
		await queryRunner.query(`CREATE INDEX "IDX_34b0087a30379c86b470a4298c" ON "mention" ("mentionById") `);
		await queryRunner.query(`DROP INDEX "IDX_2c71b2f53b9162a94e1f02e40b"`);
		await queryRunner.query(`DROP INDEX "IDX_9597d3f3afbf40e6ffd1b0ebc9"`);
		await queryRunner.query(`DROP INDEX "IDX_580d84e23219b07f520131f927"`);
		await queryRunner.query(`DROP INDEX "IDX_4f018d32b6d2e2c907833d0db1"`);
		await queryRunner.query(`DROP INDEX "IDX_d01675da9ddf57bef5692fca8b"`);
		await queryRunner.query(`DROP INDEX "IDX_3d6a8e3430779c21f04513cc5a"`);
		await queryRunner.query(`DROP INDEX "IDX_5b95805861f9de5cf7760a964a"`);
		await queryRunner.query(`DROP INDEX "IDX_4f9397b277ec0791c5f9e2fd62"`);
		await queryRunner.query(`DROP INDEX "IDX_16a2deee0d7ea361950eed1b94"`);
		await queryRunner.query(`DROP INDEX "IDX_34b0087a30379c86b470a4298c"`);
		await queryRunner.query(`ALTER TABLE "mention" RENAME TO "temporary_mention"`);
		await queryRunner.query(
			`CREATE TABLE "mention" ("deletedAt" datetime, "id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "tenantId" varchar, "organizationId" varchar, "entityId" varchar NOT NULL, "entity" varchar NOT NULL, "parentEntityId" varchar, "parentEntityType" varchar, "mentionedUserId" varchar NOT NULL, "mentionById" varchar NOT NULL, CONSTRAINT "FK_34b0087a30379c86b470a4298ca" FOREIGN KEY ("mentionById") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_16a2deee0d7ea361950eed1b944" FOREIGN KEY ("mentionedUserId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_4f018d32b6d2e2c907833d0db11" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_580d84e23219b07f520131f9271" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`
		);
		await queryRunner.query(
			`INSERT INTO "mention"("deletedAt", "id", "createdAt", "updatedAt", "isActive", "isArchived", "archivedAt", "tenantId", "organizationId", "entityId", "entity", "parentEntityId", "parentEntityType", "mentionedUserId", "mentionById") SELECT "deletedAt", "id", "createdAt", "updatedAt", "isActive", "isArchived", "archivedAt", "tenantId", "organizationId", "entityId", "entity", "parentEntityId", "parentEntityType", "mentionedUserId", "mentionById" FROM "temporary_mention"`
		);
		await queryRunner.query(`DROP TABLE "temporary_mention"`);
		await queryRunner.query(`CREATE INDEX "IDX_2c71b2f53b9162a94e1f02e40b" ON "mention" ("isActive") `);
		await queryRunner.query(`CREATE INDEX "IDX_9597d3f3afbf40e6ffd1b0ebc9" ON "mention" ("isArchived") `);
		await queryRunner.query(`CREATE INDEX "IDX_580d84e23219b07f520131f927" ON "mention" ("tenantId") `);
		await queryRunner.query(`CREATE INDEX "IDX_4f018d32b6d2e2c907833d0db1" ON "mention" ("organizationId") `);
		await queryRunner.query(`CREATE INDEX "IDX_d01675da9ddf57bef5692fca8b" ON "mention" ("entityId") `);
		await queryRunner.query(`CREATE INDEX "IDX_3d6a8e3430779c21f04513cc5a" ON "mention" ("entity") `);
		await queryRunner.query(`CREATE INDEX "IDX_5b95805861f9de5cf7760a964a" ON "mention" ("parentEntityId") `);
		await queryRunner.query(`CREATE INDEX "IDX_4f9397b277ec0791c5f9e2fd62" ON "mention" ("parentEntityType") `);
		await queryRunner.query(`CREATE INDEX "IDX_16a2deee0d7ea361950eed1b94" ON "mention" ("mentionedUserId") `);
		await queryRunner.query(`CREATE INDEX "IDX_34b0087a30379c86b470a4298c" ON "mention" ("mentionById") `);
	}

	/**
	 * MySQL Up Migration
	 *
	 * @param queryRunner
	 */
	public async mysqlUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(`ALTER TABLE \`mention\` DROP FOREIGN KEY \`FK_16a2deee0d7ea361950eed1b944\``);
		await queryRunner.query(`ALTER TABLE \`mention\` DROP FOREIGN KEY \`FK_34b0087a30379c86b470a4298ca\``);
		await queryRunner.query(`DROP INDEX \`IDX_34b0087a30379c86b470a4298c\` ON \`mention\``);
		await queryRunner.query(`DROP INDEX \`IDX_16a2deee0d7ea361950eed1b94\` ON \`mention\``);
		await queryRunner.query(`ALTER TABLE \`mention\` DROP COLUMN \`mentionById\``);
		await queryRunner.query(`ALTER TABLE \`mention\` DROP COLUMN \`mentionedUserId\``);
		await queryRunner.query(`ALTER TABLE \`mention\` ADD \`actorType\` int NULL`);
		await queryRunner.query(`ALTER TABLE \`mention\` ADD \`mentionedEmployeeId\` varchar(255) NOT NULL`);
		await queryRunner.query(`ALTER TABLE \`mention\` ADD \`employeeId\` varchar(255) NULL`);
		await queryRunner.query(`CREATE INDEX \`IDX_8a71b1017f6ea51d1913adcae4\` ON \`mention\` (\`actorType\`)`);
		await queryRunner.query(
			`CREATE INDEX \`IDX_a123435acf8d70e5df978e759f\` ON \`mention\` (\`mentionedEmployeeId\`)`
		);
		await queryRunner.query(`CREATE INDEX \`IDX_465f1a9281f338ae38cc961c2a\` ON \`mention\` (\`employeeId\`)`);
		await queryRunner.query(
			`ALTER TABLE \`mention\` ADD CONSTRAINT \`FK_a123435acf8d70e5df978e759f9\` FOREIGN KEY (\`mentionedEmployeeId\`) REFERENCES \`employee\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`mention\` ADD CONSTRAINT \`FK_465f1a9281f338ae38cc961c2a5\` FOREIGN KEY (\`employeeId\`) REFERENCES \`employee\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
	}

	/**
	 * MySQL Down Migration
	 *
	 * @param queryRunner
	 */
	public async mysqlDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(`ALTER TABLE \`mention\` DROP FOREIGN KEY \`FK_465f1a9281f338ae38cc961c2a5\``);
		await queryRunner.query(`ALTER TABLE \`mention\` DROP FOREIGN KEY \`FK_a123435acf8d70e5df978e759f9\``);
		await queryRunner.query(`DROP INDEX \`IDX_465f1a9281f338ae38cc961c2a\` ON \`mention\``);
		await queryRunner.query(`DROP INDEX \`IDX_a123435acf8d70e5df978e759f\` ON \`mention\``);
		await queryRunner.query(`DROP INDEX \`IDX_8a71b1017f6ea51d1913adcae4\` ON \`mention\``);
		await queryRunner.query(`ALTER TABLE \`mention\` DROP COLUMN \`employeeId\``);
		await queryRunner.query(`ALTER TABLE \`mention\` DROP COLUMN \`mentionedEmployeeId\``);
		await queryRunner.query(`ALTER TABLE \`mention\` DROP COLUMN \`actorType\``);
		await queryRunner.query(`ALTER TABLE \`mention\` ADD \`mentionedUserId\` varchar(255) NOT NULL`);
		await queryRunner.query(`ALTER TABLE \`mention\` ADD \`mentionById\` varchar(255) NOT NULL`);
		await queryRunner.query(`CREATE INDEX \`IDX_16a2deee0d7ea361950eed1b94\` ON \`mention\` (\`mentionedUserId\`)`);
		await queryRunner.query(`CREATE INDEX \`IDX_34b0087a30379c86b470a4298c\` ON \`mention\` (\`mentionById\`)`);
		await queryRunner.query(
			`ALTER TABLE \`mention\` ADD CONSTRAINT \`FK_34b0087a30379c86b470a4298ca\` FOREIGN KEY (\`mentionById\`) REFERENCES \`user\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
		await queryRunner.query(
			`ALTER TABLE \`mention\` ADD CONSTRAINT \`FK_16a2deee0d7ea361950eed1b944\` FOREIGN KEY (\`mentionedUserId\`) REFERENCES \`user\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`
		);
	}
}
