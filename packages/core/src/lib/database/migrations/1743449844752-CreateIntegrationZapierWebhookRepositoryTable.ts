
import { MigrationInterface, QueryRunner } from "typeorm";
import * as chalk from 'chalk';
import { DatabaseTypeEnum } from "@gauzy/config";

export class CreateIntegrationZapierWebhookRepositoryTable1743449844752 implements MigrationInterface {

    name = 'CreateIntegrationZapierWebhookRepositoryTable1743449844752';

    /**
     * Up Migration
     *
     * @param queryRunner
     */
    public async up(queryRunner: QueryRunner): Promise<void> {
        console.log(chalk.yellow(`${this.name} start running!`));

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
        await queryRunner.query(`CREATE TABLE "zapier_webhook_subscriptions" ("deletedAt" TIMESTAMP, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "createdByUserId" uuid, "updatedByUserId" uuid, "deletedByUserId" uuid, "id" uuid NOT NULL DEFAULT gen_random_uuid(), "isActive" boolean DEFAULT true, "isArchived" boolean DEFAULT false, "archivedAt" TIMESTAMP, "tenantId" uuid, "organizationId" uuid, "targetUrl" character varying NOT NULL, "event" character varying NOT NULL, "integrationId" uuid, CONSTRAINT "PK_095117a6be3c41bea4a0ee4f654" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_7ac5d8545140784b6cefa771b6" ON "zapier_webhook_subscriptions" ("createdByUserId") `);
        await queryRunner.query(`CREATE INDEX "IDX_41a8a30ed05b7c03ba4ffa0a5a" ON "zapier_webhook_subscriptions" ("updatedByUserId") `);
        await queryRunner.query(`CREATE INDEX "IDX_00d7295263f758a465acc55028" ON "zapier_webhook_subscriptions" ("deletedByUserId") `);
        await queryRunner.query(`CREATE INDEX "IDX_4a20a462973171ee872620eb0c" ON "zapier_webhook_subscriptions" ("isActive") `);
        await queryRunner.query(`CREATE INDEX "IDX_5feb24771dd5f4e24ce01f988d" ON "zapier_webhook_subscriptions" ("isArchived") `);
        await queryRunner.query(`CREATE INDEX "IDX_4eeb6acd2b5eee53148b52526b" ON "zapier_webhook_subscriptions" ("tenantId") `);
        await queryRunner.query(`CREATE INDEX "IDX_7257011058fb1c910277b5ea0b" ON "zapier_webhook_subscriptions" ("organizationId") `);
        await queryRunner.query(`CREATE INDEX "IDX_5e200877326e3bb0f8cbc1c600" ON "zapier_webhook_subscriptions" ("targetUrl") `);
        await queryRunner.query(`CREATE INDEX "IDX_b72a0994510a7705a4ae15f75a" ON "zapier_webhook_subscriptions" ("event") `);
        await queryRunner.query(`CREATE INDEX "IDX_2d6e5ddfbfc190b802b8373a1c" ON "zapier_webhook_subscriptions" ("integrationId") `);
        await queryRunner.query(`ALTER TABLE "zapier_webhook_subscriptions" ADD CONSTRAINT "FK_7ac5d8545140784b6cefa771b65" FOREIGN KEY ("createdByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "zapier_webhook_subscriptions" ADD CONSTRAINT "FK_41a8a30ed05b7c03ba4ffa0a5a6" FOREIGN KEY ("updatedByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "zapier_webhook_subscriptions" ADD CONSTRAINT "FK_00d7295263f758a465acc550281" FOREIGN KEY ("deletedByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "zapier_webhook_subscriptions" ADD CONSTRAINT "FK_4eeb6acd2b5eee53148b52526b1" FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "zapier_webhook_subscriptions" ADD CONSTRAINT "FK_7257011058fb1c910277b5ea0b7" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE "zapier_webhook_subscriptions" ADD CONSTRAINT "FK_2d6e5ddfbfc190b802b8373a1c1" FOREIGN KEY ("integrationId") REFERENCES "integration_tenant"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    /**
    * PostgresDB Down Migration
    *
    * @param queryRunner
    */
    public async postgresDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`ALTER TABLE "zapier_webhook_subscriptions" DROP CONSTRAINT "FK_2d6e5ddfbfc190b802b8373a1c1"`);
        await queryRunner.query(`ALTER TABLE "zapier_webhook_subscriptions" DROP CONSTRAINT "FK_7257011058fb1c910277b5ea0b7"`);
        await queryRunner.query(`ALTER TABLE "zapier_webhook_subscriptions" DROP CONSTRAINT "FK_4eeb6acd2b5eee53148b52526b1"`);
        await queryRunner.query(`ALTER TABLE "zapier_webhook_subscriptions" DROP CONSTRAINT "FK_00d7295263f758a465acc550281"`);
        await queryRunner.query(`ALTER TABLE "zapier_webhook_subscriptions" DROP CONSTRAINT "FK_41a8a30ed05b7c03ba4ffa0a5a6"`);
        await queryRunner.query(`ALTER TABLE "zapier_webhook_subscriptions" DROP CONSTRAINT "FK_7ac5d8545140784b6cefa771b65"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_2d6e5ddfbfc190b802b8373a1c"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_b72a0994510a7705a4ae15f75a"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_5e200877326e3bb0f8cbc1c600"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_7257011058fb1c910277b5ea0b"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_4eeb6acd2b5eee53148b52526b"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_5feb24771dd5f4e24ce01f988d"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_4a20a462973171ee872620eb0c"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_00d7295263f758a465acc55028"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_41a8a30ed05b7c03ba4ffa0a5a"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_7ac5d8545140784b6cefa771b6"`);
        await queryRunner.query(`DROP TABLE "zapier_webhook_subscriptions"`);
    }

    /**
    * SqliteDB and BetterSQlite3DB Up Migration
    *
    * @param queryRunner
    */
    public async sqliteUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`CREATE TABLE "zapier_webhook_subscriptions" ("deletedAt" datetime, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "createdByUserId" varchar, "updatedByUserId" varchar, "deletedByUserId" varchar, "id" varchar PRIMARY KEY NOT NULL, "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "tenantId" varchar, "organizationId" varchar, "targetUrl" varchar NOT NULL, "event" varchar NOT NULL, "integrationId" varchar)`);
        await queryRunner.query(`CREATE INDEX "IDX_7ac5d8545140784b6cefa771b6" ON "zapier_webhook_subscriptions" ("createdByUserId") `);
        await queryRunner.query(`CREATE INDEX "IDX_41a8a30ed05b7c03ba4ffa0a5a" ON "zapier_webhook_subscriptions" ("updatedByUserId") `);
        await queryRunner.query(`CREATE INDEX "IDX_00d7295263f758a465acc55028" ON "zapier_webhook_subscriptions" ("deletedByUserId") `);
        await queryRunner.query(`CREATE INDEX "IDX_4a20a462973171ee872620eb0c" ON "zapier_webhook_subscriptions" ("isActive") `);
        await queryRunner.query(`CREATE INDEX "IDX_5feb24771dd5f4e24ce01f988d" ON "zapier_webhook_subscriptions" ("isArchived") `);
        await queryRunner.query(`CREATE INDEX "IDX_4eeb6acd2b5eee53148b52526b" ON "zapier_webhook_subscriptions" ("tenantId") `);
        await queryRunner.query(`CREATE INDEX "IDX_7257011058fb1c910277b5ea0b" ON "zapier_webhook_subscriptions" ("organizationId") `);
        await queryRunner.query(`CREATE INDEX "IDX_5e200877326e3bb0f8cbc1c600" ON "zapier_webhook_subscriptions" ("targetUrl") `);
        await queryRunner.query(`CREATE INDEX "IDX_b72a0994510a7705a4ae15f75a" ON "zapier_webhook_subscriptions" ("event") `);
        await queryRunner.query(`CREATE INDEX "IDX_2d6e5ddfbfc190b802b8373a1c" ON "zapier_webhook_subscriptions" ("integrationId") `);
        await queryRunner.query(`DROP INDEX "IDX_7ac5d8545140784b6cefa771b6"`);
        await queryRunner.query(`DROP INDEX "IDX_41a8a30ed05b7c03ba4ffa0a5a"`);
        await queryRunner.query(`DROP INDEX "IDX_00d7295263f758a465acc55028"`);
        await queryRunner.query(`DROP INDEX "IDX_4a20a462973171ee872620eb0c"`);
        await queryRunner.query(`DROP INDEX "IDX_5feb24771dd5f4e24ce01f988d"`);
        await queryRunner.query(`DROP INDEX "IDX_4eeb6acd2b5eee53148b52526b"`);
        await queryRunner.query(`DROP INDEX "IDX_7257011058fb1c910277b5ea0b"`);
        await queryRunner.query(`DROP INDEX "IDX_5e200877326e3bb0f8cbc1c600"`);
        await queryRunner.query(`DROP INDEX "IDX_b72a0994510a7705a4ae15f75a"`);
        await queryRunner.query(`DROP INDEX "IDX_2d6e5ddfbfc190b802b8373a1c"`);
        await queryRunner.query(`CREATE TABLE "temporary_zapier_webhook_subscriptions" ("deletedAt" datetime, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "createdByUserId" varchar, "updatedByUserId" varchar, "deletedByUserId" varchar, "id" varchar PRIMARY KEY NOT NULL, "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "tenantId" varchar, "organizationId" varchar, "targetUrl" varchar NOT NULL, "event" varchar NOT NULL, "integrationId" varchar, CONSTRAINT "FK_7ac5d8545140784b6cefa771b65" FOREIGN KEY ("createdByUserId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_41a8a30ed05b7c03ba4ffa0a5a6" FOREIGN KEY ("updatedByUserId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_00d7295263f758a465acc550281" FOREIGN KEY ("deletedByUserId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_4eeb6acd2b5eee53148b52526b1" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_7257011058fb1c910277b5ea0b7" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_2d6e5ddfbfc190b802b8373a1c1" FOREIGN KEY ("integrationId") REFERENCES "integration_tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`);
        await queryRunner.query(`INSERT INTO "temporary_zapier_webhook_subscriptions"("deletedAt", "createdAt", "updatedAt", "createdByUserId", "updatedByUserId", "deletedByUserId", "id", "isActive", "isArchived", "archivedAt", "tenantId", "organizationId", "targetUrl", "event", "integrationId") SELECT "deletedAt", "createdAt", "updatedAt", "createdByUserId", "updatedByUserId", "deletedByUserId", "id", "isActive", "isArchived", "archivedAt", "tenantId", "organizationId", "targetUrl", "event", "integrationId" FROM "zapier_webhook_subscriptions"`);
        await queryRunner.query(`DROP TABLE "zapier_webhook_subscriptions"`);
        await queryRunner.query(`ALTER TABLE "temporary_zapier_webhook_subscriptions" RENAME TO "zapier_webhook_subscriptions"`);
        await queryRunner.query(`CREATE INDEX "IDX_7ac5d8545140784b6cefa771b6" ON "zapier_webhook_subscriptions" ("createdByUserId") `);
        await queryRunner.query(`CREATE INDEX "IDX_41a8a30ed05b7c03ba4ffa0a5a" ON "zapier_webhook_subscriptions" ("updatedByUserId") `);
        await queryRunner.query(`CREATE INDEX "IDX_00d7295263f758a465acc55028" ON "zapier_webhook_subscriptions" ("deletedByUserId") `);
        await queryRunner.query(`CREATE INDEX "IDX_4a20a462973171ee872620eb0c" ON "zapier_webhook_subscriptions" ("isActive") `);
        await queryRunner.query(`CREATE INDEX "IDX_5feb24771dd5f4e24ce01f988d" ON "zapier_webhook_subscriptions" ("isArchived") `);
        await queryRunner.query(`CREATE INDEX "IDX_4eeb6acd2b5eee53148b52526b" ON "zapier_webhook_subscriptions" ("tenantId") `);
        await queryRunner.query(`CREATE INDEX "IDX_7257011058fb1c910277b5ea0b" ON "zapier_webhook_subscriptions" ("organizationId") `);
        await queryRunner.query(`CREATE INDEX "IDX_5e200877326e3bb0f8cbc1c600" ON "zapier_webhook_subscriptions" ("targetUrl") `);
        await queryRunner.query(`CREATE INDEX "IDX_b72a0994510a7705a4ae15f75a" ON "zapier_webhook_subscriptions" ("event") `);
        await queryRunner.query(`CREATE INDEX "IDX_2d6e5ddfbfc190b802b8373a1c" ON "zapier_webhook_subscriptions" ("integrationId") `);
    }

    /**
    * SqliteDB and BetterSQlite3DB Down Migration
    *
    * @param queryRunner
    */
    public async sqliteDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`DROP INDEX "IDX_2d6e5ddfbfc190b802b8373a1c"`);
        await queryRunner.query(`DROP INDEX "IDX_b72a0994510a7705a4ae15f75a"`);
        await queryRunner.query(`DROP INDEX "IDX_5e200877326e3bb0f8cbc1c600"`);
        await queryRunner.query(`DROP INDEX "IDX_7257011058fb1c910277b5ea0b"`);
        await queryRunner.query(`DROP INDEX "IDX_4eeb6acd2b5eee53148b52526b"`);
        await queryRunner.query(`DROP INDEX "IDX_5feb24771dd5f4e24ce01f988d"`);
        await queryRunner.query(`DROP INDEX "IDX_4a20a462973171ee872620eb0c"`);
        await queryRunner.query(`DROP INDEX "IDX_00d7295263f758a465acc55028"`);
        await queryRunner.query(`DROP INDEX "IDX_41a8a30ed05b7c03ba4ffa0a5a"`);
        await queryRunner.query(`DROP INDEX "IDX_7ac5d8545140784b6cefa771b6"`);
        await queryRunner.query(`ALTER TABLE "zapier_webhook_subscriptions" RENAME TO "temporary_zapier_webhook_subscriptions"`);
        await queryRunner.query(`CREATE TABLE "zapier_webhook_subscriptions" ("deletedAt" datetime, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "createdByUserId" varchar, "updatedByUserId" varchar, "deletedByUserId" varchar, "id" varchar PRIMARY KEY NOT NULL, "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "tenantId" varchar, "organizationId" varchar, "targetUrl" varchar NOT NULL, "event" varchar NOT NULL, "integrationId" varchar)`);
        await queryRunner.query(`INSERT INTO "zapier_webhook_subscriptions"("deletedAt", "createdAt", "updatedAt", "createdByUserId", "updatedByUserId", "deletedByUserId", "id", "isActive", "isArchived", "archivedAt", "tenantId", "organizationId", "targetUrl", "event", "integrationId") SELECT "deletedAt", "createdAt", "updatedAt", "createdByUserId", "updatedByUserId", "deletedByUserId", "id", "isActive", "isArchived", "archivedAt", "tenantId", "organizationId", "targetUrl", "event", "integrationId" FROM "temporary_zapier_webhook_subscriptions"`);
        await queryRunner.query(`DROP TABLE "temporary_zapier_webhook_subscriptions"`);
        await queryRunner.query(`CREATE INDEX "IDX_2d6e5ddfbfc190b802b8373a1c" ON "zapier_webhook_subscriptions" ("integrationId") `);
        await queryRunner.query(`CREATE INDEX "IDX_b72a0994510a7705a4ae15f75a" ON "zapier_webhook_subscriptions" ("event") `);
        await queryRunner.query(`CREATE INDEX "IDX_5e200877326e3bb0f8cbc1c600" ON "zapier_webhook_subscriptions" ("targetUrl") `);
        await queryRunner.query(`CREATE INDEX "IDX_7257011058fb1c910277b5ea0b" ON "zapier_webhook_subscriptions" ("organizationId") `);
        await queryRunner.query(`CREATE INDEX "IDX_4eeb6acd2b5eee53148b52526b" ON "zapier_webhook_subscriptions" ("tenantId") `);
        await queryRunner.query(`CREATE INDEX "IDX_5feb24771dd5f4e24ce01f988d" ON "zapier_webhook_subscriptions" ("isArchived") `);
        await queryRunner.query(`CREATE INDEX "IDX_4a20a462973171ee872620eb0c" ON "zapier_webhook_subscriptions" ("isActive") `);
        await queryRunner.query(`CREATE INDEX "IDX_00d7295263f758a465acc55028" ON "zapier_webhook_subscriptions" ("deletedByUserId") `);
        await queryRunner.query(`CREATE INDEX "IDX_41a8a30ed05b7c03ba4ffa0a5a" ON "zapier_webhook_subscriptions" ("updatedByUserId") `);
        await queryRunner.query(`CREATE INDEX "IDX_7ac5d8545140784b6cefa771b6" ON "zapier_webhook_subscriptions" ("createdByUserId") `);
        await queryRunner.query(`DROP INDEX "IDX_2d6e5ddfbfc190b802b8373a1c"`);
        await queryRunner.query(`DROP INDEX "IDX_b72a0994510a7705a4ae15f75a"`);
        await queryRunner.query(`DROP INDEX "IDX_5e200877326e3bb0f8cbc1c600"`);
        await queryRunner.query(`DROP INDEX "IDX_7257011058fb1c910277b5ea0b"`);
        await queryRunner.query(`DROP INDEX "IDX_4eeb6acd2b5eee53148b52526b"`);
        await queryRunner.query(`DROP INDEX "IDX_5feb24771dd5f4e24ce01f988d"`);
        await queryRunner.query(`DROP INDEX "IDX_4a20a462973171ee872620eb0c"`);
        await queryRunner.query(`DROP INDEX "IDX_00d7295263f758a465acc55028"`);
        await queryRunner.query(`DROP INDEX "IDX_41a8a30ed05b7c03ba4ffa0a5a"`);
        await queryRunner.query(`DROP INDEX "IDX_7ac5d8545140784b6cefa771b6"`);
        await queryRunner.query(`DROP TABLE "zapier_webhook_subscriptions"`);
    }

    /**
     * MySQL Up Migration
     *
     * @param queryRunner
     */
    public async mysqlUpQueryRunner(queryRunner: QueryRunner): Promise<any> {

    }

    /**
     * MySQL Down Migration
     *
     * @param queryRunner
     */
    public async mysqlDownQueryRunner(queryRunner: QueryRunner): Promise<any> {

    }
}
