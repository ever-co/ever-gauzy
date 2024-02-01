import { MigrationInterface, QueryRunner } from "typeorm";
import * as chalk from "chalk";
import { DatabaseTypeEnum } from "@gauzy/config";

export class CreateIssueTypeTable1680071714132 implements MigrationInterface {

    name = 'CreateIssueTypeTable1680071714132';

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
        await queryRunner.query(`CREATE TABLE "issue_type" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "tenantId" uuid, "organizationId" uuid, "name" character varying NOT NULL, "value" character varying NOT NULL, "description" character varying, "icon" character varying, "color" character varying, "isSystem" boolean NOT NULL DEFAULT false, "imageId" uuid, "projectId" uuid, "organizationTeamId" uuid, CONSTRAINT "PK_cbaac4689773f8f434641a1b6b7" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_8b12c913c39c72fe5980427c96" ON "issue_type" ("tenantId") `);
        await queryRunner.query(`CREATE INDEX "IDX_16dbef9d1b2b422abdce8ee3ae" ON "issue_type" ("organizationId") `);
        await queryRunner.query(`CREATE INDEX "IDX_4af451ab46a94e94394c72d911" ON "issue_type" ("name") `);
        await queryRunner.query(`CREATE INDEX "IDX_af2d743ed61571bcdc5d9a27a0" ON "issue_type" ("value") `);
        await queryRunner.query(`CREATE INDEX "IDX_33779b0395f72af0b50dc526d1" ON "issue_type" ("imageId") `);
        await queryRunner.query(`CREATE INDEX "IDX_131331557078611a68b4a5b2e7" ON "issue_type" ("projectId") `);
        await queryRunner.query(`CREATE INDEX "IDX_586513cceb16777fd14a17bfe1" ON "issue_type" ("organizationTeamId") `);
        await queryRunner.query(`ALTER TABLE "issue_type" ADD CONSTRAINT "FK_8b12c913c39c72fe5980427c963" FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "issue_type" ADD CONSTRAINT "FK_16dbef9d1b2b422abdce8ee3ae2" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE "issue_type" ADD CONSTRAINT "FK_33779b0395f72af0b50dc526d1d" FOREIGN KEY ("imageId") REFERENCES "image_asset"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "issue_type" ADD CONSTRAINT "FK_131331557078611a68b4a5b2e7e" FOREIGN KEY ("projectId") REFERENCES "organization_project"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "issue_type" ADD CONSTRAINT "FK_586513cceb16777fd14a17bfe10" FOREIGN KEY ("organizationTeamId") REFERENCES "organization_team"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    /**
    * PostgresDB Down Migration
    *
    * @param queryRunner
    */
    public async postgresDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`ALTER TABLE "issue_type" DROP CONSTRAINT "FK_586513cceb16777fd14a17bfe10"`);
        await queryRunner.query(`ALTER TABLE "issue_type" DROP CONSTRAINT "FK_131331557078611a68b4a5b2e7e"`);
        await queryRunner.query(`ALTER TABLE "issue_type" DROP CONSTRAINT "FK_33779b0395f72af0b50dc526d1d"`);
        await queryRunner.query(`ALTER TABLE "issue_type" DROP CONSTRAINT "FK_16dbef9d1b2b422abdce8ee3ae2"`);
        await queryRunner.query(`ALTER TABLE "issue_type" DROP CONSTRAINT "FK_8b12c913c39c72fe5980427c963"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_586513cceb16777fd14a17bfe1"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_131331557078611a68b4a5b2e7"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_33779b0395f72af0b50dc526d1"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_af2d743ed61571bcdc5d9a27a0"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_4af451ab46a94e94394c72d911"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_16dbef9d1b2b422abdce8ee3ae"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_8b12c913c39c72fe5980427c96"`);
        await queryRunner.query(`DROP TABLE "issue_type"`);
    }

    /**
    * SqliteDB Up Migration
    *
    * @param queryRunner
    */
    public async sqliteUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`CREATE TABLE "issue_type" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "organizationId" varchar, "name" varchar NOT NULL, "value" varchar NOT NULL, "description" varchar, "icon" varchar, "color" varchar, "isSystem" boolean NOT NULL DEFAULT (0), "imageId" varchar, "projectId" varchar, "organizationTeamId" varchar)`);
        await queryRunner.query(`CREATE INDEX "IDX_8b12c913c39c72fe5980427c96" ON "issue_type" ("tenantId") `);
        await queryRunner.query(`CREATE INDEX "IDX_16dbef9d1b2b422abdce8ee3ae" ON "issue_type" ("organizationId") `);
        await queryRunner.query(`CREATE INDEX "IDX_4af451ab46a94e94394c72d911" ON "issue_type" ("name") `);
        await queryRunner.query(`CREATE INDEX "IDX_af2d743ed61571bcdc5d9a27a0" ON "issue_type" ("value") `);
        await queryRunner.query(`CREATE INDEX "IDX_33779b0395f72af0b50dc526d1" ON "issue_type" ("imageId") `);
        await queryRunner.query(`CREATE INDEX "IDX_131331557078611a68b4a5b2e7" ON "issue_type" ("projectId") `);
        await queryRunner.query(`CREATE INDEX "IDX_586513cceb16777fd14a17bfe1" ON "issue_type" ("organizationTeamId") `);
        await queryRunner.query(`DROP INDEX "IDX_8b12c913c39c72fe5980427c96"`);
        await queryRunner.query(`DROP INDEX "IDX_16dbef9d1b2b422abdce8ee3ae"`);
        await queryRunner.query(`DROP INDEX "IDX_4af451ab46a94e94394c72d911"`);
        await queryRunner.query(`DROP INDEX "IDX_af2d743ed61571bcdc5d9a27a0"`);
        await queryRunner.query(`DROP INDEX "IDX_33779b0395f72af0b50dc526d1"`);
        await queryRunner.query(`DROP INDEX "IDX_131331557078611a68b4a5b2e7"`);
        await queryRunner.query(`DROP INDEX "IDX_586513cceb16777fd14a17bfe1"`);
        await queryRunner.query(`CREATE TABLE "temporary_issue_type" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "organizationId" varchar, "name" varchar NOT NULL, "value" varchar NOT NULL, "description" varchar, "icon" varchar, "color" varchar, "isSystem" boolean NOT NULL DEFAULT (0), "imageId" varchar, "projectId" varchar, "organizationTeamId" varchar, CONSTRAINT "FK_8b12c913c39c72fe5980427c963" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_16dbef9d1b2b422abdce8ee3ae2" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_33779b0395f72af0b50dc526d1d" FOREIGN KEY ("imageId") REFERENCES "image_asset" ("id") ON DELETE SET NULL ON UPDATE NO ACTION, CONSTRAINT "FK_131331557078611a68b4a5b2e7e" FOREIGN KEY ("projectId") REFERENCES "organization_project" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_586513cceb16777fd14a17bfe10" FOREIGN KEY ("organizationTeamId") REFERENCES "organization_team" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`);
        await queryRunner.query(`INSERT INTO "temporary_issue_type"("id", "createdAt", "updatedAt", "tenantId", "organizationId", "name", "value", "description", "icon", "color", "isSystem", "imageId", "projectId", "organizationTeamId") SELECT "id", "createdAt", "updatedAt", "tenantId", "organizationId", "name", "value", "description", "icon", "color", "isSystem", "imageId", "projectId", "organizationTeamId" FROM "issue_type"`);
        await queryRunner.query(`DROP TABLE "issue_type"`);
        await queryRunner.query(`ALTER TABLE "temporary_issue_type" RENAME TO "issue_type"`);
        await queryRunner.query(`CREATE INDEX "IDX_8b12c913c39c72fe5980427c96" ON "issue_type" ("tenantId") `);
        await queryRunner.query(`CREATE INDEX "IDX_16dbef9d1b2b422abdce8ee3ae" ON "issue_type" ("organizationId") `);
        await queryRunner.query(`CREATE INDEX "IDX_4af451ab46a94e94394c72d911" ON "issue_type" ("name") `);
        await queryRunner.query(`CREATE INDEX "IDX_af2d743ed61571bcdc5d9a27a0" ON "issue_type" ("value") `);
        await queryRunner.query(`CREATE INDEX "IDX_33779b0395f72af0b50dc526d1" ON "issue_type" ("imageId") `);
        await queryRunner.query(`CREATE INDEX "IDX_131331557078611a68b4a5b2e7" ON "issue_type" ("projectId") `);
        await queryRunner.query(`CREATE INDEX "IDX_586513cceb16777fd14a17bfe1" ON "issue_type" ("organizationTeamId") `);
    }

    /**
    * SqliteDB Down Migration
    *
    * @param queryRunner
    */
    public async sqliteDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`DROP INDEX "IDX_586513cceb16777fd14a17bfe1"`);
        await queryRunner.query(`DROP INDEX "IDX_131331557078611a68b4a5b2e7"`);
        await queryRunner.query(`DROP INDEX "IDX_33779b0395f72af0b50dc526d1"`);
        await queryRunner.query(`DROP INDEX "IDX_af2d743ed61571bcdc5d9a27a0"`);
        await queryRunner.query(`DROP INDEX "IDX_4af451ab46a94e94394c72d911"`);
        await queryRunner.query(`DROP INDEX "IDX_16dbef9d1b2b422abdce8ee3ae"`);
        await queryRunner.query(`DROP INDEX "IDX_8b12c913c39c72fe5980427c96"`);
        await queryRunner.query(`ALTER TABLE "issue_type" RENAME TO "temporary_issue_type"`);
        await queryRunner.query(`CREATE TABLE "issue_type" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "organizationId" varchar, "name" varchar NOT NULL, "value" varchar NOT NULL, "description" varchar, "icon" varchar, "color" varchar, "isSystem" boolean NOT NULL DEFAULT (0), "imageId" varchar, "projectId" varchar, "organizationTeamId" varchar)`);
        await queryRunner.query(`INSERT INTO "issue_type"("id", "createdAt", "updatedAt", "tenantId", "organizationId", "name", "value", "description", "icon", "color", "isSystem", "imageId", "projectId", "organizationTeamId") SELECT "id", "createdAt", "updatedAt", "tenantId", "organizationId", "name", "value", "description", "icon", "color", "isSystem", "imageId", "projectId", "organizationTeamId" FROM "temporary_issue_type"`);
        await queryRunner.query(`DROP TABLE "temporary_issue_type"`);
        await queryRunner.query(`CREATE INDEX "IDX_586513cceb16777fd14a17bfe1" ON "issue_type" ("organizationTeamId") `);
        await queryRunner.query(`CREATE INDEX "IDX_131331557078611a68b4a5b2e7" ON "issue_type" ("projectId") `);
        await queryRunner.query(`CREATE INDEX "IDX_33779b0395f72af0b50dc526d1" ON "issue_type" ("imageId") `);
        await queryRunner.query(`CREATE INDEX "IDX_af2d743ed61571bcdc5d9a27a0" ON "issue_type" ("value") `);
        await queryRunner.query(`CREATE INDEX "IDX_4af451ab46a94e94394c72d911" ON "issue_type" ("name") `);
        await queryRunner.query(`CREATE INDEX "IDX_16dbef9d1b2b422abdce8ee3ae" ON "issue_type" ("organizationId") `);
        await queryRunner.query(`CREATE INDEX "IDX_8b12c913c39c72fe5980427c96" ON "issue_type" ("tenantId") `);
        await queryRunner.query(`DROP INDEX "IDX_586513cceb16777fd14a17bfe1"`);
        await queryRunner.query(`DROP INDEX "IDX_131331557078611a68b4a5b2e7"`);
        await queryRunner.query(`DROP INDEX "IDX_33779b0395f72af0b50dc526d1"`);
        await queryRunner.query(`DROP INDEX "IDX_af2d743ed61571bcdc5d9a27a0"`);
        await queryRunner.query(`DROP INDEX "IDX_4af451ab46a94e94394c72d911"`);
        await queryRunner.query(`DROP INDEX "IDX_16dbef9d1b2b422abdce8ee3ae"`);
        await queryRunner.query(`DROP INDEX "IDX_8b12c913c39c72fe5980427c96"`);
        await queryRunner.query(`DROP TABLE "issue_type"`);
    }

    /**
     * MySQL Up Migration
     *
     * @param queryRunner
     */
    public async mysqlUpQueryRunner(queryRunner: QueryRunner): Promise<any> { }

    /**
     * MySQL Down Migration
     *
     * @param queryRunner
     */
    public async mysqlDownQueryRunner(queryRunner: QueryRunner): Promise<any> { }
}
