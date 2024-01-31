import { MigrationInterface, QueryRunner } from "typeorm";
import * as chalk from "chalk";
import { DatabaseTypeEnum } from "@gauzy/config";

export class AlterUserInviteTable1669453028914 implements MigrationInterface {

    name = 'AlterUserInviteTable1669453028914';

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
        await queryRunner.query(`ALTER TABLE "invite" ADD "userId" uuid`);
        await queryRunner.query(`CREATE INDEX "IDX_91bfeec7a9574f458e5b592472" ON "invite" ("userId") `);
        await queryRunner.query(`ALTER TABLE "invite" ADD CONSTRAINT "FK_91bfeec7a9574f458e5b592472d" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
    }

    /**
    * PostgresDB Down Migration
    *
    * @param queryRunner
    */
    public async postgresDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`ALTER TABLE "invite" DROP CONSTRAINT "FK_91bfeec7a9574f458e5b592472d"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_91bfeec7a9574f458e5b592472"`);
        await queryRunner.query(`ALTER TABLE "invite" DROP COLUMN "userId"`);
    }

    /**
    * SqliteDB Up Migration
    *
    * @param queryRunner
    */
    public async sqliteUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`DROP INDEX "IDX_7c2328f76efb850b8114797247"`);
        await queryRunner.query(`DROP INDEX "IDX_68eef4ab86b67747f24f288a16"`);
        await queryRunner.query(`DROP INDEX "IDX_5a182e8b3e225b14ddf6df7e6c"`);
        await queryRunner.query(`DROP INDEX "IDX_900a3ed40499c79c1c289fec28"`);
        await queryRunner.query(`CREATE TABLE "temporary_invite" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "organizationId" varchar, "token" varchar NOT NULL, "email" varchar NOT NULL, "status" varchar NOT NULL, "expireDate" datetime, "actionDate" datetime, "invitedById" varchar, "roleId" varchar, "code" integer, "fullName" varchar, "userId" varchar, CONSTRAINT "FK_7c2328f76efb850b81147972476" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_68eef4ab86b67747f24f288a16c" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_5a182e8b3e225b14ddf6df7e6c3" FOREIGN KEY ("invitedById") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_900a3ed40499c79c1c289fec284" FOREIGN KEY ("roleId") REFERENCES "role" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`);
        await queryRunner.query(`INSERT INTO "temporary_invite"("id", "createdAt", "updatedAt", "tenantId", "organizationId", "token", "email", "status", "expireDate", "actionDate", "invitedById", "roleId", "code", "fullName") SELECT "id", "createdAt", "updatedAt", "tenantId", "organizationId", "token", "email", "status", "expireDate", "actionDate", "invitedById", "roleId", "code", "fullName" FROM "invite"`);
        await queryRunner.query(`DROP TABLE "invite"`);
        await queryRunner.query(`ALTER TABLE "temporary_invite" RENAME TO "invite"`);
        await queryRunner.query(`CREATE INDEX "IDX_7c2328f76efb850b8114797247" ON "invite" ("tenantId") `);
        await queryRunner.query(`CREATE INDEX "IDX_68eef4ab86b67747f24f288a16" ON "invite" ("organizationId") `);
        await queryRunner.query(`CREATE INDEX "IDX_5a182e8b3e225b14ddf6df7e6c" ON "invite" ("invitedById") `);
        await queryRunner.query(`CREATE INDEX "IDX_900a3ed40499c79c1c289fec28" ON "invite" ("roleId") `);
        await queryRunner.query(`CREATE INDEX "IDX_91bfeec7a9574f458e5b592472" ON "invite" ("userId") `);
        await queryRunner.query(`DROP INDEX "IDX_7c2328f76efb850b8114797247"`);
        await queryRunner.query(`DROP INDEX "IDX_68eef4ab86b67747f24f288a16"`);
        await queryRunner.query(`DROP INDEX "IDX_5a182e8b3e225b14ddf6df7e6c"`);
        await queryRunner.query(`DROP INDEX "IDX_900a3ed40499c79c1c289fec28"`);
        await queryRunner.query(`DROP INDEX "IDX_91bfeec7a9574f458e5b592472"`);
        await queryRunner.query(`CREATE TABLE "temporary_invite" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "organizationId" varchar, "token" varchar NOT NULL, "email" varchar NOT NULL, "status" varchar NOT NULL, "expireDate" datetime, "actionDate" datetime, "invitedById" varchar, "roleId" varchar, "code" integer, "fullName" varchar, "userId" varchar, CONSTRAINT "FK_7c2328f76efb850b81147972476" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_68eef4ab86b67747f24f288a16c" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_5a182e8b3e225b14ddf6df7e6c3" FOREIGN KEY ("invitedById") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_900a3ed40499c79c1c289fec284" FOREIGN KEY ("roleId") REFERENCES "role" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_91bfeec7a9574f458e5b592472d" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE SET NULL ON UPDATE NO ACTION)`);
        await queryRunner.query(`INSERT INTO "temporary_invite"("id", "createdAt", "updatedAt", "tenantId", "organizationId", "token", "email", "status", "expireDate", "actionDate", "invitedById", "roleId", "code", "fullName", "userId") SELECT "id", "createdAt", "updatedAt", "tenantId", "organizationId", "token", "email", "status", "expireDate", "actionDate", "invitedById", "roleId", "code", "fullName", "userId" FROM "invite"`);
        await queryRunner.query(`DROP TABLE "invite"`);
        await queryRunner.query(`ALTER TABLE "temporary_invite" RENAME TO "invite"`);
        await queryRunner.query(`CREATE INDEX "IDX_7c2328f76efb850b8114797247" ON "invite" ("tenantId") `);
        await queryRunner.query(`CREATE INDEX "IDX_68eef4ab86b67747f24f288a16" ON "invite" ("organizationId") `);
        await queryRunner.query(`CREATE INDEX "IDX_5a182e8b3e225b14ddf6df7e6c" ON "invite" ("invitedById") `);
        await queryRunner.query(`CREATE INDEX "IDX_900a3ed40499c79c1c289fec28" ON "invite" ("roleId") `);
        await queryRunner.query(`CREATE INDEX "IDX_91bfeec7a9574f458e5b592472" ON "invite" ("userId") `);
    }

    /**
    * SqliteDB Down Migration
    *
    * @param queryRunner
    */
    public async sqliteDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`DROP INDEX "IDX_91bfeec7a9574f458e5b592472"`);
        await queryRunner.query(`DROP INDEX "IDX_900a3ed40499c79c1c289fec28"`);
        await queryRunner.query(`DROP INDEX "IDX_5a182e8b3e225b14ddf6df7e6c"`);
        await queryRunner.query(`DROP INDEX "IDX_68eef4ab86b67747f24f288a16"`);
        await queryRunner.query(`DROP INDEX "IDX_7c2328f76efb850b8114797247"`);
        await queryRunner.query(`ALTER TABLE "invite" RENAME TO "temporary_invite"`);
        await queryRunner.query(`CREATE TABLE "invite" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "organizationId" varchar, "token" varchar NOT NULL, "email" varchar NOT NULL, "status" varchar NOT NULL, "expireDate" datetime, "actionDate" datetime, "invitedById" varchar, "roleId" varchar, "code" integer, "fullName" varchar, "userId" varchar, CONSTRAINT "FK_7c2328f76efb850b81147972476" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_68eef4ab86b67747f24f288a16c" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_5a182e8b3e225b14ddf6df7e6c3" FOREIGN KEY ("invitedById") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_900a3ed40499c79c1c289fec284" FOREIGN KEY ("roleId") REFERENCES "role" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`);
        await queryRunner.query(`INSERT INTO "invite"("id", "createdAt", "updatedAt", "tenantId", "organizationId", "token", "email", "status", "expireDate", "actionDate", "invitedById", "roleId", "code", "fullName", "userId") SELECT "id", "createdAt", "updatedAt", "tenantId", "organizationId", "token", "email", "status", "expireDate", "actionDate", "invitedById", "roleId", "code", "fullName", "userId" FROM "temporary_invite"`);
        await queryRunner.query(`DROP TABLE "temporary_invite"`);
        await queryRunner.query(`CREATE INDEX "IDX_91bfeec7a9574f458e5b592472" ON "invite" ("userId") `);
        await queryRunner.query(`CREATE INDEX "IDX_900a3ed40499c79c1c289fec28" ON "invite" ("roleId") `);
        await queryRunner.query(`CREATE INDEX "IDX_5a182e8b3e225b14ddf6df7e6c" ON "invite" ("invitedById") `);
        await queryRunner.query(`CREATE INDEX "IDX_68eef4ab86b67747f24f288a16" ON "invite" ("organizationId") `);
        await queryRunner.query(`CREATE INDEX "IDX_7c2328f76efb850b8114797247" ON "invite" ("tenantId") `);
        await queryRunner.query(`DROP INDEX "IDX_91bfeec7a9574f458e5b592472"`);
        await queryRunner.query(`DROP INDEX "IDX_900a3ed40499c79c1c289fec28"`);
        await queryRunner.query(`DROP INDEX "IDX_5a182e8b3e225b14ddf6df7e6c"`);
        await queryRunner.query(`DROP INDEX "IDX_68eef4ab86b67747f24f288a16"`);
        await queryRunner.query(`DROP INDEX "IDX_7c2328f76efb850b8114797247"`);
        await queryRunner.query(`ALTER TABLE "invite" RENAME TO "temporary_invite"`);
        await queryRunner.query(`CREATE TABLE "invite" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "organizationId" varchar, "token" varchar NOT NULL, "email" varchar NOT NULL, "status" varchar NOT NULL, "expireDate" datetime, "actionDate" datetime, "invitedById" varchar, "roleId" varchar, "code" integer, "fullName" varchar, CONSTRAINT "FK_7c2328f76efb850b81147972476" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_68eef4ab86b67747f24f288a16c" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_5a182e8b3e225b14ddf6df7e6c3" FOREIGN KEY ("invitedById") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_900a3ed40499c79c1c289fec284" FOREIGN KEY ("roleId") REFERENCES "role" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`);
        await queryRunner.query(`INSERT INTO "invite"("id", "createdAt", "updatedAt", "tenantId", "organizationId", "token", "email", "status", "expireDate", "actionDate", "invitedById", "roleId", "code", "fullName") SELECT "id", "createdAt", "updatedAt", "tenantId", "organizationId", "token", "email", "status", "expireDate", "actionDate", "invitedById", "roleId", "code", "fullName" FROM "temporary_invite"`);
        await queryRunner.query(`DROP TABLE "temporary_invite"`);
        await queryRunner.query(`CREATE INDEX "IDX_900a3ed40499c79c1c289fec28" ON "invite" ("roleId") `);
        await queryRunner.query(`CREATE INDEX "IDX_5a182e8b3e225b14ddf6df7e6c" ON "invite" ("invitedById") `);
        await queryRunner.query(`CREATE INDEX "IDX_68eef4ab86b67747f24f288a16" ON "invite" ("organizationId") `);
        await queryRunner.query(`CREATE INDEX "IDX_7c2328f76efb850b8114797247" ON "invite" ("tenantId") `);
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
