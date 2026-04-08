import { MigrationInterface, QueryRunner } from 'typeorm';
import * as chalk from 'chalk';
import { DatabaseTypeEnum } from '@gauzy/config';

/**
 * Migration: create the `oauth_clients` table.
 *
 * What changed from the single-app version:
 * Previously there was no DB table — the one OAuth client was stored as
 * `GAUZY_OAUTH_APP_*` env vars. This migration introduces a real registry
 * so multiple third-party apps (Activepieces, n8n, Make.com, …) can each
 * have isolated credentials, redirect URIs, and scopes.
 *
 * The `oauth_clients` table inherits the standard audit columns from
 * `TenantBaseEntity` / `BaseEntity` (id, createdAt, updatedAt, deletedAt,
 * isActive, isArchived, archivedAt, createdByUserId, updatedByUserId,
 * deletedByUserId, tenantId — nullable so a client can be either tenant-
 * scoped or global / cross-tenant), plus the OAuth-specific columns
 * defined on the `OAuthClient` entity.
 *
 * Index/FK hash names below come from the TypeORM generator output for
 * postgres and are reused verbatim across mysql / sqlite so future
 * generator runs stay idempotent.
 */
export class CreateOAuthClientsTable1775557123095 implements MigrationInterface {
    name = 'CreateOAuthClientsTable1775557123095';

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
        await queryRunner.query(`ALTER TABLE "integration_sim_workflow_execution" DROP CONSTRAINT "FK_e830e6c6e890fde77baa13d1b9d"`);
        await queryRunner.query(`ALTER TABLE "integration_sim_workflow_execution" DROP CONSTRAINT "FK_76e1b8edabd8a98090931e9a0f8"`);
        await queryRunner.query(`ALTER TABLE "integration_sim_workflow_execution" DROP CONSTRAINT "FK_b4f41cd27b1be0a3d7b96b856c9"`);
        await queryRunner.query(`ALTER TABLE "integration_sim_workflow_execution" DROP CONSTRAINT "FK_739faa38414e8bf6f5b4b418f1d"`);
        await queryRunner.query(`ALTER TABLE "integration_sim_workflow_execution" DROP CONSTRAINT "FK_b35e4424b51c7b8127e448310da"`);
        await queryRunner.query(`ALTER TABLE "integration_sim_workflow_execution" DROP CONSTRAINT "FK_cf37d62fdb657af05e7d702cb04"`);
        await queryRunner.query(`ALTER TABLE "employee_job_preset" DROP CONSTRAINT "FK_7ae5b4d4bdec77971dab319f2e2"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_e830e6c6e890fde77baa13d1b9"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_76e1b8edabd8a98090931e9a0f"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_b4f41cd27b1be0a3d7b96b856c"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_368ae7398fc5d6396b28d89dea"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_c0669719993bae8e31bb829446"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_739faa38414e8bf6f5b4b418f1"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_b35e4424b51c7b8127e448310d"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_36e8d2d032cfbff60d21ce98bc"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_3dd3ba7dd0b707fec566d25f83"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_cd2c8d035bfd5547bc6174500f"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_cf37d62fdb657af05e7d702cb0"`);
        await queryRunner.query(`CREATE TYPE "public"."oauth_clients_clienttype_enum" AS ENUM('confidential', 'public')`);
        await queryRunner.query(`CREATE TABLE "oauth_clients" ("deletedAt" TIMESTAMP, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "createdByUserId" uuid, "updatedByUserId" uuid, "deletedByUserId" uuid, "id" uuid NOT NULL DEFAULT gen_random_uuid(), "isActive" boolean DEFAULT true, "isArchived" boolean DEFAULT false, "archivedAt" TIMESTAMP, "tenantId" uuid, "clientId" character varying(100) NOT NULL, "clientSecretHash" character varying(255), "codeSecret" character varying(255) NOT NULL, "name" character varying(100) NOT NULL, "description" character varying(500), "clientType" "public"."oauth_clients_clienttype_enum" NOT NULL DEFAULT 'confidential', "redirectUris" jsonb NOT NULL, "allowedScopes" jsonb NOT NULL, "allowedGrantTypes" jsonb NOT NULL, "pkceRequired" boolean NOT NULL DEFAULT false, "accessTokenTtl" integer NOT NULL DEFAULT '86400', "refreshTokenTtl" integer NOT NULL DEFAULT '2592000', CONSTRAINT "PK_c4759172d3431bae6f04e678e0d" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_af3ed28bcb478ad9d601bbd76d" ON "oauth_clients" ("createdByUserId") `);
        await queryRunner.query(`CREATE INDEX "IDX_5e8517c2cb9ae50290f1dc159f" ON "oauth_clients" ("updatedByUserId") `);
        await queryRunner.query(`CREATE INDEX "IDX_f2b17e590e57044c3cbea51204" ON "oauth_clients" ("deletedByUserId") `);
        await queryRunner.query(`CREATE INDEX "IDX_74f2ed10bc2ac5a435f4ffa0c0" ON "oauth_clients" ("isActive") `);
        await queryRunner.query(`CREATE INDEX "IDX_fdf9fd0a9f1445be13606eaf92" ON "oauth_clients" ("isArchived") `);
        await queryRunner.query(`CREATE INDEX "IDX_e8a0bd886e6bd30d73e90ffbb5" ON "oauth_clients" ("tenantId") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_b0c094fe1ef0a6c4af8f2b10be" ON "oauth_clients" ("clientId") `);
        await queryRunner.query(`CREATE INDEX "IDX_2d4ef48832e1935208e252daa1" ON "integration_sim_workflow_execution" ("createdByUserId") `);
        await queryRunner.query(`CREATE INDEX "IDX_533308aba6bc3ef7159d35135e" ON "integration_sim_workflow_execution" ("updatedByUserId") `);
        await queryRunner.query(`CREATE INDEX "IDX_9676d3c14e8e35768a8c1d31a0" ON "integration_sim_workflow_execution" ("deletedByUserId") `);
        await queryRunner.query(`CREATE INDEX "IDX_8a4fae3c00c59b31d8023a258d" ON "integration_sim_workflow_execution" ("isActive") `);
        await queryRunner.query(`CREATE INDEX "IDX_b293be86eb07dd86186210aa8c" ON "integration_sim_workflow_execution" ("isArchived") `);
        await queryRunner.query(`CREATE INDEX "IDX_a5d235e4307e06c9c3b5fd436f" ON "integration_sim_workflow_execution" ("tenantId") `);
        await queryRunner.query(`CREATE INDEX "IDX_f7e03dbf783142f19bf31157af" ON "integration_sim_workflow_execution" ("organizationId") `);
        await queryRunner.query(`CREATE INDEX "IDX_c0a8b32c27b1a5bf5496e8d35b" ON "integration_sim_workflow_execution" ("workflowId") `);
        await queryRunner.query(`CREATE INDEX "IDX_1f232906ebc585937612319acc" ON "integration_sim_workflow_execution" ("executionId") `);
        await queryRunner.query(`CREATE INDEX "IDX_4b2cc176bdc02f7784a885ab71" ON "integration_sim_workflow_execution" ("status") `);
        await queryRunner.query(`CREATE INDEX "IDX_e0fd245c6eacb50baa547dee71" ON "integration_sim_workflow_execution" ("integrationId") `);
        await queryRunner.query(`ALTER TABLE "oauth_clients" ADD CONSTRAINT "FK_af3ed28bcb478ad9d601bbd76da" FOREIGN KEY ("createdByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "oauth_clients" ADD CONSTRAINT "FK_5e8517c2cb9ae50290f1dc159fa" FOREIGN KEY ("updatedByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "oauth_clients" ADD CONSTRAINT "FK_f2b17e590e57044c3cbea512049" FOREIGN KEY ("deletedByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "oauth_clients" ADD CONSTRAINT "FK_e8a0bd886e6bd30d73e90ffbb50" FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "integration_sim_workflow_execution" ADD CONSTRAINT "FK_2d4ef48832e1935208e252daa1a" FOREIGN KEY ("createdByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "integration_sim_workflow_execution" ADD CONSTRAINT "FK_533308aba6bc3ef7159d35135ee" FOREIGN KEY ("updatedByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "integration_sim_workflow_execution" ADD CONSTRAINT "FK_9676d3c14e8e35768a8c1d31a04" FOREIGN KEY ("deletedByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "integration_sim_workflow_execution" ADD CONSTRAINT "FK_a5d235e4307e06c9c3b5fd436fc" FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "integration_sim_workflow_execution" ADD CONSTRAINT "FK_f7e03dbf783142f19bf31157af0" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE "integration_sim_workflow_execution" ADD CONSTRAINT "FK_e0fd245c6eacb50baa547dee71b" FOREIGN KEY ("integrationId") REFERENCES "integration_tenant"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "employee_job_preset" ADD CONSTRAINT "FK_7ae5b4d4bdec77971dab319f2e2" FOREIGN KEY ("jobPresetId") REFERENCES "job_preset"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    /**
    * PostgresDB Down Migration
    *
    * @param queryRunner
    */
    public async postgresDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`ALTER TABLE "employee_job_preset" DROP CONSTRAINT "FK_7ae5b4d4bdec77971dab319f2e2"`);
        await queryRunner.query(`ALTER TABLE "integration_sim_workflow_execution" DROP CONSTRAINT "FK_e0fd245c6eacb50baa547dee71b"`);
        await queryRunner.query(`ALTER TABLE "integration_sim_workflow_execution" DROP CONSTRAINT "FK_f7e03dbf783142f19bf31157af0"`);
        await queryRunner.query(`ALTER TABLE "integration_sim_workflow_execution" DROP CONSTRAINT "FK_a5d235e4307e06c9c3b5fd436fc"`);
        await queryRunner.query(`ALTER TABLE "integration_sim_workflow_execution" DROP CONSTRAINT "FK_9676d3c14e8e35768a8c1d31a04"`);
        await queryRunner.query(`ALTER TABLE "integration_sim_workflow_execution" DROP CONSTRAINT "FK_533308aba6bc3ef7159d35135ee"`);
        await queryRunner.query(`ALTER TABLE "integration_sim_workflow_execution" DROP CONSTRAINT "FK_2d4ef48832e1935208e252daa1a"`);
        await queryRunner.query(`ALTER TABLE "oauth_clients" DROP CONSTRAINT "FK_e8a0bd886e6bd30d73e90ffbb50"`);
        await queryRunner.query(`ALTER TABLE "oauth_clients" DROP CONSTRAINT "FK_f2b17e590e57044c3cbea512049"`);
        await queryRunner.query(`ALTER TABLE "oauth_clients" DROP CONSTRAINT "FK_5e8517c2cb9ae50290f1dc159fa"`);
        await queryRunner.query(`ALTER TABLE "oauth_clients" DROP CONSTRAINT "FK_af3ed28bcb478ad9d601bbd76da"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_e0fd245c6eacb50baa547dee71"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_4b2cc176bdc02f7784a885ab71"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_1f232906ebc585937612319acc"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_c0a8b32c27b1a5bf5496e8d35b"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_f7e03dbf783142f19bf31157af"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_a5d235e4307e06c9c3b5fd436f"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_b293be86eb07dd86186210aa8c"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_8a4fae3c00c59b31d8023a258d"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_9676d3c14e8e35768a8c1d31a0"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_533308aba6bc3ef7159d35135e"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_2d4ef48832e1935208e252daa1"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_b0c094fe1ef0a6c4af8f2b10be"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_e8a0bd886e6bd30d73e90ffbb5"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_fdf9fd0a9f1445be13606eaf92"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_74f2ed10bc2ac5a435f4ffa0c0"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_f2b17e590e57044c3cbea51204"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_5e8517c2cb9ae50290f1dc159f"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_af3ed28bcb478ad9d601bbd76d"`);
        await queryRunner.query(`DROP TABLE "oauth_clients"`);
        await queryRunner.query(`DROP TYPE "public"."oauth_clients_clienttype_enum"`);
        await queryRunner.query(`CREATE INDEX "IDX_cf37d62fdb657af05e7d702cb0" ON "integration_sim_workflow_execution" ("integrationId") `);
        await queryRunner.query(`CREATE INDEX "IDX_cd2c8d035bfd5547bc6174500f" ON "integration_sim_workflow_execution" ("status") `);
        await queryRunner.query(`CREATE INDEX "IDX_3dd3ba7dd0b707fec566d25f83" ON "integration_sim_workflow_execution" ("executionId") `);
        await queryRunner.query(`CREATE INDEX "IDX_36e8d2d032cfbff60d21ce98bc" ON "integration_sim_workflow_execution" ("workflowId") `);
        await queryRunner.query(`CREATE INDEX "IDX_b35e4424b51c7b8127e448310d" ON "integration_sim_workflow_execution" ("organizationId") `);
        await queryRunner.query(`CREATE INDEX "IDX_739faa38414e8bf6f5b4b418f1" ON "integration_sim_workflow_execution" ("tenantId") `);
        await queryRunner.query(`CREATE INDEX "IDX_c0669719993bae8e31bb829446" ON "integration_sim_workflow_execution" ("isArchived") `);
        await queryRunner.query(`CREATE INDEX "IDX_368ae7398fc5d6396b28d89dea" ON "integration_sim_workflow_execution" ("isActive") `);
        await queryRunner.query(`CREATE INDEX "IDX_b4f41cd27b1be0a3d7b96b856c" ON "integration_sim_workflow_execution" ("deletedByUserId") `);
        await queryRunner.query(`CREATE INDEX "IDX_76e1b8edabd8a98090931e9a0f" ON "integration_sim_workflow_execution" ("updatedByUserId") `);
        await queryRunner.query(`CREATE INDEX "IDX_e830e6c6e890fde77baa13d1b9" ON "integration_sim_workflow_execution" ("createdByUserId") `);
        await queryRunner.query(`ALTER TABLE "employee_job_preset" ADD CONSTRAINT "FK_7ae5b4d4bdec77971dab319f2e2" FOREIGN KEY ("jobPresetId") REFERENCES "job_preset"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "integration_sim_workflow_execution" ADD CONSTRAINT "FK_cf37d62fdb657af05e7d702cb04" FOREIGN KEY ("integrationId") REFERENCES "integration_tenant"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "integration_sim_workflow_execution" ADD CONSTRAINT "FK_b35e4424b51c7b8127e448310da" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE "integration_sim_workflow_execution" ADD CONSTRAINT "FK_739faa38414e8bf6f5b4b418f1d" FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "integration_sim_workflow_execution" ADD CONSTRAINT "FK_b4f41cd27b1be0a3d7b96b856c9" FOREIGN KEY ("deletedByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "integration_sim_workflow_execution" ADD CONSTRAINT "FK_76e1b8edabd8a98090931e9a0f8" FOREIGN KEY ("updatedByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "integration_sim_workflow_execution" ADD CONSTRAINT "FK_e830e6c6e890fde77baa13d1b9d" FOREIGN KEY ("createdByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    /**
    * SqliteDB and BetterSQlite3DB Up Migration
    *
    * @param queryRunner
    */
    public async sqliteUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`CREATE TABLE "oauth_clients" ("deletedAt" datetime, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "createdByUserId" varchar, "updatedByUserId" varchar, "deletedByUserId" varchar, "id" varchar PRIMARY KEY NOT NULL, "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "tenantId" varchar, "clientId" varchar(100) NOT NULL, "clientSecretHash" varchar(255), "codeSecret" varchar(255) NOT NULL, "name" varchar(100) NOT NULL, "description" varchar(500), "clientType" varchar CHECK( "clientType" IN ('confidential','public') ) NOT NULL DEFAULT ('confidential'), "redirectUris" text NOT NULL, "allowedScopes" text NOT NULL, "allowedGrantTypes" text NOT NULL, "pkceRequired" boolean NOT NULL DEFAULT (0), "accessTokenTtl" integer NOT NULL DEFAULT (86400), "refreshTokenTtl" integer NOT NULL DEFAULT (2592000), CONSTRAINT "FK_af3ed28bcb478ad9d601bbd76da" FOREIGN KEY ("createdByUserId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_5e8517c2cb9ae50290f1dc159fa" FOREIGN KEY ("updatedByUserId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_f2b17e590e57044c3cbea512049" FOREIGN KEY ("deletedByUserId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_e8a0bd886e6bd30d73e90ffbb50" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`);
        await queryRunner.query(`CREATE INDEX "IDX_af3ed28bcb478ad9d601bbd76d" ON "oauth_clients" ("createdByUserId") `);
        await queryRunner.query(`CREATE INDEX "IDX_5e8517c2cb9ae50290f1dc159f" ON "oauth_clients" ("updatedByUserId") `);
        await queryRunner.query(`CREATE INDEX "IDX_f2b17e590e57044c3cbea51204" ON "oauth_clients" ("deletedByUserId") `);
        await queryRunner.query(`CREATE INDEX "IDX_74f2ed10bc2ac5a435f4ffa0c0" ON "oauth_clients" ("isActive") `);
        await queryRunner.query(`CREATE INDEX "IDX_fdf9fd0a9f1445be13606eaf92" ON "oauth_clients" ("isArchived") `);
        await queryRunner.query(`CREATE INDEX "IDX_e8a0bd886e6bd30d73e90ffbb5" ON "oauth_clients" ("tenantId") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_b0c094fe1ef0a6c4af8f2b10be" ON "oauth_clients" ("clientId") `);
    }

    /**
    * SqliteDB and BetterSQlite3DB Down Migration
    *
    * @param queryRunner
    */
    public async sqliteDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`DROP INDEX "IDX_b0c094fe1ef0a6c4af8f2b10be"`);
        await queryRunner.query(`DROP INDEX "IDX_e8a0bd886e6bd30d73e90ffbb5"`);
        await queryRunner.query(`DROP INDEX "IDX_fdf9fd0a9f1445be13606eaf92"`);
        await queryRunner.query(`DROP INDEX "IDX_74f2ed10bc2ac5a435f4ffa0c0"`);
        await queryRunner.query(`DROP INDEX "IDX_f2b17e590e57044c3cbea51204"`);
        await queryRunner.query(`DROP INDEX "IDX_5e8517c2cb9ae50290f1dc159f"`);
        await queryRunner.query(`DROP INDEX "IDX_af3ed28bcb478ad9d601bbd76d"`);
        await queryRunner.query(`DROP TABLE "oauth_clients"`);
    }

    /**
     * MySQL Up Migration
     *
     * @param queryRunner
     */
    public async mysqlUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`CREATE TABLE \`oauth_clients\` (\`deletedAt\` datetime(6) NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`createdByUserId\` varchar(36) NULL, \`updatedByUserId\` varchar(36) NULL, \`deletedByUserId\` varchar(36) NULL, \`id\` varchar(36) NOT NULL, \`isActive\` tinyint NULL DEFAULT 1, \`isArchived\` tinyint NULL DEFAULT 0, \`archivedAt\` datetime NULL, \`tenantId\` varchar(36) NULL, \`clientId\` varchar(100) NOT NULL, \`clientSecretHash\` varchar(255) NULL, \`codeSecret\` varchar(255) NOT NULL, \`name\` varchar(100) NOT NULL, \`description\` varchar(500) NULL, \`clientType\` enum ('confidential', 'public') NOT NULL DEFAULT 'confidential', \`redirectUris\` json NOT NULL, \`allowedScopes\` json NOT NULL, \`allowedGrantTypes\` json NOT NULL, \`pkceRequired\` tinyint NOT NULL DEFAULT 0, \`accessTokenTtl\` int NOT NULL DEFAULT '86400', \`refreshTokenTtl\` int NOT NULL DEFAULT '2592000', INDEX \`IDX_af3ed28bcb478ad9d601bbd76d\` (\`createdByUserId\`), INDEX \`IDX_5e8517c2cb9ae50290f1dc159f\` (\`updatedByUserId\`), INDEX \`IDX_f2b17e590e57044c3cbea51204\` (\`deletedByUserId\`), INDEX \`IDX_74f2ed10bc2ac5a435f4ffa0c0\` (\`isActive\`), INDEX \`IDX_fdf9fd0a9f1445be13606eaf92\` (\`isArchived\`), INDEX \`IDX_e8a0bd886e6bd30d73e90ffbb5\` (\`tenantId\`), UNIQUE INDEX \`IDX_b0c094fe1ef0a6c4af8f2b10be\` (\`clientId\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
        await queryRunner.query(`ALTER TABLE \`oauth_clients\` ADD CONSTRAINT \`FK_af3ed28bcb478ad9d601bbd76da\` FOREIGN KEY (\`createdByUserId\`) REFERENCES \`user\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`oauth_clients\` ADD CONSTRAINT \`FK_5e8517c2cb9ae50290f1dc159fa\` FOREIGN KEY (\`updatedByUserId\`) REFERENCES \`user\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`oauth_clients\` ADD CONSTRAINT \`FK_f2b17e590e57044c3cbea512049\` FOREIGN KEY (\`deletedByUserId\`) REFERENCES \`user\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`oauth_clients\` ADD CONSTRAINT \`FK_e8a0bd886e6bd30d73e90ffbb50\` FOREIGN KEY (\`tenantId\`) REFERENCES \`tenant\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    /**
     * MySQL Down Migration
     *
     * @param queryRunner
     */
    public async mysqlDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`ALTER TABLE \`oauth_clients\` DROP FOREIGN KEY \`FK_e8a0bd886e6bd30d73e90ffbb50\``);
        await queryRunner.query(`ALTER TABLE \`oauth_clients\` DROP FOREIGN KEY \`FK_f2b17e590e57044c3cbea512049\``);
        await queryRunner.query(`ALTER TABLE \`oauth_clients\` DROP FOREIGN KEY \`FK_5e8517c2cb9ae50290f1dc159fa\``);
        await queryRunner.query(`ALTER TABLE \`oauth_clients\` DROP FOREIGN KEY \`FK_af3ed28bcb478ad9d601bbd76da\``);
        await queryRunner.query(`DROP INDEX \`IDX_b0c094fe1ef0a6c4af8f2b10be\` ON \`oauth_clients\``);
        await queryRunner.query(`DROP INDEX \`IDX_e8a0bd886e6bd30d73e90ffbb5\` ON \`oauth_clients\``);
        await queryRunner.query(`DROP INDEX \`IDX_fdf9fd0a9f1445be13606eaf92\` ON \`oauth_clients\``);
        await queryRunner.query(`DROP INDEX \`IDX_74f2ed10bc2ac5a435f4ffa0c0\` ON \`oauth_clients\``);
        await queryRunner.query(`DROP INDEX \`IDX_f2b17e590e57044c3cbea51204\` ON \`oauth_clients\``);
        await queryRunner.query(`DROP INDEX \`IDX_5e8517c2cb9ae50290f1dc159f\` ON \`oauth_clients\``);
        await queryRunner.query(`DROP INDEX \`IDX_af3ed28bcb478ad9d601bbd76d\` ON \`oauth_clients\``);
        await queryRunner.query(`DROP TABLE \`oauth_clients\``);
    }
}
