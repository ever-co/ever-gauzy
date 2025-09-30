import { MigrationInterface, QueryRunner } from 'typeorm';
import * as chalk from 'chalk';
import { DatabaseTypeEnum } from '@gauzy/config';

export class CreateActivepiecesIntegrationTable1759226889377 implements MigrationInterface {
    name = 'CreateActivepiecesIntegrationTable1759226889377';

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
        console.log(chalk.yellow(this.name + ' reverting changes!'));

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
        await queryRunner.query(`CREATE TABLE "activepieces_integration" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP, "createdByUserId" uuid, "updatedByUserId" uuid, "deletedByUserId" uuid, "isActive" boolean DEFAULT true, "isArchived" boolean DEFAULT false, "archivedAt" TIMESTAMP, "tenantId" uuid, "organizationId" uuid, "clientId" varchar NOT NULL, "clientSecret" text NOT NULL, "callbackUrl" varchar, "postInstallUrl" varchar, "description" varchar, "integrationId" uuid, CONSTRAINT "PK_activepieces_integration" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "uq_activepieces_tenant_org_not_null" ON "activepieces_integration" ("tenantId", "organizationId") WHERE "organizationId" IS NOT NULL`);
        await queryRunner.query(`CREATE UNIQUE INDEX "uq_activepieces_tenant_org_null" ON "activepieces_integration" ("tenantId") WHERE "organizationId" IS NULL`);
        await queryRunner.query(`CREATE INDEX "IDX_activepieces_integration_tenant" ON "activepieces_integration" ("tenantId")`);
        await queryRunner.query(`CREATE INDEX "IDX_activepieces_integration_organization" ON "activepieces_integration" ("organizationId")`);
        await queryRunner.query(`CREATE INDEX "IDX_activepieces_integration_integration" ON "activepieces_integration" ("integrationId")`);
        await queryRunner.query(`CREATE INDEX "IDX_activepieces_integration_deletedAt" ON "activepieces_integration" ("deletedAt")`);
        await queryRunner.query(`CREATE INDEX "IDX_activepieces_integration_createdByUserId" ON "activepieces_integration" ("createdByUserId")`);
        await queryRunner.query(`CREATE INDEX "IDX_activepieces_integration_updatedByUserId" ON "activepieces_integration" ("updatedByUserId")`);
        await queryRunner.query(`CREATE INDEX "IDX_activepieces_integration_deletedByUserId" ON "activepieces_integration" ("deletedByUserId")`);
        await queryRunner.query(`CREATE INDEX "IDX_activepieces_integration_isActive" ON "activepieces_integration" ("isActive")`);
        await queryRunner.query(`CREATE INDEX "IDX_activepieces_integration_isArchived" ON "activepieces_integration" ("isArchived")`);
        await queryRunner.query(`ALTER TABLE "activepieces_integration" ADD CONSTRAINT "FK_activepieces_integration_tenant" FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "activepieces_integration" ADD CONSTRAINT "FK_activepieces_integration_organization" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE "activepieces_integration" ADD CONSTRAINT "FK_activepieces_integration_integration" FOREIGN KEY ("integrationId") REFERENCES "integration_tenant"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "activepieces_integration" ADD CONSTRAINT "FK_activepieces_integration_createdByUser" FOREIGN KEY ("createdByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "activepieces_integration" ADD CONSTRAINT "FK_activepieces_integration_updatedByUser" FOREIGN KEY ("updatedByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "activepieces_integration" ADD CONSTRAINT "FK_activepieces_integration_deletedByUser" FOREIGN KEY ("deletedByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    /**
    * PostgresDB Down Migration
    *
    * @param queryRunner
    */
    public async postgresDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`ALTER TABLE "activepieces_integration" DROP CONSTRAINT "FK_activepieces_integration_deletedByUser"`);
        await queryRunner.query(`ALTER TABLE "activepieces_integration" DROP CONSTRAINT "FK_activepieces_integration_updatedByUser"`);
        await queryRunner.query(`ALTER TABLE "activepieces_integration" DROP CONSTRAINT "FK_activepieces_integration_createdByUser"`);
        await queryRunner.query(`ALTER TABLE "activepieces_integration" DROP CONSTRAINT "FK_activepieces_integration_integration"`);
        await queryRunner.query(`ALTER TABLE "activepieces_integration" DROP CONSTRAINT "FK_activepieces_integration_organization"`);
        await queryRunner.query(`ALTER TABLE "activepieces_integration" DROP CONSTRAINT "FK_activepieces_integration_tenant"`);
        await queryRunner.query(`DROP INDEX "public"."uq_activepieces_tenant_org_not_null"`);
        await queryRunner.query(`DROP INDEX "public"."uq_activepieces_tenant_org_null"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_activepieces_integration_isArchived"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_activepieces_integration_isActive"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_activepieces_integration_deletedByUserId"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_activepieces_integration_updatedByUserId"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_activepieces_integration_createdByUserId"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_activepieces_integration_deletedAt"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_activepieces_integration_integration"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_activepieces_integration_organization"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_activepieces_integration_tenant"`);
        await queryRunner.query(`DROP TABLE "activepieces_integration"`);
    }

    /**
    * SqliteDB and BetterSQlite3DB Up Migration
    *
    * @param queryRunner
    */
    public async sqliteUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`CREATE TABLE "activepieces_integration" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "deletedAt" datetime, "createdByUserId" varchar, "updatedByUserId" varchar, "deletedByUserId" varchar, "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "tenantId" varchar, "organizationId" varchar, "clientId" varchar NOT NULL, "clientSecret" text NOT NULL, "callbackUrl" varchar, "postInstallUrl" varchar, "description" varchar, "integrationId" varchar, CONSTRAINT "FK_activepieces_integration_tenant" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_activepieces_integration_organization" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_activepieces_integration_integration" FOREIGN KEY ("integrationId") REFERENCES "integration_tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_activepieces_integration_createdByUser" FOREIGN KEY ("createdByUserId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_activepieces_integration_updatedByUser" FOREIGN KEY ("updatedByUserId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_activepieces_integration_deletedByUser" FOREIGN KEY ("deletedByUserId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`);
        await queryRunner.query(`CREATE UNIQUE INDEX "uq_activepieces_tenant_org_not_null" ON "activepieces_integration" ("tenantId", "organizationId") WHERE "organizationId" IS NOT NULL`);
        await queryRunner.query(`CREATE UNIQUE INDEX "uq_activepieces_tenant_org_null" ON "activepieces_integration" ("tenantId") WHERE "organizationId" IS NULL`);
        await queryRunner.query(`CREATE INDEX "IDX_activepieces_integration_tenant" ON "activepieces_integration" ("tenantId")`);
        await queryRunner.query(`CREATE INDEX "IDX_activepieces_integration_organization" ON "activepieces_integration" ("organizationId")`);
        await queryRunner.query(`CREATE INDEX "IDX_activepieces_integration_integration" ON "activepieces_integration" ("integrationId")`);
        await queryRunner.query(`CREATE INDEX "IDX_activepieces_integration_deletedAt" ON "activepieces_integration" ("deletedAt")`);
        await queryRunner.query(`CREATE INDEX "IDX_activepieces_integration_createdByUserId" ON "activepieces_integration" ("createdByUserId")`);
        await queryRunner.query(`CREATE INDEX "IDX_activepieces_integration_updatedByUserId" ON "activepieces_integration" ("updatedByUserId")`);
        await queryRunner.query(`CREATE INDEX "IDX_activepieces_integration_deletedByUserId" ON "activepieces_integration" ("deletedByUserId")`);
        await queryRunner.query(`CREATE INDEX "IDX_activepieces_integration_isActive" ON "activepieces_integration" ("isActive")`);
        await queryRunner.query(`CREATE INDEX "IDX_activepieces_integration_isArchived" ON "activepieces_integration" ("isArchived")`);
    }

    /**
    * SqliteDB and BetterSQlite3DB Down Migration
    *
    * @param queryRunner
    */
    public async sqliteDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`DROP INDEX "IDX_activepieces_integration_isArchived"`);
        await queryRunner.query(`DROP INDEX "IDX_activepieces_integration_isActive"`);
        await queryRunner.query(`DROP INDEX "IDX_activepieces_integration_deletedByUserId"`);
        await queryRunner.query(`DROP INDEX "IDX_activepieces_integration_updatedByUserId"`);
        await queryRunner.query(`DROP INDEX "IDX_activepieces_integration_createdByUserId"`);
        await queryRunner.query(`DROP INDEX "IDX_activepieces_integration_deletedAt"`);
        await queryRunner.query(`DROP INDEX "IDX_activepieces_integration_integration"`);
        await queryRunner.query(`DROP INDEX "IDX_activepieces_integration_organization"`);
        await queryRunner.query(`DROP INDEX "IDX_activepieces_integration_tenant"`);
        await queryRunner.query(`DROP INDEX "uq_activepieces_tenant_org_null"`);
        await queryRunner.query(`DROP INDEX "uq_activepieces_tenant_org_not_null"`);
        await queryRunner.query(`DROP TABLE "activepieces_integration"`);
    }

    /**
     * MySQL Up Migration
     *
     * @param queryRunner
     */
    public async mysqlUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`CREATE TABLE \`activepieces_integration\` (\`id\` varchar(36) NOT NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`deletedAt\` datetime(6) NULL, \`createdByUserId\` varchar(255) NULL, \`updatedByUserId\` varchar(255) NULL, \`deletedByUserId\` varchar(255) NULL, \`isActive\` tinyint DEFAULT 1, \`isArchived\` tinyint DEFAULT 0, \`archivedAt\` datetime(6) NULL, \`tenantId\` varchar(255) NULL, \`organizationId\` varchar(255) NULL, \`clientId\` varchar(255) NOT NULL, \`clientSecret\` text NOT NULL, \`callbackUrl\` varchar(255) NULL, \`postInstallUrl\` varchar(255) NULL, \`description\` varchar(255) NULL, \`integrationId\` varchar(255) NULL, PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
        await queryRunner.query(`ALTER TABLE \`activepieces_integration\` ADD COLUMN \`tenantOrgKey\` varchar(511) AS (IF(\`organizationId\` IS NULL, \`tenantId\`, CONCAT(\`tenantId\`, ':', \`organizationId\`))) STORED`);
        await queryRunner.query(`CREATE UNIQUE INDEX \`uq_activepieces_tenant_org_key\` ON \`activepieces_integration\` (\`tenantOrgKey\`)`);
        await queryRunner.query(`CREATE INDEX \`IDX_activepieces_integration_tenant\` ON \`activepieces_integration\` (\`tenantId\`)`);
        await queryRunner.query(`CREATE INDEX \`IDX_activepieces_integration_organization\` ON \`activepieces_integration\` (\`organizationId\`)`);
        await queryRunner.query(`CREATE INDEX \`IDX_activepieces_integration_integration\` ON \`activepieces_integration\` (\`integrationId\`)`);
        await queryRunner.query(`CREATE INDEX \`IDX_activepieces_integration_deletedAt\` ON \`activepieces_integration\` (\`deletedAt\`)`);
        await queryRunner.query(`CREATE INDEX \`IDX_activepieces_integration_createdByUserId\` ON \`activepieces_integration\` (\`createdByUserId\`)`);
        await queryRunner.query(`CREATE INDEX \`IDX_activepieces_integration_updatedByUserId\` ON \`activepieces_integration\` (\`updatedByUserId\`)`);
        await queryRunner.query(`CREATE INDEX \`IDX_activepieces_integration_deletedByUserId\` ON \`activepieces_integration\` (\`deletedByUserId\`)`);
        await queryRunner.query(`CREATE INDEX \`IDX_activepieces_integration_isActive\` ON \`activepieces_integration\` (\`isActive\`)`);
        await queryRunner.query(`CREATE INDEX \`IDX_activepieces_integration_isArchived\` ON \`activepieces_integration\` (\`isArchived\`)`);
        await queryRunner.query(`ALTER TABLE \`activepieces_integration\` ADD CONSTRAINT \`FK_activepieces_integration_tenant\` FOREIGN KEY (\`tenantId\`) REFERENCES \`tenant\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`activepieces_integration\` ADD CONSTRAINT \`FK_activepieces_integration_organization\` FOREIGN KEY (\`organizationId\`) REFERENCES \`organization\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE \`activepieces_integration\` ADD CONSTRAINT \`FK_activepieces_integration_integration\` FOREIGN KEY (\`integrationId\`) REFERENCES \`integration_tenant\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`activepieces_integration\` ADD CONSTRAINT \`FK_activepieces_integration_createdByUser\` FOREIGN KEY (\`createdByUserId\`) REFERENCES \`user\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`activepieces_integration\` ADD CONSTRAINT \`FK_activepieces_integration_updatedByUser\` FOREIGN KEY (\`updatedByUserId\`) REFERENCES \`user\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`activepieces_integration\` ADD CONSTRAINT \`FK_activepieces_integration_deletedByUser\` FOREIGN KEY (\`deletedByUserId\`) REFERENCES \`user\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    /**
     * MySQL Down Migration
     *
     * @param queryRunner
     */
    public async mysqlDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`ALTER TABLE \`activepieces_integration\` DROP FOREIGN KEY \`FK_activepieces_integration_deletedByUser\``);
        await queryRunner.query(`ALTER TABLE \`activepieces_integration\` DROP FOREIGN KEY \`FK_activepieces_integration_updatedByUser\``);
        await queryRunner.query(`ALTER TABLE \`activepieces_integration\` DROP FOREIGN KEY \`FK_activepieces_integration_createdByUser\``);
        await queryRunner.query(`ALTER TABLE \`activepieces_integration\` DROP FOREIGN KEY \`FK_activepieces_integration_integration\``);
        await queryRunner.query(`ALTER TABLE \`activepieces_integration\` DROP FOREIGN KEY \`FK_activepieces_integration_organization\``);
        await queryRunner.query(`ALTER TABLE \`activepieces_integration\` DROP FOREIGN KEY \`FK_activepieces_integration_tenant\``);
        await queryRunner.query(`DROP INDEX \`uq_activepieces_tenant_org_key\` ON \`activepieces_integration\``);
        await queryRunner.query(`ALTER TABLE \`activepieces_integration\` DROP COLUMN \`tenantOrgKey\``);
        await queryRunner.query(`DROP INDEX \`IDX_activepieces_integration_isArchived\` ON \`activepieces_integration\``);
        await queryRunner.query(`DROP INDEX \`IDX_activepieces_integration_isActive\` ON \`activepieces_integration\``);
        await queryRunner.query(`DROP INDEX \`IDX_activepieces_integration_deletedByUserId\` ON \`activepieces_integration\``);
        await queryRunner.query(`DROP INDEX \`IDX_activepieces_integration_updatedByUserId\` ON \`activepieces_integration\``);
        await queryRunner.query(`DROP INDEX \`IDX_activepieces_integration_createdByUserId\` ON \`activepieces_integration\``);
        await queryRunner.query(`DROP INDEX \`IDX_activepieces_integration_deletedAt\` ON \`activepieces_integration\``);
        await queryRunner.query(`DROP INDEX \`IDX_activepieces_integration_integration\` ON \`activepieces_integration\``);
        await queryRunner.query(`DROP INDEX \`IDX_activepieces_integration_organization\` ON \`activepieces_integration\``);
        await queryRunner.query(`DROP INDEX \`IDX_activepieces_integration_tenant\` ON \`activepieces_integration\``);
        await queryRunner.query(`DROP TABLE \`activepieces_integration\``);
    }
}
