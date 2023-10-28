
import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateIntegrationOrganizationGithubRepositoryIssueTable1698383136452 implements MigrationInterface {

    name = 'CreateIntegrationOrganizationGithubRepositoryIssueTable1698383136452';

    /**
    * Up Migration
    *
    * @param queryRunner
    */
    public async up(queryRunner: QueryRunner): Promise<any> {
        if (['sqlite', 'better-sqlite3'].includes(queryRunner.connection.options.type)) {
            await this.sqliteUpQueryRunner(queryRunner);
        } else {
            await this.postgresUpQueryRunner(queryRunner);
        }
    }

    /**
    * Down Migration
    *
    * @param queryRunner
    */
    public async down(queryRunner: QueryRunner): Promise<any> {
        if (['sqlite', 'better-sqlite3'].includes(queryRunner.connection.options.type)) {
            await this.sqliteDownQueryRunner(queryRunner);
        } else {
            await this.postgresDownQueryRunner(queryRunner);
        }
    }

    /**
    * PostgresDB Up Migration
    *
    * @param queryRunner
    */
    public async postgresUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`CREATE TABLE "organization_github_repository_issue" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "isActive" boolean DEFAULT true, "isArchived" boolean DEFAULT false, "tenantId" uuid, "organizationId" uuid, "issueId" integer NOT NULL, "issueNumber" integer NOT NULL, "repositoryId" uuid, CONSTRAINT "PK_99e44380c05f06ffe7c9200f9c5" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_d706210d377ece2a1bc3386388" ON "organization_github_repository_issue" ("isActive") `);
        await queryRunner.query(`CREATE INDEX "IDX_c774c276d6b7ea05a7e12d3c81" ON "organization_github_repository_issue" ("isArchived") `);
        await queryRunner.query(`CREATE INDEX "IDX_b3234be5b70c2362cdf67bb188" ON "organization_github_repository_issue" ("tenantId") `);
        await queryRunner.query(`CREATE INDEX "IDX_6c8e119fc6a2a7d3413aa76d3b" ON "organization_github_repository_issue" ("organizationId") `);
        await queryRunner.query(`CREATE INDEX "IDX_055f310a04a928343494a5255a" ON "organization_github_repository_issue" ("issueId") `);
        await queryRunner.query(`CREATE INDEX "IDX_a8709a9c5cc142c6fbe92df274" ON "organization_github_repository_issue" ("issueNumber") `);
        await queryRunner.query(`CREATE INDEX "IDX_5065401113abb6e9608225e567" ON "organization_github_repository_issue" ("repositoryId") `);
        await queryRunner.query(`ALTER TABLE "organization_github_repository_issue" ADD CONSTRAINT "FK_b3234be5b70c2362cdf67bb1889" FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "organization_github_repository_issue" ADD CONSTRAINT "FK_6c8e119fc6a2a7d3413aa76d3bd" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE "organization_github_repository_issue" ADD CONSTRAINT "FK_5065401113abb6e9608225e5678" FOREIGN KEY ("repositoryId") REFERENCES "organization_github_repository"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
    }

    /**
    * PostgresDB Down Migration
    *
    * @param queryRunner
    */
    public async postgresDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`ALTER TABLE "organization_github_repository_issue" DROP CONSTRAINT "FK_5065401113abb6e9608225e5678"`);
        await queryRunner.query(`ALTER TABLE "organization_github_repository_issue" DROP CONSTRAINT "FK_6c8e119fc6a2a7d3413aa76d3bd"`);
        await queryRunner.query(`ALTER TABLE "organization_github_repository_issue" DROP CONSTRAINT "FK_b3234be5b70c2362cdf67bb1889"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_5065401113abb6e9608225e567"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_a8709a9c5cc142c6fbe92df274"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_055f310a04a928343494a5255a"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_6c8e119fc6a2a7d3413aa76d3b"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_b3234be5b70c2362cdf67bb188"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_c774c276d6b7ea05a7e12d3c81"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_d706210d377ece2a1bc3386388"`);
        await queryRunner.query(`DROP TABLE "organization_github_repository_issue"`);
    }

    /**
    * SqliteDB and BetterSQlite3DB Up Migration
    *
    * @param queryRunner
    */
    public async sqliteUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`CREATE TABLE "organization_github_repository_issue" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "tenantId" varchar, "organizationId" varchar, "issueId" integer NOT NULL, "issueNumber" integer NOT NULL, "repositoryId" varchar)`);
        await queryRunner.query(`CREATE INDEX "IDX_d706210d377ece2a1bc3386388" ON "organization_github_repository_issue" ("isActive") `);
        await queryRunner.query(`CREATE INDEX "IDX_c774c276d6b7ea05a7e12d3c81" ON "organization_github_repository_issue" ("isArchived") `);
        await queryRunner.query(`CREATE INDEX "IDX_b3234be5b70c2362cdf67bb188" ON "organization_github_repository_issue" ("tenantId") `);
        await queryRunner.query(`CREATE INDEX "IDX_6c8e119fc6a2a7d3413aa76d3b" ON "organization_github_repository_issue" ("organizationId") `);
        await queryRunner.query(`CREATE INDEX "IDX_055f310a04a928343494a5255a" ON "organization_github_repository_issue" ("issueId") `);
        await queryRunner.query(`CREATE INDEX "IDX_a8709a9c5cc142c6fbe92df274" ON "organization_github_repository_issue" ("issueNumber") `);
        await queryRunner.query(`CREATE INDEX "IDX_5065401113abb6e9608225e567" ON "organization_github_repository_issue" ("repositoryId") `);
        await queryRunner.query(`DROP INDEX "IDX_d706210d377ece2a1bc3386388"`);
        await queryRunner.query(`DROP INDEX "IDX_c774c276d6b7ea05a7e12d3c81"`);
        await queryRunner.query(`DROP INDEX "IDX_b3234be5b70c2362cdf67bb188"`);
        await queryRunner.query(`DROP INDEX "IDX_6c8e119fc6a2a7d3413aa76d3b"`);
        await queryRunner.query(`DROP INDEX "IDX_055f310a04a928343494a5255a"`);
        await queryRunner.query(`DROP INDEX "IDX_a8709a9c5cc142c6fbe92df274"`);
        await queryRunner.query(`DROP INDEX "IDX_5065401113abb6e9608225e567"`);
        await queryRunner.query(`CREATE TABLE "temporary_organization_github_repository_issue" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "tenantId" varchar, "organizationId" varchar, "issueId" integer NOT NULL, "issueNumber" integer NOT NULL, "repositoryId" varchar, CONSTRAINT "FK_b3234be5b70c2362cdf67bb1889" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_6c8e119fc6a2a7d3413aa76d3bd" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_5065401113abb6e9608225e5678" FOREIGN KEY ("repositoryId") REFERENCES "organization_github_repository" ("id") ON DELETE SET NULL ON UPDATE NO ACTION)`);
        await queryRunner.query(`INSERT INTO "temporary_organization_github_repository_issue"("id", "createdAt", "updatedAt", "isActive", "isArchived", "tenantId", "organizationId", "issueId", "issueNumber", "repositoryId") SELECT "id", "createdAt", "updatedAt", "isActive", "isArchived", "tenantId", "organizationId", "issueId", "issueNumber", "repositoryId" FROM "organization_github_repository_issue"`);
        await queryRunner.query(`DROP TABLE "organization_github_repository_issue"`);
        await queryRunner.query(`ALTER TABLE "temporary_organization_github_repository_issue" RENAME TO "organization_github_repository_issue"`);
        await queryRunner.query(`CREATE INDEX "IDX_d706210d377ece2a1bc3386388" ON "organization_github_repository_issue" ("isActive") `);
        await queryRunner.query(`CREATE INDEX "IDX_c774c276d6b7ea05a7e12d3c81" ON "organization_github_repository_issue" ("isArchived") `);
        await queryRunner.query(`CREATE INDEX "IDX_b3234be5b70c2362cdf67bb188" ON "organization_github_repository_issue" ("tenantId") `);
        await queryRunner.query(`CREATE INDEX "IDX_6c8e119fc6a2a7d3413aa76d3b" ON "organization_github_repository_issue" ("organizationId") `);
        await queryRunner.query(`CREATE INDEX "IDX_055f310a04a928343494a5255a" ON "organization_github_repository_issue" ("issueId") `);
        await queryRunner.query(`CREATE INDEX "IDX_a8709a9c5cc142c6fbe92df274" ON "organization_github_repository_issue" ("issueNumber") `);
        await queryRunner.query(`CREATE INDEX "IDX_5065401113abb6e9608225e567" ON "organization_github_repository_issue" ("repositoryId") `);
    }

    /**
    * SqliteDB and BetterSQlite3DB Down Migration
    *
    * @param queryRunner
    */
    public async sqliteDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`DROP INDEX "IDX_5065401113abb6e9608225e567"`);
        await queryRunner.query(`DROP INDEX "IDX_a8709a9c5cc142c6fbe92df274"`);
        await queryRunner.query(`DROP INDEX "IDX_055f310a04a928343494a5255a"`);
        await queryRunner.query(`DROP INDEX "IDX_6c8e119fc6a2a7d3413aa76d3b"`);
        await queryRunner.query(`DROP INDEX "IDX_b3234be5b70c2362cdf67bb188"`);
        await queryRunner.query(`DROP INDEX "IDX_c774c276d6b7ea05a7e12d3c81"`);
        await queryRunner.query(`DROP INDEX "IDX_d706210d377ece2a1bc3386388"`);
        await queryRunner.query(`ALTER TABLE "organization_github_repository_issue" RENAME TO "temporary_organization_github_repository_issue"`);
        await queryRunner.query(`CREATE TABLE "organization_github_repository_issue" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "tenantId" varchar, "organizationId" varchar, "issueId" integer NOT NULL, "issueNumber" integer NOT NULL, "repositoryId" varchar)`);
        await queryRunner.query(`INSERT INTO "organization_github_repository_issue"("id", "createdAt", "updatedAt", "isActive", "isArchived", "tenantId", "organizationId", "issueId", "issueNumber", "repositoryId") SELECT "id", "createdAt", "updatedAt", "isActive", "isArchived", "tenantId", "organizationId", "issueId", "issueNumber", "repositoryId" FROM "temporary_organization_github_repository_issue"`);
        await queryRunner.query(`DROP TABLE "temporary_organization_github_repository_issue"`);
        await queryRunner.query(`CREATE INDEX "IDX_5065401113abb6e9608225e567" ON "organization_github_repository_issue" ("repositoryId") `);
        await queryRunner.query(`CREATE INDEX "IDX_a8709a9c5cc142c6fbe92df274" ON "organization_github_repository_issue" ("issueNumber") `);
        await queryRunner.query(`CREATE INDEX "IDX_055f310a04a928343494a5255a" ON "organization_github_repository_issue" ("issueId") `);
        await queryRunner.query(`CREATE INDEX "IDX_6c8e119fc6a2a7d3413aa76d3b" ON "organization_github_repository_issue" ("organizationId") `);
        await queryRunner.query(`CREATE INDEX "IDX_b3234be5b70c2362cdf67bb188" ON "organization_github_repository_issue" ("tenantId") `);
        await queryRunner.query(`CREATE INDEX "IDX_c774c276d6b7ea05a7e12d3c81" ON "organization_github_repository_issue" ("isArchived") `);
        await queryRunner.query(`CREATE INDEX "IDX_d706210d377ece2a1bc3386388" ON "organization_github_repository_issue" ("isActive") `);
        await queryRunner.query(`DROP INDEX "IDX_5065401113abb6e9608225e567"`);
        await queryRunner.query(`DROP INDEX "IDX_a8709a9c5cc142c6fbe92df274"`);
        await queryRunner.query(`DROP INDEX "IDX_055f310a04a928343494a5255a"`);
        await queryRunner.query(`DROP INDEX "IDX_6c8e119fc6a2a7d3413aa76d3b"`);
        await queryRunner.query(`DROP INDEX "IDX_b3234be5b70c2362cdf67bb188"`);
        await queryRunner.query(`DROP INDEX "IDX_c774c276d6b7ea05a7e12d3c81"`);
        await queryRunner.query(`DROP INDEX "IDX_d706210d377ece2a1bc3386388"`);
        await queryRunner.query(`DROP TABLE "organization_github_repository_issue"`);
    }
}
