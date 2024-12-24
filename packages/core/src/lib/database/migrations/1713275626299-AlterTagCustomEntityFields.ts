
import { MigrationInterface, QueryRunner } from "typeorm";
import * as chalk from 'chalk';
import { DatabaseTypeEnum } from "@gauzy/config";

export class AlterTagCustomEntityFields1713275626299 implements MigrationInterface {

    name = 'AlterTagCustomEntityFields1713275626299';

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
        await queryRunner.query(`ALTER TABLE "tag_proposal" DROP CONSTRAINT "FK_451853704de278eef61a37fa7a6"`);
        await queryRunner.query(`ALTER TABLE "tag" ADD "__fix_relational_custom_fields__" boolean`);
        await queryRunner.query(`ALTER TABLE "tag_proposal" ADD CONSTRAINT "FK_451853704de278eef61a37fa7a6" FOREIGN KEY ("tagId") REFERENCES "tag"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    /**
    * PostgresDB Down Migration
    *
    * @param queryRunner
    */
    public async postgresDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`ALTER TABLE "tag_proposal" DROP CONSTRAINT "FK_451853704de278eef61a37fa7a6"`);
        await queryRunner.query(`ALTER TABLE "tag" DROP COLUMN "__fix_relational_custom_fields__"`);
        await queryRunner.query(`ALTER TABLE "tag_proposal" ADD CONSTRAINT "FK_451853704de278eef61a37fa7a6" FOREIGN KEY ("tagId") REFERENCES "tag"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    /**
    * SqliteDB and BetterSQlite3DB Up Migration
    *
    * @param queryRunner
    */
    public async sqliteUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`DROP INDEX "IDX_451853704de278eef61a37fa7a"`);
        await queryRunner.query(`DROP INDEX "IDX_3f55851a03524e567594d50774"`);
        await queryRunner.query(`CREATE TABLE "temporary_tag_proposal" ("proposalId" varchar NOT NULL, "tagId" varchar NOT NULL, CONSTRAINT "FK_3f55851a03524e567594d507744" FOREIGN KEY ("proposalId") REFERENCES "proposal" ("id") ON DELETE CASCADE ON UPDATE CASCADE, PRIMARY KEY ("proposalId", "tagId"))`);
        await queryRunner.query(`INSERT INTO "temporary_tag_proposal"("proposalId", "tagId") SELECT "proposalId", "tagId" FROM "tag_proposal"`);
        await queryRunner.query(`DROP TABLE "tag_proposal"`);
        await queryRunner.query(`ALTER TABLE "temporary_tag_proposal" RENAME TO "tag_proposal"`);
        await queryRunner.query(`CREATE INDEX "IDX_451853704de278eef61a37fa7a" ON "tag_proposal" ("tagId") `);
        await queryRunner.query(`CREATE INDEX "IDX_3f55851a03524e567594d50774" ON "tag_proposal" ("proposalId") `);
        await queryRunner.query(`DROP INDEX "IDX_58876ee26a90170551027459bf"`);
        await queryRunner.query(`DROP INDEX "IDX_1f22c73374bcca1ea84a4dca59"`);
        await queryRunner.query(`DROP INDEX "IDX_c2f6bec0b39eaa3a6d90903ae9"`);
        await queryRunner.query(`DROP INDEX "IDX_b08dd29fb6a8acdf83c83d8988"`);
        await queryRunner.query(`DROP INDEX "IDX_49746602acc4e5e8721062b69e"`);
        await queryRunner.query(`CREATE TABLE "temporary_tag" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "organizationId" varchar, "name" varchar NOT NULL, "description" varchar, "color" varchar NOT NULL, "isSystem" boolean NOT NULL DEFAULT (0), "icon" varchar, "organizationTeamId" varchar, "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "deletedAt" datetime, "textColor" varchar, "__fix_relational_custom_fields__" boolean, CONSTRAINT "FK_c2f6bec0b39eaa3a6d90903ae99" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_b08dd29fb6a8acdf83c83d8988f" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_49746602acc4e5e8721062b69ec" FOREIGN KEY ("organizationTeamId") REFERENCES "organization_team" ("id") ON DELETE SET NULL ON UPDATE NO ACTION)`);
        await queryRunner.query(`INSERT INTO "temporary_tag"("id", "createdAt", "updatedAt", "tenantId", "organizationId", "name", "description", "color", "isSystem", "icon", "organizationTeamId", "isActive", "isArchived", "deletedAt", "textColor") SELECT "id", "createdAt", "updatedAt", "tenantId", "organizationId", "name", "description", "color", "isSystem", "icon", "organizationTeamId", "isActive", "isArchived", "deletedAt", "textColor" FROM "tag"`);
        await queryRunner.query(`DROP TABLE "tag"`);
        await queryRunner.query(`ALTER TABLE "temporary_tag" RENAME TO "tag"`);
        await queryRunner.query(`CREATE INDEX "IDX_58876ee26a90170551027459bf" ON "tag" ("isArchived") `);
        await queryRunner.query(`CREATE INDEX "IDX_1f22c73374bcca1ea84a4dca59" ON "tag" ("isActive") `);
        await queryRunner.query(`CREATE INDEX "IDX_c2f6bec0b39eaa3a6d90903ae9" ON "tag" ("organizationId") `);
        await queryRunner.query(`CREATE INDEX "IDX_b08dd29fb6a8acdf83c83d8988" ON "tag" ("tenantId") `);
        await queryRunner.query(`CREATE INDEX "IDX_49746602acc4e5e8721062b69e" ON "tag" ("organizationTeamId") `);
        await queryRunner.query(`CREATE TABLE "temporary_tag_proposal" ("proposalId" varchar NOT NULL, "tagId" varchar NOT NULL, CONSTRAINT "FK_3f55851a03524e567594d507744" FOREIGN KEY ("proposalId") REFERENCES "proposal" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_451853704de278eef61a37fa7a6" FOREIGN KEY ("tagId") REFERENCES "tag" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION, PRIMARY KEY ("proposalId", "tagId"))`);
        await queryRunner.query(`INSERT INTO "temporary_tag_proposal"("proposalId", "tagId") SELECT "proposalId", "tagId" FROM "tag_proposal"`);
        await queryRunner.query(`DROP TABLE "tag_proposal"`);
        await queryRunner.query(`ALTER TABLE "temporary_tag_proposal" RENAME TO "tag_proposal"`);
        await queryRunner.query(`CREATE INDEX "IDX_451853704de278eef61a37fa7a" ON "tag_proposal" ("tagId") `);
        await queryRunner.query(`CREATE INDEX "IDX_3f55851a03524e567594d50774" ON "tag_proposal" ("proposalId") `);
    }

    /**
    * SqliteDB and BetterSQlite3DB Down Migration
    *
    * @param queryRunner
    */
    public async sqliteDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`DROP INDEX "IDX_3f55851a03524e567594d50774"`);
        await queryRunner.query(`DROP INDEX "IDX_451853704de278eef61a37fa7a"`);
        await queryRunner.query(`ALTER TABLE "tag_proposal" RENAME TO "temporary_tag_proposal"`);
        await queryRunner.query(`CREATE TABLE "tag_proposal" ("proposalId" varchar NOT NULL, "tagId" varchar NOT NULL, CONSTRAINT "FK_3f55851a03524e567594d507744" FOREIGN KEY ("proposalId") REFERENCES "proposal" ("id") ON DELETE CASCADE ON UPDATE CASCADE, PRIMARY KEY ("proposalId", "tagId"))`);
        await queryRunner.query(`INSERT INTO "tag_proposal"("proposalId", "tagId") SELECT "proposalId", "tagId" FROM "temporary_tag_proposal"`);
        await queryRunner.query(`DROP TABLE "temporary_tag_proposal"`);
        await queryRunner.query(`CREATE INDEX "IDX_3f55851a03524e567594d50774" ON "tag_proposal" ("proposalId") `);
        await queryRunner.query(`CREATE INDEX "IDX_451853704de278eef61a37fa7a" ON "tag_proposal" ("tagId") `);
        await queryRunner.query(`DROP INDEX "IDX_49746602acc4e5e8721062b69e"`);
        await queryRunner.query(`DROP INDEX "IDX_b08dd29fb6a8acdf83c83d8988"`);
        await queryRunner.query(`DROP INDEX "IDX_c2f6bec0b39eaa3a6d90903ae9"`);
        await queryRunner.query(`DROP INDEX "IDX_1f22c73374bcca1ea84a4dca59"`);
        await queryRunner.query(`DROP INDEX "IDX_58876ee26a90170551027459bf"`);
        await queryRunner.query(`ALTER TABLE "tag" RENAME TO "temporary_tag"`);
        await queryRunner.query(`CREATE TABLE "tag" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "organizationId" varchar, "name" varchar NOT NULL, "description" varchar, "color" varchar NOT NULL, "isSystem" boolean NOT NULL DEFAULT (0), "icon" varchar, "organizationTeamId" varchar, "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "deletedAt" datetime, "textColor" varchar, CONSTRAINT "FK_c2f6bec0b39eaa3a6d90903ae99" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_b08dd29fb6a8acdf83c83d8988f" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_49746602acc4e5e8721062b69ec" FOREIGN KEY ("organizationTeamId") REFERENCES "organization_team" ("id") ON DELETE SET NULL ON UPDATE NO ACTION)`);
        await queryRunner.query(`INSERT INTO "tag"("id", "createdAt", "updatedAt", "tenantId", "organizationId", "name", "description", "color", "isSystem", "icon", "organizationTeamId", "isActive", "isArchived", "deletedAt", "textColor") SELECT "id", "createdAt", "updatedAt", "tenantId", "organizationId", "name", "description", "color", "isSystem", "icon", "organizationTeamId", "isActive", "isArchived", "deletedAt", "textColor" FROM "temporary_tag"`);
        await queryRunner.query(`DROP TABLE "temporary_tag"`);
        await queryRunner.query(`CREATE INDEX "IDX_49746602acc4e5e8721062b69e" ON "tag" ("organizationTeamId") `);
        await queryRunner.query(`CREATE INDEX "IDX_b08dd29fb6a8acdf83c83d8988" ON "tag" ("tenantId") `);
        await queryRunner.query(`CREATE INDEX "IDX_c2f6bec0b39eaa3a6d90903ae9" ON "tag" ("organizationId") `);
        await queryRunner.query(`CREATE INDEX "IDX_1f22c73374bcca1ea84a4dca59" ON "tag" ("isActive") `);
        await queryRunner.query(`CREATE INDEX "IDX_58876ee26a90170551027459bf" ON "tag" ("isArchived") `);
        await queryRunner.query(`DROP INDEX "IDX_3f55851a03524e567594d50774"`);
        await queryRunner.query(`DROP INDEX "IDX_451853704de278eef61a37fa7a"`);
        await queryRunner.query(`ALTER TABLE "tag_proposal" RENAME TO "temporary_tag_proposal"`);
        await queryRunner.query(`CREATE TABLE "tag_proposal" ("proposalId" varchar NOT NULL, "tagId" varchar NOT NULL, CONSTRAINT "FK_451853704de278eef61a37fa7a6" FOREIGN KEY ("tagId") REFERENCES "tag" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_3f55851a03524e567594d507744" FOREIGN KEY ("proposalId") REFERENCES "proposal" ("id") ON DELETE CASCADE ON UPDATE CASCADE, PRIMARY KEY ("proposalId", "tagId"))`);
        await queryRunner.query(`INSERT INTO "tag_proposal"("proposalId", "tagId") SELECT "proposalId", "tagId" FROM "temporary_tag_proposal"`);
        await queryRunner.query(`DROP TABLE "temporary_tag_proposal"`);
        await queryRunner.query(`CREATE INDEX "IDX_3f55851a03524e567594d50774" ON "tag_proposal" ("proposalId") `);
        await queryRunner.query(`CREATE INDEX "IDX_451853704de278eef61a37fa7a" ON "tag_proposal" ("tagId") `);
    }

    /**
     * MySQL Up Migration
     *
     * @param queryRunner
     */
    public async mysqlUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`ALTER TABLE \`tag_proposal\` DROP FOREIGN KEY \`FK_451853704de278eef61a37fa7a6\``);
        await queryRunner.query(`ALTER TABLE \`tag\` ADD \`__fix_relational_custom_fields__\` tinyint NULL`);
        await queryRunner.query(`ALTER TABLE \`tag_proposal\` ADD CONSTRAINT \`FK_451853704de278eef61a37fa7a6\` FOREIGN KEY (\`tagId\`) REFERENCES \`tag\`(\`id\`) ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    /**
     * MySQL Down Migration
     *
     * @param queryRunner
     */
    public async mysqlDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`ALTER TABLE \`tag_proposal\` DROP FOREIGN KEY \`FK_451853704de278eef61a37fa7a6\``);
        await queryRunner.query(`ALTER TABLE \`tag\` DROP COLUMN \`__fix_relational_custom_fields__\``);
        await queryRunner.query(`ALTER TABLE \`tag_proposal\` ADD CONSTRAINT \`FK_451853704de278eef61a37fa7a6\` FOREIGN KEY (\`tagId\`) REFERENCES \`tag\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`);
    }
}
