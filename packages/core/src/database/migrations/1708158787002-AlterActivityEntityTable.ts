
import { MigrationInterface, QueryRunner } from "typeorm";
import { DatabaseTypeEnum } from "@gauzy/config";
import { yellow } from "chalk";

export class AlterActivityEntityTable1708158787002 implements MigrationInterface {

    name = 'AlterActivityEntityTable1708158787002';

    /**
     * Up Migration
     *
     * @param queryRunner
     */
    public async up(queryRunner: QueryRunner): Promise<void> {
        console.log(yellow(this.name + ' start running!'));

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
        await queryRunner.query(`ALTER TABLE "activity" ALTER COLUMN "date" DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "activity" ALTER COLUMN "date" DROP DEFAULT`);
        await queryRunner.query(`ALTER TABLE "activity" ALTER COLUMN "time" DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "activity" ALTER COLUMN "time" DROP DEFAULT`);
    }

    /**
    * PostgresDB Down Migration
    *
    * @param queryRunner
    */
    public async postgresDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`ALTER TABLE "activity" ALTER COLUMN "time" SET DEFAULT now()`);
        await queryRunner.query(`ALTER TABLE "activity" ALTER COLUMN "time" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "activity" ALTER COLUMN "date" SET DEFAULT now()`);
        await queryRunner.query(`ALTER TABLE "activity" ALTER COLUMN "date" SET NOT NULL`);
    }

    /**
    * SqliteDB and BetterSQlite3DB Up Migration
    *
    * @param queryRunner
    */
    public async sqliteUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`DROP INDEX "IDX_d2d6db7f03da5632687e5d140e"`);
        await queryRunner.query(`DROP INDEX "IDX_ae6ac57aafef59f561d4db3dd7"`);
        await queryRunner.query(`DROP INDEX "IDX_f2401d8fdff5d8970dfe30d3ae"`);
        await queryRunner.query(`DROP INDEX "IDX_fdb3f018c2bba4885bfa5757d1"`);
        await queryRunner.query(`DROP INDEX "IDX_a6f74ae99d549932391f0f4460"`);
        await queryRunner.query(`DROP INDEX "IDX_5a898f44fa31ef7916f0c38b01"`);
        await queryRunner.query(`DROP INDEX "IDX_4e382caaf07ab0923b2e06bf91"`);
        await queryRunner.query(`DROP INDEX "IDX_2743f8990fde12f9586287eb09"`);
        await queryRunner.query(`DROP INDEX "IDX_a28a1682ea80f10d1ecc7babaa"`);
        await queryRunner.query(`DROP INDEX "IDX_302b60a4970ffe94d5223f1c23"`);
        await queryRunner.query(`DROP INDEX "IDX_b5525385e85f7429e233d4a0fa"`);
        await queryRunner.query(`DROP INDEX "IDX_f27285af15ef48363745ab2d79"`);
        await queryRunner.query(`DROP INDEX "IDX_0e36a2c95e2f1df7f1b3059d24"`);
        await queryRunner.query(`DROP INDEX "IDX_ffd736f18ba71b3221e4f835a9"`);
        await queryRunner.query(`CREATE TABLE "temporary_activity" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "organizationId" varchar, "title" varchar, "description" varchar, "metaData" text, "date" date, "time" time, "duration" integer NOT NULL DEFAULT (0), "type" varchar, "source" varchar NOT NULL DEFAULT ('BROWSER'), "deletedAt" datetime, "employeeId" varchar NOT NULL, "projectId" varchar, "timeSlotId" varchar, "taskId" varchar, "recordedAt" datetime, "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), CONSTRAINT "FK_f2401d8fdff5d8970dfe30d3aed" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_fdb3f018c2bba4885bfa5757d16" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_a6f74ae99d549932391f0f44609" FOREIGN KEY ("employeeId") REFERENCES "employee" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_5a898f44fa31ef7916f0c38b016" FOREIGN KEY ("projectId") REFERENCES "organization_project" ("id") ON DELETE SET NULL ON UPDATE NO ACTION, CONSTRAINT "FK_4e382caaf07ab0923b2e06bf918" FOREIGN KEY ("timeSlotId") REFERENCES "time_slot" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_2743f8990fde12f9586287eb09f" FOREIGN KEY ("taskId") REFERENCES "task" ("id") ON DELETE SET NULL ON UPDATE NO ACTION)`);
        await queryRunner.query(`INSERT INTO "temporary_activity"("id", "createdAt", "updatedAt", "tenantId", "organizationId", "title", "description", "metaData", "date", "time", "duration", "type", "source", "deletedAt", "employeeId", "projectId", "timeSlotId", "taskId", "recordedAt", "isActive", "isArchived") SELECT "id", "createdAt", "updatedAt", "tenantId", "organizationId", "title", "description", "metaData", "date", "time", "duration", "type", "source", "deletedAt", "employeeId", "projectId", "timeSlotId", "taskId", "recordedAt", "isActive", "isArchived" FROM "activity"`);
        await queryRunner.query(`DROP TABLE "activity"`);
        await queryRunner.query(`ALTER TABLE "temporary_activity" RENAME TO "activity"`);
        await queryRunner.query(`CREATE INDEX "IDX_d2d6db7f03da5632687e5d140e" ON "activity" ("isArchived") `);
        await queryRunner.query(`CREATE INDEX "IDX_ae6ac57aafef59f561d4db3dd7" ON "activity" ("isActive") `);
        await queryRunner.query(`CREATE INDEX "IDX_f2401d8fdff5d8970dfe30d3ae" ON "activity" ("tenantId") `);
        await queryRunner.query(`CREATE INDEX "IDX_fdb3f018c2bba4885bfa5757d1" ON "activity" ("organizationId") `);
        await queryRunner.query(`CREATE INDEX "IDX_a6f74ae99d549932391f0f4460" ON "activity" ("employeeId") `);
        await queryRunner.query(`CREATE INDEX "IDX_5a898f44fa31ef7916f0c38b01" ON "activity" ("projectId") `);
        await queryRunner.query(`CREATE INDEX "IDX_4e382caaf07ab0923b2e06bf91" ON "activity" ("timeSlotId") `);
        await queryRunner.query(`CREATE INDEX "IDX_2743f8990fde12f9586287eb09" ON "activity" ("taskId") `);
        await queryRunner.query(`CREATE INDEX "IDX_a28a1682ea80f10d1ecc7babaa" ON "activity" ("title") `);
        await queryRunner.query(`CREATE INDEX "IDX_302b60a4970ffe94d5223f1c23" ON "activity" ("date") `);
        await queryRunner.query(`CREATE INDEX "IDX_b5525385e85f7429e233d4a0fa" ON "activity" ("time") `);
        await queryRunner.query(`CREATE INDEX "IDX_f27285af15ef48363745ab2d79" ON "activity" ("type") `);
        await queryRunner.query(`CREATE INDEX "IDX_0e36a2c95e2f1df7f1b3059d24" ON "activity" ("source") `);
        await queryRunner.query(`CREATE INDEX "IDX_ffd736f18ba71b3221e4f835a9" ON "activity" ("recordedAt") `);
    }

    /**
    * SqliteDB and BetterSQlite3DB Down Migration
    *
    * @param queryRunner
    */
    public async sqliteDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`DROP INDEX "IDX_ffd736f18ba71b3221e4f835a9"`);
        await queryRunner.query(`DROP INDEX "IDX_0e36a2c95e2f1df7f1b3059d24"`);
        await queryRunner.query(`DROP INDEX "IDX_f27285af15ef48363745ab2d79"`);
        await queryRunner.query(`DROP INDEX "IDX_b5525385e85f7429e233d4a0fa"`);
        await queryRunner.query(`DROP INDEX "IDX_302b60a4970ffe94d5223f1c23"`);
        await queryRunner.query(`DROP INDEX "IDX_a28a1682ea80f10d1ecc7babaa"`);
        await queryRunner.query(`DROP INDEX "IDX_2743f8990fde12f9586287eb09"`);
        await queryRunner.query(`DROP INDEX "IDX_4e382caaf07ab0923b2e06bf91"`);
        await queryRunner.query(`DROP INDEX "IDX_5a898f44fa31ef7916f0c38b01"`);
        await queryRunner.query(`DROP INDEX "IDX_a6f74ae99d549932391f0f4460"`);
        await queryRunner.query(`DROP INDEX "IDX_fdb3f018c2bba4885bfa5757d1"`);
        await queryRunner.query(`DROP INDEX "IDX_f2401d8fdff5d8970dfe30d3ae"`);
        await queryRunner.query(`DROP INDEX "IDX_ae6ac57aafef59f561d4db3dd7"`);
        await queryRunner.query(`DROP INDEX "IDX_d2d6db7f03da5632687e5d140e"`);
        await queryRunner.query(`ALTER TABLE "activity" RENAME TO "temporary_activity"`);
        await queryRunner.query(`CREATE TABLE "activity" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "organizationId" varchar, "title" varchar, "description" varchar, "metaData" text, "date" date NOT NULL DEFAULT (datetime('now')), "time" time NOT NULL DEFAULT (datetime('now')), "duration" integer NOT NULL DEFAULT (0), "type" varchar, "source" varchar NOT NULL DEFAULT ('BROWSER'), "deletedAt" datetime, "employeeId" varchar NOT NULL, "projectId" varchar, "timeSlotId" varchar, "taskId" varchar, "recordedAt" datetime, "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), CONSTRAINT "FK_f2401d8fdff5d8970dfe30d3aed" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_fdb3f018c2bba4885bfa5757d16" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_a6f74ae99d549932391f0f44609" FOREIGN KEY ("employeeId") REFERENCES "employee" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_5a898f44fa31ef7916f0c38b016" FOREIGN KEY ("projectId") REFERENCES "organization_project" ("id") ON DELETE SET NULL ON UPDATE NO ACTION, CONSTRAINT "FK_4e382caaf07ab0923b2e06bf918" FOREIGN KEY ("timeSlotId") REFERENCES "time_slot" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_2743f8990fde12f9586287eb09f" FOREIGN KEY ("taskId") REFERENCES "task" ("id") ON DELETE SET NULL ON UPDATE NO ACTION)`);
        await queryRunner.query(`INSERT INTO "activity"("id", "createdAt", "updatedAt", "tenantId", "organizationId", "title", "description", "metaData", "date", "time", "duration", "type", "source", "deletedAt", "employeeId", "projectId", "timeSlotId", "taskId", "recordedAt", "isActive", "isArchived") SELECT "id", "createdAt", "updatedAt", "tenantId", "organizationId", "title", "description", "metaData", "date", "time", "duration", "type", "source", "deletedAt", "employeeId", "projectId", "timeSlotId", "taskId", "recordedAt", "isActive", "isArchived" FROM "temporary_activity"`);
        await queryRunner.query(`DROP TABLE "temporary_activity"`);
        await queryRunner.query(`CREATE INDEX "IDX_ffd736f18ba71b3221e4f835a9" ON "activity" ("recordedAt") `);
        await queryRunner.query(`CREATE INDEX "IDX_0e36a2c95e2f1df7f1b3059d24" ON "activity" ("source") `);
        await queryRunner.query(`CREATE INDEX "IDX_f27285af15ef48363745ab2d79" ON "activity" ("type") `);
        await queryRunner.query(`CREATE INDEX "IDX_b5525385e85f7429e233d4a0fa" ON "activity" ("time") `);
        await queryRunner.query(`CREATE INDEX "IDX_302b60a4970ffe94d5223f1c23" ON "activity" ("date") `);
        await queryRunner.query(`CREATE INDEX "IDX_a28a1682ea80f10d1ecc7babaa" ON "activity" ("title") `);
        await queryRunner.query(`CREATE INDEX "IDX_2743f8990fde12f9586287eb09" ON "activity" ("taskId") `);
        await queryRunner.query(`CREATE INDEX "IDX_4e382caaf07ab0923b2e06bf91" ON "activity" ("timeSlotId") `);
        await queryRunner.query(`CREATE INDEX "IDX_5a898f44fa31ef7916f0c38b01" ON "activity" ("projectId") `);
        await queryRunner.query(`CREATE INDEX "IDX_a6f74ae99d549932391f0f4460" ON "activity" ("employeeId") `);
        await queryRunner.query(`CREATE INDEX "IDX_fdb3f018c2bba4885bfa5757d1" ON "activity" ("organizationId") `);
        await queryRunner.query(`CREATE INDEX "IDX_f2401d8fdff5d8970dfe30d3ae" ON "activity" ("tenantId") `);
        await queryRunner.query(`CREATE INDEX "IDX_ae6ac57aafef59f561d4db3dd7" ON "activity" ("isActive") `);
        await queryRunner.query(`CREATE INDEX "IDX_d2d6db7f03da5632687e5d140e" ON "activity" ("isArchived") `);
    }

    /**
     * MySQL Up Migration
     *
     * @param queryRunner
     */
    public async mysqlUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`DROP INDEX \`IDX_302b60a4970ffe94d5223f1c23\` ON \`activity\``);
        await queryRunner.query(`ALTER TABLE \`activity\` DROP COLUMN \`date\``);
        await queryRunner.query(`ALTER TABLE \`activity\` ADD \`date\` date NULL`);
        await queryRunner.query(`ALTER TABLE \`activity\` CHANGE \`time\` \`time\` time NULL`);
        await queryRunner.query(`CREATE INDEX \`IDX_302b60a4970ffe94d5223f1c23\` ON \`activity\` (\`date\`)`);
    }

    /**
     * MySQL Down Migration
     *
     * @param queryRunner
     */
    public async mysqlDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`DROP INDEX \`IDX_302b60a4970ffe94d5223f1c23\` ON \`activity\``);
        await queryRunner.query(`ALTER TABLE \`activity\` CHANGE \`time\` \`time\` time(6) NOT NULL DEFAULT '00:00:00.000000'`);
        await queryRunner.query(`ALTER TABLE \`activity\` DROP COLUMN \`date\``);
        await queryRunner.query(`ALTER TABLE \`activity\` ADD \`date\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6)`);
        await queryRunner.query(`CREATE INDEX \`IDX_302b60a4970ffe94d5223f1c23\` ON \`activity\` (\`date\`)`);
    }
}
