import { MigrationInterface, QueryRunner } from "typeorm";
    
export class AlterRolePermissionTable1643807301083 implements MigrationInterface {

    name = 'AlterRolePermissionTable1643807301083';

    public async up(queryRunner: QueryRunner): Promise<void> {
        if (queryRunner.connection.options.type === 'sqlite') {
            await this.sqliteUpQueryRunner(queryRunner);
        } else {
            await this.postgresUpQueryRunner(queryRunner);
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
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
}