
import { MigrationInterface, QueryRunner } from "typeorm";
import { yellow } from "chalk";
import { DatabaseTypeEnum } from "@gauzy/config";

export class AlterCustomFieldsDefaultColumn1714319484155 implements MigrationInterface {

    name = 'AlterCustomFieldsDefaultColumn1714319484155';

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
        await queryRunner.query(`ALTER TABLE "employee_job_preset" DROP CONSTRAINT "FK_7ae5b4d4bdec77971dab319f2e2"`);
        await queryRunner.query(`ALTER TABLE "employee_job_preset" DROP CONSTRAINT "FK_68e75e49f06409fd385b4f87746"`);
        await queryRunner.query(`ALTER TABLE "tag_proposal" DROP CONSTRAINT "FK_451853704de278eef61a37fa7a6"`);
        await queryRunner.query(`ALTER TABLE "employee" RENAME COLUMN "__fix_relational_custom_fields__" TO "fix_relational_custom_fields"`);
        await queryRunner.query(`ALTER TABLE "tag" RENAME COLUMN "__fix_relational_custom_fields__" TO "fix_relational_custom_fields"`);
        await queryRunner.query(`ALTER TABLE "employee_job_preset" ADD CONSTRAINT "FK_68e75e49f06409fd385b4f87746" FOREIGN KEY ("employeeId") REFERENCES "employee"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE "employee_job_preset" ADD CONSTRAINT "FK_7ae5b4d4bdec77971dab319f2e2" FOREIGN KEY ("jobPresetId") REFERENCES "job_preset"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "tag_proposal" ADD CONSTRAINT "FK_451853704de278eef61a37fa7a6" FOREIGN KEY ("tagId") REFERENCES "tag"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
    }

    /**
    * PostgresDB Down Migration
    *
    * @param queryRunner
    */
    public async postgresDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`ALTER TABLE "tag_proposal" DROP CONSTRAINT "FK_451853704de278eef61a37fa7a6"`);
        await queryRunner.query(`ALTER TABLE "employee_job_preset" DROP CONSTRAINT "FK_7ae5b4d4bdec77971dab319f2e2"`);
        await queryRunner.query(`ALTER TABLE "employee_job_preset" DROP CONSTRAINT "FK_68e75e49f06409fd385b4f87746"`);
        await queryRunner.query(`ALTER TABLE "tag" RENAME COLUMN "fix_relational_custom_fields" TO "__fix_relational_custom_fields__"`);
        await queryRunner.query(`ALTER TABLE "employee" RENAME COLUMN "fix_relational_custom_fields" TO "__fix_relational_custom_fields__"`);
        await queryRunner.query(`ALTER TABLE "tag_proposal" ADD CONSTRAINT "FK_451853704de278eef61a37fa7a6" FOREIGN KEY ("tagId") REFERENCES "tag"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "employee_job_preset" ADD CONSTRAINT "FK_68e75e49f06409fd385b4f87746" FOREIGN KEY ("employeeId") REFERENCES "employee"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "employee_job_preset" ADD CONSTRAINT "FK_7ae5b4d4bdec77971dab319f2e2" FOREIGN KEY ("jobPresetId") REFERENCES "job_preset"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
    }

    /**
    * SqliteDB and BetterSQlite3DB Up Migration
    *
    * @param queryRunner
    */
    public async sqliteUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`DROP INDEX "IDX_68e75e49f06409fd385b4f8774"`);
        await queryRunner.query(`DROP INDEX "IDX_7ae5b4d4bdec77971dab319f2e"`);
        await queryRunner.query(`CREATE TABLE "temporary_employee_job_preset" ("jobPresetId" varchar NOT NULL, "employeeId" varchar NOT NULL, PRIMARY KEY ("jobPresetId", "employeeId"))`);
        await queryRunner.query(`INSERT INTO "temporary_employee_job_preset"("jobPresetId", "employeeId") SELECT "jobPresetId", "employeeId" FROM "employee_job_preset"`);
        await queryRunner.query(`DROP TABLE "employee_job_preset"`);
        await queryRunner.query(`ALTER TABLE "temporary_employee_job_preset" RENAME TO "employee_job_preset"`);
        await queryRunner.query(`CREATE INDEX "IDX_68e75e49f06409fd385b4f8774" ON "employee_job_preset" ("employeeId") `);
        await queryRunner.query(`CREATE INDEX "IDX_7ae5b4d4bdec77971dab319f2e" ON "employee_job_preset" ("jobPresetId") `);
        await queryRunner.query(`DROP INDEX "IDX_3f55851a03524e567594d50774"`);
        await queryRunner.query(`DROP INDEX "IDX_451853704de278eef61a37fa7a"`);
        await queryRunner.query(`CREATE TABLE "temporary_tag_proposal" ("proposalId" varchar NOT NULL, "tagId" varchar NOT NULL, CONSTRAINT "FK_3f55851a03524e567594d507744" FOREIGN KEY ("proposalId") REFERENCES "proposal" ("id") ON DELETE CASCADE ON UPDATE CASCADE, PRIMARY KEY ("proposalId", "tagId"))`);
        await queryRunner.query(`INSERT INTO "temporary_tag_proposal"("proposalId", "tagId") SELECT "proposalId", "tagId" FROM "tag_proposal"`);
        await queryRunner.query(`DROP TABLE "tag_proposal"`);
        await queryRunner.query(`ALTER TABLE "temporary_tag_proposal" RENAME TO "tag_proposal"`);
        await queryRunner.query(`CREATE INDEX "IDX_3f55851a03524e567594d50774" ON "tag_proposal" ("proposalId") `);
        await queryRunner.query(`CREATE INDEX "IDX_451853704de278eef61a37fa7a" ON "tag_proposal" ("tagId") `);
        await queryRunner.query(`DROP INDEX "IDX_5e719204dcafa8d6b2ecdeda13"`);
        await queryRunner.query(`DROP INDEX "IDX_1c0c1370ecd98040259625e17e"`);
        await queryRunner.query(`DROP INDEX "IDX_f4b0d329c4a3cf79ffe9d56504"`);
        await queryRunner.query(`DROP INDEX "IDX_96dfbcaa2990df01fe5bb39ccc"`);
        await queryRunner.query(`DROP INDEX "IDX_c6a48286f3aa8ae903bee0d1e7"`);
        await queryRunner.query(`DROP INDEX "IDX_4b3303a6b7eb92d237a4379734"`);
        await queryRunner.query(`DROP INDEX "IDX_510cb87f5da169e57e694d1a5c"`);
        await queryRunner.query(`DROP INDEX "IDX_175b7be641928a31521224daa8"`);
        await queryRunner.query(`CREATE TABLE "temporary_employee" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "organizationId" varchar, "valueDate" datetime, "isActive" boolean DEFAULT (1), "short_description" varchar(200), "description" varchar, "startedWorkOn" datetime, "endWork" datetime, "payPeriod" varchar, "billRateValue" integer, "billRateCurrency" varchar, "reWeeklyLimit" integer, "offerDate" datetime, "acceptDate" datetime, "rejectDate" datetime, "employeeLevel" varchar(500), "anonymousBonus" boolean, "averageIncome" numeric, "averageBonus" numeric, "totalWorkHours" numeric DEFAULT (0), "averageExpenses" numeric, "show_anonymous_bonus" boolean, "show_average_bonus" boolean, "show_average_expenses" boolean, "show_average_income" boolean, "show_billrate" boolean, "show_payperiod" boolean, "show_start_work_on" boolean, "isJobSearchActive" boolean, "linkedInUrl" varchar, "facebookUrl" varchar, "instagramUrl" varchar, "twitterUrl" varchar, "githubUrl" varchar, "gitlabUrl" varchar, "upworkUrl" varchar, "stackoverflowUrl" varchar, "isVerified" boolean, "isVetted" boolean, "totalJobs" numeric, "jobSuccess" numeric, "profile_link" varchar, "userId" varchar NOT NULL, "contactId" varchar, "organizationPositionId" varchar, "isTrackingEnabled" boolean DEFAULT (0), "deletedAt" datetime, "allowScreenshotCapture" boolean NOT NULL DEFAULT (1), "upworkId" varchar, "linkedInId" varchar, "isOnline" boolean DEFAULT (0), "isTrackingTime" boolean DEFAULT (0), "minimumBillingRate" integer, "isAway" boolean DEFAULT (0), "isArchived" boolean DEFAULT (0), "fix_relational_custom_fields" boolean, CONSTRAINT "REL_1c0c1370ecd98040259625e17e" UNIQUE ("contactId"), CONSTRAINT "REL_f4b0d329c4a3cf79ffe9d56504" UNIQUE ("userId"), CONSTRAINT "FK_5e719204dcafa8d6b2ecdeda130" FOREIGN KEY ("organizationPositionId") REFERENCES "organization_position" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION, CONSTRAINT "FK_1c0c1370ecd98040259625e17e2" FOREIGN KEY ("contactId") REFERENCES "contact" ("id") ON DELETE SET NULL ON UPDATE NO ACTION, CONSTRAINT "FK_f4b0d329c4a3cf79ffe9d565047" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_c6a48286f3aa8ae903bee0d1e72" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_4b3303a6b7eb92d237a4379734e" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`);
        await queryRunner.query(`INSERT INTO "temporary_employee"("id", "createdAt", "updatedAt", "tenantId", "organizationId", "valueDate", "isActive", "short_description", "description", "startedWorkOn", "endWork", "payPeriod", "billRateValue", "billRateCurrency", "reWeeklyLimit", "offerDate", "acceptDate", "rejectDate", "employeeLevel", "anonymousBonus", "averageIncome", "averageBonus", "totalWorkHours", "averageExpenses", "show_anonymous_bonus", "show_average_bonus", "show_average_expenses", "show_average_income", "show_billrate", "show_payperiod", "show_start_work_on", "isJobSearchActive", "linkedInUrl", "facebookUrl", "instagramUrl", "twitterUrl", "githubUrl", "gitlabUrl", "upworkUrl", "stackoverflowUrl", "isVerified", "isVetted", "totalJobs", "jobSuccess", "profile_link", "userId", "contactId", "organizationPositionId", "isTrackingEnabled", "deletedAt", "allowScreenshotCapture", "upworkId", "linkedInId", "isOnline", "isTrackingTime", "minimumBillingRate", "isAway", "isArchived", "fix_relational_custom_fields") SELECT "id", "createdAt", "updatedAt", "tenantId", "organizationId", "valueDate", "isActive", "short_description", "description", "startedWorkOn", "endWork", "payPeriod", "billRateValue", "billRateCurrency", "reWeeklyLimit", "offerDate", "acceptDate", "rejectDate", "employeeLevel", "anonymousBonus", "averageIncome", "averageBonus", "totalWorkHours", "averageExpenses", "show_anonymous_bonus", "show_average_bonus", "show_average_expenses", "show_average_income", "show_billrate", "show_payperiod", "show_start_work_on", "isJobSearchActive", "linkedInUrl", "facebookUrl", "instagramUrl", "twitterUrl", "githubUrl", "gitlabUrl", "upworkUrl", "stackoverflowUrl", "isVerified", "isVetted", "totalJobs", "jobSuccess", "profile_link", "userId", "contactId", "organizationPositionId", "isTrackingEnabled", "deletedAt", "allowScreenshotCapture", "upworkId", "linkedInId", "isOnline", "isTrackingTime", "minimumBillingRate", "isAway", "isArchived", "__fix_relational_custom_fields__" FROM "employee"`);
        await queryRunner.query(`DROP TABLE "employee"`);
        await queryRunner.query(`ALTER TABLE "temporary_employee" RENAME TO "employee"`);
        await queryRunner.query(`CREATE INDEX "IDX_5e719204dcafa8d6b2ecdeda13" ON "employee" ("organizationPositionId") `);
        await queryRunner.query(`CREATE INDEX "IDX_1c0c1370ecd98040259625e17e" ON "employee" ("contactId") `);
        await queryRunner.query(`CREATE INDEX "IDX_f4b0d329c4a3cf79ffe9d56504" ON "employee" ("userId") `);
        await queryRunner.query(`CREATE INDEX "IDX_96dfbcaa2990df01fe5bb39ccc" ON "employee" ("profile_link") `);
        await queryRunner.query(`CREATE INDEX "IDX_c6a48286f3aa8ae903bee0d1e7" ON "employee" ("organizationId") `);
        await queryRunner.query(`CREATE INDEX "IDX_4b3303a6b7eb92d237a4379734" ON "employee" ("tenantId") `);
        await queryRunner.query(`CREATE INDEX "IDX_510cb87f5da169e57e694d1a5c" ON "employee" ("isActive") `);
        await queryRunner.query(`CREATE INDEX "IDX_175b7be641928a31521224daa8" ON "employee" ("isArchived") `);
        await queryRunner.query(`DROP INDEX "IDX_49746602acc4e5e8721062b69e"`);
        await queryRunner.query(`DROP INDEX "IDX_b08dd29fb6a8acdf83c83d8988"`);
        await queryRunner.query(`DROP INDEX "IDX_c2f6bec0b39eaa3a6d90903ae9"`);
        await queryRunner.query(`DROP INDEX "IDX_1f22c73374bcca1ea84a4dca59"`);
        await queryRunner.query(`DROP INDEX "IDX_58876ee26a90170551027459bf"`);
        await queryRunner.query(`CREATE TABLE "temporary_tag" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "organizationId" varchar, "name" varchar NOT NULL, "description" varchar, "color" varchar NOT NULL, "isSystem" boolean NOT NULL DEFAULT (0), "icon" varchar, "organizationTeamId" varchar, "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "deletedAt" datetime, "textColor" varchar, "fix_relational_custom_fields" boolean, CONSTRAINT "FK_49746602acc4e5e8721062b69ec" FOREIGN KEY ("organizationTeamId") REFERENCES "organization_team" ("id") ON DELETE SET NULL ON UPDATE NO ACTION, CONSTRAINT "FK_b08dd29fb6a8acdf83c83d8988f" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_c2f6bec0b39eaa3a6d90903ae99" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE)`);
        await queryRunner.query(`INSERT INTO "temporary_tag"("id", "createdAt", "updatedAt", "tenantId", "organizationId", "name", "description", "color", "isSystem", "icon", "organizationTeamId", "isActive", "isArchived", "deletedAt", "textColor", "fix_relational_custom_fields") SELECT "id", "createdAt", "updatedAt", "tenantId", "organizationId", "name", "description", "color", "isSystem", "icon", "organizationTeamId", "isActive", "isArchived", "deletedAt", "textColor", "__fix_relational_custom_fields__" FROM "tag"`);
        await queryRunner.query(`DROP TABLE "tag"`);
        await queryRunner.query(`ALTER TABLE "temporary_tag" RENAME TO "tag"`);
        await queryRunner.query(`CREATE INDEX "IDX_49746602acc4e5e8721062b69e" ON "tag" ("organizationTeamId") `);
        await queryRunner.query(`CREATE INDEX "IDX_b08dd29fb6a8acdf83c83d8988" ON "tag" ("tenantId") `);
        await queryRunner.query(`CREATE INDEX "IDX_c2f6bec0b39eaa3a6d90903ae9" ON "tag" ("organizationId") `);
        await queryRunner.query(`CREATE INDEX "IDX_1f22c73374bcca1ea84a4dca59" ON "tag" ("isActive") `);
        await queryRunner.query(`CREATE INDEX "IDX_58876ee26a90170551027459bf" ON "tag" ("isArchived") `);
        await queryRunner.query(`DROP INDEX "IDX_68e75e49f06409fd385b4f8774"`);
        await queryRunner.query(`DROP INDEX "IDX_7ae5b4d4bdec77971dab319f2e"`);
        await queryRunner.query(`CREATE TABLE "temporary_employee_job_preset" ("jobPresetId" varchar NOT NULL, "employeeId" varchar NOT NULL, CONSTRAINT "FK_68e75e49f06409fd385b4f87746" FOREIGN KEY ("employeeId") REFERENCES "employee" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_7ae5b4d4bdec77971dab319f2e2" FOREIGN KEY ("jobPresetId") REFERENCES "job_preset" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION, PRIMARY KEY ("jobPresetId", "employeeId"))`);
        await queryRunner.query(`INSERT INTO "temporary_employee_job_preset"("jobPresetId", "employeeId") SELECT "jobPresetId", "employeeId" FROM "employee_job_preset"`);
        await queryRunner.query(`DROP TABLE "employee_job_preset"`);
        await queryRunner.query(`ALTER TABLE "temporary_employee_job_preset" RENAME TO "employee_job_preset"`);
        await queryRunner.query(`CREATE INDEX "IDX_68e75e49f06409fd385b4f8774" ON "employee_job_preset" ("employeeId") `);
        await queryRunner.query(`CREATE INDEX "IDX_7ae5b4d4bdec77971dab319f2e" ON "employee_job_preset" ("jobPresetId") `);
        await queryRunner.query(`DROP INDEX "IDX_3f55851a03524e567594d50774"`);
        await queryRunner.query(`DROP INDEX "IDX_451853704de278eef61a37fa7a"`);
        await queryRunner.query(`CREATE TABLE "temporary_tag_proposal" ("proposalId" varchar NOT NULL, "tagId" varchar NOT NULL, CONSTRAINT "FK_3f55851a03524e567594d507744" FOREIGN KEY ("proposalId") REFERENCES "proposal" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_451853704de278eef61a37fa7a6" FOREIGN KEY ("tagId") REFERENCES "tag" ("id") ON DELETE CASCADE ON UPDATE CASCADE, PRIMARY KEY ("proposalId", "tagId"))`);
        await queryRunner.query(`INSERT INTO "temporary_tag_proposal"("proposalId", "tagId") SELECT "proposalId", "tagId" FROM "tag_proposal"`);
        await queryRunner.query(`DROP TABLE "tag_proposal"`);
        await queryRunner.query(`ALTER TABLE "temporary_tag_proposal" RENAME TO "tag_proposal"`);
        await queryRunner.query(`CREATE INDEX "IDX_3f55851a03524e567594d50774" ON "tag_proposal" ("proposalId") `);
        await queryRunner.query(`CREATE INDEX "IDX_451853704de278eef61a37fa7a" ON "tag_proposal" ("tagId") `);
    }

    /**
    * SqliteDB and BetterSQlite3DB Down Migration
    *
    * @param queryRunner
    */
    public async sqliteDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`DROP INDEX "IDX_451853704de278eef61a37fa7a"`);
        await queryRunner.query(`DROP INDEX "IDX_3f55851a03524e567594d50774"`);
        await queryRunner.query(`ALTER TABLE "tag_proposal" RENAME TO "temporary_tag_proposal"`);
        await queryRunner.query(`CREATE TABLE "tag_proposal" ("proposalId" varchar NOT NULL, "tagId" varchar NOT NULL, CONSTRAINT "FK_3f55851a03524e567594d507744" FOREIGN KEY ("proposalId") REFERENCES "proposal" ("id") ON DELETE CASCADE ON UPDATE CASCADE, PRIMARY KEY ("proposalId", "tagId"))`);
        await queryRunner.query(`INSERT INTO "tag_proposal"("proposalId", "tagId") SELECT "proposalId", "tagId" FROM "temporary_tag_proposal"`);
        await queryRunner.query(`DROP TABLE "temporary_tag_proposal"`);
        await queryRunner.query(`CREATE INDEX "IDX_451853704de278eef61a37fa7a" ON "tag_proposal" ("tagId") `);
        await queryRunner.query(`CREATE INDEX "IDX_3f55851a03524e567594d50774" ON "tag_proposal" ("proposalId") `);
        await queryRunner.query(`DROP INDEX "IDX_7ae5b4d4bdec77971dab319f2e"`);
        await queryRunner.query(`DROP INDEX "IDX_68e75e49f06409fd385b4f8774"`);
        await queryRunner.query(`ALTER TABLE "employee_job_preset" RENAME TO "temporary_employee_job_preset"`);
        await queryRunner.query(`CREATE TABLE "employee_job_preset" ("jobPresetId" varchar NOT NULL, "employeeId" varchar NOT NULL, PRIMARY KEY ("jobPresetId", "employeeId"))`);
        await queryRunner.query(`INSERT INTO "employee_job_preset"("jobPresetId", "employeeId") SELECT "jobPresetId", "employeeId" FROM "temporary_employee_job_preset"`);
        await queryRunner.query(`DROP TABLE "temporary_employee_job_preset"`);
        await queryRunner.query(`CREATE INDEX "IDX_7ae5b4d4bdec77971dab319f2e" ON "employee_job_preset" ("jobPresetId") `);
        await queryRunner.query(`CREATE INDEX "IDX_68e75e49f06409fd385b4f8774" ON "employee_job_preset" ("employeeId") `);
        await queryRunner.query(`DROP INDEX "IDX_58876ee26a90170551027459bf"`);
        await queryRunner.query(`DROP INDEX "IDX_1f22c73374bcca1ea84a4dca59"`);
        await queryRunner.query(`DROP INDEX "IDX_c2f6bec0b39eaa3a6d90903ae9"`);
        await queryRunner.query(`DROP INDEX "IDX_b08dd29fb6a8acdf83c83d8988"`);
        await queryRunner.query(`DROP INDEX "IDX_49746602acc4e5e8721062b69e"`);
        await queryRunner.query(`ALTER TABLE "tag" RENAME TO "temporary_tag"`);
        await queryRunner.query(`CREATE TABLE "tag" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "organizationId" varchar, "name" varchar NOT NULL, "description" varchar, "color" varchar NOT NULL, "isSystem" boolean NOT NULL DEFAULT (0), "icon" varchar, "organizationTeamId" varchar, "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "deletedAt" datetime, "textColor" varchar, "__fix_relational_custom_fields__" boolean, CONSTRAINT "FK_49746602acc4e5e8721062b69ec" FOREIGN KEY ("organizationTeamId") REFERENCES "organization_team" ("id") ON DELETE SET NULL ON UPDATE NO ACTION, CONSTRAINT "FK_b08dd29fb6a8acdf83c83d8988f" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_c2f6bec0b39eaa3a6d90903ae99" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE)`);
        await queryRunner.query(`INSERT INTO "tag"("id", "createdAt", "updatedAt", "tenantId", "organizationId", "name", "description", "color", "isSystem", "icon", "organizationTeamId", "isActive", "isArchived", "deletedAt", "textColor", "__fix_relational_custom_fields__") SELECT "id", "createdAt", "updatedAt", "tenantId", "organizationId", "name", "description", "color", "isSystem", "icon", "organizationTeamId", "isActive", "isArchived", "deletedAt", "textColor", "fix_relational_custom_fields" FROM "temporary_tag"`);
        await queryRunner.query(`DROP TABLE "temporary_tag"`);
        await queryRunner.query(`CREATE INDEX "IDX_58876ee26a90170551027459bf" ON "tag" ("isArchived") `);
        await queryRunner.query(`CREATE INDEX "IDX_1f22c73374bcca1ea84a4dca59" ON "tag" ("isActive") `);
        await queryRunner.query(`CREATE INDEX "IDX_c2f6bec0b39eaa3a6d90903ae9" ON "tag" ("organizationId") `);
        await queryRunner.query(`CREATE INDEX "IDX_b08dd29fb6a8acdf83c83d8988" ON "tag" ("tenantId") `);
        await queryRunner.query(`CREATE INDEX "IDX_49746602acc4e5e8721062b69e" ON "tag" ("organizationTeamId") `);
        await queryRunner.query(`DROP INDEX "IDX_175b7be641928a31521224daa8"`);
        await queryRunner.query(`DROP INDEX "IDX_510cb87f5da169e57e694d1a5c"`);
        await queryRunner.query(`DROP INDEX "IDX_4b3303a6b7eb92d237a4379734"`);
        await queryRunner.query(`DROP INDEX "IDX_c6a48286f3aa8ae903bee0d1e7"`);
        await queryRunner.query(`DROP INDEX "IDX_96dfbcaa2990df01fe5bb39ccc"`);
        await queryRunner.query(`DROP INDEX "IDX_f4b0d329c4a3cf79ffe9d56504"`);
        await queryRunner.query(`DROP INDEX "IDX_1c0c1370ecd98040259625e17e"`);
        await queryRunner.query(`DROP INDEX "IDX_5e719204dcafa8d6b2ecdeda13"`);
        await queryRunner.query(`ALTER TABLE "employee" RENAME TO "temporary_employee"`);
        await queryRunner.query(`CREATE TABLE "employee" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "organizationId" varchar, "valueDate" datetime, "isActive" boolean DEFAULT (1), "short_description" varchar(200), "description" varchar, "startedWorkOn" datetime, "endWork" datetime, "payPeriod" varchar, "billRateValue" integer, "billRateCurrency" varchar, "reWeeklyLimit" integer, "offerDate" datetime, "acceptDate" datetime, "rejectDate" datetime, "employeeLevel" varchar(500), "anonymousBonus" boolean, "averageIncome" numeric, "averageBonus" numeric, "totalWorkHours" numeric DEFAULT (0), "averageExpenses" numeric, "show_anonymous_bonus" boolean, "show_average_bonus" boolean, "show_average_expenses" boolean, "show_average_income" boolean, "show_billrate" boolean, "show_payperiod" boolean, "show_start_work_on" boolean, "isJobSearchActive" boolean, "linkedInUrl" varchar, "facebookUrl" varchar, "instagramUrl" varchar, "twitterUrl" varchar, "githubUrl" varchar, "gitlabUrl" varchar, "upworkUrl" varchar, "stackoverflowUrl" varchar, "isVerified" boolean, "isVetted" boolean, "totalJobs" numeric, "jobSuccess" numeric, "profile_link" varchar, "userId" varchar NOT NULL, "contactId" varchar, "organizationPositionId" varchar, "isTrackingEnabled" boolean DEFAULT (0), "deletedAt" datetime, "allowScreenshotCapture" boolean NOT NULL DEFAULT (1), "upworkId" varchar, "linkedInId" varchar, "isOnline" boolean DEFAULT (0), "isTrackingTime" boolean DEFAULT (0), "minimumBillingRate" integer, "isAway" boolean DEFAULT (0), "isArchived" boolean DEFAULT (0), "__fix_relational_custom_fields__" boolean, CONSTRAINT "REL_1c0c1370ecd98040259625e17e" UNIQUE ("contactId"), CONSTRAINT "REL_f4b0d329c4a3cf79ffe9d56504" UNIQUE ("userId"), CONSTRAINT "FK_5e719204dcafa8d6b2ecdeda130" FOREIGN KEY ("organizationPositionId") REFERENCES "organization_position" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION, CONSTRAINT "FK_1c0c1370ecd98040259625e17e2" FOREIGN KEY ("contactId") REFERENCES "contact" ("id") ON DELETE SET NULL ON UPDATE NO ACTION, CONSTRAINT "FK_f4b0d329c4a3cf79ffe9d565047" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_c6a48286f3aa8ae903bee0d1e72" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_4b3303a6b7eb92d237a4379734e" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`);
        await queryRunner.query(`INSERT INTO "employee"("id", "createdAt", "updatedAt", "tenantId", "organizationId", "valueDate", "isActive", "short_description", "description", "startedWorkOn", "endWork", "payPeriod", "billRateValue", "billRateCurrency", "reWeeklyLimit", "offerDate", "acceptDate", "rejectDate", "employeeLevel", "anonymousBonus", "averageIncome", "averageBonus", "totalWorkHours", "averageExpenses", "show_anonymous_bonus", "show_average_bonus", "show_average_expenses", "show_average_income", "show_billrate", "show_payperiod", "show_start_work_on", "isJobSearchActive", "linkedInUrl", "facebookUrl", "instagramUrl", "twitterUrl", "githubUrl", "gitlabUrl", "upworkUrl", "stackoverflowUrl", "isVerified", "isVetted", "totalJobs", "jobSuccess", "profile_link", "userId", "contactId", "organizationPositionId", "isTrackingEnabled", "deletedAt", "allowScreenshotCapture", "upworkId", "linkedInId", "isOnline", "isTrackingTime", "minimumBillingRate", "isAway", "isArchived", "__fix_relational_custom_fields__") SELECT "id", "createdAt", "updatedAt", "tenantId", "organizationId", "valueDate", "isActive", "short_description", "description", "startedWorkOn", "endWork", "payPeriod", "billRateValue", "billRateCurrency", "reWeeklyLimit", "offerDate", "acceptDate", "rejectDate", "employeeLevel", "anonymousBonus", "averageIncome", "averageBonus", "totalWorkHours", "averageExpenses", "show_anonymous_bonus", "show_average_bonus", "show_average_expenses", "show_average_income", "show_billrate", "show_payperiod", "show_start_work_on", "isJobSearchActive", "linkedInUrl", "facebookUrl", "instagramUrl", "twitterUrl", "githubUrl", "gitlabUrl", "upworkUrl", "stackoverflowUrl", "isVerified", "isVetted", "totalJobs", "jobSuccess", "profile_link", "userId", "contactId", "organizationPositionId", "isTrackingEnabled", "deletedAt", "allowScreenshotCapture", "upworkId", "linkedInId", "isOnline", "isTrackingTime", "minimumBillingRate", "isAway", "isArchived", "fix_relational_custom_fields" FROM "temporary_employee"`);
        await queryRunner.query(`DROP TABLE "temporary_employee"`);
        await queryRunner.query(`CREATE INDEX "IDX_175b7be641928a31521224daa8" ON "employee" ("isArchived") `);
        await queryRunner.query(`CREATE INDEX "IDX_510cb87f5da169e57e694d1a5c" ON "employee" ("isActive") `);
        await queryRunner.query(`CREATE INDEX "IDX_4b3303a6b7eb92d237a4379734" ON "employee" ("tenantId") `);
        await queryRunner.query(`CREATE INDEX "IDX_c6a48286f3aa8ae903bee0d1e7" ON "employee" ("organizationId") `);
        await queryRunner.query(`CREATE INDEX "IDX_96dfbcaa2990df01fe5bb39ccc" ON "employee" ("profile_link") `);
        await queryRunner.query(`CREATE INDEX "IDX_f4b0d329c4a3cf79ffe9d56504" ON "employee" ("userId") `);
        await queryRunner.query(`CREATE INDEX "IDX_1c0c1370ecd98040259625e17e" ON "employee" ("contactId") `);
        await queryRunner.query(`CREATE INDEX "IDX_5e719204dcafa8d6b2ecdeda13" ON "employee" ("organizationPositionId") `);
        await queryRunner.query(`DROP INDEX "IDX_451853704de278eef61a37fa7a"`);
        await queryRunner.query(`DROP INDEX "IDX_3f55851a03524e567594d50774"`);
        await queryRunner.query(`ALTER TABLE "tag_proposal" RENAME TO "temporary_tag_proposal"`);
        await queryRunner.query(`CREATE TABLE "tag_proposal" ("proposalId" varchar NOT NULL, "tagId" varchar NOT NULL, CONSTRAINT "FK_451853704de278eef61a37fa7a6" FOREIGN KEY ("tagId") REFERENCES "tag" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION, CONSTRAINT "FK_3f55851a03524e567594d507744" FOREIGN KEY ("proposalId") REFERENCES "proposal" ("id") ON DELETE CASCADE ON UPDATE CASCADE, PRIMARY KEY ("proposalId", "tagId"))`);
        await queryRunner.query(`INSERT INTO "tag_proposal"("proposalId", "tagId") SELECT "proposalId", "tagId" FROM "temporary_tag_proposal"`);
        await queryRunner.query(`DROP TABLE "temporary_tag_proposal"`);
        await queryRunner.query(`CREATE INDEX "IDX_451853704de278eef61a37fa7a" ON "tag_proposal" ("tagId") `);
        await queryRunner.query(`CREATE INDEX "IDX_3f55851a03524e567594d50774" ON "tag_proposal" ("proposalId") `);
        await queryRunner.query(`DROP INDEX "IDX_7ae5b4d4bdec77971dab319f2e"`);
        await queryRunner.query(`DROP INDEX "IDX_68e75e49f06409fd385b4f8774"`);
        await queryRunner.query(`ALTER TABLE "employee_job_preset" RENAME TO "temporary_employee_job_preset"`);
        await queryRunner.query(`CREATE TABLE "employee_job_preset" ("jobPresetId" varchar NOT NULL, "employeeId" varchar NOT NULL, CONSTRAINT "FK_68e75e49f06409fd385b4f87746" FOREIGN KEY ("employeeId") REFERENCES "employee" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION, CONSTRAINT "FK_7ae5b4d4bdec77971dab319f2e2" FOREIGN KEY ("jobPresetId") REFERENCES "job_preset" ("id") ON DELETE CASCADE ON UPDATE CASCADE, PRIMARY KEY ("jobPresetId", "employeeId"))`);
        await queryRunner.query(`INSERT INTO "employee_job_preset"("jobPresetId", "employeeId") SELECT "jobPresetId", "employeeId" FROM "temporary_employee_job_preset"`);
        await queryRunner.query(`DROP TABLE "temporary_employee_job_preset"`);
        await queryRunner.query(`CREATE INDEX "IDX_7ae5b4d4bdec77971dab319f2e" ON "employee_job_preset" ("jobPresetId") `);
        await queryRunner.query(`CREATE INDEX "IDX_68e75e49f06409fd385b4f8774" ON "employee_job_preset" ("employeeId") `);
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
