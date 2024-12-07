import { MigrationInterface, QueryRunner } from "typeorm";
import * as chalk from 'chalk';
import { DatabaseTypeEnum } from "@gauzy/config";

export class AlterCodeToAlphaNumericFormat1693547294428 implements MigrationInterface {

    name = 'AlterCodeToAlphaNumericFormat1693547294428';

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
        await queryRunner.query(`ALTER TABLE "user" DROP CONSTRAINT "FK_c28e52f758e7bbc53828db92194"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_9e80c9ec749dfda6dbe2cd9704"`);
        await queryRunner.query(`ALTER TABLE "email_reset" ALTER COLUMN "code" TYPE character varying`);
        await queryRunner.query(`ALTER TABLE "invite" ALTER COLUMN "code" TYPE character varying`);
        await queryRunner.query(`ALTER TABLE "organization_team_join_request" ALTER COLUMN "code" TYPE character varying`);
        await queryRunner.query(`ALTER TABLE "user" ALTER COLUMN "code" TYPE character varying`);
        await queryRunner.query(`CREATE INDEX "IDX_9e80c9ec749dfda6dbe2cd9704" ON "email_reset" ("code") `);
        await queryRunner.query(`CREATE INDEX "IDX_9033faf41b23c61ba201c48796" ON "email_sent" ("emailTemplateId") `);
        await queryRunner.query(`ALTER TABLE "user" ADD CONSTRAINT "FK_c28e52f758e7bbc53828db92194" FOREIGN KEY ("roleId") REFERENCES "role"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
    }

    /**
    * PostgresDB Down Migration
    *
    * @param queryRunner
    */
    public async postgresDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`ALTER TABLE "user" DROP CONSTRAINT "FK_c28e52f758e7bbc53828db92194"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_9033faf41b23c61ba201c48796"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_9e80c9ec749dfda6dbe2cd9704"`);
        await queryRunner.query(`ALTER TABLE "user" ALTER COLUMN "code" TYPE integer`);
        await queryRunner.query(`ALTER TABLE "organization_team_join_request" ALTER COLUMN "code" TYPE integer`);
        await queryRunner.query(`ALTER TABLE "invite" ALTER COLUMN "code" TYPE integer`);
        await queryRunner.query(`ALTER TABLE "email_reset" ALTER COLUMN "code" TYPE integer`);
        await queryRunner.query(`CREATE INDEX "IDX_9e80c9ec749dfda6dbe2cd9704" ON "email_reset" ("code") `);
        await queryRunner.query(`ALTER TABLE "user" ADD CONSTRAINT "FK_c28e52f758e7bbc53828db92194" FOREIGN KEY ("roleId") REFERENCES "role"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    /**
     * SqliteDB Up Migration
     *
     * @param queryRunner
     */
    public async sqliteUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`DROP INDEX "IDX_5e028298e103e1694147ada69e"`);
        await queryRunner.query(`DROP INDEX "IDX_f2578043e491921209f5dadd08"`);
        await queryRunner.query(`DROP INDEX "IDX_c28e52f758e7bbc53828db9219"`);
        await queryRunner.query(`DROP INDEX "IDX_78a916df40e02a9deb1c4b75ed"`);
        await queryRunner.query(`DROP INDEX "IDX_e12875dfb3b1d92d7d7c5377e2"`);
        await queryRunner.query(`DROP INDEX "IDX_f0e1b4ecdca13b177e2e3a0613"`);
        await queryRunner.query(`DROP INDEX "IDX_58e4dbff0e1a32a9bdc861bb29"`);
        await queryRunner.query(`DROP INDEX "IDX_19de43e9f1842360ce646253d7"`);
        await queryRunner.query(`DROP INDEX "IDX_685bf353c85f23b6f848e4dcde"`);
        await queryRunner.query(`CREATE TABLE "temporary_user" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "thirdPartyId" varchar, "firstName" varchar, "lastName" varchar, "email" varchar, "username" varchar, "hash" varchar, "imageUrl" varchar(500), "preferredLanguage" varchar DEFAULT ('en'), "preferredComponentLayout" varchar CHECK( "preferredComponentLayout" IN ('CARDS_GRID','TABLE') ) DEFAULT ('TABLE'), "roleId" varchar, "refreshToken" varchar, "isActive" boolean DEFAULT (1), "code" integer, "codeExpireAt" datetime, "emailVerifiedAt" datetime, "emailToken" varchar, "phoneNumber" varchar, "timeZone" varchar, "imageId" varchar, CONSTRAINT "FK_5e028298e103e1694147ada69e5" FOREIGN KEY ("imageId") REFERENCES "image_asset" ("id") ON DELETE SET NULL ON UPDATE NO ACTION, CONSTRAINT "FK_685bf353c85f23b6f848e4dcded" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`);
        await queryRunner.query(`INSERT INTO "temporary_user"("id", "createdAt", "updatedAt", "tenantId", "thirdPartyId", "firstName", "lastName", "email", "username", "hash", "imageUrl", "preferredLanguage", "preferredComponentLayout", "roleId", "refreshToken", "isActive", "code", "codeExpireAt", "emailVerifiedAt", "emailToken", "phoneNumber", "timeZone", "imageId") SELECT "id", "createdAt", "updatedAt", "tenantId", "thirdPartyId", "firstName", "lastName", "email", "username", "hash", "imageUrl", "preferredLanguage", "preferredComponentLayout", "roleId", "refreshToken", "isActive", "code", "codeExpireAt", "emailVerifiedAt", "emailToken", "phoneNumber", "timeZone", "imageId" FROM "user"`);
        await queryRunner.query(`DROP TABLE "user"`);
        await queryRunner.query(`ALTER TABLE "temporary_user" RENAME TO "user"`);
        await queryRunner.query(`CREATE INDEX "IDX_5e028298e103e1694147ada69e" ON "user" ("imageId") `);
        await queryRunner.query(`CREATE INDEX "IDX_f2578043e491921209f5dadd08" ON "user" ("phoneNumber") `);
        await queryRunner.query(`CREATE INDEX "IDX_c28e52f758e7bbc53828db9219" ON "user" ("roleId") `);
        await queryRunner.query(`CREATE INDEX "IDX_78a916df40e02a9deb1c4b75ed" ON "user" ("username") `);
        await queryRunner.query(`CREATE INDEX "IDX_e12875dfb3b1d92d7d7c5377e2" ON "user" ("email") `);
        await queryRunner.query(`CREATE INDEX "IDX_f0e1b4ecdca13b177e2e3a0613" ON "user" ("lastName") `);
        await queryRunner.query(`CREATE INDEX "IDX_58e4dbff0e1a32a9bdc861bb29" ON "user" ("firstName") `);
        await queryRunner.query(`CREATE INDEX "IDX_19de43e9f1842360ce646253d7" ON "user" ("thirdPartyId") `);
        await queryRunner.query(`CREATE INDEX "IDX_685bf353c85f23b6f848e4dcde" ON "user" ("tenantId") `);
        await queryRunner.query(`DROP INDEX "IDX_4ac734f2a1a3c055dca04fba99"`);
        await queryRunner.query(`DROP INDEX "IDX_93799dfaeff51de06f1e02ac41"`);
        await queryRunner.query(`DROP INDEX "IDX_03d16a2fd43d7c601743440212"`);
        await queryRunner.query(`DROP INDEX "IDX_4be518a169bbcbfe92025ac574"`);
        await queryRunner.query(`DROP INDEX "IDX_9e80c9ec749dfda6dbe2cd9704"`);
        await queryRunner.query(`DROP INDEX "IDX_e37af4ab2ba0bf268bfd982634"`);
        await queryRunner.query(`CREATE TABLE "temporary_email_reset" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "email" varchar NOT NULL, "oldEmail" varchar NOT NULL, "code" integer NOT NULL, "userId" varchar, "token" varchar, "expiredAt" datetime, CONSTRAINT "FK_e37af4ab2ba0bf268bfd9826345" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_93799dfaeff51de06f1e02ac414" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`);
        await queryRunner.query(`INSERT INTO "temporary_email_reset"("id", "createdAt", "updatedAt", "tenantId", "email", "oldEmail", "code", "userId", "token", "expiredAt") SELECT "id", "createdAt", "updatedAt", "tenantId", "email", "oldEmail", "code", "userId", "token", "expiredAt" FROM "email_reset"`);
        await queryRunner.query(`DROP TABLE "email_reset"`);
        await queryRunner.query(`ALTER TABLE "temporary_email_reset" RENAME TO "email_reset"`);
        await queryRunner.query(`CREATE INDEX "IDX_4ac734f2a1a3c055dca04fba99" ON "email_reset" ("token") `);
        await queryRunner.query(`CREATE INDEX "IDX_93799dfaeff51de06f1e02ac41" ON "email_reset" ("tenantId") `);
        await queryRunner.query(`CREATE INDEX "IDX_03d16a2fd43d7c601743440212" ON "email_reset" ("email") `);
        await queryRunner.query(`CREATE INDEX "IDX_4be518a169bbcbfe92025ac574" ON "email_reset" ("oldEmail") `);
        await queryRunner.query(`CREATE INDEX "IDX_9e80c9ec749dfda6dbe2cd9704" ON "email_reset" ("code") `);
        await queryRunner.query(`CREATE INDEX "IDX_e37af4ab2ba0bf268bfd982634" ON "email_reset" ("userId") `);
        await queryRunner.query(`DROP INDEX "IDX_91bfeec7a9574f458e5b592472"`);
        await queryRunner.query(`DROP INDEX "IDX_900a3ed40499c79c1c289fec28"`);
        await queryRunner.query(`DROP INDEX "IDX_5a182e8b3e225b14ddf6df7e6c"`);
        await queryRunner.query(`DROP INDEX "IDX_68eef4ab86b67747f24f288a16"`);
        await queryRunner.query(`DROP INDEX "IDX_7c2328f76efb850b8114797247"`);
        await queryRunner.query(`CREATE TABLE "temporary_invite" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "organizationId" varchar, "token" varchar NOT NULL, "email" varchar NOT NULL, "status" varchar NOT NULL, "expireDate" datetime, "actionDate" datetime, "invitedById" varchar, "roleId" varchar, "code" integer, "fullName" varchar, "userId" varchar, CONSTRAINT "FK_91bfeec7a9574f458e5b592472d" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE SET NULL ON UPDATE NO ACTION, CONSTRAINT "FK_900a3ed40499c79c1c289fec284" FOREIGN KEY ("roleId") REFERENCES "role" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_5a182e8b3e225b14ddf6df7e6c3" FOREIGN KEY ("invitedById") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_68eef4ab86b67747f24f288a16c" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_7c2328f76efb850b81147972476" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`);
        await queryRunner.query(`INSERT INTO "temporary_invite"("id", "createdAt", "updatedAt", "tenantId", "organizationId", "token", "email", "status", "expireDate", "actionDate", "invitedById", "roleId", "code", "fullName", "userId") SELECT "id", "createdAt", "updatedAt", "tenantId", "organizationId", "token", "email", "status", "expireDate", "actionDate", "invitedById", "roleId", "code", "fullName", "userId" FROM "invite"`);
        await queryRunner.query(`DROP TABLE "invite"`);
        await queryRunner.query(`ALTER TABLE "temporary_invite" RENAME TO "invite"`);
        await queryRunner.query(`CREATE INDEX "IDX_91bfeec7a9574f458e5b592472" ON "invite" ("userId") `);
        await queryRunner.query(`CREATE INDEX "IDX_900a3ed40499c79c1c289fec28" ON "invite" ("roleId") `);
        await queryRunner.query(`CREATE INDEX "IDX_5a182e8b3e225b14ddf6df7e6c" ON "invite" ("invitedById") `);
        await queryRunner.query(`CREATE INDEX "IDX_68eef4ab86b67747f24f288a16" ON "invite" ("organizationId") `);
        await queryRunner.query(`CREATE INDEX "IDX_7c2328f76efb850b8114797247" ON "invite" ("tenantId") `);
        await queryRunner.query(`DROP INDEX "IDX_d9529008c733cb90044b8c2ad6"`);
        await queryRunner.query(`DROP INDEX "IDX_c15823bf3f63b1fe331d9de662"`);
        await queryRunner.query(`DROP INDEX "IDX_5e73656ce0355347477c42ae19"`);
        await queryRunner.query(`DROP INDEX "IDX_171b852be7c1f387eca93775aa"`);
        await queryRunner.query(`CREATE TABLE "temporary_organization_team_join_request" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "organizationId" varchar, "email" varchar NOT NULL, "fullName" varchar, "linkAddress" varchar, "position" varchar, "status" varchar, "code" integer, "token" varchar, "expiredAt" datetime, "userId" varchar, "organizationTeamId" varchar, CONSTRAINT "FK_d9529008c733cb90044b8c2ad6b" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_c15823bf3f63b1fe331d9de6625" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_5e73656ce0355347477c42ae19b" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_171b852be7c1f387eca93775aad" FOREIGN KEY ("organizationTeamId") REFERENCES "organization_team" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`);
        await queryRunner.query(`INSERT INTO "temporary_organization_team_join_request"("id", "createdAt", "updatedAt", "tenantId", "organizationId", "email", "fullName", "linkAddress", "position", "status", "code", "token", "expiredAt", "userId", "organizationTeamId") SELECT "id", "createdAt", "updatedAt", "tenantId", "organizationId", "email", "fullName", "linkAddress", "position", "status", "code", "token", "expiredAt", "userId", "organizationTeamId" FROM "organization_team_join_request"`);
        await queryRunner.query(`DROP TABLE "organization_team_join_request"`);
        await queryRunner.query(`ALTER TABLE "temporary_organization_team_join_request" RENAME TO "organization_team_join_request"`);
        await queryRunner.query(`CREATE INDEX "IDX_d9529008c733cb90044b8c2ad6" ON "organization_team_join_request" ("tenantId") `);
        await queryRunner.query(`CREATE INDEX "IDX_c15823bf3f63b1fe331d9de662" ON "organization_team_join_request" ("organizationId") `);
        await queryRunner.query(`CREATE INDEX "IDX_5e73656ce0355347477c42ae19" ON "organization_team_join_request" ("userId") `);
        await queryRunner.query(`CREATE INDEX "IDX_171b852be7c1f387eca93775aa" ON "organization_team_join_request" ("organizationTeamId") `);
        await queryRunner.query(`DROP INDEX "IDX_5e028298e103e1694147ada69e"`);
        await queryRunner.query(`DROP INDEX "IDX_f2578043e491921209f5dadd08"`);
        await queryRunner.query(`DROP INDEX "IDX_c28e52f758e7bbc53828db9219"`);
        await queryRunner.query(`DROP INDEX "IDX_78a916df40e02a9deb1c4b75ed"`);
        await queryRunner.query(`DROP INDEX "IDX_e12875dfb3b1d92d7d7c5377e2"`);
        await queryRunner.query(`DROP INDEX "IDX_f0e1b4ecdca13b177e2e3a0613"`);
        await queryRunner.query(`DROP INDEX "IDX_58e4dbff0e1a32a9bdc861bb29"`);
        await queryRunner.query(`DROP INDEX "IDX_19de43e9f1842360ce646253d7"`);
        await queryRunner.query(`DROP INDEX "IDX_685bf353c85f23b6f848e4dcde"`);
        await queryRunner.query(`CREATE TABLE "temporary_user" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "thirdPartyId" varchar, "firstName" varchar, "lastName" varchar, "email" varchar, "username" varchar, "hash" varchar, "imageUrl" varchar(500), "preferredLanguage" varchar DEFAULT ('en'), "preferredComponentLayout" varchar CHECK( "preferredComponentLayout" IN ('CARDS_GRID','TABLE') ) DEFAULT ('TABLE'), "roleId" varchar, "refreshToken" varchar, "isActive" boolean DEFAULT (1), "code" integer, "codeExpireAt" datetime, "emailVerifiedAt" datetime, "emailToken" varchar, "phoneNumber" varchar, "timeZone" varchar, "imageId" varchar, CONSTRAINT "FK_5e028298e103e1694147ada69e5" FOREIGN KEY ("imageId") REFERENCES "image_asset" ("id") ON DELETE SET NULL ON UPDATE NO ACTION, CONSTRAINT "FK_685bf353c85f23b6f848e4dcded" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`);
        await queryRunner.query(`INSERT INTO "temporary_user"("id", "createdAt", "updatedAt", "tenantId", "thirdPartyId", "firstName", "lastName", "email", "username", "hash", "imageUrl", "preferredLanguage", "preferredComponentLayout", "roleId", "refreshToken", "isActive", "code", "codeExpireAt", "emailVerifiedAt", "emailToken", "phoneNumber", "timeZone", "imageId") SELECT "id", "createdAt", "updatedAt", "tenantId", "thirdPartyId", "firstName", "lastName", "email", "username", "hash", "imageUrl", "preferredLanguage", "preferredComponentLayout", "roleId", "refreshToken", "isActive", "code", "codeExpireAt", "emailVerifiedAt", "emailToken", "phoneNumber", "timeZone", "imageId" FROM "user"`);
        await queryRunner.query(`DROP TABLE "user"`);
        await queryRunner.query(`ALTER TABLE "temporary_user" RENAME TO "user"`);
        await queryRunner.query(`CREATE INDEX "IDX_5e028298e103e1694147ada69e" ON "user" ("imageId") `);
        await queryRunner.query(`CREATE INDEX "IDX_f2578043e491921209f5dadd08" ON "user" ("phoneNumber") `);
        await queryRunner.query(`CREATE INDEX "IDX_c28e52f758e7bbc53828db9219" ON "user" ("roleId") `);
        await queryRunner.query(`CREATE INDEX "IDX_78a916df40e02a9deb1c4b75ed" ON "user" ("username") `);
        await queryRunner.query(`CREATE INDEX "IDX_e12875dfb3b1d92d7d7c5377e2" ON "user" ("email") `);
        await queryRunner.query(`CREATE INDEX "IDX_f0e1b4ecdca13b177e2e3a0613" ON "user" ("lastName") `);
        await queryRunner.query(`CREATE INDEX "IDX_58e4dbff0e1a32a9bdc861bb29" ON "user" ("firstName") `);
        await queryRunner.query(`CREATE INDEX "IDX_19de43e9f1842360ce646253d7" ON "user" ("thirdPartyId") `);
        await queryRunner.query(`CREATE INDEX "IDX_685bf353c85f23b6f848e4dcde" ON "user" ("tenantId") `);
        await queryRunner.query(`DROP INDEX "IDX_4ac734f2a1a3c055dca04fba99"`);
        await queryRunner.query(`DROP INDEX "IDX_93799dfaeff51de06f1e02ac41"`);
        await queryRunner.query(`DROP INDEX "IDX_03d16a2fd43d7c601743440212"`);
        await queryRunner.query(`DROP INDEX "IDX_4be518a169bbcbfe92025ac574"`);
        await queryRunner.query(`DROP INDEX "IDX_9e80c9ec749dfda6dbe2cd9704"`);
        await queryRunner.query(`DROP INDEX "IDX_e37af4ab2ba0bf268bfd982634"`);
        await queryRunner.query(`CREATE TABLE "temporary_email_reset" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "email" varchar NOT NULL, "oldEmail" varchar NOT NULL, "code" varchar NOT NULL, "userId" varchar, "token" varchar, "expiredAt" datetime, CONSTRAINT "FK_e37af4ab2ba0bf268bfd9826345" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_93799dfaeff51de06f1e02ac414" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`);
        await queryRunner.query(`INSERT INTO "temporary_email_reset"("id", "createdAt", "updatedAt", "tenantId", "email", "oldEmail", "code", "userId", "token", "expiredAt") SELECT "id", "createdAt", "updatedAt", "tenantId", "email", "oldEmail", "code", "userId", "token", "expiredAt" FROM "email_reset"`);
        await queryRunner.query(`DROP TABLE "email_reset"`);
        await queryRunner.query(`ALTER TABLE "temporary_email_reset" RENAME TO "email_reset"`);
        await queryRunner.query(`CREATE INDEX "IDX_4ac734f2a1a3c055dca04fba99" ON "email_reset" ("token") `);
        await queryRunner.query(`CREATE INDEX "IDX_93799dfaeff51de06f1e02ac41" ON "email_reset" ("tenantId") `);
        await queryRunner.query(`CREATE INDEX "IDX_03d16a2fd43d7c601743440212" ON "email_reset" ("email") `);
        await queryRunner.query(`CREATE INDEX "IDX_4be518a169bbcbfe92025ac574" ON "email_reset" ("oldEmail") `);
        await queryRunner.query(`CREATE INDEX "IDX_9e80c9ec749dfda6dbe2cd9704" ON "email_reset" ("code") `);
        await queryRunner.query(`CREATE INDEX "IDX_e37af4ab2ba0bf268bfd982634" ON "email_reset" ("userId") `);
        await queryRunner.query(`DROP INDEX "IDX_91bfeec7a9574f458e5b592472"`);
        await queryRunner.query(`DROP INDEX "IDX_900a3ed40499c79c1c289fec28"`);
        await queryRunner.query(`DROP INDEX "IDX_5a182e8b3e225b14ddf6df7e6c"`);
        await queryRunner.query(`DROP INDEX "IDX_68eef4ab86b67747f24f288a16"`);
        await queryRunner.query(`DROP INDEX "IDX_7c2328f76efb850b8114797247"`);
        await queryRunner.query(`CREATE TABLE "temporary_invite" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "organizationId" varchar, "token" varchar NOT NULL, "email" varchar NOT NULL, "status" varchar NOT NULL, "expireDate" datetime, "actionDate" datetime, "invitedById" varchar, "roleId" varchar, "code" varchar, "fullName" varchar, "userId" varchar, CONSTRAINT "FK_91bfeec7a9574f458e5b592472d" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE SET NULL ON UPDATE NO ACTION, CONSTRAINT "FK_900a3ed40499c79c1c289fec284" FOREIGN KEY ("roleId") REFERENCES "role" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_5a182e8b3e225b14ddf6df7e6c3" FOREIGN KEY ("invitedById") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_68eef4ab86b67747f24f288a16c" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_7c2328f76efb850b81147972476" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`);
        await queryRunner.query(`INSERT INTO "temporary_invite"("id", "createdAt", "updatedAt", "tenantId", "organizationId", "token", "email", "status", "expireDate", "actionDate", "invitedById", "roleId", "code", "fullName", "userId") SELECT "id", "createdAt", "updatedAt", "tenantId", "organizationId", "token", "email", "status", "expireDate", "actionDate", "invitedById", "roleId", "code", "fullName", "userId" FROM "invite"`);
        await queryRunner.query(`DROP TABLE "invite"`);
        await queryRunner.query(`ALTER TABLE "temporary_invite" RENAME TO "invite"`);
        await queryRunner.query(`CREATE INDEX "IDX_91bfeec7a9574f458e5b592472" ON "invite" ("userId") `);
        await queryRunner.query(`CREATE INDEX "IDX_900a3ed40499c79c1c289fec28" ON "invite" ("roleId") `);
        await queryRunner.query(`CREATE INDEX "IDX_5a182e8b3e225b14ddf6df7e6c" ON "invite" ("invitedById") `);
        await queryRunner.query(`CREATE INDEX "IDX_68eef4ab86b67747f24f288a16" ON "invite" ("organizationId") `);
        await queryRunner.query(`CREATE INDEX "IDX_7c2328f76efb850b8114797247" ON "invite" ("tenantId") `);
        await queryRunner.query(`DROP INDEX "IDX_d9529008c733cb90044b8c2ad6"`);
        await queryRunner.query(`DROP INDEX "IDX_c15823bf3f63b1fe331d9de662"`);
        await queryRunner.query(`DROP INDEX "IDX_5e73656ce0355347477c42ae19"`);
        await queryRunner.query(`DROP INDEX "IDX_171b852be7c1f387eca93775aa"`);
        await queryRunner.query(`CREATE TABLE "temporary_organization_team_join_request" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "organizationId" varchar, "email" varchar NOT NULL, "fullName" varchar, "linkAddress" varchar, "position" varchar, "status" varchar, "code" varchar, "token" varchar, "expiredAt" datetime, "userId" varchar, "organizationTeamId" varchar, CONSTRAINT "FK_d9529008c733cb90044b8c2ad6b" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_c15823bf3f63b1fe331d9de6625" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_5e73656ce0355347477c42ae19b" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_171b852be7c1f387eca93775aad" FOREIGN KEY ("organizationTeamId") REFERENCES "organization_team" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`);
        await queryRunner.query(`INSERT INTO "temporary_organization_team_join_request"("id", "createdAt", "updatedAt", "tenantId", "organizationId", "email", "fullName", "linkAddress", "position", "status", "code", "token", "expiredAt", "userId", "organizationTeamId") SELECT "id", "createdAt", "updatedAt", "tenantId", "organizationId", "email", "fullName", "linkAddress", "position", "status", "code", "token", "expiredAt", "userId", "organizationTeamId" FROM "organization_team_join_request"`);
        await queryRunner.query(`DROP TABLE "organization_team_join_request"`);
        await queryRunner.query(`ALTER TABLE "temporary_organization_team_join_request" RENAME TO "organization_team_join_request"`);
        await queryRunner.query(`CREATE INDEX "IDX_d9529008c733cb90044b8c2ad6" ON "organization_team_join_request" ("tenantId") `);
        await queryRunner.query(`CREATE INDEX "IDX_c15823bf3f63b1fe331d9de662" ON "organization_team_join_request" ("organizationId") `);
        await queryRunner.query(`CREATE INDEX "IDX_5e73656ce0355347477c42ae19" ON "organization_team_join_request" ("userId") `);
        await queryRunner.query(`CREATE INDEX "IDX_171b852be7c1f387eca93775aa" ON "organization_team_join_request" ("organizationTeamId") `);
        await queryRunner.query(`DROP INDEX "IDX_5e028298e103e1694147ada69e"`);
        await queryRunner.query(`DROP INDEX "IDX_f2578043e491921209f5dadd08"`);
        await queryRunner.query(`DROP INDEX "IDX_c28e52f758e7bbc53828db9219"`);
        await queryRunner.query(`DROP INDEX "IDX_78a916df40e02a9deb1c4b75ed"`);
        await queryRunner.query(`DROP INDEX "IDX_e12875dfb3b1d92d7d7c5377e2"`);
        await queryRunner.query(`DROP INDEX "IDX_f0e1b4ecdca13b177e2e3a0613"`);
        await queryRunner.query(`DROP INDEX "IDX_58e4dbff0e1a32a9bdc861bb29"`);
        await queryRunner.query(`DROP INDEX "IDX_19de43e9f1842360ce646253d7"`);
        await queryRunner.query(`DROP INDEX "IDX_685bf353c85f23b6f848e4dcde"`);
        await queryRunner.query(`CREATE TABLE "temporary_user" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "thirdPartyId" varchar, "firstName" varchar, "lastName" varchar, "email" varchar, "username" varchar, "hash" varchar, "imageUrl" varchar(500), "preferredLanguage" varchar DEFAULT ('en'), "preferredComponentLayout" varchar CHECK( "preferredComponentLayout" IN ('CARDS_GRID','TABLE') ) DEFAULT ('TABLE'), "roleId" varchar, "refreshToken" varchar, "isActive" boolean DEFAULT (1), "code" varchar, "codeExpireAt" datetime, "emailVerifiedAt" datetime, "emailToken" varchar, "phoneNumber" varchar, "timeZone" varchar, "imageId" varchar, CONSTRAINT "FK_5e028298e103e1694147ada69e5" FOREIGN KEY ("imageId") REFERENCES "image_asset" ("id") ON DELETE SET NULL ON UPDATE NO ACTION, CONSTRAINT "FK_685bf353c85f23b6f848e4dcded" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`);
        await queryRunner.query(`INSERT INTO "temporary_user"("id", "createdAt", "updatedAt", "tenantId", "thirdPartyId", "firstName", "lastName", "email", "username", "hash", "imageUrl", "preferredLanguage", "preferredComponentLayout", "roleId", "refreshToken", "isActive", "code", "codeExpireAt", "emailVerifiedAt", "emailToken", "phoneNumber", "timeZone", "imageId") SELECT "id", "createdAt", "updatedAt", "tenantId", "thirdPartyId", "firstName", "lastName", "email", "username", "hash", "imageUrl", "preferredLanguage", "preferredComponentLayout", "roleId", "refreshToken", "isActive", "code", "codeExpireAt", "emailVerifiedAt", "emailToken", "phoneNumber", "timeZone", "imageId" FROM "user"`);
        await queryRunner.query(`DROP TABLE "user"`);
        await queryRunner.query(`ALTER TABLE "temporary_user" RENAME TO "user"`);
        await queryRunner.query(`CREATE INDEX "IDX_5e028298e103e1694147ada69e" ON "user" ("imageId") `);
        await queryRunner.query(`CREATE INDEX "IDX_f2578043e491921209f5dadd08" ON "user" ("phoneNumber") `);
        await queryRunner.query(`CREATE INDEX "IDX_c28e52f758e7bbc53828db9219" ON "user" ("roleId") `);
        await queryRunner.query(`CREATE INDEX "IDX_78a916df40e02a9deb1c4b75ed" ON "user" ("username") `);
        await queryRunner.query(`CREATE INDEX "IDX_e12875dfb3b1d92d7d7c5377e2" ON "user" ("email") `);
        await queryRunner.query(`CREATE INDEX "IDX_f0e1b4ecdca13b177e2e3a0613" ON "user" ("lastName") `);
        await queryRunner.query(`CREATE INDEX "IDX_58e4dbff0e1a32a9bdc861bb29" ON "user" ("firstName") `);
        await queryRunner.query(`CREATE INDEX "IDX_19de43e9f1842360ce646253d7" ON "user" ("thirdPartyId") `);
        await queryRunner.query(`CREATE INDEX "IDX_685bf353c85f23b6f848e4dcde" ON "user" ("tenantId") `);
        await queryRunner.query(`CREATE INDEX "IDX_9033faf41b23c61ba201c48796" ON "email_sent" ("emailTemplateId") `);
        await queryRunner.query(`DROP INDEX "IDX_5e028298e103e1694147ada69e"`);
        await queryRunner.query(`DROP INDEX "IDX_f2578043e491921209f5dadd08"`);
        await queryRunner.query(`DROP INDEX "IDX_c28e52f758e7bbc53828db9219"`);
        await queryRunner.query(`DROP INDEX "IDX_78a916df40e02a9deb1c4b75ed"`);
        await queryRunner.query(`DROP INDEX "IDX_e12875dfb3b1d92d7d7c5377e2"`);
        await queryRunner.query(`DROP INDEX "IDX_f0e1b4ecdca13b177e2e3a0613"`);
        await queryRunner.query(`DROP INDEX "IDX_58e4dbff0e1a32a9bdc861bb29"`);
        await queryRunner.query(`DROP INDEX "IDX_19de43e9f1842360ce646253d7"`);
        await queryRunner.query(`DROP INDEX "IDX_685bf353c85f23b6f848e4dcde"`);
        await queryRunner.query(`CREATE TABLE "temporary_user" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "thirdPartyId" varchar, "firstName" varchar, "lastName" varchar, "email" varchar, "username" varchar, "hash" varchar, "imageUrl" varchar(500), "preferredLanguage" varchar DEFAULT ('en'), "preferredComponentLayout" varchar CHECK( "preferredComponentLayout" IN ('CARDS_GRID','TABLE') ) DEFAULT ('TABLE'), "roleId" varchar, "refreshToken" varchar, "isActive" boolean DEFAULT (1), "code" varchar, "codeExpireAt" datetime, "emailVerifiedAt" datetime, "emailToken" varchar, "phoneNumber" varchar, "timeZone" varchar, "imageId" varchar, CONSTRAINT "FK_5e028298e103e1694147ada69e5" FOREIGN KEY ("imageId") REFERENCES "image_asset" ("id") ON DELETE SET NULL ON UPDATE NO ACTION, CONSTRAINT "FK_685bf353c85f23b6f848e4dcded" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_c28e52f758e7bbc53828db92194" FOREIGN KEY ("roleId") REFERENCES "role" ("id") ON DELETE SET NULL ON UPDATE NO ACTION)`);
        await queryRunner.query(`INSERT INTO "temporary_user"("id", "createdAt", "updatedAt", "tenantId", "thirdPartyId", "firstName", "lastName", "email", "username", "hash", "imageUrl", "preferredLanguage", "preferredComponentLayout", "roleId", "refreshToken", "isActive", "code", "codeExpireAt", "emailVerifiedAt", "emailToken", "phoneNumber", "timeZone", "imageId") SELECT "id", "createdAt", "updatedAt", "tenantId", "thirdPartyId", "firstName", "lastName", "email", "username", "hash", "imageUrl", "preferredLanguage", "preferredComponentLayout", "roleId", "refreshToken", "isActive", "code", "codeExpireAt", "emailVerifiedAt", "emailToken", "phoneNumber", "timeZone", "imageId" FROM "user"`);
        await queryRunner.query(`DROP TABLE "user"`);
        await queryRunner.query(`ALTER TABLE "temporary_user" RENAME TO "user"`);
        await queryRunner.query(`CREATE INDEX "IDX_5e028298e103e1694147ada69e" ON "user" ("imageId") `);
        await queryRunner.query(`CREATE INDEX "IDX_f2578043e491921209f5dadd08" ON "user" ("phoneNumber") `);
        await queryRunner.query(`CREATE INDEX "IDX_c28e52f758e7bbc53828db9219" ON "user" ("roleId") `);
        await queryRunner.query(`CREATE INDEX "IDX_78a916df40e02a9deb1c4b75ed" ON "user" ("username") `);
        await queryRunner.query(`CREATE INDEX "IDX_e12875dfb3b1d92d7d7c5377e2" ON "user" ("email") `);
        await queryRunner.query(`CREATE INDEX "IDX_f0e1b4ecdca13b177e2e3a0613" ON "user" ("lastName") `);
        await queryRunner.query(`CREATE INDEX "IDX_58e4dbff0e1a32a9bdc861bb29" ON "user" ("firstName") `);
        await queryRunner.query(`CREATE INDEX "IDX_19de43e9f1842360ce646253d7" ON "user" ("thirdPartyId") `);
        await queryRunner.query(`CREATE INDEX "IDX_685bf353c85f23b6f848e4dcde" ON "user" ("tenantId") `);
    }

    /**
    * SqliteDB Down Migration
    *
    * @param queryRunner
    */
    public async sqliteDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`DROP INDEX "IDX_685bf353c85f23b6f848e4dcde"`);
        await queryRunner.query(`DROP INDEX "IDX_19de43e9f1842360ce646253d7"`);
        await queryRunner.query(`DROP INDEX "IDX_58e4dbff0e1a32a9bdc861bb29"`);
        await queryRunner.query(`DROP INDEX "IDX_f0e1b4ecdca13b177e2e3a0613"`);
        await queryRunner.query(`DROP INDEX "IDX_e12875dfb3b1d92d7d7c5377e2"`);
        await queryRunner.query(`DROP INDEX "IDX_78a916df40e02a9deb1c4b75ed"`);
        await queryRunner.query(`DROP INDEX "IDX_c28e52f758e7bbc53828db9219"`);
        await queryRunner.query(`DROP INDEX "IDX_f2578043e491921209f5dadd08"`);
        await queryRunner.query(`DROP INDEX "IDX_5e028298e103e1694147ada69e"`);
        await queryRunner.query(`ALTER TABLE "user" RENAME TO "temporary_user"`);
        await queryRunner.query(`CREATE TABLE "user" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "thirdPartyId" varchar, "firstName" varchar, "lastName" varchar, "email" varchar, "username" varchar, "hash" varchar, "imageUrl" varchar(500), "preferredLanguage" varchar DEFAULT ('en'), "preferredComponentLayout" varchar CHECK( "preferredComponentLayout" IN ('CARDS_GRID','TABLE') ) DEFAULT ('TABLE'), "roleId" varchar, "refreshToken" varchar, "isActive" boolean DEFAULT (1), "code" varchar, "codeExpireAt" datetime, "emailVerifiedAt" datetime, "emailToken" varchar, "phoneNumber" varchar, "timeZone" varchar, "imageId" varchar, CONSTRAINT "FK_5e028298e103e1694147ada69e5" FOREIGN KEY ("imageId") REFERENCES "image_asset" ("id") ON DELETE SET NULL ON UPDATE NO ACTION, CONSTRAINT "FK_685bf353c85f23b6f848e4dcded" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`);
        await queryRunner.query(`INSERT INTO "user"("id", "createdAt", "updatedAt", "tenantId", "thirdPartyId", "firstName", "lastName", "email", "username", "hash", "imageUrl", "preferredLanguage", "preferredComponentLayout", "roleId", "refreshToken", "isActive", "code", "codeExpireAt", "emailVerifiedAt", "emailToken", "phoneNumber", "timeZone", "imageId") SELECT "id", "createdAt", "updatedAt", "tenantId", "thirdPartyId", "firstName", "lastName", "email", "username", "hash", "imageUrl", "preferredLanguage", "preferredComponentLayout", "roleId", "refreshToken", "isActive", "code", "codeExpireAt", "emailVerifiedAt", "emailToken", "phoneNumber", "timeZone", "imageId" FROM "temporary_user"`);
        await queryRunner.query(`DROP TABLE "temporary_user"`);
        await queryRunner.query(`CREATE INDEX "IDX_685bf353c85f23b6f848e4dcde" ON "user" ("tenantId") `);
        await queryRunner.query(`CREATE INDEX "IDX_19de43e9f1842360ce646253d7" ON "user" ("thirdPartyId") `);
        await queryRunner.query(`CREATE INDEX "IDX_58e4dbff0e1a32a9bdc861bb29" ON "user" ("firstName") `);
        await queryRunner.query(`CREATE INDEX "IDX_f0e1b4ecdca13b177e2e3a0613" ON "user" ("lastName") `);
        await queryRunner.query(`CREATE INDEX "IDX_e12875dfb3b1d92d7d7c5377e2" ON "user" ("email") `);
        await queryRunner.query(`CREATE INDEX "IDX_78a916df40e02a9deb1c4b75ed" ON "user" ("username") `);
        await queryRunner.query(`CREATE INDEX "IDX_c28e52f758e7bbc53828db9219" ON "user" ("roleId") `);
        await queryRunner.query(`CREATE INDEX "IDX_f2578043e491921209f5dadd08" ON "user" ("phoneNumber") `);
        await queryRunner.query(`CREATE INDEX "IDX_5e028298e103e1694147ada69e" ON "user" ("imageId") `);
        await queryRunner.query(`DROP INDEX "IDX_9033faf41b23c61ba201c48796"`);
        await queryRunner.query(`DROP INDEX "IDX_685bf353c85f23b6f848e4dcde"`);
        await queryRunner.query(`DROP INDEX "IDX_19de43e9f1842360ce646253d7"`);
        await queryRunner.query(`DROP INDEX "IDX_58e4dbff0e1a32a9bdc861bb29"`);
        await queryRunner.query(`DROP INDEX "IDX_f0e1b4ecdca13b177e2e3a0613"`);
        await queryRunner.query(`DROP INDEX "IDX_e12875dfb3b1d92d7d7c5377e2"`);
        await queryRunner.query(`DROP INDEX "IDX_78a916df40e02a9deb1c4b75ed"`);
        await queryRunner.query(`DROP INDEX "IDX_c28e52f758e7bbc53828db9219"`);
        await queryRunner.query(`DROP INDEX "IDX_f2578043e491921209f5dadd08"`);
        await queryRunner.query(`DROP INDEX "IDX_5e028298e103e1694147ada69e"`);
        await queryRunner.query(`ALTER TABLE "user" RENAME TO "temporary_user"`);
        await queryRunner.query(`CREATE TABLE "user" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "thirdPartyId" varchar, "firstName" varchar, "lastName" varchar, "email" varchar, "username" varchar, "hash" varchar, "imageUrl" varchar(500), "preferredLanguage" varchar DEFAULT ('en'), "preferredComponentLayout" varchar CHECK( "preferredComponentLayout" IN ('CARDS_GRID','TABLE') ) DEFAULT ('TABLE'), "roleId" varchar, "refreshToken" varchar, "isActive" boolean DEFAULT (1), "code" integer, "codeExpireAt" datetime, "emailVerifiedAt" datetime, "emailToken" varchar, "phoneNumber" varchar, "timeZone" varchar, "imageId" varchar, CONSTRAINT "FK_5e028298e103e1694147ada69e5" FOREIGN KEY ("imageId") REFERENCES "image_asset" ("id") ON DELETE SET NULL ON UPDATE NO ACTION, CONSTRAINT "FK_685bf353c85f23b6f848e4dcded" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`);
        await queryRunner.query(`INSERT INTO "user"("id", "createdAt", "updatedAt", "tenantId", "thirdPartyId", "firstName", "lastName", "email", "username", "hash", "imageUrl", "preferredLanguage", "preferredComponentLayout", "roleId", "refreshToken", "isActive", "code", "codeExpireAt", "emailVerifiedAt", "emailToken", "phoneNumber", "timeZone", "imageId") SELECT "id", "createdAt", "updatedAt", "tenantId", "thirdPartyId", "firstName", "lastName", "email", "username", "hash", "imageUrl", "preferredLanguage", "preferredComponentLayout", "roleId", "refreshToken", "isActive", "code", "codeExpireAt", "emailVerifiedAt", "emailToken", "phoneNumber", "timeZone", "imageId" FROM "temporary_user"`);
        await queryRunner.query(`DROP TABLE "temporary_user"`);
        await queryRunner.query(`CREATE INDEX "IDX_685bf353c85f23b6f848e4dcde" ON "user" ("tenantId") `);
        await queryRunner.query(`CREATE INDEX "IDX_19de43e9f1842360ce646253d7" ON "user" ("thirdPartyId") `);
        await queryRunner.query(`CREATE INDEX "IDX_58e4dbff0e1a32a9bdc861bb29" ON "user" ("firstName") `);
        await queryRunner.query(`CREATE INDEX "IDX_f0e1b4ecdca13b177e2e3a0613" ON "user" ("lastName") `);
        await queryRunner.query(`CREATE INDEX "IDX_e12875dfb3b1d92d7d7c5377e2" ON "user" ("email") `);
        await queryRunner.query(`CREATE INDEX "IDX_78a916df40e02a9deb1c4b75ed" ON "user" ("username") `);
        await queryRunner.query(`CREATE INDEX "IDX_c28e52f758e7bbc53828db9219" ON "user" ("roleId") `);
        await queryRunner.query(`CREATE INDEX "IDX_f2578043e491921209f5dadd08" ON "user" ("phoneNumber") `);
        await queryRunner.query(`CREATE INDEX "IDX_5e028298e103e1694147ada69e" ON "user" ("imageId") `);
        await queryRunner.query(`DROP INDEX "IDX_171b852be7c1f387eca93775aa"`);
        await queryRunner.query(`DROP INDEX "IDX_5e73656ce0355347477c42ae19"`);
        await queryRunner.query(`DROP INDEX "IDX_c15823bf3f63b1fe331d9de662"`);
        await queryRunner.query(`DROP INDEX "IDX_d9529008c733cb90044b8c2ad6"`);
        await queryRunner.query(`ALTER TABLE "organization_team_join_request" RENAME TO "temporary_organization_team_join_request"`);
        await queryRunner.query(`CREATE TABLE "organization_team_join_request" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "organizationId" varchar, "email" varchar NOT NULL, "fullName" varchar, "linkAddress" varchar, "position" varchar, "status" varchar, "code" integer, "token" varchar, "expiredAt" datetime, "userId" varchar, "organizationTeamId" varchar, CONSTRAINT "FK_d9529008c733cb90044b8c2ad6b" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_c15823bf3f63b1fe331d9de6625" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_5e73656ce0355347477c42ae19b" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_171b852be7c1f387eca93775aad" FOREIGN KEY ("organizationTeamId") REFERENCES "organization_team" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`);
        await queryRunner.query(`INSERT INTO "organization_team_join_request"("id", "createdAt", "updatedAt", "tenantId", "organizationId", "email", "fullName", "linkAddress", "position", "status", "code", "token", "expiredAt", "userId", "organizationTeamId") SELECT "id", "createdAt", "updatedAt", "tenantId", "organizationId", "email", "fullName", "linkAddress", "position", "status", "code", "token", "expiredAt", "userId", "organizationTeamId" FROM "temporary_organization_team_join_request"`);
        await queryRunner.query(`DROP TABLE "temporary_organization_team_join_request"`);
        await queryRunner.query(`CREATE INDEX "IDX_171b852be7c1f387eca93775aa" ON "organization_team_join_request" ("organizationTeamId") `);
        await queryRunner.query(`CREATE INDEX "IDX_5e73656ce0355347477c42ae19" ON "organization_team_join_request" ("userId") `);
        await queryRunner.query(`CREATE INDEX "IDX_c15823bf3f63b1fe331d9de662" ON "organization_team_join_request" ("organizationId") `);
        await queryRunner.query(`CREATE INDEX "IDX_d9529008c733cb90044b8c2ad6" ON "organization_team_join_request" ("tenantId") `);
        await queryRunner.query(`DROP INDEX "IDX_7c2328f76efb850b8114797247"`);
        await queryRunner.query(`DROP INDEX "IDX_68eef4ab86b67747f24f288a16"`);
        await queryRunner.query(`DROP INDEX "IDX_5a182e8b3e225b14ddf6df7e6c"`);
        await queryRunner.query(`DROP INDEX "IDX_900a3ed40499c79c1c289fec28"`);
        await queryRunner.query(`DROP INDEX "IDX_91bfeec7a9574f458e5b592472"`);
        await queryRunner.query(`ALTER TABLE "invite" RENAME TO "temporary_invite"`);
        await queryRunner.query(`CREATE TABLE "invite" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "organizationId" varchar, "token" varchar NOT NULL, "email" varchar NOT NULL, "status" varchar NOT NULL, "expireDate" datetime, "actionDate" datetime, "invitedById" varchar, "roleId" varchar, "code" integer, "fullName" varchar, "userId" varchar, CONSTRAINT "FK_91bfeec7a9574f458e5b592472d" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE SET NULL ON UPDATE NO ACTION, CONSTRAINT "FK_900a3ed40499c79c1c289fec284" FOREIGN KEY ("roleId") REFERENCES "role" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_5a182e8b3e225b14ddf6df7e6c3" FOREIGN KEY ("invitedById") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_68eef4ab86b67747f24f288a16c" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_7c2328f76efb850b81147972476" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`);
        await queryRunner.query(`INSERT INTO "invite"("id", "createdAt", "updatedAt", "tenantId", "organizationId", "token", "email", "status", "expireDate", "actionDate", "invitedById", "roleId", "code", "fullName", "userId") SELECT "id", "createdAt", "updatedAt", "tenantId", "organizationId", "token", "email", "status", "expireDate", "actionDate", "invitedById", "roleId", "code", "fullName", "userId" FROM "temporary_invite"`);
        await queryRunner.query(`DROP TABLE "temporary_invite"`);
        await queryRunner.query(`CREATE INDEX "IDX_7c2328f76efb850b8114797247" ON "invite" ("tenantId") `);
        await queryRunner.query(`CREATE INDEX "IDX_68eef4ab86b67747f24f288a16" ON "invite" ("organizationId") `);
        await queryRunner.query(`CREATE INDEX "IDX_5a182e8b3e225b14ddf6df7e6c" ON "invite" ("invitedById") `);
        await queryRunner.query(`CREATE INDEX "IDX_900a3ed40499c79c1c289fec28" ON "invite" ("roleId") `);
        await queryRunner.query(`CREATE INDEX "IDX_91bfeec7a9574f458e5b592472" ON "invite" ("userId") `);
        await queryRunner.query(`DROP INDEX "IDX_e37af4ab2ba0bf268bfd982634"`);
        await queryRunner.query(`DROP INDEX "IDX_9e80c9ec749dfda6dbe2cd9704"`);
        await queryRunner.query(`DROP INDEX "IDX_4be518a169bbcbfe92025ac574"`);
        await queryRunner.query(`DROP INDEX "IDX_03d16a2fd43d7c601743440212"`);
        await queryRunner.query(`DROP INDEX "IDX_93799dfaeff51de06f1e02ac41"`);
        await queryRunner.query(`DROP INDEX "IDX_4ac734f2a1a3c055dca04fba99"`);
        await queryRunner.query(`ALTER TABLE "email_reset" RENAME TO "temporary_email_reset"`);
        await queryRunner.query(`CREATE TABLE "email_reset" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "email" varchar NOT NULL, "oldEmail" varchar NOT NULL, "code" integer NOT NULL, "userId" varchar, "token" varchar, "expiredAt" datetime, CONSTRAINT "FK_e37af4ab2ba0bf268bfd9826345" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_93799dfaeff51de06f1e02ac414" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`);
        await queryRunner.query(`INSERT INTO "email_reset"("id", "createdAt", "updatedAt", "tenantId", "email", "oldEmail", "code", "userId", "token", "expiredAt") SELECT "id", "createdAt", "updatedAt", "tenantId", "email", "oldEmail", "code", "userId", "token", "expiredAt" FROM "temporary_email_reset"`);
        await queryRunner.query(`DROP TABLE "temporary_email_reset"`);
        await queryRunner.query(`CREATE INDEX "IDX_e37af4ab2ba0bf268bfd982634" ON "email_reset" ("userId") `);
        await queryRunner.query(`CREATE INDEX "IDX_9e80c9ec749dfda6dbe2cd9704" ON "email_reset" ("code") `);
        await queryRunner.query(`CREATE INDEX "IDX_4be518a169bbcbfe92025ac574" ON "email_reset" ("oldEmail") `);
        await queryRunner.query(`CREATE INDEX "IDX_03d16a2fd43d7c601743440212" ON "email_reset" ("email") `);
        await queryRunner.query(`CREATE INDEX "IDX_93799dfaeff51de06f1e02ac41" ON "email_reset" ("tenantId") `);
        await queryRunner.query(`CREATE INDEX "IDX_4ac734f2a1a3c055dca04fba99" ON "email_reset" ("token") `);
        await queryRunner.query(`DROP INDEX "IDX_685bf353c85f23b6f848e4dcde"`);
        await queryRunner.query(`DROP INDEX "IDX_19de43e9f1842360ce646253d7"`);
        await queryRunner.query(`DROP INDEX "IDX_58e4dbff0e1a32a9bdc861bb29"`);
        await queryRunner.query(`DROP INDEX "IDX_f0e1b4ecdca13b177e2e3a0613"`);
        await queryRunner.query(`DROP INDEX "IDX_e12875dfb3b1d92d7d7c5377e2"`);
        await queryRunner.query(`DROP INDEX "IDX_78a916df40e02a9deb1c4b75ed"`);
        await queryRunner.query(`DROP INDEX "IDX_c28e52f758e7bbc53828db9219"`);
        await queryRunner.query(`DROP INDEX "IDX_f2578043e491921209f5dadd08"`);
        await queryRunner.query(`DROP INDEX "IDX_5e028298e103e1694147ada69e"`);
        await queryRunner.query(`ALTER TABLE "user" RENAME TO "temporary_user"`);
        await queryRunner.query(`CREATE TABLE "user" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "thirdPartyId" varchar, "firstName" varchar, "lastName" varchar, "email" varchar, "username" varchar, "hash" varchar, "imageUrl" varchar(500), "preferredLanguage" varchar DEFAULT ('en'), "preferredComponentLayout" varchar CHECK( "preferredComponentLayout" IN ('CARDS_GRID','TABLE') ) DEFAULT ('TABLE'), "roleId" varchar, "refreshToken" varchar, "isActive" boolean DEFAULT (1), "code" integer, "codeExpireAt" datetime, "emailVerifiedAt" datetime, "emailToken" varchar, "phoneNumber" varchar, "timeZone" varchar, "imageId" varchar, CONSTRAINT "FK_5e028298e103e1694147ada69e5" FOREIGN KEY ("imageId") REFERENCES "image_asset" ("id") ON DELETE SET NULL ON UPDATE NO ACTION, CONSTRAINT "FK_685bf353c85f23b6f848e4dcded" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`);
        await queryRunner.query(`INSERT INTO "user"("id", "createdAt", "updatedAt", "tenantId", "thirdPartyId", "firstName", "lastName", "email", "username", "hash", "imageUrl", "preferredLanguage", "preferredComponentLayout", "roleId", "refreshToken", "isActive", "code", "codeExpireAt", "emailVerifiedAt", "emailToken", "phoneNumber", "timeZone", "imageId") SELECT "id", "createdAt", "updatedAt", "tenantId", "thirdPartyId", "firstName", "lastName", "email", "username", "hash", "imageUrl", "preferredLanguage", "preferredComponentLayout", "roleId", "refreshToken", "isActive", "code", "codeExpireAt", "emailVerifiedAt", "emailToken", "phoneNumber", "timeZone", "imageId" FROM "temporary_user"`);
        await queryRunner.query(`DROP TABLE "temporary_user"`);
        await queryRunner.query(`CREATE INDEX "IDX_685bf353c85f23b6f848e4dcde" ON "user" ("tenantId") `);
        await queryRunner.query(`CREATE INDEX "IDX_19de43e9f1842360ce646253d7" ON "user" ("thirdPartyId") `);
        await queryRunner.query(`CREATE INDEX "IDX_58e4dbff0e1a32a9bdc861bb29" ON "user" ("firstName") `);
        await queryRunner.query(`CREATE INDEX "IDX_f0e1b4ecdca13b177e2e3a0613" ON "user" ("lastName") `);
        await queryRunner.query(`CREATE INDEX "IDX_e12875dfb3b1d92d7d7c5377e2" ON "user" ("email") `);
        await queryRunner.query(`CREATE INDEX "IDX_78a916df40e02a9deb1c4b75ed" ON "user" ("username") `);
        await queryRunner.query(`CREATE INDEX "IDX_c28e52f758e7bbc53828db9219" ON "user" ("roleId") `);
        await queryRunner.query(`CREATE INDEX "IDX_f2578043e491921209f5dadd08" ON "user" ("phoneNumber") `);
        await queryRunner.query(`CREATE INDEX "IDX_5e028298e103e1694147ada69e" ON "user" ("imageId") `);
        await queryRunner.query(`DROP INDEX "IDX_171b852be7c1f387eca93775aa"`);
        await queryRunner.query(`DROP INDEX "IDX_5e73656ce0355347477c42ae19"`);
        await queryRunner.query(`DROP INDEX "IDX_c15823bf3f63b1fe331d9de662"`);
        await queryRunner.query(`DROP INDEX "IDX_d9529008c733cb90044b8c2ad6"`);
        await queryRunner.query(`ALTER TABLE "organization_team_join_request" RENAME TO "temporary_organization_team_join_request"`);
        await queryRunner.query(`CREATE TABLE "organization_team_join_request" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "organizationId" varchar, "email" varchar NOT NULL, "fullName" varchar, "linkAddress" varchar, "position" varchar, "status" varchar, "code" integer, "token" varchar, "expiredAt" datetime, "userId" varchar, "organizationTeamId" varchar, CONSTRAINT "FK_d9529008c733cb90044b8c2ad6b" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_c15823bf3f63b1fe331d9de6625" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_5e73656ce0355347477c42ae19b" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_171b852be7c1f387eca93775aad" FOREIGN KEY ("organizationTeamId") REFERENCES "organization_team" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`);
        await queryRunner.query(`INSERT INTO "organization_team_join_request"("id", "createdAt", "updatedAt", "tenantId", "organizationId", "email", "fullName", "linkAddress", "position", "status", "code", "token", "expiredAt", "userId", "organizationTeamId") SELECT "id", "createdAt", "updatedAt", "tenantId", "organizationId", "email", "fullName", "linkAddress", "position", "status", "code", "token", "expiredAt", "userId", "organizationTeamId" FROM "temporary_organization_team_join_request"`);
        await queryRunner.query(`DROP TABLE "temporary_organization_team_join_request"`);
        await queryRunner.query(`CREATE INDEX "IDX_171b852be7c1f387eca93775aa" ON "organization_team_join_request" ("organizationTeamId") `);
        await queryRunner.query(`CREATE INDEX "IDX_5e73656ce0355347477c42ae19" ON "organization_team_join_request" ("userId") `);
        await queryRunner.query(`CREATE INDEX "IDX_c15823bf3f63b1fe331d9de662" ON "organization_team_join_request" ("organizationId") `);
        await queryRunner.query(`CREATE INDEX "IDX_d9529008c733cb90044b8c2ad6" ON "organization_team_join_request" ("tenantId") `);
        await queryRunner.query(`DROP INDEX "IDX_7c2328f76efb850b8114797247"`);
        await queryRunner.query(`DROP INDEX "IDX_68eef4ab86b67747f24f288a16"`);
        await queryRunner.query(`DROP INDEX "IDX_5a182e8b3e225b14ddf6df7e6c"`);
        await queryRunner.query(`DROP INDEX "IDX_900a3ed40499c79c1c289fec28"`);
        await queryRunner.query(`DROP INDEX "IDX_91bfeec7a9574f458e5b592472"`);
        await queryRunner.query(`ALTER TABLE "invite" RENAME TO "temporary_invite"`);
        await queryRunner.query(`CREATE TABLE "invite" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "organizationId" varchar, "token" varchar NOT NULL, "email" varchar NOT NULL, "status" varchar NOT NULL, "expireDate" datetime, "actionDate" datetime, "invitedById" varchar, "roleId" varchar, "code" integer, "fullName" varchar, "userId" varchar, CONSTRAINT "FK_91bfeec7a9574f458e5b592472d" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE SET NULL ON UPDATE NO ACTION, CONSTRAINT "FK_900a3ed40499c79c1c289fec284" FOREIGN KEY ("roleId") REFERENCES "role" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_5a182e8b3e225b14ddf6df7e6c3" FOREIGN KEY ("invitedById") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_68eef4ab86b67747f24f288a16c" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_7c2328f76efb850b81147972476" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`);
        await queryRunner.query(`INSERT INTO "invite"("id", "createdAt", "updatedAt", "tenantId", "organizationId", "token", "email", "status", "expireDate", "actionDate", "invitedById", "roleId", "code", "fullName", "userId") SELECT "id", "createdAt", "updatedAt", "tenantId", "organizationId", "token", "email", "status", "expireDate", "actionDate", "invitedById", "roleId", "code", "fullName", "userId" FROM "temporary_invite"`);
        await queryRunner.query(`DROP TABLE "temporary_invite"`);
        await queryRunner.query(`CREATE INDEX "IDX_7c2328f76efb850b8114797247" ON "invite" ("tenantId") `);
        await queryRunner.query(`CREATE INDEX "IDX_68eef4ab86b67747f24f288a16" ON "invite" ("organizationId") `);
        await queryRunner.query(`CREATE INDEX "IDX_5a182e8b3e225b14ddf6df7e6c" ON "invite" ("invitedById") `);
        await queryRunner.query(`CREATE INDEX "IDX_900a3ed40499c79c1c289fec28" ON "invite" ("roleId") `);
        await queryRunner.query(`CREATE INDEX "IDX_91bfeec7a9574f458e5b592472" ON "invite" ("userId") `);
        await queryRunner.query(`DROP INDEX "IDX_e37af4ab2ba0bf268bfd982634"`);
        await queryRunner.query(`DROP INDEX "IDX_9e80c9ec749dfda6dbe2cd9704"`);
        await queryRunner.query(`DROP INDEX "IDX_4be518a169bbcbfe92025ac574"`);
        await queryRunner.query(`DROP INDEX "IDX_03d16a2fd43d7c601743440212"`);
        await queryRunner.query(`DROP INDEX "IDX_93799dfaeff51de06f1e02ac41"`);
        await queryRunner.query(`DROP INDEX "IDX_4ac734f2a1a3c055dca04fba99"`);
        await queryRunner.query(`ALTER TABLE "email_reset" RENAME TO "temporary_email_reset"`);
        await queryRunner.query(`CREATE TABLE "email_reset" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "email" varchar NOT NULL, "oldEmail" varchar NOT NULL, "code" integer NOT NULL, "userId" varchar, "token" varchar, "expiredAt" datetime, CONSTRAINT "FK_e37af4ab2ba0bf268bfd9826345" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_93799dfaeff51de06f1e02ac414" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`);
        await queryRunner.query(`INSERT INTO "email_reset"("id", "createdAt", "updatedAt", "tenantId", "email", "oldEmail", "code", "userId", "token", "expiredAt") SELECT "id", "createdAt", "updatedAt", "tenantId", "email", "oldEmail", "code", "userId", "token", "expiredAt" FROM "temporary_email_reset"`);
        await queryRunner.query(`DROP TABLE "temporary_email_reset"`);
        await queryRunner.query(`CREATE INDEX "IDX_e37af4ab2ba0bf268bfd982634" ON "email_reset" ("userId") `);
        await queryRunner.query(`CREATE INDEX "IDX_9e80c9ec749dfda6dbe2cd9704" ON "email_reset" ("code") `);
        await queryRunner.query(`CREATE INDEX "IDX_4be518a169bbcbfe92025ac574" ON "email_reset" ("oldEmail") `);
        await queryRunner.query(`CREATE INDEX "IDX_03d16a2fd43d7c601743440212" ON "email_reset" ("email") `);
        await queryRunner.query(`CREATE INDEX "IDX_93799dfaeff51de06f1e02ac41" ON "email_reset" ("tenantId") `);
        await queryRunner.query(`CREATE INDEX "IDX_4ac734f2a1a3c055dca04fba99" ON "email_reset" ("token") `);
        await queryRunner.query(`DROP INDEX "IDX_685bf353c85f23b6f848e4dcde"`);
        await queryRunner.query(`DROP INDEX "IDX_19de43e9f1842360ce646253d7"`);
        await queryRunner.query(`DROP INDEX "IDX_58e4dbff0e1a32a9bdc861bb29"`);
        await queryRunner.query(`DROP INDEX "IDX_f0e1b4ecdca13b177e2e3a0613"`);
        await queryRunner.query(`DROP INDEX "IDX_e12875dfb3b1d92d7d7c5377e2"`);
        await queryRunner.query(`DROP INDEX "IDX_78a916df40e02a9deb1c4b75ed"`);
        await queryRunner.query(`DROP INDEX "IDX_c28e52f758e7bbc53828db9219"`);
        await queryRunner.query(`DROP INDEX "IDX_f2578043e491921209f5dadd08"`);
        await queryRunner.query(`DROP INDEX "IDX_5e028298e103e1694147ada69e"`);
        await queryRunner.query(`ALTER TABLE "user" RENAME TO "temporary_user"`);
        await queryRunner.query(`CREATE TABLE "user" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "thirdPartyId" varchar, "firstName" varchar, "lastName" varchar, "email" varchar, "username" varchar, "hash" varchar, "imageUrl" varchar(500), "preferredLanguage" varchar DEFAULT ('en'), "preferredComponentLayout" varchar CHECK( "preferredComponentLayout" IN ('CARDS_GRID','TABLE') ) DEFAULT ('TABLE'), "roleId" varchar, "refreshToken" varchar, "isActive" boolean DEFAULT (1), "code" integer, "codeExpireAt" datetime, "emailVerifiedAt" datetime, "emailToken" varchar, "phoneNumber" varchar, "timeZone" varchar, "imageId" varchar, CONSTRAINT "FK_5e028298e103e1694147ada69e5" FOREIGN KEY ("imageId") REFERENCES "image_asset" ("id") ON DELETE SET NULL ON UPDATE NO ACTION, CONSTRAINT "FK_c28e52f758e7bbc53828db92194" FOREIGN KEY ("roleId") REFERENCES "role" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_685bf353c85f23b6f848e4dcded" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`);
        await queryRunner.query(`INSERT INTO "user"("id", "createdAt", "updatedAt", "tenantId", "thirdPartyId", "firstName", "lastName", "email", "username", "hash", "imageUrl", "preferredLanguage", "preferredComponentLayout", "roleId", "refreshToken", "isActive", "code", "codeExpireAt", "emailVerifiedAt", "emailToken", "phoneNumber", "timeZone", "imageId") SELECT "id", "createdAt", "updatedAt", "tenantId", "thirdPartyId", "firstName", "lastName", "email", "username", "hash", "imageUrl", "preferredLanguage", "preferredComponentLayout", "roleId", "refreshToken", "isActive", "code", "codeExpireAt", "emailVerifiedAt", "emailToken", "phoneNumber", "timeZone", "imageId" FROM "temporary_user"`);
        await queryRunner.query(`DROP TABLE "temporary_user"`);
        await queryRunner.query(`CREATE INDEX "IDX_685bf353c85f23b6f848e4dcde" ON "user" ("tenantId") `);
        await queryRunner.query(`CREATE INDEX "IDX_19de43e9f1842360ce646253d7" ON "user" ("thirdPartyId") `);
        await queryRunner.query(`CREATE INDEX "IDX_58e4dbff0e1a32a9bdc861bb29" ON "user" ("firstName") `);
        await queryRunner.query(`CREATE INDEX "IDX_f0e1b4ecdca13b177e2e3a0613" ON "user" ("lastName") `);
        await queryRunner.query(`CREATE INDEX "IDX_e12875dfb3b1d92d7d7c5377e2" ON "user" ("email") `);
        await queryRunner.query(`CREATE INDEX "IDX_78a916df40e02a9deb1c4b75ed" ON "user" ("username") `);
        await queryRunner.query(`CREATE INDEX "IDX_c28e52f758e7bbc53828db9219" ON "user" ("roleId") `);
        await queryRunner.query(`CREATE INDEX "IDX_f2578043e491921209f5dadd08" ON "user" ("phoneNumber") `);
        await queryRunner.query(`CREATE INDEX "IDX_5e028298e103e1694147ada69e" ON "user" ("imageId") `);
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
