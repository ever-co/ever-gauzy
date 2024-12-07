import { MigrationInterface, QueryRunner } from "typeorm";
import * as chalk from "chalk";
import { DatabaseTypeEnum } from "@gauzy/config";

export class AlterJobSearchRelationalTables1680530165590 implements MigrationInterface {

    name = 'AlterJobSearchRelationalTables1680530165590';

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
        await queryRunner.query(`ALTER TABLE "job_search_category" ALTER COLUMN "jobSource" SET DEFAULT 'upwork'`);
        await queryRunner.query(`ALTER TABLE "job_search_occupation" ALTER COLUMN "jobSource" SET DEFAULT 'upwork'`);
    }

    /**
    * PostgresDB Down Migration
    *
    * @param queryRunner
    */
    public async postgresDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`ALTER TABLE "job_search_occupation" ALTER COLUMN "jobSource" SET DEFAULT 'UPWORK'`);
        await queryRunner.query(`ALTER TABLE "job_search_category" ALTER COLUMN "jobSource" SET DEFAULT 'UPWORK'`);
    }

    /**
    * SqliteDB Up Migration
    *
    * @param queryRunner
    */
    public async sqliteUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`DROP INDEX "IDX_6ee5218c869b57197e4a209bed"`);
        await queryRunner.query(`DROP INDEX "IDX_d0a798419c775b9157bf0269f4"`);
        await queryRunner.query(`DROP INDEX "IDX_3b335bbcbf7d5e00853acaa165"`);
        await queryRunner.query(`DROP INDEX "IDX_86381fb6d28978b101b3aec8ca"`);
        await queryRunner.query(`DROP INDEX "IDX_35e120f2b6e5188391cf068d3b"`);
        await queryRunner.query(`CREATE TABLE "temporary_job_search_category" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "organizationId" varchar, "name" varchar NOT NULL, "jobSourceCategoryId" varchar, "jobSource" text NOT NULL DEFAULT ('upwork'), CONSTRAINT "FK_86381fb6d28978b101b3aec8ca4" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_35e120f2b6e5188391cf068d3ba" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`);
        await queryRunner.query(`INSERT INTO "temporary_job_search_category"("id", "createdAt", "updatedAt", "tenantId", "organizationId", "name", "jobSourceCategoryId", "jobSource") SELECT "id", "createdAt", "updatedAt", "tenantId", "organizationId", "name", "jobSourceCategoryId", "jobSource" FROM "job_search_category"`);
        await queryRunner.query(`DROP TABLE "job_search_category"`);
        await queryRunner.query(`ALTER TABLE "temporary_job_search_category" RENAME TO "job_search_category"`);
        await queryRunner.query(`CREATE INDEX "IDX_6ee5218c869b57197e4a209bed" ON "job_search_category" ("jobSource") `);
        await queryRunner.query(`CREATE INDEX "IDX_d0a798419c775b9157bf0269f4" ON "job_search_category" ("jobSourceCategoryId") `);
        await queryRunner.query(`CREATE INDEX "IDX_3b335bbcbf7d5e00853acaa165" ON "job_search_category" ("name") `);
        await queryRunner.query(`CREATE INDEX "IDX_86381fb6d28978b101b3aec8ca" ON "job_search_category" ("organizationId") `);
        await queryRunner.query(`CREATE INDEX "IDX_35e120f2b6e5188391cf068d3b" ON "job_search_category" ("tenantId") `);
        await queryRunner.query(`DROP INDEX "IDX_c8723c90a6f007f8d7e882a04f"`);
        await queryRunner.query(`DROP INDEX "IDX_cb64573b18dd7b23f591f15502"`);
        await queryRunner.query(`DROP INDEX "IDX_9f1288205ae91f91cf356cac2f"`);
        await queryRunner.query(`DROP INDEX "IDX_1a62a99e1016e4a2b461e886ec"`);
        await queryRunner.query(`DROP INDEX "IDX_44e22d88b47daf2095491b7cac"`);
        await queryRunner.query(`CREATE TABLE "temporary_job_search_occupation" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "organizationId" varchar, "name" varchar NOT NULL, "jobSourceOccupationId" varchar, "jobSource" text NOT NULL DEFAULT ('upwork'), CONSTRAINT "FK_1a62a99e1016e4a2b461e886ecd" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_44e22d88b47daf2095491b7cac3" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`);
        await queryRunner.query(`INSERT INTO "temporary_job_search_occupation"("id", "createdAt", "updatedAt", "tenantId", "organizationId", "name", "jobSourceOccupationId", "jobSource") SELECT "id", "createdAt", "updatedAt", "tenantId", "organizationId", "name", "jobSourceOccupationId", "jobSource" FROM "job_search_occupation"`);
        await queryRunner.query(`DROP TABLE "job_search_occupation"`);
        await queryRunner.query(`ALTER TABLE "temporary_job_search_occupation" RENAME TO "job_search_occupation"`);
        await queryRunner.query(`CREATE INDEX "IDX_c8723c90a6f007f8d7e882a04f" ON "job_search_occupation" ("jobSource") `);
        await queryRunner.query(`CREATE INDEX "IDX_cb64573b18dd7b23f591f15502" ON "job_search_occupation" ("jobSourceOccupationId") `);
        await queryRunner.query(`CREATE INDEX "IDX_9f1288205ae91f91cf356cac2f" ON "job_search_occupation" ("name") `);
        await queryRunner.query(`CREATE INDEX "IDX_1a62a99e1016e4a2b461e886ec" ON "job_search_occupation" ("organizationId") `);
        await queryRunner.query(`CREATE INDEX "IDX_44e22d88b47daf2095491b7cac" ON "job_search_occupation" ("tenantId") `);
    }

    /**
    * SqliteDB Down Migration
    *
    * @param queryRunner
    */
    public async sqliteDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`DROP INDEX "IDX_44e22d88b47daf2095491b7cac"`);
        await queryRunner.query(`DROP INDEX "IDX_1a62a99e1016e4a2b461e886ec"`);
        await queryRunner.query(`DROP INDEX "IDX_9f1288205ae91f91cf356cac2f"`);
        await queryRunner.query(`DROP INDEX "IDX_cb64573b18dd7b23f591f15502"`);
        await queryRunner.query(`DROP INDEX "IDX_c8723c90a6f007f8d7e882a04f"`);
        await queryRunner.query(`ALTER TABLE "job_search_occupation" RENAME TO "temporary_job_search_occupation"`);
        await queryRunner.query(`CREATE TABLE "job_search_occupation" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "organizationId" varchar, "name" varchar NOT NULL, "jobSourceOccupationId" varchar, "jobSource" text NOT NULL DEFAULT ('UPWORK'), CONSTRAINT "FK_1a62a99e1016e4a2b461e886ecd" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_44e22d88b47daf2095491b7cac3" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`);
        await queryRunner.query(`INSERT INTO "job_search_occupation"("id", "createdAt", "updatedAt", "tenantId", "organizationId", "name", "jobSourceOccupationId", "jobSource") SELECT "id", "createdAt", "updatedAt", "tenantId", "organizationId", "name", "jobSourceOccupationId", "jobSource" FROM "temporary_job_search_occupation"`);
        await queryRunner.query(`DROP TABLE "temporary_job_search_occupation"`);
        await queryRunner.query(`CREATE INDEX "IDX_44e22d88b47daf2095491b7cac" ON "job_search_occupation" ("tenantId") `);
        await queryRunner.query(`CREATE INDEX "IDX_1a62a99e1016e4a2b461e886ec" ON "job_search_occupation" ("organizationId") `);
        await queryRunner.query(`CREATE INDEX "IDX_9f1288205ae91f91cf356cac2f" ON "job_search_occupation" ("name") `);
        await queryRunner.query(`CREATE INDEX "IDX_cb64573b18dd7b23f591f15502" ON "job_search_occupation" ("jobSourceOccupationId") `);
        await queryRunner.query(`CREATE INDEX "IDX_c8723c90a6f007f8d7e882a04f" ON "job_search_occupation" ("jobSource") `);
        await queryRunner.query(`DROP INDEX "IDX_35e120f2b6e5188391cf068d3b"`);
        await queryRunner.query(`DROP INDEX "IDX_86381fb6d28978b101b3aec8ca"`);
        await queryRunner.query(`DROP INDEX "IDX_3b335bbcbf7d5e00853acaa165"`);
        await queryRunner.query(`DROP INDEX "IDX_d0a798419c775b9157bf0269f4"`);
        await queryRunner.query(`DROP INDEX "IDX_6ee5218c869b57197e4a209bed"`);
        await queryRunner.query(`ALTER TABLE "job_search_category" RENAME TO "temporary_job_search_category"`);
        await queryRunner.query(`CREATE TABLE "job_search_category" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "organizationId" varchar, "name" varchar NOT NULL, "jobSourceCategoryId" varchar, "jobSource" text NOT NULL DEFAULT ('UPWORK'), CONSTRAINT "FK_86381fb6d28978b101b3aec8ca4" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_35e120f2b6e5188391cf068d3ba" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`);
        await queryRunner.query(`INSERT INTO "job_search_category"("id", "createdAt", "updatedAt", "tenantId", "organizationId", "name", "jobSourceCategoryId", "jobSource") SELECT "id", "createdAt", "updatedAt", "tenantId", "organizationId", "name", "jobSourceCategoryId", "jobSource" FROM "temporary_job_search_category"`);
        await queryRunner.query(`DROP TABLE "temporary_job_search_category"`);
        await queryRunner.query(`CREATE INDEX "IDX_35e120f2b6e5188391cf068d3b" ON "job_search_category" ("tenantId") `);
        await queryRunner.query(`CREATE INDEX "IDX_86381fb6d28978b101b3aec8ca" ON "job_search_category" ("organizationId") `);
        await queryRunner.query(`CREATE INDEX "IDX_3b335bbcbf7d5e00853acaa165" ON "job_search_category" ("name") `);
        await queryRunner.query(`CREATE INDEX "IDX_d0a798419c775b9157bf0269f4" ON "job_search_category" ("jobSourceCategoryId") `);
        await queryRunner.query(`CREATE INDEX "IDX_6ee5218c869b57197e4a209bed" ON "job_search_category" ("jobSource") `);
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
