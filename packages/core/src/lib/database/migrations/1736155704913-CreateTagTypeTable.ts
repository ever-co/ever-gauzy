
import { MigrationInterface, QueryRunner } from "typeorm";
import * as chalk from 'chalk';
import { DatabaseTypeEnum } from "@gauzy/config";

export class CreateTagTypeTable1736155704913 implements MigrationInterface {

    name = 'CreateTagTypeTable1736155704913';

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
        await queryRunner.query(`CREATE TABLE "tag_type" ("deletedAt" TIMESTAMP, "id" uuid NOT NULL DEFAULT gen_random_uuid(), "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "isActive" boolean DEFAULT true, "isArchived" boolean DEFAULT false, "archivedAt" TIMESTAMP, "tenantId" uuid, "organizationId" uuid, "type" character varying NOT NULL, CONSTRAINT "PK_0829ee814cd10d5a337eaa07443" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_c1bef0b8aa28d47b9907667a1f" ON "tag_type" ("isActive") `);
        await queryRunner.query(`CREATE INDEX "IDX_e2d517d3e3ff2a873f43367813" ON "tag_type" ("isArchived") `);
        await queryRunner.query(`CREATE INDEX "IDX_556112dc97b482454726198f25" ON "tag_type" ("tenantId") `);
        await queryRunner.query(`CREATE INDEX "IDX_dcefa726d2f515583535cb540f" ON "tag_type" ("organizationId") `);
        await queryRunner.query(`ALTER TABLE "tag" ADD "tagTypeId" uuid`);
        await queryRunner.query(`CREATE INDEX "IDX_1c84215eb01fa457d0beeaee7f" ON "tag" ("tagTypeId") `);
        await queryRunner.query(`ALTER TABLE "tag" ADD CONSTRAINT "FK_1c84215eb01fa457d0beeaee7fc" FOREIGN KEY ("tagTypeId") REFERENCES "tag_type"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "tag_type" ADD CONSTRAINT "FK_556112dc97b482454726198f250" FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "tag_type" ADD CONSTRAINT "FK_dcefa726d2f515583535cb540f3" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
    }

    /**
    * PostgresDB Down Migration
    *
    * @param queryRunner
    */
    public async postgresDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`ALTER TABLE "tag_type" DROP CONSTRAINT "FK_dcefa726d2f515583535cb540f3"`);
        await queryRunner.query(`ALTER TABLE "tag_type" DROP CONSTRAINT "FK_556112dc97b482454726198f250"`);
        await queryRunner.query(`ALTER TABLE "tag" DROP CONSTRAINT "FK_1c84215eb01fa457d0beeaee7fc"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_1c84215eb01fa457d0beeaee7f"`);
        await queryRunner.query(`ALTER TABLE "tag" DROP COLUMN "tagTypeId"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_dcefa726d2f515583535cb540f"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_556112dc97b482454726198f25"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_e2d517d3e3ff2a873f43367813"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_c1bef0b8aa28d47b9907667a1f"`);
        await queryRunner.query(`DROP TABLE "tag_type"`);
    }

    /**
    * SqliteDB and BetterSQlite3DB Up Migration
    *
    * @param queryRunner
    */
    public async sqliteUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`CREATE TABLE "tag_type" ("deletedAt" datetime, "id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "tenantId" varchar, "organizationId" varchar, "type" varchar NOT NULL)`);
        await queryRunner.query(`CREATE INDEX "IDX_c1bef0b8aa28d47b9907667a1f" ON "tag_type" ("isActive") `);
        await queryRunner.query(`CREATE INDEX "IDX_e2d517d3e3ff2a873f43367813" ON "tag_type" ("isArchived") `);
        await queryRunner.query(`CREATE INDEX "IDX_556112dc97b482454726198f25" ON "tag_type" ("tenantId") `);
        await queryRunner.query(`CREATE INDEX "IDX_dcefa726d2f515583535cb540f" ON "tag_type" ("organizationId") `);
        await queryRunner.query(`DROP INDEX "IDX_49746602acc4e5e8721062b69e"`);
        await queryRunner.query(`DROP INDEX "IDX_b08dd29fb6a8acdf83c83d8988"`);
        await queryRunner.query(`DROP INDEX "IDX_c2f6bec0b39eaa3a6d90903ae9"`);
        await queryRunner.query(`DROP INDEX "IDX_1f22c73374bcca1ea84a4dca59"`);
        await queryRunner.query(`DROP INDEX "IDX_58876ee26a90170551027459bf"`);
        await queryRunner.query(`CREATE TABLE "temporary_tag" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "organizationId" varchar, "name" varchar NOT NULL, "description" varchar, "color" varchar NOT NULL, "isSystem" boolean NOT NULL DEFAULT (0), "icon" varchar, "organizationTeamId" varchar, "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "deletedAt" datetime, "textColor" varchar, "fix_relational_custom_fields" boolean, "archivedAt" datetime, "tagTypeId" varchar, CONSTRAINT "FK_49746602acc4e5e8721062b69ec" FOREIGN KEY ("organizationTeamId") REFERENCES "organization_team" ("id") ON DELETE SET NULL ON UPDATE NO ACTION, CONSTRAINT "FK_b08dd29fb6a8acdf83c83d8988f" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_c2f6bec0b39eaa3a6d90903ae99" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE)`);
        await queryRunner.query(`INSERT INTO "temporary_tag"("id", "createdAt", "updatedAt", "tenantId", "organizationId", "name", "description", "color", "isSystem", "icon", "organizationTeamId", "isActive", "isArchived", "deletedAt", "textColor", "fix_relational_custom_fields", "archivedAt") SELECT "id", "createdAt", "updatedAt", "tenantId", "organizationId", "name", "description", "color", "isSystem", "icon", "organizationTeamId", "isActive", "isArchived", "deletedAt", "textColor", "fix_relational_custom_fields", "archivedAt" FROM "tag"`);
        await queryRunner.query(`DROP TABLE "tag"`);
        await queryRunner.query(`ALTER TABLE "temporary_tag" RENAME TO "tag"`);
        await queryRunner.query(`CREATE INDEX "IDX_49746602acc4e5e8721062b69e" ON "tag" ("organizationTeamId") `);
        await queryRunner.query(`CREATE INDEX "IDX_b08dd29fb6a8acdf83c83d8988" ON "tag" ("tenantId") `);
        await queryRunner.query(`CREATE INDEX "IDX_c2f6bec0b39eaa3a6d90903ae9" ON "tag" ("organizationId") `);
        await queryRunner.query(`CREATE INDEX "IDX_1f22c73374bcca1ea84a4dca59" ON "tag" ("isActive") `);
        await queryRunner.query(`CREATE INDEX "IDX_58876ee26a90170551027459bf" ON "tag" ("isArchived") `);
        await queryRunner.query(`CREATE INDEX "IDX_1c84215eb01fa457d0beeaee7f" ON "tag" ("tagTypeId") `);
        await queryRunner.query(`DROP INDEX "IDX_49746602acc4e5e8721062b69e"`);
        await queryRunner.query(`DROP INDEX "IDX_b08dd29fb6a8acdf83c83d8988"`);
        await queryRunner.query(`DROP INDEX "IDX_c2f6bec0b39eaa3a6d90903ae9"`);
        await queryRunner.query(`DROP INDEX "IDX_1f22c73374bcca1ea84a4dca59"`);
        await queryRunner.query(`DROP INDEX "IDX_58876ee26a90170551027459bf"`);
        await queryRunner.query(`DROP INDEX "IDX_1c84215eb01fa457d0beeaee7f"`);
        await queryRunner.query(`CREATE TABLE "temporary_tag" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "organizationId" varchar, "name" varchar NOT NULL, "description" varchar, "color" varchar NOT NULL, "isSystem" boolean NOT NULL DEFAULT (0), "icon" varchar, "organizationTeamId" varchar, "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "deletedAt" datetime, "textColor" varchar, "fix_relational_custom_fields" boolean, "archivedAt" datetime, "tagTypeId" varchar, CONSTRAINT "FK_49746602acc4e5e8721062b69ec" FOREIGN KEY ("organizationTeamId") REFERENCES "organization_team" ("id") ON DELETE SET NULL ON UPDATE NO ACTION, CONSTRAINT "FK_b08dd29fb6a8acdf83c83d8988f" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_c2f6bec0b39eaa3a6d90903ae99" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_1c84215eb01fa457d0beeaee7fc" FOREIGN KEY ("tagTypeId") REFERENCES "tag_type" ("id") ON DELETE SET NULL ON UPDATE NO ACTION)`);
        await queryRunner.query(`INSERT INTO "temporary_tag"("id", "createdAt", "updatedAt", "tenantId", "organizationId", "name", "description", "color", "isSystem", "icon", "organizationTeamId", "isActive", "isArchived", "deletedAt", "textColor", "fix_relational_custom_fields", "archivedAt", "tagTypeId") SELECT "id", "createdAt", "updatedAt", "tenantId", "organizationId", "name", "description", "color", "isSystem", "icon", "organizationTeamId", "isActive", "isArchived", "deletedAt", "textColor", "fix_relational_custom_fields", "archivedAt", "tagTypeId" FROM "tag"`);
        await queryRunner.query(`DROP TABLE "tag"`);
        await queryRunner.query(`ALTER TABLE "temporary_tag" RENAME TO "tag"`);
        await queryRunner.query(`CREATE INDEX "IDX_49746602acc4e5e8721062b69e" ON "tag" ("organizationTeamId") `);
        await queryRunner.query(`CREATE INDEX "IDX_b08dd29fb6a8acdf83c83d8988" ON "tag" ("tenantId") `);
        await queryRunner.query(`CREATE INDEX "IDX_c2f6bec0b39eaa3a6d90903ae9" ON "tag" ("organizationId") `);
        await queryRunner.query(`CREATE INDEX "IDX_1f22c73374bcca1ea84a4dca59" ON "tag" ("isActive") `);
        await queryRunner.query(`CREATE INDEX "IDX_58876ee26a90170551027459bf" ON "tag" ("isArchived") `);
        await queryRunner.query(`CREATE INDEX "IDX_1c84215eb01fa457d0beeaee7f" ON "tag" ("tagTypeId") `);
        await queryRunner.query(`DROP INDEX "IDX_c1bef0b8aa28d47b9907667a1f"`);
        await queryRunner.query(`DROP INDEX "IDX_e2d517d3e3ff2a873f43367813"`);
        await queryRunner.query(`DROP INDEX "IDX_556112dc97b482454726198f25"`);
        await queryRunner.query(`DROP INDEX "IDX_dcefa726d2f515583535cb540f"`);
        await queryRunner.query(`CREATE TABLE "temporary_tag_type" ("deletedAt" datetime, "id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "tenantId" varchar, "organizationId" varchar, "type" varchar NOT NULL, CONSTRAINT "FK_556112dc97b482454726198f250" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_dcefa726d2f515583535cb540f3" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE)`);
        await queryRunner.query(`INSERT INTO "temporary_tag_type"("deletedAt", "id", "createdAt", "updatedAt", "isActive", "isArchived", "archivedAt", "tenantId", "organizationId", "type") SELECT "deletedAt", "id", "createdAt", "updatedAt", "isActive", "isArchived", "archivedAt", "tenantId", "organizationId", "type" FROM "tag_type"`);
        await queryRunner.query(`DROP TABLE "tag_type"`);
        await queryRunner.query(`ALTER TABLE "temporary_tag_type" RENAME TO "tag_type"`);
        await queryRunner.query(`CREATE INDEX "IDX_c1bef0b8aa28d47b9907667a1f" ON "tag_type" ("isActive") `);
        await queryRunner.query(`CREATE INDEX "IDX_e2d517d3e3ff2a873f43367813" ON "tag_type" ("isArchived") `);
        await queryRunner.query(`CREATE INDEX "IDX_556112dc97b482454726198f25" ON "tag_type" ("tenantId") `);
        await queryRunner.query(`CREATE INDEX "IDX_dcefa726d2f515583535cb540f" ON "tag_type" ("organizationId") `);
    }

    /**
    * SqliteDB and BetterSQlite3DB Down Migration
    *
    * @param queryRunner
    */
    public async sqliteDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`DROP INDEX "IDX_dcefa726d2f515583535cb540f"`);
        await queryRunner.query(`DROP INDEX "IDX_556112dc97b482454726198f25"`);
        await queryRunner.query(`DROP INDEX "IDX_e2d517d3e3ff2a873f43367813"`);
        await queryRunner.query(`DROP INDEX "IDX_c1bef0b8aa28d47b9907667a1f"`);
        await queryRunner.query(`ALTER TABLE "tag_type" RENAME TO "temporary_tag_type"`);
        await queryRunner.query(`CREATE TABLE "tag_type" ("deletedAt" datetime, "id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "tenantId" varchar, "organizationId" varchar, "type" varchar NOT NULL)`);
        await queryRunner.query(`INSERT INTO "tag_type"("deletedAt", "id", "createdAt", "updatedAt", "isActive", "isArchived", "archivedAt", "tenantId", "organizationId", "type") SELECT "deletedAt", "id", "createdAt", "updatedAt", "isActive", "isArchived", "archivedAt", "tenantId", "organizationId", "type" FROM "temporary_tag_type"`);
        await queryRunner.query(`DROP TABLE "temporary_tag_type"`);
        await queryRunner.query(`CREATE INDEX "IDX_dcefa726d2f515583535cb540f" ON "tag_type" ("organizationId") `);
        await queryRunner.query(`CREATE INDEX "IDX_556112dc97b482454726198f25" ON "tag_type" ("tenantId") `);
        await queryRunner.query(`CREATE INDEX "IDX_e2d517d3e3ff2a873f43367813" ON "tag_type" ("isArchived") `);
        await queryRunner.query(`CREATE INDEX "IDX_c1bef0b8aa28d47b9907667a1f" ON "tag_type" ("isActive") `);
        await queryRunner.query(`DROP INDEX "IDX_1c84215eb01fa457d0beeaee7f"`);
        await queryRunner.query(`DROP INDEX "IDX_58876ee26a90170551027459bf"`);
        await queryRunner.query(`DROP INDEX "IDX_1f22c73374bcca1ea84a4dca59"`);
        await queryRunner.query(`DROP INDEX "IDX_c2f6bec0b39eaa3a6d90903ae9"`);
        await queryRunner.query(`DROP INDEX "IDX_b08dd29fb6a8acdf83c83d8988"`);
        await queryRunner.query(`DROP INDEX "IDX_49746602acc4e5e8721062b69e"`);
        await queryRunner.query(`ALTER TABLE "tag" RENAME TO "temporary_tag"`);
        await queryRunner.query(`CREATE TABLE "tag" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "organizationId" varchar, "name" varchar NOT NULL, "description" varchar, "color" varchar NOT NULL, "isSystem" boolean NOT NULL DEFAULT (0), "icon" varchar, "organizationTeamId" varchar, "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "deletedAt" datetime, "textColor" varchar, "fix_relational_custom_fields" boolean, "archivedAt" datetime, "tagTypeId" varchar, CONSTRAINT "FK_49746602acc4e5e8721062b69ec" FOREIGN KEY ("organizationTeamId") REFERENCES "organization_team" ("id") ON DELETE SET NULL ON UPDATE NO ACTION, CONSTRAINT "FK_b08dd29fb6a8acdf83c83d8988f" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_c2f6bec0b39eaa3a6d90903ae99" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE)`);
        await queryRunner.query(`INSERT INTO "tag"("id", "createdAt", "updatedAt", "tenantId", "organizationId", "name", "description", "color", "isSystem", "icon", "organizationTeamId", "isActive", "isArchived", "deletedAt", "textColor", "fix_relational_custom_fields", "archivedAt", "tagTypeId") SELECT "id", "createdAt", "updatedAt", "tenantId", "organizationId", "name", "description", "color", "isSystem", "icon", "organizationTeamId", "isActive", "isArchived", "deletedAt", "textColor", "fix_relational_custom_fields", "archivedAt", "tagTypeId" FROM "temporary_tag"`);
        await queryRunner.query(`DROP TABLE "temporary_tag"`);
        await queryRunner.query(`CREATE INDEX "IDX_1c84215eb01fa457d0beeaee7f" ON "tag" ("tagTypeId") `);
        await queryRunner.query(`CREATE INDEX "IDX_58876ee26a90170551027459bf" ON "tag" ("isArchived") `);
        await queryRunner.query(`CREATE INDEX "IDX_1f22c73374bcca1ea84a4dca59" ON "tag" ("isActive") `);
        await queryRunner.query(`CREATE INDEX "IDX_c2f6bec0b39eaa3a6d90903ae9" ON "tag" ("organizationId") `);
        await queryRunner.query(`CREATE INDEX "IDX_b08dd29fb6a8acdf83c83d8988" ON "tag" ("tenantId") `);
        await queryRunner.query(`CREATE INDEX "IDX_49746602acc4e5e8721062b69e" ON "tag" ("organizationTeamId") `);
        await queryRunner.query(`DROP INDEX "IDX_1c84215eb01fa457d0beeaee7f"`);
        await queryRunner.query(`DROP INDEX "IDX_58876ee26a90170551027459bf"`);
        await queryRunner.query(`DROP INDEX "IDX_1f22c73374bcca1ea84a4dca59"`);
        await queryRunner.query(`DROP INDEX "IDX_c2f6bec0b39eaa3a6d90903ae9"`);
        await queryRunner.query(`DROP INDEX "IDX_b08dd29fb6a8acdf83c83d8988"`);
        await queryRunner.query(`DROP INDEX "IDX_49746602acc4e5e8721062b69e"`);
        await queryRunner.query(`ALTER TABLE "tag" RENAME TO "temporary_tag"`);
        await queryRunner.query(`CREATE TABLE "tag" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "organizationId" varchar, "name" varchar NOT NULL, "description" varchar, "color" varchar NOT NULL, "isSystem" boolean NOT NULL DEFAULT (0), "icon" varchar, "organizationTeamId" varchar, "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "deletedAt" datetime, "textColor" varchar, "fix_relational_custom_fields" boolean, "archivedAt" datetime, CONSTRAINT "FK_49746602acc4e5e8721062b69ec" FOREIGN KEY ("organizationTeamId") REFERENCES "organization_team" ("id") ON DELETE SET NULL ON UPDATE NO ACTION, CONSTRAINT "FK_b08dd29fb6a8acdf83c83d8988f" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_c2f6bec0b39eaa3a6d90903ae99" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE)`);
        await queryRunner.query(`INSERT INTO "tag"("id", "createdAt", "updatedAt", "tenantId", "organizationId", "name", "description", "color", "isSystem", "icon", "organizationTeamId", "isActive", "isArchived", "deletedAt", "textColor", "fix_relational_custom_fields", "archivedAt") SELECT "id", "createdAt", "updatedAt", "tenantId", "organizationId", "name", "description", "color", "isSystem", "icon", "organizationTeamId", "isActive", "isArchived", "deletedAt", "textColor", "fix_relational_custom_fields", "archivedAt" FROM "temporary_tag"`);
        await queryRunner.query(`DROP TABLE "temporary_tag"`);
        await queryRunner.query(`CREATE INDEX "IDX_58876ee26a90170551027459bf" ON "tag" ("isArchived") `);
        await queryRunner.query(`CREATE INDEX "IDX_1f22c73374bcca1ea84a4dca59" ON "tag" ("isActive") `);
        await queryRunner.query(`CREATE INDEX "IDX_c2f6bec0b39eaa3a6d90903ae9" ON "tag" ("organizationId") `);
        await queryRunner.query(`CREATE INDEX "IDX_b08dd29fb6a8acdf83c83d8988" ON "tag" ("tenantId") `);
        await queryRunner.query(`CREATE INDEX "IDX_49746602acc4e5e8721062b69e" ON "tag" ("organizationTeamId") `);
        await queryRunner.query(`DROP INDEX "IDX_dcefa726d2f515583535cb540f"`);
        await queryRunner.query(`DROP INDEX "IDX_556112dc97b482454726198f25"`);
        await queryRunner.query(`DROP INDEX "IDX_e2d517d3e3ff2a873f43367813"`);
        await queryRunner.query(`DROP INDEX "IDX_c1bef0b8aa28d47b9907667a1f"`);
        await queryRunner.query(`DROP TABLE "tag_type"`);
    }

    /**
     * MySQL Up Migration
     *
     * @param queryRunner
     */
    public async mysqlUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(`CREATE TABLE \`tag_type\` (\`deletedAt\` datetime(6) NULL, \`id\` varchar(36) NOT NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`isActive\` tinyint NULL DEFAULT 1, \`isArchived\` tinyint NULL DEFAULT 0, \`archivedAt\` datetime NULL, \`tenantId\` varchar(255) NULL, \`organizationId\` varchar(255) NULL, \`type\` varchar(255) NOT NULL, INDEX \`IDX_c1bef0b8aa28d47b9907667a1f\` (\`isActive\`), INDEX \`IDX_e2d517d3e3ff2a873f43367813\` (\`isArchived\`), INDEX \`IDX_556112dc97b482454726198f25\` (\`tenantId\`), INDEX \`IDX_dcefa726d2f515583535cb540f\` (\`organizationId\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
		await queryRunner.query(`ALTER TABLE \`tag\` ADD \`tagTypeId\` varchar(255) NULL`);
		await queryRunner.query(`CREATE INDEX \`IDX_1c84215eb01fa457d0beeaee7f\` ON \`tag\` (\`tagTypeId\`)`);
		await queryRunner.query(`ALTER TABLE \`tag\` ADD CONSTRAINT \`FK_1c84215eb01fa457d0beeaee7fc\` FOREIGN KEY (\`tagTypeId\`) REFERENCES \`tag_type\`(\`id\`) ON DELETE SET NULL ON UPDATE NO ACTION`);
		await queryRunner.query(`ALTER TABLE \`tag_type\` ADD CONSTRAINT \`FK_556112dc97b482454726198f250\` FOREIGN KEY (\`tenantId\`) REFERENCES \`tenant\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`);
		await queryRunner.query(`ALTER TABLE \`tag_type\` ADD CONSTRAINT \`FK_dcefa726d2f515583535cb540f3\` FOREIGN KEY (\`organizationId\`) REFERENCES \`organization\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`);
    }

    /**
     * MySQL Down Migration
     *
     * @param queryRunner
     */
    public async mysqlDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
		await queryRunner.query(`ALTER TABLE \`tag_type\` DROP FOREIGN KEY \`FK_dcefa726d2f515583535cb540f3\``);
		await queryRunner.query(`ALTER TABLE \`tag_type\` DROP FOREIGN KEY \`FK_556112dc97b482454726198f250\``);
		await queryRunner.query(`ALTER TABLE \`tag\` DROP FOREIGN KEY \`FK_1c84215eb01fa457d0beeaee7fc\``);
		await queryRunner.query(`DROP INDEX \`IDX_1c84215eb01fa457d0beeaee7f\` ON \`tag\``);
		await queryRunner.query(`ALTER TABLE \`tag\` DROP COLUMN \`tagTypeId\``);
		await queryRunner.query(`DROP INDEX \`IDX_dcefa726d2f515583535cb540f\` ON \`tag_type\``);
		await queryRunner.query(`DROP INDEX \`IDX_556112dc97b482454726198f25\` ON \`tag_type\``);
		await queryRunner.query(`DROP INDEX \`IDX_e2d517d3e3ff2a873f43367813\` ON \`tag_type\``);
		await queryRunner.query(`DROP INDEX \`IDX_c1bef0b8aa28d47b9907667a1f\` ON \`tag_type\``);
		await queryRunner.query(`DROP TABLE \`tag_type\``);
    }
}
