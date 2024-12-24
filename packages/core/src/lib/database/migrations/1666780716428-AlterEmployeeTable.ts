import { MigrationInterface, QueryRunner } from "typeorm";
import * as chalk from "chalk";
import { DatabaseTypeEnum } from "@gauzy/config";

export class AlterEmployeeTable1666780716428 implements MigrationInterface {

    name = 'AlterEmployeeTable1666780716428';

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
        await queryRunner.query(`ALTER TABLE "employee" ALTER COLUMN "isTrackingEnabled" SET DEFAULT false`);
    }

    /**
    * PostgresDB Down Migration
    *
    * @param queryRunner
    */
    public async postgresDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`ALTER TABLE "employee" ALTER COLUMN "isTrackingEnabled" SET DEFAULT true`);
    }

    /**
    * SqliteDB Up Migration
    *
    * @param queryRunner
    */
    public async sqliteUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`DROP INDEX "IDX_4b3303a6b7eb92d237a4379734"`);
        await queryRunner.query(`DROP INDEX "IDX_c6a48286f3aa8ae903bee0d1e7"`);
        await queryRunner.query(`DROP INDEX "IDX_96dfbcaa2990df01fe5bb39ccc"`);
        await queryRunner.query(`DROP INDEX "IDX_f4b0d329c4a3cf79ffe9d56504"`);
        await queryRunner.query(`DROP INDEX "IDX_1c0c1370ecd98040259625e17e"`);
        await queryRunner.query(`DROP INDEX "IDX_5e719204dcafa8d6b2ecdeda13"`);
        await queryRunner.query(`CREATE TABLE "temporary_employee" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "organizationId" varchar, "valueDate" datetime, "isActive" boolean DEFAULT (1), "short_description" varchar(200), "description" varchar, "startedWorkOn" datetime, "endWork" datetime, "payPeriod" varchar, "billRateValue" integer, "billRateCurrency" varchar, "reWeeklyLimit" integer, "offerDate" datetime, "acceptDate" datetime, "rejectDate" datetime, "employeeLevel" varchar(500), "anonymousBonus" boolean, "averageIncome" numeric, "averageBonus" numeric, "totalWorkHours" numeric DEFAULT (0), "averageExpenses" numeric, "show_anonymous_bonus" boolean, "show_average_bonus" boolean, "show_average_expenses" boolean, "show_average_income" boolean, "show_billrate" boolean, "show_payperiod" boolean, "show_start_work_on" boolean, "isJobSearchActive" boolean, "linkedInUrl" varchar, "facebookUrl" varchar, "instagramUrl" varchar, "twitterUrl" varchar, "githubUrl" varchar, "gitlabUrl" varchar, "upworkUrl" varchar, "stackoverflowUrl" varchar, "isVerified" boolean, "isVetted" boolean, "totalJobs" numeric, "jobSuccess" numeric, "profile_link" varchar, "userId" varchar NOT NULL, "contactId" varchar, "organizationPositionId" varchar, "isTrackingEnabled" boolean DEFAULT (0), CONSTRAINT "REL_f4b0d329c4a3cf79ffe9d56504" UNIQUE ("userId"), CONSTRAINT "REL_1c0c1370ecd98040259625e17e" UNIQUE ("contactId"), CONSTRAINT "FK_4b3303a6b7eb92d237a4379734e" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_c6a48286f3aa8ae903bee0d1e72" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_f4b0d329c4a3cf79ffe9d565047" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_1c0c1370ecd98040259625e17e2" FOREIGN KEY ("contactId") REFERENCES "contact" ("id") ON DELETE SET NULL ON UPDATE NO ACTION, CONSTRAINT "FK_5e719204dcafa8d6b2ecdeda130" FOREIGN KEY ("organizationPositionId") REFERENCES "organization_position" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION)`);
        await queryRunner.query(`INSERT INTO "temporary_employee"("id", "createdAt", "updatedAt", "tenantId", "organizationId", "valueDate", "isActive", "short_description", "description", "startedWorkOn", "endWork", "payPeriod", "billRateValue", "billRateCurrency", "reWeeklyLimit", "offerDate", "acceptDate", "rejectDate", "employeeLevel", "anonymousBonus", "averageIncome", "averageBonus", "totalWorkHours", "averageExpenses", "show_anonymous_bonus", "show_average_bonus", "show_average_expenses", "show_average_income", "show_billrate", "show_payperiod", "show_start_work_on", "isJobSearchActive", "linkedInUrl", "facebookUrl", "instagramUrl", "twitterUrl", "githubUrl", "gitlabUrl", "upworkUrl", "stackoverflowUrl", "isVerified", "isVetted", "totalJobs", "jobSuccess", "profile_link", "userId", "contactId", "organizationPositionId", "isTrackingEnabled") SELECT "id", "createdAt", "updatedAt", "tenantId", "organizationId", "valueDate", "isActive", "short_description", "description", "startedWorkOn", "endWork", "payPeriod", "billRateValue", "billRateCurrency", "reWeeklyLimit", "offerDate", "acceptDate", "rejectDate", "employeeLevel", "anonymousBonus", "averageIncome", "averageBonus", "totalWorkHours", "averageExpenses", "show_anonymous_bonus", "show_average_bonus", "show_average_expenses", "show_average_income", "show_billrate", "show_payperiod", "show_start_work_on", "isJobSearchActive", "linkedInUrl", "facebookUrl", "instagramUrl", "twitterUrl", "githubUrl", "gitlabUrl", "upworkUrl", "stackoverflowUrl", "isVerified", "isVetted", "totalJobs", "jobSuccess", "profile_link", "userId", "contactId", "organizationPositionId", "isTrackingEnabled" FROM "employee"`);
        await queryRunner.query(`DROP TABLE "employee"`);
        await queryRunner.query(`ALTER TABLE "temporary_employee" RENAME TO "employee"`);
        await queryRunner.query(`CREATE INDEX "IDX_4b3303a6b7eb92d237a4379734" ON "employee" ("tenantId") `);
        await queryRunner.query(`CREATE INDEX "IDX_c6a48286f3aa8ae903bee0d1e7" ON "employee" ("organizationId") `);
        await queryRunner.query(`CREATE INDEX "IDX_96dfbcaa2990df01fe5bb39ccc" ON "employee" ("profile_link") `);
        await queryRunner.query(`CREATE INDEX "IDX_f4b0d329c4a3cf79ffe9d56504" ON "employee" ("userId") `);
        await queryRunner.query(`CREATE INDEX "IDX_1c0c1370ecd98040259625e17e" ON "employee" ("contactId") `);
        await queryRunner.query(`CREATE INDEX "IDX_5e719204dcafa8d6b2ecdeda13" ON "employee" ("organizationPositionId") `);
    }

    /**
    * SqliteDB Down Migration
    *
    * @param queryRunner
    */
    public async sqliteDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`DROP INDEX "IDX_5e719204dcafa8d6b2ecdeda13"`);
        await queryRunner.query(`DROP INDEX "IDX_1c0c1370ecd98040259625e17e"`);
        await queryRunner.query(`DROP INDEX "IDX_f4b0d329c4a3cf79ffe9d56504"`);
        await queryRunner.query(`DROP INDEX "IDX_96dfbcaa2990df01fe5bb39ccc"`);
        await queryRunner.query(`DROP INDEX "IDX_c6a48286f3aa8ae903bee0d1e7"`);
        await queryRunner.query(`DROP INDEX "IDX_4b3303a6b7eb92d237a4379734"`);
        await queryRunner.query(`ALTER TABLE "employee" RENAME TO "temporary_employee"`);
        await queryRunner.query(`CREATE TABLE "employee" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "organizationId" varchar, "valueDate" datetime, "isActive" boolean DEFAULT (1), "short_description" varchar(200), "description" varchar, "startedWorkOn" datetime, "endWork" datetime, "payPeriod" varchar, "billRateValue" integer, "billRateCurrency" varchar, "reWeeklyLimit" integer, "offerDate" datetime, "acceptDate" datetime, "rejectDate" datetime, "employeeLevel" varchar(500), "anonymousBonus" boolean, "averageIncome" numeric, "averageBonus" numeric, "totalWorkHours" numeric DEFAULT (0), "averageExpenses" numeric, "show_anonymous_bonus" boolean, "show_average_bonus" boolean, "show_average_expenses" boolean, "show_average_income" boolean, "show_billrate" boolean, "show_payperiod" boolean, "show_start_work_on" boolean, "isJobSearchActive" boolean, "linkedInUrl" varchar, "facebookUrl" varchar, "instagramUrl" varchar, "twitterUrl" varchar, "githubUrl" varchar, "gitlabUrl" varchar, "upworkUrl" varchar, "stackoverflowUrl" varchar, "isVerified" boolean, "isVetted" boolean, "totalJobs" numeric, "jobSuccess" numeric, "profile_link" varchar, "userId" varchar NOT NULL, "contactId" varchar, "organizationPositionId" varchar, "isTrackingEnabled" boolean DEFAULT (1), CONSTRAINT "REL_f4b0d329c4a3cf79ffe9d56504" UNIQUE ("userId"), CONSTRAINT "REL_1c0c1370ecd98040259625e17e" UNIQUE ("contactId"), CONSTRAINT "FK_4b3303a6b7eb92d237a4379734e" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_c6a48286f3aa8ae903bee0d1e72" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_f4b0d329c4a3cf79ffe9d565047" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_1c0c1370ecd98040259625e17e2" FOREIGN KEY ("contactId") REFERENCES "contact" ("id") ON DELETE SET NULL ON UPDATE NO ACTION, CONSTRAINT "FK_5e719204dcafa8d6b2ecdeda130" FOREIGN KEY ("organizationPositionId") REFERENCES "organization_position" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION)`);
        await queryRunner.query(`INSERT INTO "employee"("id", "createdAt", "updatedAt", "tenantId", "organizationId", "valueDate", "isActive", "short_description", "description", "startedWorkOn", "endWork", "payPeriod", "billRateValue", "billRateCurrency", "reWeeklyLimit", "offerDate", "acceptDate", "rejectDate", "employeeLevel", "anonymousBonus", "averageIncome", "averageBonus", "totalWorkHours", "averageExpenses", "show_anonymous_bonus", "show_average_bonus", "show_average_expenses", "show_average_income", "show_billrate", "show_payperiod", "show_start_work_on", "isJobSearchActive", "linkedInUrl", "facebookUrl", "instagramUrl", "twitterUrl", "githubUrl", "gitlabUrl", "upworkUrl", "stackoverflowUrl", "isVerified", "isVetted", "totalJobs", "jobSuccess", "profile_link", "userId", "contactId", "organizationPositionId", "isTrackingEnabled") SELECT "id", "createdAt", "updatedAt", "tenantId", "organizationId", "valueDate", "isActive", "short_description", "description", "startedWorkOn", "endWork", "payPeriod", "billRateValue", "billRateCurrency", "reWeeklyLimit", "offerDate", "acceptDate", "rejectDate", "employeeLevel", "anonymousBonus", "averageIncome", "averageBonus", "totalWorkHours", "averageExpenses", "show_anonymous_bonus", "show_average_bonus", "show_average_expenses", "show_average_income", "show_billrate", "show_payperiod", "show_start_work_on", "isJobSearchActive", "linkedInUrl", "facebookUrl", "instagramUrl", "twitterUrl", "githubUrl", "gitlabUrl", "upworkUrl", "stackoverflowUrl", "isVerified", "isVetted", "totalJobs", "jobSuccess", "profile_link", "userId", "contactId", "organizationPositionId", "isTrackingEnabled" FROM "temporary_employee"`);
        await queryRunner.query(`DROP TABLE "temporary_employee"`);
        await queryRunner.query(`CREATE INDEX "IDX_5e719204dcafa8d6b2ecdeda13" ON "employee" ("organizationPositionId") `);
        await queryRunner.query(`CREATE INDEX "IDX_1c0c1370ecd98040259625e17e" ON "employee" ("contactId") `);
        await queryRunner.query(`CREATE INDEX "IDX_f4b0d329c4a3cf79ffe9d56504" ON "employee" ("userId") `);
        await queryRunner.query(`CREATE INDEX "IDX_96dfbcaa2990df01fe5bb39ccc" ON "employee" ("profile_link") `);
        await queryRunner.query(`CREATE INDEX "IDX_c6a48286f3aa8ae903bee0d1e7" ON "employee" ("organizationId") `);
        await queryRunner.query(`CREATE INDEX "IDX_4b3303a6b7eb92d237a4379734" ON "employee" ("tenantId") `);
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
