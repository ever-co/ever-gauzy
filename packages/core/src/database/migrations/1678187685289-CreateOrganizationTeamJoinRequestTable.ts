
import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateOrganizationTeamJoinRequestTable1678187685289 implements MigrationInterface {

    name = 'CreateOrganizationTeamJoinRequestTable1678187685289';

    /**
    * Up Migration
    *
    * @param queryRunner
    */
    public async up(queryRunner: QueryRunner): Promise<any> {
        if (queryRunner.connection.options.type === 'sqlite') {
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
        if (queryRunner.connection.options.type === 'sqlite') {
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
        await queryRunner.query(`CREATE TABLE "organization_team_join_request" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "tenantId" uuid, "organizationId" uuid, "email" character varying NOT NULL, "fullName" character varying, "linkAddress" character varying, "position" character varying, "status" character varying NOT NULL DEFAULT 'REQUESTED', "code" integer, "token" character varying, "expireAt" TIMESTAMP, "userId" uuid, "organizationTeamId" uuid, CONSTRAINT "PK_131578c98f3a9e8a72b9a8a1374" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_d9529008c733cb90044b8c2ad6" ON "organization_team_join_request" ("tenantId") `);
        await queryRunner.query(`CREATE INDEX "IDX_c15823bf3f63b1fe331d9de662" ON "organization_team_join_request" ("organizationId") `);
        await queryRunner.query(`CREATE INDEX "IDX_5e73656ce0355347477c42ae19" ON "organization_team_join_request" ("userId") `);
        await queryRunner.query(`CREATE INDEX "IDX_171b852be7c1f387eca93775aa" ON "organization_team_join_request" ("organizationTeamId") `);
        await queryRunner.query(`ALTER TABLE "organization_team_join_request" ADD CONSTRAINT "FK_d9529008c733cb90044b8c2ad6b" FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "organization_team_join_request" ADD CONSTRAINT "FK_c15823bf3f63b1fe331d9de6625" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE "organization_team_join_request" ADD CONSTRAINT "FK_5e73656ce0355347477c42ae19b" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "organization_team_join_request" ADD CONSTRAINT "FK_171b852be7c1f387eca93775aad" FOREIGN KEY ("organizationTeamId") REFERENCES "organization_team"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
    }

    /**
    * PostgresDB Down Migration
    *
    * @param queryRunner
    */
    public async postgresDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`ALTER TABLE "organization_team_join_request" DROP CONSTRAINT "FK_171b852be7c1f387eca93775aad"`);
        await queryRunner.query(`ALTER TABLE "organization_team_join_request" DROP CONSTRAINT "FK_5e73656ce0355347477c42ae19b"`);
        await queryRunner.query(`ALTER TABLE "organization_team_join_request" DROP CONSTRAINT "FK_c15823bf3f63b1fe331d9de6625"`);
        await queryRunner.query(`ALTER TABLE "organization_team_join_request" DROP CONSTRAINT "FK_d9529008c733cb90044b8c2ad6b"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_171b852be7c1f387eca93775aa"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_5e73656ce0355347477c42ae19"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_c15823bf3f63b1fe331d9de662"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_d9529008c733cb90044b8c2ad6"`);
        await queryRunner.query(`DROP TABLE "organization_team_join_request"`);
    }

    /**
    * SqliteDB Up Migration
    *
    * @param queryRunner
    */
    public async sqliteUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`CREATE TABLE "organization_team_join_request" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "organizationId" varchar, "email" varchar NOT NULL, "fullName" varchar, "linkAddress" varchar, "position" varchar, "status" varchar NOT NULL DEFAULT ('REQUESTED'), "code" integer, "token" varchar, "expireAt" datetime, "userId" varchar, "organizationTeamId" varchar)`);
        await queryRunner.query(`CREATE INDEX "IDX_d9529008c733cb90044b8c2ad6" ON "organization_team_join_request" ("tenantId") `);
        await queryRunner.query(`CREATE INDEX "IDX_c15823bf3f63b1fe331d9de662" ON "organization_team_join_request" ("organizationId") `);
        await queryRunner.query(`CREATE INDEX "IDX_5e73656ce0355347477c42ae19" ON "organization_team_join_request" ("userId") `);
        await queryRunner.query(`CREATE INDEX "IDX_171b852be7c1f387eca93775aa" ON "organization_team_join_request" ("organizationTeamId") `);
        await queryRunner.query(`DROP INDEX "IDX_d9529008c733cb90044b8c2ad6"`);
        await queryRunner.query(`DROP INDEX "IDX_c15823bf3f63b1fe331d9de662"`);
        await queryRunner.query(`DROP INDEX "IDX_5e73656ce0355347477c42ae19"`);
        await queryRunner.query(`DROP INDEX "IDX_171b852be7c1f387eca93775aa"`);
        await queryRunner.query(`CREATE TABLE "temporary_organization_team_join_request" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "organizationId" varchar, "email" varchar NOT NULL, "fullName" varchar, "linkAddress" varchar, "position" varchar, "status" varchar NOT NULL DEFAULT ('REQUESTED'), "code" integer, "token" varchar, "expireAt" datetime, "userId" varchar, "organizationTeamId" varchar, CONSTRAINT "FK_d9529008c733cb90044b8c2ad6b" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_c15823bf3f63b1fe331d9de6625" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_5e73656ce0355347477c42ae19b" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE SET NULL ON UPDATE NO ACTION, CONSTRAINT "FK_171b852be7c1f387eca93775aad" FOREIGN KEY ("organizationTeamId") REFERENCES "organization_team" ("id") ON DELETE SET NULL ON UPDATE NO ACTION)`);
        await queryRunner.query(`INSERT INTO "temporary_organization_team_join_request"("id", "createdAt", "updatedAt", "tenantId", "organizationId", "email", "fullName", "linkAddress", "position", "status", "code", "token", "expireAt", "userId", "organizationTeamId") SELECT "id", "createdAt", "updatedAt", "tenantId", "organizationId", "email", "fullName", "linkAddress", "position", "status", "code", "token", "expireAt", "userId", "organizationTeamId" FROM "organization_team_join_request"`);
        await queryRunner.query(`DROP TABLE "organization_team_join_request"`);
        await queryRunner.query(`ALTER TABLE "temporary_organization_team_join_request" RENAME TO "organization_team_join_request"`);
        await queryRunner.query(`CREATE INDEX "IDX_d9529008c733cb90044b8c2ad6" ON "organization_team_join_request" ("tenantId") `);
        await queryRunner.query(`CREATE INDEX "IDX_c15823bf3f63b1fe331d9de662" ON "organization_team_join_request" ("organizationId") `);
        await queryRunner.query(`CREATE INDEX "IDX_5e73656ce0355347477c42ae19" ON "organization_team_join_request" ("userId") `);
        await queryRunner.query(`CREATE INDEX "IDX_171b852be7c1f387eca93775aa" ON "organization_team_join_request" ("organizationTeamId") `);
    }

    /**
    * SqliteDB Down Migration
    *
    * @param queryRunner
    */
    public async sqliteDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`DROP INDEX "IDX_171b852be7c1f387eca93775aa"`);
        await queryRunner.query(`DROP INDEX "IDX_5e73656ce0355347477c42ae19"`);
        await queryRunner.query(`DROP INDEX "IDX_c15823bf3f63b1fe331d9de662"`);
        await queryRunner.query(`DROP INDEX "IDX_d9529008c733cb90044b8c2ad6"`);
        await queryRunner.query(`ALTER TABLE "organization_team_join_request" RENAME TO "temporary_organization_team_join_request"`);
        await queryRunner.query(`CREATE TABLE "organization_team_join_request" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "organizationId" varchar, "email" varchar NOT NULL, "fullName" varchar, "linkAddress" varchar, "position" varchar, "status" varchar NOT NULL DEFAULT ('REQUESTED'), "code" integer, "token" varchar, "expireAt" datetime, "userId" varchar, "organizationTeamId" varchar)`);
        await queryRunner.query(`INSERT INTO "organization_team_join_request"("id", "createdAt", "updatedAt", "tenantId", "organizationId", "email", "fullName", "linkAddress", "position", "status", "code", "token", "expireAt", "userId", "organizationTeamId") SELECT "id", "createdAt", "updatedAt", "tenantId", "organizationId", "email", "fullName", "linkAddress", "position", "status", "code", "token", "expireAt", "userId", "organizationTeamId" FROM "temporary_organization_team_join_request"`);
        await queryRunner.query(`DROP TABLE "temporary_organization_team_join_request"`);
        await queryRunner.query(`CREATE INDEX "IDX_171b852be7c1f387eca93775aa" ON "organization_team_join_request" ("organizationTeamId") `);
        await queryRunner.query(`CREATE INDEX "IDX_5e73656ce0355347477c42ae19" ON "organization_team_join_request" ("userId") `);
        await queryRunner.query(`CREATE INDEX "IDX_c15823bf3f63b1fe331d9de662" ON "organization_team_join_request" ("organizationId") `);
        await queryRunner.query(`CREATE INDEX "IDX_d9529008c733cb90044b8c2ad6" ON "organization_team_join_request" ("tenantId") `);
        await queryRunner.query(`DROP INDEX "IDX_171b852be7c1f387eca93775aa"`);
        await queryRunner.query(`DROP INDEX "IDX_5e73656ce0355347477c42ae19"`);
        await queryRunner.query(`DROP INDEX "IDX_c15823bf3f63b1fe331d9de662"`);
        await queryRunner.query(`DROP INDEX "IDX_d9529008c733cb90044b8c2ad6"`);
        await queryRunner.query(`DROP TABLE "organization_team_join_request"`);
    }
}
