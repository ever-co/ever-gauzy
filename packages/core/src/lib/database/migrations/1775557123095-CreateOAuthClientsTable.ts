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

        switch (queryRunner.connection.options.type as DatabaseTypeEnum) {
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

        switch (queryRunner.connection.options.type as DatabaseTypeEnum) {
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
        // NOTE: An earlier generated version of this migration also touched
        // `integration_sim_workflow_execution` and `employee_job_preset`.
        // Those were TypeORM generator artifacts unrelated to OAuth clients
        // and have been removed so this migration only creates the new
        // `oauth_clients` table — matching the SQLite and MySQL variants.
        await queryRunner.query(`CREATE TYPE "public"."oauth_clients_clienttype_enum" AS ENUM('confidential', 'public')`);
        await queryRunner.query(`CREATE TABLE "oauth_clients" ("deletedAt" TIMESTAMP, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "createdByUserId" uuid, "updatedByUserId" uuid, "deletedByUserId" uuid, "id" uuid NOT NULL DEFAULT gen_random_uuid(), "isActive" boolean DEFAULT true, "isArchived" boolean DEFAULT false, "archivedAt" TIMESTAMP, "tenantId" uuid, "clientId" character varying(100) NOT NULL, "clientSecretHash" character varying(255), "codeSecret" character varying(255) NOT NULL, "name" character varying(100) NOT NULL, "description" character varying(500), "clientType" "public"."oauth_clients_clienttype_enum" NOT NULL DEFAULT 'confidential', "redirectUris" jsonb NOT NULL, "allowedScopes" jsonb NOT NULL, "allowedGrantTypes" jsonb NOT NULL, "pkceRequired" boolean NOT NULL DEFAULT false, "accessTokenTtl" integer NOT NULL DEFAULT '86400', "refreshTokenTtl" integer NOT NULL DEFAULT '2592000', CONSTRAINT "PK_c4759172d3431bae6f04e678e0d" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_af3ed28bcb478ad9d601bbd76d" ON "oauth_clients" ("createdByUserId") `);
        await queryRunner.query(`CREATE INDEX "IDX_5e8517c2cb9ae50290f1dc159f" ON "oauth_clients" ("updatedByUserId") `);
        await queryRunner.query(`CREATE INDEX "IDX_f2b17e590e57044c3cbea51204" ON "oauth_clients" ("deletedByUserId") `);
        await queryRunner.query(`CREATE INDEX "IDX_74f2ed10bc2ac5a435f4ffa0c0" ON "oauth_clients" ("isActive") `);
        await queryRunner.query(`CREATE INDEX "IDX_fdf9fd0a9f1445be13606eaf92" ON "oauth_clients" ("isArchived") `);
        await queryRunner.query(`CREATE INDEX "IDX_e8a0bd886e6bd30d73e90ffbb5" ON "oauth_clients" ("tenantId") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_b0c094fe1ef0a6c4af8f2b10be" ON "oauth_clients" ("clientId") `);
        await queryRunner.query(`ALTER TABLE "oauth_clients" ADD CONSTRAINT "FK_af3ed28bcb478ad9d601bbd76da" FOREIGN KEY ("createdByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "oauth_clients" ADD CONSTRAINT "FK_5e8517c2cb9ae50290f1dc159fa" FOREIGN KEY ("updatedByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "oauth_clients" ADD CONSTRAINT "FK_f2b17e590e57044c3cbea512049" FOREIGN KEY ("deletedByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "oauth_clients" ADD CONSTRAINT "FK_e8a0bd886e6bd30d73e90ffbb50" FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    /**
    * PostgresDB Down Migration
    *
    * @param queryRunner
    */
    public async postgresDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`ALTER TABLE "oauth_clients" DROP CONSTRAINT "FK_e8a0bd886e6bd30d73e90ffbb50"`);
        await queryRunner.query(`ALTER TABLE "oauth_clients" DROP CONSTRAINT "FK_f2b17e590e57044c3cbea512049"`);
        await queryRunner.query(`ALTER TABLE "oauth_clients" DROP CONSTRAINT "FK_5e8517c2cb9ae50290f1dc159fa"`);
        await queryRunner.query(`ALTER TABLE "oauth_clients" DROP CONSTRAINT "FK_af3ed28bcb478ad9d601bbd76da"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_b0c094fe1ef0a6c4af8f2b10be"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_e8a0bd886e6bd30d73e90ffbb5"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_fdf9fd0a9f1445be13606eaf92"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_74f2ed10bc2ac5a435f4ffa0c0"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_f2b17e590e57044c3cbea51204"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_5e8517c2cb9ae50290f1dc159f"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_af3ed28bcb478ad9d601bbd76d"`);
        await queryRunner.query(`DROP TABLE "oauth_clients"`);
        await queryRunner.query(`DROP TYPE "public"."oauth_clients_clienttype_enum"`);
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
