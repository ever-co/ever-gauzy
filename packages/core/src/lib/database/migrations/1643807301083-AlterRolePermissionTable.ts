import { MigrationInterface, QueryRunner } from "typeorm";
import * as chalk from "chalk";
import { DatabaseTypeEnum } from "@gauzy/config";

export class AlterRolePermissionTable1643807301083 implements MigrationInterface {

    name = 'AlterRolePermissionTable1643807301083';

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
        await queryRunner.query(`ALTER TABLE "role_permission" ADD "description" character varying`);
    }

    /**
     * PostgresDB Down Migration
     *
     * @param queryRunner
     */
    public async postgresDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`ALTER TABLE "role_permission" DROP COLUMN "description"`);
    }

    /**
     * SqliteDB Up Migration
     *
     * @param queryRunner
     */
    public async sqliteUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`DROP INDEX "IDX_e3130a39c1e4a740d044e68573"`);
        await queryRunner.query(`DROP INDEX "IDX_8307c5c44a4ad6210b767b17a9"`);
        await queryRunner.query(`DROP INDEX "IDX_cbd053921056e77c0a8e03122a"`);
        await queryRunner.query(`CREATE TABLE "temporary_role_permission" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "permission" varchar NOT NULL, "enabled" boolean DEFAULT (0), "roleId" varchar NOT NULL, "description" varchar, CONSTRAINT "FK_e3130a39c1e4a740d044e685730" FOREIGN KEY ("roleId") REFERENCES "role" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_cbd053921056e77c0a8e03122af" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`);
        await queryRunner.query(`INSERT INTO "temporary_role_permission"("id", "createdAt", "updatedAt", "tenantId", "permission", "enabled", "roleId") SELECT "id", "createdAt", "updatedAt", "tenantId", "permission", "enabled", "roleId" FROM "role_permission"`);
        await queryRunner.query(`DROP TABLE "role_permission"`);
        await queryRunner.query(`ALTER TABLE "temporary_role_permission" RENAME TO "role_permission"`);
        await queryRunner.query(`CREATE INDEX "IDX_e3130a39c1e4a740d044e68573" ON "role_permission" ("roleId") `);
        await queryRunner.query(`CREATE INDEX "IDX_8307c5c44a4ad6210b767b17a9" ON "role_permission" ("permission") `);
        await queryRunner.query(`CREATE INDEX "IDX_cbd053921056e77c0a8e03122a" ON "role_permission" ("tenantId") `);
    }

    /**
     * SqliteDB Down Migration
     *
     * @param queryRunner
     */
    public async sqliteDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`DROP INDEX "IDX_cbd053921056e77c0a8e03122a"`);
        await queryRunner.query(`DROP INDEX "IDX_8307c5c44a4ad6210b767b17a9"`);
        await queryRunner.query(`DROP INDEX "IDX_e3130a39c1e4a740d044e68573"`);
        await queryRunner.query(`ALTER TABLE "role_permission" RENAME TO "temporary_role_permission"`);
        await queryRunner.query(`CREATE TABLE "role_permission" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "permission" varchar NOT NULL, "enabled" boolean DEFAULT (0), "roleId" varchar NOT NULL, CONSTRAINT "FK_e3130a39c1e4a740d044e685730" FOREIGN KEY ("roleId") REFERENCES "role" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_cbd053921056e77c0a8e03122af" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`);
        await queryRunner.query(`INSERT INTO "role_permission"("id", "createdAt", "updatedAt", "tenantId", "permission", "enabled", "roleId") SELECT "id", "createdAt", "updatedAt", "tenantId", "permission", "enabled", "roleId" FROM "temporary_role_permission"`);
        await queryRunner.query(`DROP TABLE "temporary_role_permission"`);
        await queryRunner.query(`CREATE INDEX "IDX_cbd053921056e77c0a8e03122a" ON "role_permission" ("tenantId") `);
        await queryRunner.query(`CREATE INDEX "IDX_8307c5c44a4ad6210b767b17a9" ON "role_permission" ("permission") `);
        await queryRunner.query(`CREATE INDEX "IDX_e3130a39c1e4a740d044e68573" ON "role_permission" ("roleId") `);
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
