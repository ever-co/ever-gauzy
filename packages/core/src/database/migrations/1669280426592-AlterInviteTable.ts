import { MigrationInterface, QueryRunner } from "typeorm";
import * as chalk from "chalk";
import { DatabaseTypeEnum } from "@gauzy/config";

export class AlterInviteTable1669280426592 implements MigrationInterface {

    name = 'AlterInviteTable1669280426592';

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
        await queryRunner.query(`DROP INDEX "public"."IDX_658d8246180c0345d32a100544"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_83dbe83cb33c3e8468c8045ea7"`);
        await queryRunner.query(`ALTER TABLE "invite" ADD "code" integer`);
        await queryRunner.query(`ALTER TABLE "invite" ADD "fullName" character varying`);
    }

    /**
    * PostgresDB Down Migration
    *
    * @param queryRunner
    */
    public async postgresDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`ALTER TABLE "invite" DROP COLUMN "fullName"`);
        await queryRunner.query(`ALTER TABLE "invite" DROP COLUMN "code"`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_83dbe83cb33c3e8468c8045ea7" ON "invite" ("token") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_658d8246180c0345d32a100544" ON "invite" ("email") `);
    }

    /**
    * SqliteDB Up Migration
    *
    * @param queryRunner
    */
    public async sqliteUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`DROP INDEX "IDX_658d8246180c0345d32a100544"`);
        await queryRunner.query(`DROP INDEX "IDX_83dbe83cb33c3e8468c8045ea7"`);
        await queryRunner.query(`DROP INDEX "IDX_900a3ed40499c79c1c289fec28"`);
        await queryRunner.query(`DROP INDEX "IDX_5a182e8b3e225b14ddf6df7e6c"`);
        await queryRunner.query(`DROP INDEX "IDX_68eef4ab86b67747f24f288a16"`);
        await queryRunner.query(`DROP INDEX "IDX_7c2328f76efb850b8114797247"`);
        await queryRunner.query(`CREATE TABLE "temporary_invite" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "organizationId" varchar, "token" varchar NOT NULL, "email" varchar NOT NULL, "status" varchar NOT NULL, "expireDate" datetime, "actionDate" datetime, "invitedById" varchar, "roleId" varchar, "code" integer, "fullName" varchar, CONSTRAINT "FK_900a3ed40499c79c1c289fec284" FOREIGN KEY ("roleId") REFERENCES "role" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_5a182e8b3e225b14ddf6df7e6c3" FOREIGN KEY ("invitedById") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_68eef4ab86b67747f24f288a16c" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_7c2328f76efb850b81147972476" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`);
        await queryRunner.query(`INSERT INTO "temporary_invite"("id", "createdAt", "updatedAt", "tenantId", "organizationId", "token", "email", "status", "expireDate", "actionDate", "invitedById", "roleId") SELECT "id", "createdAt", "updatedAt", "tenantId", "organizationId", "token", "email", "status", "expireDate", "actionDate", "invitedById", "roleId" FROM "invite"`);
        await queryRunner.query(`DROP TABLE "invite"`);
        await queryRunner.query(`ALTER TABLE "temporary_invite" RENAME TO "invite"`);
        await queryRunner.query(`CREATE INDEX "IDX_900a3ed40499c79c1c289fec28" ON "invite" ("roleId") `);
        await queryRunner.query(`CREATE INDEX "IDX_5a182e8b3e225b14ddf6df7e6c" ON "invite" ("invitedById") `);
        await queryRunner.query(`CREATE INDEX "IDX_68eef4ab86b67747f24f288a16" ON "invite" ("organizationId") `);
        await queryRunner.query(`CREATE INDEX "IDX_7c2328f76efb850b8114797247" ON "invite" ("tenantId") `);
    }

    /**
    * SqliteDB Down Migration
    *
    * @param queryRunner
    */
    public async sqliteDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`DROP INDEX "IDX_7c2328f76efb850b8114797247"`);
        await queryRunner.query(`DROP INDEX "IDX_68eef4ab86b67747f24f288a16"`);
        await queryRunner.query(`DROP INDEX "IDX_5a182e8b3e225b14ddf6df7e6c"`);
        await queryRunner.query(`DROP INDEX "IDX_900a3ed40499c79c1c289fec28"`);
        await queryRunner.query(`ALTER TABLE "invite" RENAME TO "temporary_invite"`);
        await queryRunner.query(`CREATE TABLE "invite" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "organizationId" varchar, "token" varchar NOT NULL, "email" varchar NOT NULL, "status" varchar NOT NULL, "expireDate" datetime, "actionDate" datetime, "invitedById" varchar, "roleId" varchar, CONSTRAINT "FK_900a3ed40499c79c1c289fec284" FOREIGN KEY ("roleId") REFERENCES "role" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_5a182e8b3e225b14ddf6df7e6c3" FOREIGN KEY ("invitedById") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_68eef4ab86b67747f24f288a16c" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_7c2328f76efb850b81147972476" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`);
        await queryRunner.query(`INSERT INTO "invite"("id", "createdAt", "updatedAt", "tenantId", "organizationId", "token", "email", "status", "expireDate", "actionDate", "invitedById", "roleId") SELECT "id", "createdAt", "updatedAt", "tenantId", "organizationId", "token", "email", "status", "expireDate", "actionDate", "invitedById", "roleId" FROM "temporary_invite"`);
        await queryRunner.query(`DROP TABLE "temporary_invite"`);
        await queryRunner.query(`CREATE INDEX "IDX_7c2328f76efb850b8114797247" ON "invite" ("tenantId") `);
        await queryRunner.query(`CREATE INDEX "IDX_68eef4ab86b67747f24f288a16" ON "invite" ("organizationId") `);
        await queryRunner.query(`CREATE INDEX "IDX_5a182e8b3e225b14ddf6df7e6c" ON "invite" ("invitedById") `);
        await queryRunner.query(`CREATE INDEX "IDX_900a3ed40499c79c1c289fec28" ON "invite" ("roleId") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_83dbe83cb33c3e8468c8045ea7" ON "invite" ("token") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_658d8246180c0345d32a100544" ON "invite" ("email") `);
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
