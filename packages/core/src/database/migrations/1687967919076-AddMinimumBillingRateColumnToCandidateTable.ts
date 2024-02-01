import { MigrationInterface, QueryRunner } from "typeorm";
import * as chalk from "chalk";
import { DatabaseTypeEnum } from "@gauzy/config";

export class AddMinimumBillingRateColumnToCandidateTable1687967919076 implements MigrationInterface {

    name = 'AddMinimumBillingRateColumnToCandidateTable1687967919076';

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
        await queryRunner.query(`ALTER TABLE "candidate" ADD "minimumBillingRate" integer`);
    }

    /**
    * PostgresDB Down Migration
    *
    * @param queryRunner
    */
    public async postgresDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`ALTER TABLE "candidate" DROP COLUMN "minimumBillingRate"`);
    }

    /**
    * SqliteDB Up Migration
    *
    * @param queryRunner
    */
    public async sqliteUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`DROP INDEX "IDX_8b900e8a39f76125e610ab30c0"`);
        await queryRunner.query(`DROP INDEX "IDX_77ac426e04553ff1654421bce4"`);
        await queryRunner.query(`DROP INDEX "IDX_16fb27ffd1a99c6506c92ad57a"`);
        await queryRunner.query(`DROP INDEX "IDX_b674793a804b7d69d74c8f6c5b"`);
        await queryRunner.query(`DROP INDEX "IDX_1e3e8228e7df634fa4cec6322c"`);
        await queryRunner.query(`DROP INDEX "IDX_4ea108fd8b089237964d5f98fb"`);
        await queryRunner.query(`DROP INDEX "IDX_3930aa71e0fa24f09201811b1b"`);
        await queryRunner.query(`CREATE TABLE "temporary_candidate" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "organizationId" varchar, "rating" numeric, "valueDate" datetime, "appliedDate" datetime, "hiredDate" datetime, "status" varchar DEFAULT ('APPLIED'), "rejectDate" datetime, "candidateLevel" varchar(500), "reWeeklyLimit" integer, "billRateCurrency" varchar(255), "billRateValue" integer, "payPeriod" varchar, "cvUrl" varchar, "isArchived" boolean DEFAULT (0), "contactId" varchar, "organizationPositionId" varchar, "sourceId" varchar, "userId" varchar NOT NULL, "employeeId" varchar, "minimumBillingRate" integer, CONSTRAINT "UQ_91b20077aa92f9115764033cd06" UNIQUE ("employeeId"), CONSTRAINT "REL_b674793a804b7d69d74c8f6c5b" UNIQUE ("contactId"), CONSTRAINT "REL_4ea108fd8b089237964d5f98fb" UNIQUE ("sourceId"), CONSTRAINT "REL_3930aa71e0fa24f09201811b1b" UNIQUE ("userId"), CONSTRAINT "FK_8b900e8a39f76125e610ab30c0e" FOREIGN KEY ("employeeId") REFERENCES "employee" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION, CONSTRAINT "FK_77ac426e04553ff1654421bce4d" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_16fb27ffd1a99c6506c92ad57a7" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_b674793a804b7d69d74c8f6c5ba" FOREIGN KEY ("contactId") REFERENCES "contact" ("id") ON DELETE SET NULL ON UPDATE NO ACTION, CONSTRAINT "FK_1e3e8228e7df634fa4cec6322c7" FOREIGN KEY ("organizationPositionId") REFERENCES "organization_position" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION, CONSTRAINT "FK_4ea108fd8b089237964d5f98fba" FOREIGN KEY ("sourceId") REFERENCES "candidate_source" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_3930aa71e0fa24f09201811b1bb" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`);
        await queryRunner.query(`INSERT INTO "temporary_candidate"("id", "createdAt", "updatedAt", "tenantId", "organizationId", "rating", "valueDate", "appliedDate", "hiredDate", "status", "rejectDate", "candidateLevel", "reWeeklyLimit", "billRateCurrency", "billRateValue", "payPeriod", "cvUrl", "isArchived", "contactId", "organizationPositionId", "sourceId", "userId", "employeeId") SELECT "id", "createdAt", "updatedAt", "tenantId", "organizationId", "rating", "valueDate", "appliedDate", "hiredDate", "status", "rejectDate", "candidateLevel", "reWeeklyLimit", "billRateCurrency", "billRateValue", "payPeriod", "cvUrl", "isArchived", "contactId", "organizationPositionId", "sourceId", "userId", "employeeId" FROM "candidate"`);
        await queryRunner.query(`DROP TABLE "candidate"`);
        await queryRunner.query(`ALTER TABLE "temporary_candidate" RENAME TO "candidate"`);
        await queryRunner.query(`CREATE INDEX "IDX_8b900e8a39f76125e610ab30c0" ON "candidate" ("employeeId") `);
        await queryRunner.query(`CREATE INDEX "IDX_77ac426e04553ff1654421bce4" ON "candidate" ("tenantId") `);
        await queryRunner.query(`CREATE INDEX "IDX_16fb27ffd1a99c6506c92ad57a" ON "candidate" ("organizationId") `);
        await queryRunner.query(`CREATE INDEX "IDX_b674793a804b7d69d74c8f6c5b" ON "candidate" ("contactId") `);
        await queryRunner.query(`CREATE INDEX "IDX_1e3e8228e7df634fa4cec6322c" ON "candidate" ("organizationPositionId") `);
        await queryRunner.query(`CREATE INDEX "IDX_4ea108fd8b089237964d5f98fb" ON "candidate" ("sourceId") `);
        await queryRunner.query(`CREATE INDEX "IDX_3930aa71e0fa24f09201811b1b" ON "candidate" ("userId") `);
    }

    /**
    * SqliteDB Down Migration
    *
    * @param queryRunner
    */
    public async sqliteDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`DROP INDEX "IDX_3930aa71e0fa24f09201811b1b"`);
        await queryRunner.query(`DROP INDEX "IDX_4ea108fd8b089237964d5f98fb"`);
        await queryRunner.query(`DROP INDEX "IDX_1e3e8228e7df634fa4cec6322c"`);
        await queryRunner.query(`DROP INDEX "IDX_b674793a804b7d69d74c8f6c5b"`);
        await queryRunner.query(`DROP INDEX "IDX_16fb27ffd1a99c6506c92ad57a"`);
        await queryRunner.query(`DROP INDEX "IDX_77ac426e04553ff1654421bce4"`);
        await queryRunner.query(`DROP INDEX "IDX_8b900e8a39f76125e610ab30c0"`);
        await queryRunner.query(`ALTER TABLE "candidate" RENAME TO "temporary_candidate"`);
        await queryRunner.query(`CREATE TABLE "candidate" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "organizationId" varchar, "rating" numeric, "valueDate" datetime, "appliedDate" datetime, "hiredDate" datetime, "status" varchar DEFAULT ('APPLIED'), "rejectDate" datetime, "candidateLevel" varchar(500), "reWeeklyLimit" integer, "billRateCurrency" varchar(255), "billRateValue" integer, "payPeriod" varchar, "cvUrl" varchar, "isArchived" boolean DEFAULT (0), "contactId" varchar, "organizationPositionId" varchar, "sourceId" varchar, "userId" varchar NOT NULL, "employeeId" varchar, CONSTRAINT "UQ_91b20077aa92f9115764033cd06" UNIQUE ("employeeId"), CONSTRAINT "REL_b674793a804b7d69d74c8f6c5b" UNIQUE ("contactId"), CONSTRAINT "REL_4ea108fd8b089237964d5f98fb" UNIQUE ("sourceId"), CONSTRAINT "REL_3930aa71e0fa24f09201811b1b" UNIQUE ("userId"), CONSTRAINT "FK_8b900e8a39f76125e610ab30c0e" FOREIGN KEY ("employeeId") REFERENCES "employee" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION, CONSTRAINT "FK_77ac426e04553ff1654421bce4d" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_16fb27ffd1a99c6506c92ad57a7" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_b674793a804b7d69d74c8f6c5ba" FOREIGN KEY ("contactId") REFERENCES "contact" ("id") ON DELETE SET NULL ON UPDATE NO ACTION, CONSTRAINT "FK_1e3e8228e7df634fa4cec6322c7" FOREIGN KEY ("organizationPositionId") REFERENCES "organization_position" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION, CONSTRAINT "FK_4ea108fd8b089237964d5f98fba" FOREIGN KEY ("sourceId") REFERENCES "candidate_source" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_3930aa71e0fa24f09201811b1bb" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`);
        await queryRunner.query(`INSERT INTO "candidate"("id", "createdAt", "updatedAt", "tenantId", "organizationId", "rating", "valueDate", "appliedDate", "hiredDate", "status", "rejectDate", "candidateLevel", "reWeeklyLimit", "billRateCurrency", "billRateValue", "payPeriod", "cvUrl", "isArchived", "contactId", "organizationPositionId", "sourceId", "userId", "employeeId") SELECT "id", "createdAt", "updatedAt", "tenantId", "organizationId", "rating", "valueDate", "appliedDate", "hiredDate", "status", "rejectDate", "candidateLevel", "reWeeklyLimit", "billRateCurrency", "billRateValue", "payPeriod", "cvUrl", "isArchived", "contactId", "organizationPositionId", "sourceId", "userId", "employeeId" FROM "temporary_candidate"`);
        await queryRunner.query(`DROP TABLE "temporary_candidate"`);
        await queryRunner.query(`CREATE INDEX "IDX_3930aa71e0fa24f09201811b1b" ON "candidate" ("userId") `);
        await queryRunner.query(`CREATE INDEX "IDX_4ea108fd8b089237964d5f98fb" ON "candidate" ("sourceId") `);
        await queryRunner.query(`CREATE INDEX "IDX_1e3e8228e7df634fa4cec6322c" ON "candidate" ("organizationPositionId") `);
        await queryRunner.query(`CREATE INDEX "IDX_b674793a804b7d69d74c8f6c5b" ON "candidate" ("contactId") `);
        await queryRunner.query(`CREATE INDEX "IDX_16fb27ffd1a99c6506c92ad57a" ON "candidate" ("organizationId") `);
        await queryRunner.query(`CREATE INDEX "IDX_77ac426e04553ff1654421bce4" ON "candidate" ("tenantId") `);
        await queryRunner.query(`CREATE INDEX "IDX_8b900e8a39f76125e610ab30c0" ON "candidate" ("employeeId") `);
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
