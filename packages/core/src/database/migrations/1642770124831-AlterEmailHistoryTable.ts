import { MigrationInterface, QueryRunner } from "typeorm";
import * as chalk from "chalk";
import { DatabaseTypeEnum } from "@gauzy/config";

export class AlterEmailHistoryTable1642770124831 implements MigrationInterface {

    name = 'AlterEmailHistoryTable1642770124831';

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
        await queryRunner.query(`ALTER TABLE "email_sent" ALTER COLUMN "name" DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "email_sent" ALTER COLUMN "content" DROP NOT NULL`);
        await queryRunner.query(`CREATE INDEX "IDX_a954fda57cca81dc48446e73b8" ON "email_sent" ("email") `);
    }

    /**
     * PostgresDB Down Migration
     *
     * @param queryRunner
     */
    public async postgresDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`DROP INDEX "public"."IDX_a954fda57cca81dc48446e73b8"`);
        await queryRunner.query(`ALTER TABLE "email_sent" ALTER COLUMN "content" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "email_sent" ALTER COLUMN "name" SET NOT NULL`);
    }

    /**
     * SqliteDB Up Migration
     *
     * @param queryRunner
     */
    public async sqliteUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`DROP INDEX "IDX_5e719204dcafa8d6b2ecdeda13"`);
        await queryRunner.query(`DROP INDEX "IDX_1c0c1370ecd98040259625e17e"`);
        await queryRunner.query(`DROP INDEX "IDX_f4b0d329c4a3cf79ffe9d56504"`);
        await queryRunner.query(`DROP INDEX "IDX_96dfbcaa2990df01fe5bb39ccc"`);
        await queryRunner.query(`DROP INDEX "IDX_c6a48286f3aa8ae903bee0d1e7"`);
        await queryRunner.query(`DROP INDEX "IDX_4b3303a6b7eb92d237a4379734"`);
        await queryRunner.query(`CREATE TABLE "temporary_employee" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "organizationId" varchar, "valueDate" datetime, "isActive" boolean DEFAULT (1), "short_description" varchar(200), "description" varchar, "startedWorkOn" datetime, "endWork" datetime, "payPeriod" varchar, "billRateValue" numeric, "billRateCurrency" varchar, "reWeeklyLimit" integer, "offerDate" datetime, "acceptDate" datetime, "rejectDate" datetime, "employeeLevel" varchar(500), "anonymousBonus" boolean, "averageIncome" numeric, "averageBonus" numeric, "totalWorkHours" numeric NOT NULL DEFAULT (0), "averageExpenses" numeric, "show_anonymous_bonus" boolean, "show_average_bonus" boolean, "show_average_expenses" boolean, "show_average_income" boolean, "show_billrate" boolean, "show_payperiod" boolean, "show_start_work_on" boolean, "isJobSearchActive" boolean, "linkedInUrl" varchar, "facebookUrl" varchar, "instagramUrl" varchar, "twitterUrl" varchar, "githubUrl" varchar, "gitlabUrl" varchar, "upworkUrl" varchar, "stackoverflowUrl" varchar, "isVerified" boolean, "isVetted" boolean, "totalJobs" numeric, "jobSuccess" numeric, "profile_link" varchar, "userId" varchar NOT NULL, "contactId" varchar, "organizationPositionId" varchar, CONSTRAINT "REL_1c0c1370ecd98040259625e17e" UNIQUE ("contactId"), CONSTRAINT "REL_f4b0d329c4a3cf79ffe9d56504" UNIQUE ("userId"), CONSTRAINT "FK_5e719204dcafa8d6b2ecdeda130" FOREIGN KEY ("organizationPositionId") REFERENCES "organization_position" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION, CONSTRAINT "FK_1c0c1370ecd98040259625e17e2" FOREIGN KEY ("contactId") REFERENCES "contact" ("id") ON DELETE SET NULL ON UPDATE NO ACTION, CONSTRAINT "FK_f4b0d329c4a3cf79ffe9d565047" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_c6a48286f3aa8ae903bee0d1e72" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_4b3303a6b7eb92d237a4379734e" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`);
        await queryRunner.query(`INSERT INTO "temporary_employee"("id", "createdAt", "updatedAt", "tenantId", "organizationId", "valueDate", "isActive", "short_description", "description", "startedWorkOn", "endWork", "payPeriod", "billRateValue", "billRateCurrency", "reWeeklyLimit", "offerDate", "acceptDate", "rejectDate", "employeeLevel", "anonymousBonus", "averageIncome", "averageBonus", "totalWorkHours", "averageExpenses", "show_anonymous_bonus", "show_average_bonus", "show_average_expenses", "show_average_income", "show_billrate", "show_payperiod", "show_start_work_on", "isJobSearchActive", "linkedInUrl", "facebookUrl", "instagramUrl", "twitterUrl", "githubUrl", "gitlabUrl", "upworkUrl", "stackoverflowUrl", "isVerified", "isVetted", "totalJobs", "jobSuccess", "profile_link", "userId", "contactId", "organizationPositionId") SELECT "id", "createdAt", "updatedAt", "tenantId", "organizationId", "valueDate", "isActive", "short_description", "description", "startedWorkOn", "endWork", "payPeriod", "billRateValue", "billRateCurrency", "reWeeklyLimit", "offerDate", "acceptDate", "rejectDate", "employeeLevel", "anonymousBonus", "averageIncome", "averageBonus", "totalWorkHours", "averageExpenses", "show_anonymous_bonus", "show_average_bonus", "show_average_expenses", "show_average_income", "show_billrate", "show_payperiod", "show_start_work_on", "isJobSearchActive", "linkedInUrl", "facebookUrl", "instagramUrl", "twitterUrl", "githubUrl", "gitlabUrl", "upworkUrl", "stackoverflowUrl", "isVerified", "isVetted", "totalJobs", "jobSuccess", "profile_link", "userId", "contactId", "organizationPositionId" FROM "employee"`);
        await queryRunner.query(`DROP TABLE "employee"`);
        await queryRunner.query(`ALTER TABLE "temporary_employee" RENAME TO "employee"`);
        await queryRunner.query(`CREATE INDEX "IDX_5e719204dcafa8d6b2ecdeda13" ON "employee" ("organizationPositionId") `);
        await queryRunner.query(`CREATE INDEX "IDX_1c0c1370ecd98040259625e17e" ON "employee" ("contactId") `);
        await queryRunner.query(`CREATE INDEX "IDX_f4b0d329c4a3cf79ffe9d56504" ON "employee" ("userId") `);
        await queryRunner.query(`CREATE INDEX "IDX_96dfbcaa2990df01fe5bb39ccc" ON "employee" ("profile_link") `);
        await queryRunner.query(`CREATE INDEX "IDX_c6a48286f3aa8ae903bee0d1e7" ON "employee" ("organizationId") `);
        await queryRunner.query(`CREATE INDEX "IDX_4b3303a6b7eb92d237a4379734" ON "employee" ("tenantId") `);
        await queryRunner.query(`DROP INDEX "IDX_7719d73cd16a9f57ecc6ac24b3"`);
        await queryRunner.query(`DROP INDEX "IDX_60468af1ce34043a900809c84f"`);
        await queryRunner.query(`CREATE TABLE "temporary_contact" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "organizationId" varchar, "name" varchar, "firstName" varchar, "lastName" varchar, "country" varchar, "city" varchar, "address" varchar, "address2" varchar, "postcode" varchar, "latitude" float, "longitude" float, "regionCode" varchar, "fax" varchar, "fiscalInformation" varchar, "website" varchar, CONSTRAINT "FK_7719d73cd16a9f57ecc6ac24b3d" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_60468af1ce34043a900809c84f2" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`);
        await queryRunner.query(`INSERT INTO "temporary_contact"("id", "createdAt", "updatedAt", "tenantId", "organizationId", "name", "firstName", "lastName", "country", "city", "address", "address2", "postcode", "latitude", "longitude", "regionCode", "fax", "fiscalInformation", "website") SELECT "id", "createdAt", "updatedAt", "tenantId", "organizationId", "name", "firstName", "lastName", "country", "city", "address", "address2", "postcode", "latitude", "longitude", "regionCode", "fax", "fiscalInformation", "website" FROM "contact"`);
        await queryRunner.query(`DROP TABLE "contact"`);
        await queryRunner.query(`ALTER TABLE "temporary_contact" RENAME TO "contact"`);
        await queryRunner.query(`CREATE INDEX "IDX_7719d73cd16a9f57ecc6ac24b3" ON "contact" ("organizationId") `);
        await queryRunner.query(`CREATE INDEX "IDX_60468af1ce34043a900809c84f" ON "contact" ("tenantId") `);
        await queryRunner.query(`DROP INDEX "IDX_1261c457b3035b77719556995b"`);
        await queryRunner.query(`DROP INDEX "IDX_953df0eb0df3035baf140399f6"`);
        await queryRunner.query(`DROP INDEX "IDX_525f4873c6edc3d94559f88900"`);
        await queryRunner.query(`DROP INDEX "IDX_0af511c44de7a16beb45cc3785"`);
        await queryRunner.query(`CREATE TABLE "temporary_email_sent" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "organizationId" varchar, "name" varchar, "content" varchar, "email" varchar NOT NULL, "isArchived" boolean, "userId" varchar, "emailTemplateId" varchar NOT NULL, CONSTRAINT "FK_9033faf41b23c61ba201c487969" FOREIGN KEY ("emailTemplateId") REFERENCES "email_template" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_1261c457b3035b77719556995bf" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_525f4873c6edc3d94559f88900c" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_0af511c44de7a16beb45cc37852" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`);
        await queryRunner.query(`INSERT INTO "temporary_email_sent"("id", "createdAt", "updatedAt", "tenantId", "organizationId", "name", "content", "email", "isArchived", "userId", "emailTemplateId") SELECT "id", "createdAt", "updatedAt", "tenantId", "organizationId", "name", "content", "email", "isArchived", "userId", "emailTemplateId" FROM "email_sent"`);
        await queryRunner.query(`DROP TABLE "email_sent"`);
        await queryRunner.query(`ALTER TABLE "temporary_email_sent" RENAME TO "email_sent"`);
        await queryRunner.query(`CREATE INDEX "IDX_1261c457b3035b77719556995b" ON "email_sent" ("userId") `);
        await queryRunner.query(`CREATE INDEX "IDX_953df0eb0df3035baf140399f6" ON "email_sent" ("name") `);
        await queryRunner.query(`CREATE INDEX "IDX_525f4873c6edc3d94559f88900" ON "email_sent" ("organizationId") `);
        await queryRunner.query(`CREATE INDEX "IDX_0af511c44de7a16beb45cc3785" ON "email_sent" ("tenantId") `);
        await queryRunner.query(`DROP INDEX "IDX_5e719204dcafa8d6b2ecdeda13"`);
        await queryRunner.query(`DROP INDEX "IDX_1c0c1370ecd98040259625e17e"`);
        await queryRunner.query(`DROP INDEX "IDX_f4b0d329c4a3cf79ffe9d56504"`);
        await queryRunner.query(`DROP INDEX "IDX_96dfbcaa2990df01fe5bb39ccc"`);
        await queryRunner.query(`DROP INDEX "IDX_c6a48286f3aa8ae903bee0d1e7"`);
        await queryRunner.query(`DROP INDEX "IDX_4b3303a6b7eb92d237a4379734"`);
        await queryRunner.query(`CREATE TABLE "temporary_employee" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "organizationId" varchar, "valueDate" datetime, "isActive" boolean DEFAULT (1), "short_description" varchar(200), "description" varchar, "startedWorkOn" datetime, "endWork" datetime, "payPeriod" varchar, "billRateValue" integer, "billRateCurrency" varchar, "reWeeklyLimit" integer, "offerDate" datetime, "acceptDate" datetime, "rejectDate" datetime, "employeeLevel" varchar(500), "anonymousBonus" boolean, "averageIncome" numeric, "averageBonus" numeric, "totalWorkHours" numeric NOT NULL DEFAULT (0), "averageExpenses" numeric, "show_anonymous_bonus" boolean, "show_average_bonus" boolean, "show_average_expenses" boolean, "show_average_income" boolean, "show_billrate" boolean, "show_payperiod" boolean, "show_start_work_on" boolean, "isJobSearchActive" boolean, "linkedInUrl" varchar, "facebookUrl" varchar, "instagramUrl" varchar, "twitterUrl" varchar, "githubUrl" varchar, "gitlabUrl" varchar, "upworkUrl" varchar, "stackoverflowUrl" varchar, "isVerified" boolean, "isVetted" boolean, "totalJobs" numeric, "jobSuccess" numeric, "profile_link" varchar, "userId" varchar NOT NULL, "contactId" varchar, "organizationPositionId" varchar, CONSTRAINT "REL_1c0c1370ecd98040259625e17e" UNIQUE ("contactId"), CONSTRAINT "REL_f4b0d329c4a3cf79ffe9d56504" UNIQUE ("userId"), CONSTRAINT "FK_5e719204dcafa8d6b2ecdeda130" FOREIGN KEY ("organizationPositionId") REFERENCES "organization_position" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION, CONSTRAINT "FK_1c0c1370ecd98040259625e17e2" FOREIGN KEY ("contactId") REFERENCES "contact" ("id") ON DELETE SET NULL ON UPDATE NO ACTION, CONSTRAINT "FK_f4b0d329c4a3cf79ffe9d565047" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_c6a48286f3aa8ae903bee0d1e72" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_4b3303a6b7eb92d237a4379734e" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`);
        await queryRunner.query(`INSERT INTO "temporary_employee"("id", "createdAt", "updatedAt", "tenantId", "organizationId", "valueDate", "isActive", "short_description", "description", "startedWorkOn", "endWork", "payPeriod", "billRateValue", "billRateCurrency", "reWeeklyLimit", "offerDate", "acceptDate", "rejectDate", "employeeLevel", "anonymousBonus", "averageIncome", "averageBonus", "totalWorkHours", "averageExpenses", "show_anonymous_bonus", "show_average_bonus", "show_average_expenses", "show_average_income", "show_billrate", "show_payperiod", "show_start_work_on", "isJobSearchActive", "linkedInUrl", "facebookUrl", "instagramUrl", "twitterUrl", "githubUrl", "gitlabUrl", "upworkUrl", "stackoverflowUrl", "isVerified", "isVetted", "totalJobs", "jobSuccess", "profile_link", "userId", "contactId", "organizationPositionId") SELECT "id", "createdAt", "updatedAt", "tenantId", "organizationId", "valueDate", "isActive", "short_description", "description", "startedWorkOn", "endWork", "payPeriod", "billRateValue", "billRateCurrency", "reWeeklyLimit", "offerDate", "acceptDate", "rejectDate", "employeeLevel", "anonymousBonus", "averageIncome", "averageBonus", "totalWorkHours", "averageExpenses", "show_anonymous_bonus", "show_average_bonus", "show_average_expenses", "show_average_income", "show_billrate", "show_payperiod", "show_start_work_on", "isJobSearchActive", "linkedInUrl", "facebookUrl", "instagramUrl", "twitterUrl", "githubUrl", "gitlabUrl", "upworkUrl", "stackoverflowUrl", "isVerified", "isVetted", "totalJobs", "jobSuccess", "profile_link", "userId", "contactId", "organizationPositionId" FROM "employee"`);
        await queryRunner.query(`DROP TABLE "employee"`);
        await queryRunner.query(`ALTER TABLE "temporary_employee" RENAME TO "employee"`);
        await queryRunner.query(`CREATE INDEX "IDX_5e719204dcafa8d6b2ecdeda13" ON "employee" ("organizationPositionId") `);
        await queryRunner.query(`CREATE INDEX "IDX_1c0c1370ecd98040259625e17e" ON "employee" ("contactId") `);
        await queryRunner.query(`CREATE INDEX "IDX_f4b0d329c4a3cf79ffe9d56504" ON "employee" ("userId") `);
        await queryRunner.query(`CREATE INDEX "IDX_96dfbcaa2990df01fe5bb39ccc" ON "employee" ("profile_link") `);
        await queryRunner.query(`CREATE INDEX "IDX_c6a48286f3aa8ae903bee0d1e7" ON "employee" ("organizationId") `);
        await queryRunner.query(`CREATE INDEX "IDX_4b3303a6b7eb92d237a4379734" ON "employee" ("tenantId") `);
        await queryRunner.query(`CREATE INDEX "IDX_a954fda57cca81dc48446e73b8" ON "email_sent" ("email") `);
    }

    /**
     * SqliteDB Down Migration
     *
     * @param queryRunner
     */
    public async sqliteDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`DROP INDEX "IDX_a954fda57cca81dc48446e73b8"`);
        await queryRunner.query(`DROP INDEX "IDX_4b3303a6b7eb92d237a4379734"`);
        await queryRunner.query(`DROP INDEX "IDX_c6a48286f3aa8ae903bee0d1e7"`);
        await queryRunner.query(`DROP INDEX "IDX_96dfbcaa2990df01fe5bb39ccc"`);
        await queryRunner.query(`DROP INDEX "IDX_f4b0d329c4a3cf79ffe9d56504"`);
        await queryRunner.query(`DROP INDEX "IDX_1c0c1370ecd98040259625e17e"`);
        await queryRunner.query(`DROP INDEX "IDX_5e719204dcafa8d6b2ecdeda13"`);
        await queryRunner.query(`ALTER TABLE "employee" RENAME TO "temporary_employee"`);
        await queryRunner.query(`CREATE TABLE "employee" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "organizationId" varchar, "valueDate" datetime, "isActive" boolean DEFAULT (1), "short_description" varchar(200), "description" varchar, "startedWorkOn" datetime, "endWork" datetime, "payPeriod" varchar, "billRateValue" numeric, "billRateCurrency" varchar, "reWeeklyLimit" integer, "offerDate" datetime, "acceptDate" datetime, "rejectDate" datetime, "employeeLevel" varchar(500), "anonymousBonus" boolean, "averageIncome" numeric, "averageBonus" numeric, "totalWorkHours" numeric NOT NULL DEFAULT (0), "averageExpenses" numeric, "show_anonymous_bonus" boolean, "show_average_bonus" boolean, "show_average_expenses" boolean, "show_average_income" boolean, "show_billrate" boolean, "show_payperiod" boolean, "show_start_work_on" boolean, "isJobSearchActive" boolean, "linkedInUrl" varchar, "facebookUrl" varchar, "instagramUrl" varchar, "twitterUrl" varchar, "githubUrl" varchar, "gitlabUrl" varchar, "upworkUrl" varchar, "stackoverflowUrl" varchar, "isVerified" boolean, "isVetted" boolean, "totalJobs" numeric, "jobSuccess" numeric, "profile_link" varchar, "userId" varchar NOT NULL, "contactId" varchar, "organizationPositionId" varchar, CONSTRAINT "REL_1c0c1370ecd98040259625e17e" UNIQUE ("contactId"), CONSTRAINT "REL_f4b0d329c4a3cf79ffe9d56504" UNIQUE ("userId"), CONSTRAINT "FK_5e719204dcafa8d6b2ecdeda130" FOREIGN KEY ("organizationPositionId") REFERENCES "organization_position" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION, CONSTRAINT "FK_1c0c1370ecd98040259625e17e2" FOREIGN KEY ("contactId") REFERENCES "contact" ("id") ON DELETE SET NULL ON UPDATE NO ACTION, CONSTRAINT "FK_f4b0d329c4a3cf79ffe9d565047" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_c6a48286f3aa8ae903bee0d1e72" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_4b3303a6b7eb92d237a4379734e" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`);
        await queryRunner.query(`INSERT INTO "employee"("id", "createdAt", "updatedAt", "tenantId", "organizationId", "valueDate", "isActive", "short_description", "description", "startedWorkOn", "endWork", "payPeriod", "billRateValue", "billRateCurrency", "reWeeklyLimit", "offerDate", "acceptDate", "rejectDate", "employeeLevel", "anonymousBonus", "averageIncome", "averageBonus", "totalWorkHours", "averageExpenses", "show_anonymous_bonus", "show_average_bonus", "show_average_expenses", "show_average_income", "show_billrate", "show_payperiod", "show_start_work_on", "isJobSearchActive", "linkedInUrl", "facebookUrl", "instagramUrl", "twitterUrl", "githubUrl", "gitlabUrl", "upworkUrl", "stackoverflowUrl", "isVerified", "isVetted", "totalJobs", "jobSuccess", "profile_link", "userId", "contactId", "organizationPositionId") SELECT "id", "createdAt", "updatedAt", "tenantId", "organizationId", "valueDate", "isActive", "short_description", "description", "startedWorkOn", "endWork", "payPeriod", "billRateValue", "billRateCurrency", "reWeeklyLimit", "offerDate", "acceptDate", "rejectDate", "employeeLevel", "anonymousBonus", "averageIncome", "averageBonus", "totalWorkHours", "averageExpenses", "show_anonymous_bonus", "show_average_bonus", "show_average_expenses", "show_average_income", "show_billrate", "show_payperiod", "show_start_work_on", "isJobSearchActive", "linkedInUrl", "facebookUrl", "instagramUrl", "twitterUrl", "githubUrl", "gitlabUrl", "upworkUrl", "stackoverflowUrl", "isVerified", "isVetted", "totalJobs", "jobSuccess", "profile_link", "userId", "contactId", "organizationPositionId" FROM "temporary_employee"`);
        await queryRunner.query(`DROP TABLE "temporary_employee"`);
        await queryRunner.query(`CREATE INDEX "IDX_4b3303a6b7eb92d237a4379734" ON "employee" ("tenantId") `);
        await queryRunner.query(`CREATE INDEX "IDX_c6a48286f3aa8ae903bee0d1e7" ON "employee" ("organizationId") `);
        await queryRunner.query(`CREATE INDEX "IDX_96dfbcaa2990df01fe5bb39ccc" ON "employee" ("profile_link") `);
        await queryRunner.query(`CREATE INDEX "IDX_f4b0d329c4a3cf79ffe9d56504" ON "employee" ("userId") `);
        await queryRunner.query(`CREATE INDEX "IDX_1c0c1370ecd98040259625e17e" ON "employee" ("contactId") `);
        await queryRunner.query(`CREATE INDEX "IDX_5e719204dcafa8d6b2ecdeda13" ON "employee" ("organizationPositionId") `);
        await queryRunner.query(`DROP INDEX "IDX_0af511c44de7a16beb45cc3785"`);
        await queryRunner.query(`DROP INDEX "IDX_525f4873c6edc3d94559f88900"`);
        await queryRunner.query(`DROP INDEX "IDX_953df0eb0df3035baf140399f6"`);
        await queryRunner.query(`DROP INDEX "IDX_1261c457b3035b77719556995b"`);
        await queryRunner.query(`ALTER TABLE "email_sent" RENAME TO "temporary_email_sent"`);
        await queryRunner.query(`CREATE TABLE "email_sent" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "organizationId" varchar, "name" varchar NOT NULL, "content" varchar NOT NULL, "email" varchar NOT NULL, "isArchived" boolean, "userId" varchar, "emailTemplateId" varchar NOT NULL, CONSTRAINT "FK_9033faf41b23c61ba201c487969" FOREIGN KEY ("emailTemplateId") REFERENCES "email_template" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_1261c457b3035b77719556995bf" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_525f4873c6edc3d94559f88900c" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_0af511c44de7a16beb45cc37852" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`);
        await queryRunner.query(`INSERT INTO "email_sent"("id", "createdAt", "updatedAt", "tenantId", "organizationId", "name", "content", "email", "isArchived", "userId", "emailTemplateId") SELECT "id", "createdAt", "updatedAt", "tenantId", "organizationId", "name", "content", "email", "isArchived", "userId", "emailTemplateId" FROM "temporary_email_sent"`);
        await queryRunner.query(`DROP TABLE "temporary_email_sent"`);
        await queryRunner.query(`CREATE INDEX "IDX_0af511c44de7a16beb45cc3785" ON "email_sent" ("tenantId") `);
        await queryRunner.query(`CREATE INDEX "IDX_525f4873c6edc3d94559f88900" ON "email_sent" ("organizationId") `);
        await queryRunner.query(`CREATE INDEX "IDX_953df0eb0df3035baf140399f6" ON "email_sent" ("name") `);
        await queryRunner.query(`CREATE INDEX "IDX_1261c457b3035b77719556995b" ON "email_sent" ("userId") `);
        await queryRunner.query(`DROP INDEX "IDX_60468af1ce34043a900809c84f"`);
        await queryRunner.query(`DROP INDEX "IDX_7719d73cd16a9f57ecc6ac24b3"`);
        await queryRunner.query(`ALTER TABLE "contact" RENAME TO "temporary_contact"`);
        await queryRunner.query(`CREATE TABLE "contact" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "organizationId" varchar, "name" varchar, "firstName" varchar, "lastName" varchar, "country" varchar, "city" varchar, "address" varchar, "address2" varchar, "postcode" varchar, "latitude" float, "longitude" float, "regionCode" varchar, "fax" varchar, "fiscalInformation" varchar, "website" varchar, CONSTRAINT "FK_7719d73cd16a9f57ecc6ac24b3d" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_60468af1ce34043a900809c84f2" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`);
        await queryRunner.query(`INSERT INTO "contact"("id", "createdAt", "updatedAt", "tenantId", "organizationId", "name", "firstName", "lastName", "country", "city", "address", "address2", "postcode", "latitude", "longitude", "regionCode", "fax", "fiscalInformation", "website") SELECT "id", "createdAt", "updatedAt", "tenantId", "organizationId", "name", "firstName", "lastName", "country", "city", "address", "address2", "postcode", "latitude", "longitude", "regionCode", "fax", "fiscalInformation", "website" FROM "temporary_contact"`);
        await queryRunner.query(`DROP TABLE "temporary_contact"`);
        await queryRunner.query(`CREATE INDEX "IDX_60468af1ce34043a900809c84f" ON "contact" ("tenantId") `);
        await queryRunner.query(`CREATE INDEX "IDX_7719d73cd16a9f57ecc6ac24b3" ON "contact" ("organizationId") `);
        await queryRunner.query(`DROP INDEX "IDX_4b3303a6b7eb92d237a4379734"`);
        await queryRunner.query(`DROP INDEX "IDX_c6a48286f3aa8ae903bee0d1e7"`);
        await queryRunner.query(`DROP INDEX "IDX_96dfbcaa2990df01fe5bb39ccc"`);
        await queryRunner.query(`DROP INDEX "IDX_f4b0d329c4a3cf79ffe9d56504"`);
        await queryRunner.query(`DROP INDEX "IDX_1c0c1370ecd98040259625e17e"`);
        await queryRunner.query(`DROP INDEX "IDX_5e719204dcafa8d6b2ecdeda13"`);
        await queryRunner.query(`ALTER TABLE "employee" RENAME TO "temporary_employee"`);
        await queryRunner.query(`CREATE TABLE "employee" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "organizationId" varchar, "valueDate" datetime, "isActive" boolean DEFAULT (1), "short_description" varchar(200), "description" varchar, "startedWorkOn" datetime, "endWork" datetime, "payPeriod" varchar, "billRateValue" numeric, "billRateCurrency" varchar, "reWeeklyLimit" integer, "offerDate" datetime, "acceptDate" datetime, "rejectDate" datetime, "employeeLevel" varchar(500), "anonymousBonus" boolean, "averageIncome" numeric, "averageBonus" numeric, "totalWorkHours" numeric NOT NULL DEFAULT (0), "averageExpenses" numeric, "show_anonymous_bonus" boolean, "show_average_bonus" boolean, "show_average_expenses" boolean, "show_average_income" boolean, "show_billrate" boolean, "show_payperiod" boolean, "show_start_work_on" boolean, "isJobSearchActive" boolean, "linkedInUrl" varchar, "facebookUrl" varchar, "instagramUrl" varchar, "twitterUrl" varchar, "githubUrl" varchar, "gitlabUrl" varchar, "upworkUrl" varchar, "stackoverflowUrl" varchar, "isVerified" boolean, "isVetted" boolean, "totalJobs" numeric, "jobSuccess" numeric, "profile_link" varchar, "userId" varchar NOT NULL, "contactId" varchar, "organizationPositionId" varchar, CONSTRAINT "REL_1c0c1370ecd98040259625e17e" UNIQUE ("contactId"), CONSTRAINT "REL_f4b0d329c4a3cf79ffe9d56504" UNIQUE ("userId"), CONSTRAINT "FK_5e719204dcafa8d6b2ecdeda130" FOREIGN KEY ("organizationPositionId") REFERENCES "organization_position" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION, CONSTRAINT "FK_1c0c1370ecd98040259625e17e2" FOREIGN KEY ("contactId") REFERENCES "contact" ("id") ON DELETE SET NULL ON UPDATE NO ACTION, CONSTRAINT "FK_f4b0d329c4a3cf79ffe9d565047" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_c6a48286f3aa8ae903bee0d1e72" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_4b3303a6b7eb92d237a4379734e" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`);
        await queryRunner.query(`INSERT INTO "employee"("id", "createdAt", "updatedAt", "tenantId", "organizationId", "valueDate", "isActive", "short_description", "description", "startedWorkOn", "endWork", "payPeriod", "billRateValue", "billRateCurrency", "reWeeklyLimit", "offerDate", "acceptDate", "rejectDate", "employeeLevel", "anonymousBonus", "averageIncome", "averageBonus", "totalWorkHours", "averageExpenses", "show_anonymous_bonus", "show_average_bonus", "show_average_expenses", "show_average_income", "show_billrate", "show_payperiod", "show_start_work_on", "isJobSearchActive", "linkedInUrl", "facebookUrl", "instagramUrl", "twitterUrl", "githubUrl", "gitlabUrl", "upworkUrl", "stackoverflowUrl", "isVerified", "isVetted", "totalJobs", "jobSuccess", "profile_link", "userId", "contactId", "organizationPositionId") SELECT "id", "createdAt", "updatedAt", "tenantId", "organizationId", "valueDate", "isActive", "short_description", "description", "startedWorkOn", "endWork", "payPeriod", "billRateValue", "billRateCurrency", "reWeeklyLimit", "offerDate", "acceptDate", "rejectDate", "employeeLevel", "anonymousBonus", "averageIncome", "averageBonus", "totalWorkHours", "averageExpenses", "show_anonymous_bonus", "show_average_bonus", "show_average_expenses", "show_average_income", "show_billrate", "show_payperiod", "show_start_work_on", "isJobSearchActive", "linkedInUrl", "facebookUrl", "instagramUrl", "twitterUrl", "githubUrl", "gitlabUrl", "upworkUrl", "stackoverflowUrl", "isVerified", "isVetted", "totalJobs", "jobSuccess", "profile_link", "userId", "contactId", "organizationPositionId" FROM "temporary_employee"`);
        await queryRunner.query(`DROP TABLE "temporary_employee"`);
        await queryRunner.query(`CREATE INDEX "IDX_4b3303a6b7eb92d237a4379734" ON "employee" ("tenantId") `);
        await queryRunner.query(`CREATE INDEX "IDX_c6a48286f3aa8ae903bee0d1e7" ON "employee" ("organizationId") `);
        await queryRunner.query(`CREATE INDEX "IDX_96dfbcaa2990df01fe5bb39ccc" ON "employee" ("profile_link") `);
        await queryRunner.query(`CREATE INDEX "IDX_f4b0d329c4a3cf79ffe9d56504" ON "employee" ("userId") `);
        await queryRunner.query(`CREATE INDEX "IDX_1c0c1370ecd98040259625e17e" ON "employee" ("contactId") `);
        await queryRunner.query(`CREATE INDEX "IDX_5e719204dcafa8d6b2ecdeda13" ON "employee" ("organizationPositionId") `);
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
