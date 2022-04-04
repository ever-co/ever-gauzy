import { MigrationInterface, QueryRunner } from "typeorm";
    
export class AlterTenantTable1648899149818 implements MigrationInterface {

    name = 'AlterTenantTable1648899149818';

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
        await queryRunner.query(`ALTER TABLE "tenant" ADD "logo" character varying`);
    }

    /**
    * PostgresDB Down Migration
    * 
    * @param queryRunner 
    */
    public async postgresDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`ALTER TABLE "tenant" DROP COLUMN "logo"`);
    }
    
    /**
     * SqliteDB Up Migration
     * 
     * @param queryRunner 
     */
    public async sqliteUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`DROP INDEX "IDX_56211336b5ff35fd944f225917"`);
        await queryRunner.query(`CREATE TABLE "temporary_tenant" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "name" varchar NOT NULL, "logo" varchar)`);
        await queryRunner.query(`INSERT INTO "temporary_tenant"("id", "createdAt", "updatedAt", "name") SELECT "id", "createdAt", "updatedAt", "name" FROM "tenant"`);
        await queryRunner.query(`DROP TABLE "tenant"`);
        await queryRunner.query(`ALTER TABLE "temporary_tenant" RENAME TO "tenant"`);
        await queryRunner.query(`CREATE INDEX "IDX_56211336b5ff35fd944f225917" ON "tenant" ("name") `);
        await queryRunner.query(`CREATE INDEX "IDX_3062637d94040b8a277c5e6367" ON "tenant" ("logo") `);
    }
    
    /**
     * SqliteDB Down Migration
     * 
     * @param queryRunner 
     */
    public async sqliteDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`DROP INDEX "IDX_3062637d94040b8a277c5e6367"`);
        await queryRunner.query(`DROP INDEX "IDX_60468af1ce34043a900809c84f"`);
        await queryRunner.query(`ALTER TABLE "tenant" RENAME TO "temporary_tenant"`);
        await queryRunner.query(`CREATE TABLE "tenant" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "name" varchar NOT NULL)`);
        await queryRunner.query(`INSERT INTO "tenant"("id", "createdAt", "updatedAt", "name") SELECT "id", "createdAt", "updatedAt", "name" FROM "temporary_tenant"`);
        await queryRunner.query(`DROP TABLE "temporary_tenant"`);
        await queryRunner.query(`CREATE INDEX "IDX_56211336b5ff35fd944f225917" ON "tenant" ("name") `);
    }
}