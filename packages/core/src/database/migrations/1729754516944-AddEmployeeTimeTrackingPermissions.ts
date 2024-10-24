
import { MigrationInterface, QueryRunner } from "typeorm";
import { yellow } from "chalk";
import { DatabaseTypeEnum } from "@gauzy/config";

export class AddEmployeeTimeTrackingPermissions1729754516944 implements MigrationInterface {

    name = 'AddEmployeeTimeTrackingPermissions1729754516944';

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
        
    }

    /**
    * PostgresDB Down Migration
    *
    * @param queryRunner
    */
    public async postgresDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
        
    }

    /**
    * SqliteDB and BetterSQlite3DB Up Migration
    *
    * @param queryRunner
    */
    public async sqliteUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`DROP INDEX "IDX_2ef674d18792e8864fd8d484ea"`);
        await queryRunner.query(`DROP INDEX "IDX_b73c278619bd8fb7f30f93182c"`);
        await queryRunner.query(`DROP INDEX "IDX_44100d3eaf418ee67fa7a756f1"`);
        await queryRunner.query(`DROP INDEX "IDX_95603855ae10050123e48a6688"`);
        await queryRunner.query(`DROP INDEX "IDX_f9438f82f6e93bd6a87b8216af"`);
        await queryRunner.query(`DROP INDEX "IDX_4c25c2c9d7ebbd0c07edd824ff"`);
        await queryRunner.query(`DROP INDEX "IDX_841b729b80bc03ea38d16b8508"`);
        await queryRunner.query(`CREATE TABLE "temporary_resource_link" ("deletedAt" datetime, "id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "tenantId" varchar, "organizationId" varchar, "entity" varchar NOT NULL, "entityId" varchar NOT NULL, "title" varchar NOT NULL, "url" text NOT NULL, "metaData" text, "creatorId" varchar)`);
        await queryRunner.query(`INSERT INTO "temporary_resource_link"("deletedAt", "id", "createdAt", "updatedAt", "isActive", "isArchived", "archivedAt", "tenantId", "organizationId", "entity", "entityId", "title", "url", "metaData", "creatorId") SELECT "deletedAt", "id", "createdAt", "updatedAt", "isActive", "isArchived", "archivedAt", "tenantId", "organizationId", "entity", "entityId", "title", "url", "metaData", "creatorId" FROM "resource_link"`);
        await queryRunner.query(`DROP TABLE "resource_link"`);
        await queryRunner.query(`ALTER TABLE "temporary_resource_link" RENAME TO "resource_link"`);
        await queryRunner.query(`CREATE INDEX "IDX_2ef674d18792e8864fd8d484ea" ON "resource_link" ("creatorId") `);
        await queryRunner.query(`CREATE INDEX "IDX_b73c278619bd8fb7f30f93182c" ON "resource_link" ("entityId") `);
        await queryRunner.query(`CREATE INDEX "IDX_44100d3eaf418ee67fa7a756f1" ON "resource_link" ("entity") `);
        await queryRunner.query(`CREATE INDEX "IDX_95603855ae10050123e48a6688" ON "resource_link" ("organizationId") `);
        await queryRunner.query(`CREATE INDEX "IDX_f9438f82f6e93bd6a87b8216af" ON "resource_link" ("tenantId") `);
        await queryRunner.query(`CREATE INDEX "IDX_4c25c2c9d7ebbd0c07edd824ff" ON "resource_link" ("isArchived") `);
        await queryRunner.query(`CREATE INDEX "IDX_841b729b80bc03ea38d16b8508" ON "resource_link" ("isActive") `);
        await queryRunner.query(`DROP INDEX "IDX_7ae5b4d4bdec77971dab319f2e"`);
        await queryRunner.query(`DROP INDEX "IDX_68e75e49f06409fd385b4f8774"`);
        await queryRunner.query(`CREATE TABLE "temporary_employee_job_preset" ("jobPresetId" varchar NOT NULL, "employeeId" varchar NOT NULL, CONSTRAINT "FK_68e75e49f06409fd385b4f87746" FOREIGN KEY ("employeeId") REFERENCES "employee" ("id") ON DELETE CASCADE ON UPDATE CASCADE, PRIMARY KEY ("jobPresetId", "employeeId"))`);
        await queryRunner.query(`INSERT INTO "temporary_employee_job_preset"("jobPresetId", "employeeId") SELECT "jobPresetId", "employeeId" FROM "employee_job_preset"`);
        await queryRunner.query(`DROP TABLE "employee_job_preset"`);
        await queryRunner.query(`ALTER TABLE "temporary_employee_job_preset" RENAME TO "employee_job_preset"`);
        await queryRunner.query(`CREATE INDEX "IDX_7ae5b4d4bdec77971dab319f2e" ON "employee_job_preset" ("jobPresetId") `);
        await queryRunner.query(`CREATE INDEX "IDX_68e75e49f06409fd385b4f8774" ON "employee_job_preset" ("employeeId") `);
        await queryRunner.query(`DROP INDEX "IDX_2ef674d18792e8864fd8d484ea"`);
        await queryRunner.query(`DROP INDEX "IDX_b73c278619bd8fb7f30f93182c"`);
        await queryRunner.query(`DROP INDEX "IDX_44100d3eaf418ee67fa7a756f1"`);
        await queryRunner.query(`DROP INDEX "IDX_95603855ae10050123e48a6688"`);
        await queryRunner.query(`DROP INDEX "IDX_f9438f82f6e93bd6a87b8216af"`);
        await queryRunner.query(`DROP INDEX "IDX_4c25c2c9d7ebbd0c07edd824ff"`);
        await queryRunner.query(`DROP INDEX "IDX_841b729b80bc03ea38d16b8508"`);
        await queryRunner.query(`DROP INDEX "IDX_ada33b1685138be7798aea280b"`);
        await queryRunner.query(`DROP INDEX "IDX_964d6a55608f67f7d92e9827db"`);
        await queryRunner.query(`DROP INDEX "IDX_085b00c43479478866d7a27ca9"`);
        await queryRunner.query(`DROP INDEX "IDX_66f2fd42fa8f00e11d6960cb39"`);
        await queryRunner.query(`DROP INDEX "IDX_1d6cb060eba156d1e50f7ea4a0"`);
        await queryRunner.query(`DROP INDEX "IDX_5820fe8a6385bfc0338c49a508"`);
        await queryRunner.query(`DROP INDEX "IDX_0a62fc4546d596f9e9ce305ecb"`);
        await queryRunner.query(`DROP INDEX "IDX_b484d5942747f0c19372ae8fcd"`);
        await queryRunner.query(`DROP INDEX "IDX_c74a2db6a95bb3a5b788e23a50"`);
        await queryRunner.query(`DROP INDEX "IDX_89292145eeceb7ff32dac0de83"`);
        await queryRunner.query(`DROP INDEX "IDX_94c4d067f73d90faaad8c2d3db"`);
        await queryRunner.query(`DROP INDEX "IDX_85c20063cd74c766533fd08389"`);
        await queryRunner.query(`DROP INDEX "IDX_f3505a1756b04b59626d1bd836"`);
        await queryRunner.query(`CREATE TABLE "temporary_api_call_log" ("deletedAt" datetime, "id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "tenantId" varchar, "organizationId" varchar, "correlationId" varchar NOT NULL, "url" varchar NOT NULL, "method" integer NOT NULL, "requestHeaders" text NOT NULL, "requestBody" text NOT NULL, "responseBody" text NOT NULL, "statusCode" integer NOT NULL, "requestTime" datetime NOT NULL, "responseTime" datetime NOT NULL, "ipAddress" varchar, "protocol" varchar NOT NULL, "userAgent" varchar NOT NULL, "userId" varchar, "origin" varchar, CONSTRAINT "FK_ada33b1685138be7798aea280b2" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_89292145eeceb7ff32dac0de83b" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_94c4d067f73d90faaad8c2d3dbd" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`);
        await queryRunner.query(`INSERT INTO "temporary_api_call_log"("deletedAt", "id", "createdAt", "updatedAt", "isActive", "isArchived", "archivedAt", "tenantId", "organizationId", "correlationId", "url", "method", "requestHeaders", "requestBody", "responseBody", "statusCode", "requestTime", "responseTime", "ipAddress", "protocol", "userAgent", "userId") SELECT "deletedAt", "id", "createdAt", "updatedAt", "isActive", "isArchived", "archivedAt", "tenantId", "organizationId", "correlationId", "url", "method", "requestHeaders", "requestBody", "responseBody", "statusCode", "requestTime", "responseTime", "ipAddress", "protocol", "userAgent", "userId" FROM "api_call_log"`);
        await queryRunner.query(`DROP TABLE "api_call_log"`);
        await queryRunner.query(`ALTER TABLE "temporary_api_call_log" RENAME TO "api_call_log"`);
        await queryRunner.query(`CREATE INDEX "IDX_ada33b1685138be7798aea280b" ON "api_call_log" ("userId") `);
        await queryRunner.query(`CREATE INDEX "IDX_964d6a55608f67f7d92e9827db" ON "api_call_log" ("protocol") `);
        await queryRunner.query(`CREATE INDEX "IDX_085b00c43479478866d7a27ca9" ON "api_call_log" ("ipAddress") `);
        await queryRunner.query(`CREATE INDEX "IDX_66f2fd42fa8f00e11d6960cb39" ON "api_call_log" ("responseTime") `);
        await queryRunner.query(`CREATE INDEX "IDX_1d6cb060eba156d1e50f7ea4a0" ON "api_call_log" ("requestTime") `);
        await queryRunner.query(`CREATE INDEX "IDX_5820fe8a6385bfc0338c49a508" ON "api_call_log" ("statusCode") `);
        await queryRunner.query(`CREATE INDEX "IDX_0a62fc4546d596f9e9ce305ecb" ON "api_call_log" ("method") `);
        await queryRunner.query(`CREATE INDEX "IDX_b484d5942747f0c19372ae8fcd" ON "api_call_log" ("url") `);
        await queryRunner.query(`CREATE INDEX "IDX_c74a2db6a95bb3a5b788e23a50" ON "api_call_log" ("correlationId") `);
        await queryRunner.query(`CREATE INDEX "IDX_89292145eeceb7ff32dac0de83" ON "api_call_log" ("organizationId") `);
        await queryRunner.query(`CREATE INDEX "IDX_94c4d067f73d90faaad8c2d3db" ON "api_call_log" ("tenantId") `);
        await queryRunner.query(`CREATE INDEX "IDX_85c20063cd74c766533fd08389" ON "api_call_log" ("isArchived") `);
        await queryRunner.query(`CREATE INDEX "IDX_f3505a1756b04b59626d1bd836" ON "api_call_log" ("isActive") `);
        await queryRunner.query(`DROP INDEX "IDX_5e719204dcafa8d6b2ecdeda13"`);
        await queryRunner.query(`DROP INDEX "IDX_1c0c1370ecd98040259625e17e"`);
        await queryRunner.query(`DROP INDEX "IDX_f4b0d329c4a3cf79ffe9d56504"`);
        await queryRunner.query(`DROP INDEX "IDX_96dfbcaa2990df01fe5bb39ccc"`);
        await queryRunner.query(`DROP INDEX "IDX_c6a48286f3aa8ae903bee0d1e7"`);
        await queryRunner.query(`DROP INDEX "IDX_4b3303a6b7eb92d237a4379734"`);
        await queryRunner.query(`DROP INDEX "IDX_510cb87f5da169e57e694d1a5c"`);
        await queryRunner.query(`DROP INDEX "IDX_175b7be641928a31521224daa8"`);
        await queryRunner.query(`CREATE TABLE "temporary_employee" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "organizationId" varchar, "valueDate" datetime, "isActive" boolean DEFAULT (1), "short_description" varchar(200), "description" varchar, "startedWorkOn" datetime, "endWork" datetime, "payPeriod" varchar, "billRateValue" integer, "billRateCurrency" varchar, "reWeeklyLimit" integer, "offerDate" datetime, "acceptDate" datetime, "rejectDate" datetime, "employeeLevel" varchar(500), "anonymousBonus" boolean, "averageIncome" numeric, "averageBonus" numeric, "totalWorkHours" numeric DEFAULT (0), "averageExpenses" numeric, "show_anonymous_bonus" boolean, "show_average_bonus" boolean, "show_average_expenses" boolean, "show_average_income" boolean, "show_billrate" boolean, "show_payperiod" boolean, "show_start_work_on" boolean, "isJobSearchActive" boolean, "linkedInUrl" varchar, "facebookUrl" varchar, "instagramUrl" varchar, "twitterUrl" varchar, "githubUrl" varchar, "gitlabUrl" varchar, "upworkUrl" varchar, "stackoverflowUrl" varchar, "isVerified" boolean, "isVetted" boolean, "totalJobs" numeric, "jobSuccess" numeric, "profile_link" varchar, "userId" varchar NOT NULL, "contactId" varchar, "organizationPositionId" varchar, "isTrackingEnabled" boolean DEFAULT (0), "deletedAt" datetime, "allowScreenshotCapture" boolean NOT NULL DEFAULT (1), "upworkId" varchar, "linkedInId" varchar, "isOnline" boolean DEFAULT (0), "isTrackingTime" boolean DEFAULT (0), "minimumBillingRate" integer, "isAway" boolean DEFAULT (0), "isArchived" boolean DEFAULT (0), "fix_relational_custom_fields" boolean, "archivedAt" datetime, "allowManualTime" boolean NOT NULL DEFAULT (0), "allowModifyTime" boolean NOT NULL DEFAULT (0), "allowDeleteTime" boolean NOT NULL DEFAULT (0), CONSTRAINT "REL_1c0c1370ecd98040259625e17e" UNIQUE ("contactId"), CONSTRAINT "REL_f4b0d329c4a3cf79ffe9d56504" UNIQUE ("userId"), CONSTRAINT "FK_5e719204dcafa8d6b2ecdeda130" FOREIGN KEY ("organizationPositionId") REFERENCES "organization_position" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION, CONSTRAINT "FK_1c0c1370ecd98040259625e17e2" FOREIGN KEY ("contactId") REFERENCES "contact" ("id") ON DELETE SET NULL ON UPDATE NO ACTION, CONSTRAINT "FK_f4b0d329c4a3cf79ffe9d565047" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_c6a48286f3aa8ae903bee0d1e72" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_4b3303a6b7eb92d237a4379734e" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`);
        await queryRunner.query(`INSERT INTO "temporary_employee"("id", "createdAt", "updatedAt", "tenantId", "organizationId", "valueDate", "isActive", "short_description", "description", "startedWorkOn", "endWork", "payPeriod", "billRateValue", "billRateCurrency", "reWeeklyLimit", "offerDate", "acceptDate", "rejectDate", "employeeLevel", "anonymousBonus", "averageIncome", "averageBonus", "totalWorkHours", "averageExpenses", "show_anonymous_bonus", "show_average_bonus", "show_average_expenses", "show_average_income", "show_billrate", "show_payperiod", "show_start_work_on", "isJobSearchActive", "linkedInUrl", "facebookUrl", "instagramUrl", "twitterUrl", "githubUrl", "gitlabUrl", "upworkUrl", "stackoverflowUrl", "isVerified", "isVetted", "totalJobs", "jobSuccess", "profile_link", "userId", "contactId", "organizationPositionId", "isTrackingEnabled", "deletedAt", "allowScreenshotCapture", "upworkId", "linkedInId", "isOnline", "isTrackingTime", "minimumBillingRate", "isAway", "isArchived", "fix_relational_custom_fields", "archivedAt") SELECT "id", "createdAt", "updatedAt", "tenantId", "organizationId", "valueDate", "isActive", "short_description", "description", "startedWorkOn", "endWork", "payPeriod", "billRateValue", "billRateCurrency", "reWeeklyLimit", "offerDate", "acceptDate", "rejectDate", "employeeLevel", "anonymousBonus", "averageIncome", "averageBonus", "totalWorkHours", "averageExpenses", "show_anonymous_bonus", "show_average_bonus", "show_average_expenses", "show_average_income", "show_billrate", "show_payperiod", "show_start_work_on", "isJobSearchActive", "linkedInUrl", "facebookUrl", "instagramUrl", "twitterUrl", "githubUrl", "gitlabUrl", "upworkUrl", "stackoverflowUrl", "isVerified", "isVetted", "totalJobs", "jobSuccess", "profile_link", "userId", "contactId", "organizationPositionId", "isTrackingEnabled", "deletedAt", "allowScreenshotCapture", "upworkId", "linkedInId", "isOnline", "isTrackingTime", "minimumBillingRate", "isAway", "isArchived", "fix_relational_custom_fields", "archivedAt" FROM "employee"`);
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
        await queryRunner.query(`DROP INDEX "IDX_ada33b1685138be7798aea280b"`);
        await queryRunner.query(`DROP INDEX "IDX_964d6a55608f67f7d92e9827db"`);
        await queryRunner.query(`DROP INDEX "IDX_085b00c43479478866d7a27ca9"`);
        await queryRunner.query(`DROP INDEX "IDX_66f2fd42fa8f00e11d6960cb39"`);
        await queryRunner.query(`DROP INDEX "IDX_1d6cb060eba156d1e50f7ea4a0"`);
        await queryRunner.query(`DROP INDEX "IDX_5820fe8a6385bfc0338c49a508"`);
        await queryRunner.query(`DROP INDEX "IDX_0a62fc4546d596f9e9ce305ecb"`);
        await queryRunner.query(`DROP INDEX "IDX_b484d5942747f0c19372ae8fcd"`);
        await queryRunner.query(`DROP INDEX "IDX_c74a2db6a95bb3a5b788e23a50"`);
        await queryRunner.query(`DROP INDEX "IDX_89292145eeceb7ff32dac0de83"`);
        await queryRunner.query(`DROP INDEX "IDX_94c4d067f73d90faaad8c2d3db"`);
        await queryRunner.query(`DROP INDEX "IDX_85c20063cd74c766533fd08389"`);
        await queryRunner.query(`DROP INDEX "IDX_f3505a1756b04b59626d1bd836"`);
        await queryRunner.query(`CREATE TABLE "temporary_api_call_log" ("deletedAt" datetime, "id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "tenantId" varchar, "organizationId" varchar, "correlationId" varchar NOT NULL, "url" varchar NOT NULL, "method" integer NOT NULL, "requestHeaders" text NOT NULL, "requestBody" text NOT NULL, "responseBody" text NOT NULL, "statusCode" integer NOT NULL, "requestTime" datetime NOT NULL, "responseTime" datetime NOT NULL, "ipAddress" varchar, "protocol" varchar, "userAgent" varchar, "userId" varchar, "origin" varchar, CONSTRAINT "FK_ada33b1685138be7798aea280b2" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_89292145eeceb7ff32dac0de83b" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_94c4d067f73d90faaad8c2d3dbd" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`);
        await queryRunner.query(`INSERT INTO "temporary_api_call_log"("deletedAt", "id", "createdAt", "updatedAt", "isActive", "isArchived", "archivedAt", "tenantId", "organizationId", "correlationId", "url", "method", "requestHeaders", "requestBody", "responseBody", "statusCode", "requestTime", "responseTime", "ipAddress", "protocol", "userAgent", "userId", "origin") SELECT "deletedAt", "id", "createdAt", "updatedAt", "isActive", "isArchived", "archivedAt", "tenantId", "organizationId", "correlationId", "url", "method", "requestHeaders", "requestBody", "responseBody", "statusCode", "requestTime", "responseTime", "ipAddress", "protocol", "userAgent", "userId", "origin" FROM "api_call_log"`);
        await queryRunner.query(`DROP TABLE "api_call_log"`);
        await queryRunner.query(`ALTER TABLE "temporary_api_call_log" RENAME TO "api_call_log"`);
        await queryRunner.query(`CREATE INDEX "IDX_ada33b1685138be7798aea280b" ON "api_call_log" ("userId") `);
        await queryRunner.query(`CREATE INDEX "IDX_964d6a55608f67f7d92e9827db" ON "api_call_log" ("protocol") `);
        await queryRunner.query(`CREATE INDEX "IDX_085b00c43479478866d7a27ca9" ON "api_call_log" ("ipAddress") `);
        await queryRunner.query(`CREATE INDEX "IDX_66f2fd42fa8f00e11d6960cb39" ON "api_call_log" ("responseTime") `);
        await queryRunner.query(`CREATE INDEX "IDX_1d6cb060eba156d1e50f7ea4a0" ON "api_call_log" ("requestTime") `);
        await queryRunner.query(`CREATE INDEX "IDX_5820fe8a6385bfc0338c49a508" ON "api_call_log" ("statusCode") `);
        await queryRunner.query(`CREATE INDEX "IDX_0a62fc4546d596f9e9ce305ecb" ON "api_call_log" ("method") `);
        await queryRunner.query(`CREATE INDEX "IDX_b484d5942747f0c19372ae8fcd" ON "api_call_log" ("url") `);
        await queryRunner.query(`CREATE INDEX "IDX_c74a2db6a95bb3a5b788e23a50" ON "api_call_log" ("correlationId") `);
        await queryRunner.query(`CREATE INDEX "IDX_89292145eeceb7ff32dac0de83" ON "api_call_log" ("organizationId") `);
        await queryRunner.query(`CREATE INDEX "IDX_94c4d067f73d90faaad8c2d3db" ON "api_call_log" ("tenantId") `);
        await queryRunner.query(`CREATE INDEX "IDX_85c20063cd74c766533fd08389" ON "api_call_log" ("isArchived") `);
        await queryRunner.query(`CREATE INDEX "IDX_f3505a1756b04b59626d1bd836" ON "api_call_log" ("isActive") `);
        await queryRunner.query(`CREATE INDEX "IDX_e891dad6f91b8eb04a47f42a06" ON "resource_link" ("isActive") `);
        await queryRunner.query(`CREATE INDEX "IDX_2efdd5f6dc5d0c483edbc932ff" ON "resource_link" ("isArchived") `);
        await queryRunner.query(`CREATE INDEX "IDX_64d90b997156b7de382fd8a88f" ON "resource_link" ("tenantId") `);
        await queryRunner.query(`CREATE INDEX "IDX_b3caaf70dcd98d572c0fe09c59" ON "resource_link" ("organizationId") `);
        await queryRunner.query(`CREATE INDEX "IDX_ada8b0cf4463e653a756fc6db2" ON "resource_link" ("entity") `);
        await queryRunner.query(`CREATE INDEX "IDX_61dc38c01dfd2fe25cd934a0d1" ON "resource_link" ("entityId") `);
        await queryRunner.query(`CREATE INDEX "IDX_df91a85b49f78544da67aa9d9a" ON "resource_link" ("creatorId") `);
        await queryRunner.query(`DROP INDEX "IDX_e891dad6f91b8eb04a47f42a06"`);
        await queryRunner.query(`DROP INDEX "IDX_2efdd5f6dc5d0c483edbc932ff"`);
        await queryRunner.query(`DROP INDEX "IDX_64d90b997156b7de382fd8a88f"`);
        await queryRunner.query(`DROP INDEX "IDX_b3caaf70dcd98d572c0fe09c59"`);
        await queryRunner.query(`DROP INDEX "IDX_ada8b0cf4463e653a756fc6db2"`);
        await queryRunner.query(`DROP INDEX "IDX_61dc38c01dfd2fe25cd934a0d1"`);
        await queryRunner.query(`DROP INDEX "IDX_df91a85b49f78544da67aa9d9a"`);
        await queryRunner.query(`CREATE TABLE "temporary_resource_link" ("deletedAt" datetime, "id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "tenantId" varchar, "organizationId" varchar, "entity" varchar NOT NULL, "entityId" varchar NOT NULL, "title" varchar NOT NULL, "url" text NOT NULL, "metaData" text, "creatorId" varchar, CONSTRAINT "FK_64d90b997156b7de382fd8a88f2" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_b3caaf70dcd98d572c0fe09c59f" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_df91a85b49f78544da67aa9d9ad" FOREIGN KEY ("creatorId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`);
        await queryRunner.query(`INSERT INTO "temporary_resource_link"("deletedAt", "id", "createdAt", "updatedAt", "isActive", "isArchived", "archivedAt", "tenantId", "organizationId", "entity", "entityId", "title", "url", "metaData", "creatorId") SELECT "deletedAt", "id", "createdAt", "updatedAt", "isActive", "isArchived", "archivedAt", "tenantId", "organizationId", "entity", "entityId", "title", "url", "metaData", "creatorId" FROM "resource_link"`);
        await queryRunner.query(`DROP TABLE "resource_link"`);
        await queryRunner.query(`ALTER TABLE "temporary_resource_link" RENAME TO "resource_link"`);
        await queryRunner.query(`CREATE INDEX "IDX_e891dad6f91b8eb04a47f42a06" ON "resource_link" ("isActive") `);
        await queryRunner.query(`CREATE INDEX "IDX_2efdd5f6dc5d0c483edbc932ff" ON "resource_link" ("isArchived") `);
        await queryRunner.query(`CREATE INDEX "IDX_64d90b997156b7de382fd8a88f" ON "resource_link" ("tenantId") `);
        await queryRunner.query(`CREATE INDEX "IDX_b3caaf70dcd98d572c0fe09c59" ON "resource_link" ("organizationId") `);
        await queryRunner.query(`CREATE INDEX "IDX_ada8b0cf4463e653a756fc6db2" ON "resource_link" ("entity") `);
        await queryRunner.query(`CREATE INDEX "IDX_61dc38c01dfd2fe25cd934a0d1" ON "resource_link" ("entityId") `);
        await queryRunner.query(`CREATE INDEX "IDX_df91a85b49f78544da67aa9d9a" ON "resource_link" ("creatorId") `);
        await queryRunner.query(`DROP INDEX "IDX_7ae5b4d4bdec77971dab319f2e"`);
        await queryRunner.query(`DROP INDEX "IDX_68e75e49f06409fd385b4f8774"`);
        await queryRunner.query(`CREATE TABLE "temporary_employee_job_preset" ("jobPresetId" varchar NOT NULL, "employeeId" varchar NOT NULL, CONSTRAINT "FK_68e75e49f06409fd385b4f87746" FOREIGN KEY ("employeeId") REFERENCES "employee" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_7ae5b4d4bdec77971dab319f2e2" FOREIGN KEY ("jobPresetId") REFERENCES "job_preset" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION, PRIMARY KEY ("jobPresetId", "employeeId"))`);
        await queryRunner.query(`INSERT INTO "temporary_employee_job_preset"("jobPresetId", "employeeId") SELECT "jobPresetId", "employeeId" FROM "employee_job_preset"`);
        await queryRunner.query(`DROP TABLE "employee_job_preset"`);
        await queryRunner.query(`ALTER TABLE "temporary_employee_job_preset" RENAME TO "employee_job_preset"`);
        await queryRunner.query(`CREATE INDEX "IDX_7ae5b4d4bdec77971dab319f2e" ON "employee_job_preset" ("jobPresetId") `);
        await queryRunner.query(`CREATE INDEX "IDX_68e75e49f06409fd385b4f8774" ON "employee_job_preset" ("employeeId") `);
    }

    /**
    * SqliteDB and BetterSQlite3DB Down Migration
    *
    * @param queryRunner
    */
    public async sqliteDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`DROP INDEX "IDX_68e75e49f06409fd385b4f8774"`);
        await queryRunner.query(`DROP INDEX "IDX_7ae5b4d4bdec77971dab319f2e"`);
        await queryRunner.query(`ALTER TABLE "employee_job_preset" RENAME TO "temporary_employee_job_preset"`);
        await queryRunner.query(`CREATE TABLE "employee_job_preset" ("jobPresetId" varchar NOT NULL, "employeeId" varchar NOT NULL, CONSTRAINT "FK_68e75e49f06409fd385b4f87746" FOREIGN KEY ("employeeId") REFERENCES "employee" ("id") ON DELETE CASCADE ON UPDATE CASCADE, PRIMARY KEY ("jobPresetId", "employeeId"))`);
        await queryRunner.query(`INSERT INTO "employee_job_preset"("jobPresetId", "employeeId") SELECT "jobPresetId", "employeeId" FROM "temporary_employee_job_preset"`);
        await queryRunner.query(`DROP TABLE "temporary_employee_job_preset"`);
        await queryRunner.query(`CREATE INDEX "IDX_68e75e49f06409fd385b4f8774" ON "employee_job_preset" ("employeeId") `);
        await queryRunner.query(`CREATE INDEX "IDX_7ae5b4d4bdec77971dab319f2e" ON "employee_job_preset" ("jobPresetId") `);
        await queryRunner.query(`DROP INDEX "IDX_df91a85b49f78544da67aa9d9a"`);
        await queryRunner.query(`DROP INDEX "IDX_61dc38c01dfd2fe25cd934a0d1"`);
        await queryRunner.query(`DROP INDEX "IDX_ada8b0cf4463e653a756fc6db2"`);
        await queryRunner.query(`DROP INDEX "IDX_b3caaf70dcd98d572c0fe09c59"`);
        await queryRunner.query(`DROP INDEX "IDX_64d90b997156b7de382fd8a88f"`);
        await queryRunner.query(`DROP INDEX "IDX_2efdd5f6dc5d0c483edbc932ff"`);
        await queryRunner.query(`DROP INDEX "IDX_e891dad6f91b8eb04a47f42a06"`);
        await queryRunner.query(`ALTER TABLE "resource_link" RENAME TO "temporary_resource_link"`);
        await queryRunner.query(`CREATE TABLE "resource_link" ("deletedAt" datetime, "id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "tenantId" varchar, "organizationId" varchar, "entity" varchar NOT NULL, "entityId" varchar NOT NULL, "title" varchar NOT NULL, "url" text NOT NULL, "metaData" text, "creatorId" varchar)`);
        await queryRunner.query(`INSERT INTO "resource_link"("deletedAt", "id", "createdAt", "updatedAt", "isActive", "isArchived", "archivedAt", "tenantId", "organizationId", "entity", "entityId", "title", "url", "metaData", "creatorId") SELECT "deletedAt", "id", "createdAt", "updatedAt", "isActive", "isArchived", "archivedAt", "tenantId", "organizationId", "entity", "entityId", "title", "url", "metaData", "creatorId" FROM "temporary_resource_link"`);
        await queryRunner.query(`DROP TABLE "temporary_resource_link"`);
        await queryRunner.query(`CREATE INDEX "IDX_df91a85b49f78544da67aa9d9a" ON "resource_link" ("creatorId") `);
        await queryRunner.query(`CREATE INDEX "IDX_61dc38c01dfd2fe25cd934a0d1" ON "resource_link" ("entityId") `);
        await queryRunner.query(`CREATE INDEX "IDX_ada8b0cf4463e653a756fc6db2" ON "resource_link" ("entity") `);
        await queryRunner.query(`CREATE INDEX "IDX_b3caaf70dcd98d572c0fe09c59" ON "resource_link" ("organizationId") `);
        await queryRunner.query(`CREATE INDEX "IDX_64d90b997156b7de382fd8a88f" ON "resource_link" ("tenantId") `);
        await queryRunner.query(`CREATE INDEX "IDX_2efdd5f6dc5d0c483edbc932ff" ON "resource_link" ("isArchived") `);
        await queryRunner.query(`CREATE INDEX "IDX_e891dad6f91b8eb04a47f42a06" ON "resource_link" ("isActive") `);
        await queryRunner.query(`DROP INDEX "IDX_df91a85b49f78544da67aa9d9a"`);
        await queryRunner.query(`DROP INDEX "IDX_61dc38c01dfd2fe25cd934a0d1"`);
        await queryRunner.query(`DROP INDEX "IDX_ada8b0cf4463e653a756fc6db2"`);
        await queryRunner.query(`DROP INDEX "IDX_b3caaf70dcd98d572c0fe09c59"`);
        await queryRunner.query(`DROP INDEX "IDX_64d90b997156b7de382fd8a88f"`);
        await queryRunner.query(`DROP INDEX "IDX_2efdd5f6dc5d0c483edbc932ff"`);
        await queryRunner.query(`DROP INDEX "IDX_e891dad6f91b8eb04a47f42a06"`);
        await queryRunner.query(`DROP INDEX "IDX_f3505a1756b04b59626d1bd836"`);
        await queryRunner.query(`DROP INDEX "IDX_85c20063cd74c766533fd08389"`);
        await queryRunner.query(`DROP INDEX "IDX_94c4d067f73d90faaad8c2d3db"`);
        await queryRunner.query(`DROP INDEX "IDX_89292145eeceb7ff32dac0de83"`);
        await queryRunner.query(`DROP INDEX "IDX_c74a2db6a95bb3a5b788e23a50"`);
        await queryRunner.query(`DROP INDEX "IDX_b484d5942747f0c19372ae8fcd"`);
        await queryRunner.query(`DROP INDEX "IDX_0a62fc4546d596f9e9ce305ecb"`);
        await queryRunner.query(`DROP INDEX "IDX_5820fe8a6385bfc0338c49a508"`);
        await queryRunner.query(`DROP INDEX "IDX_1d6cb060eba156d1e50f7ea4a0"`);
        await queryRunner.query(`DROP INDEX "IDX_66f2fd42fa8f00e11d6960cb39"`);
        await queryRunner.query(`DROP INDEX "IDX_085b00c43479478866d7a27ca9"`);
        await queryRunner.query(`DROP INDEX "IDX_964d6a55608f67f7d92e9827db"`);
        await queryRunner.query(`DROP INDEX "IDX_ada33b1685138be7798aea280b"`);
        await queryRunner.query(`ALTER TABLE "api_call_log" RENAME TO "temporary_api_call_log"`);
        await queryRunner.query(`CREATE TABLE "api_call_log" ("deletedAt" datetime, "id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "tenantId" varchar, "organizationId" varchar, "correlationId" varchar NOT NULL, "url" varchar NOT NULL, "method" integer NOT NULL, "requestHeaders" text NOT NULL, "requestBody" text NOT NULL, "responseBody" text NOT NULL, "statusCode" integer NOT NULL, "requestTime" datetime NOT NULL, "responseTime" datetime NOT NULL, "ipAddress" varchar, "protocol" varchar NOT NULL, "userAgent" varchar NOT NULL, "userId" varchar, "origin" varchar, CONSTRAINT "FK_ada33b1685138be7798aea280b2" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_89292145eeceb7ff32dac0de83b" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_94c4d067f73d90faaad8c2d3dbd" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`);
        await queryRunner.query(`INSERT INTO "api_call_log"("deletedAt", "id", "createdAt", "updatedAt", "isActive", "isArchived", "archivedAt", "tenantId", "organizationId", "correlationId", "url", "method", "requestHeaders", "requestBody", "responseBody", "statusCode", "requestTime", "responseTime", "ipAddress", "protocol", "userAgent", "userId", "origin") SELECT "deletedAt", "id", "createdAt", "updatedAt", "isActive", "isArchived", "archivedAt", "tenantId", "organizationId", "correlationId", "url", "method", "requestHeaders", "requestBody", "responseBody", "statusCode", "requestTime", "responseTime", "ipAddress", "protocol", "userAgent", "userId", "origin" FROM "temporary_api_call_log"`);
        await queryRunner.query(`DROP TABLE "temporary_api_call_log"`);
        await queryRunner.query(`CREATE INDEX "IDX_f3505a1756b04b59626d1bd836" ON "api_call_log" ("isActive") `);
        await queryRunner.query(`CREATE INDEX "IDX_85c20063cd74c766533fd08389" ON "api_call_log" ("isArchived") `);
        await queryRunner.query(`CREATE INDEX "IDX_94c4d067f73d90faaad8c2d3db" ON "api_call_log" ("tenantId") `);
        await queryRunner.query(`CREATE INDEX "IDX_89292145eeceb7ff32dac0de83" ON "api_call_log" ("organizationId") `);
        await queryRunner.query(`CREATE INDEX "IDX_c74a2db6a95bb3a5b788e23a50" ON "api_call_log" ("correlationId") `);
        await queryRunner.query(`CREATE INDEX "IDX_b484d5942747f0c19372ae8fcd" ON "api_call_log" ("url") `);
        await queryRunner.query(`CREATE INDEX "IDX_0a62fc4546d596f9e9ce305ecb" ON "api_call_log" ("method") `);
        await queryRunner.query(`CREATE INDEX "IDX_5820fe8a6385bfc0338c49a508" ON "api_call_log" ("statusCode") `);
        await queryRunner.query(`CREATE INDEX "IDX_1d6cb060eba156d1e50f7ea4a0" ON "api_call_log" ("requestTime") `);
        await queryRunner.query(`CREATE INDEX "IDX_66f2fd42fa8f00e11d6960cb39" ON "api_call_log" ("responseTime") `);
        await queryRunner.query(`CREATE INDEX "IDX_085b00c43479478866d7a27ca9" ON "api_call_log" ("ipAddress") `);
        await queryRunner.query(`CREATE INDEX "IDX_964d6a55608f67f7d92e9827db" ON "api_call_log" ("protocol") `);
        await queryRunner.query(`CREATE INDEX "IDX_ada33b1685138be7798aea280b" ON "api_call_log" ("userId") `);
        await queryRunner.query(`DROP INDEX "IDX_175b7be641928a31521224daa8"`);
        await queryRunner.query(`DROP INDEX "IDX_510cb87f5da169e57e694d1a5c"`);
        await queryRunner.query(`DROP INDEX "IDX_4b3303a6b7eb92d237a4379734"`);
        await queryRunner.query(`DROP INDEX "IDX_c6a48286f3aa8ae903bee0d1e7"`);
        await queryRunner.query(`DROP INDEX "IDX_96dfbcaa2990df01fe5bb39ccc"`);
        await queryRunner.query(`DROP INDEX "IDX_f4b0d329c4a3cf79ffe9d56504"`);
        await queryRunner.query(`DROP INDEX "IDX_1c0c1370ecd98040259625e17e"`);
        await queryRunner.query(`DROP INDEX "IDX_5e719204dcafa8d6b2ecdeda13"`);
        await queryRunner.query(`ALTER TABLE "employee" RENAME TO "temporary_employee"`);
        await queryRunner.query(`CREATE TABLE "employee" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "organizationId" varchar, "valueDate" datetime, "isActive" boolean DEFAULT (1), "short_description" varchar(200), "description" varchar, "startedWorkOn" datetime, "endWork" datetime, "payPeriod" varchar, "billRateValue" integer, "billRateCurrency" varchar, "reWeeklyLimit" integer, "offerDate" datetime, "acceptDate" datetime, "rejectDate" datetime, "employeeLevel" varchar(500), "anonymousBonus" boolean, "averageIncome" numeric, "averageBonus" numeric, "totalWorkHours" numeric DEFAULT (0), "averageExpenses" numeric, "show_anonymous_bonus" boolean, "show_average_bonus" boolean, "show_average_expenses" boolean, "show_average_income" boolean, "show_billrate" boolean, "show_payperiod" boolean, "show_start_work_on" boolean, "isJobSearchActive" boolean, "linkedInUrl" varchar, "facebookUrl" varchar, "instagramUrl" varchar, "twitterUrl" varchar, "githubUrl" varchar, "gitlabUrl" varchar, "upworkUrl" varchar, "stackoverflowUrl" varchar, "isVerified" boolean, "isVetted" boolean, "totalJobs" numeric, "jobSuccess" numeric, "profile_link" varchar, "userId" varchar NOT NULL, "contactId" varchar, "organizationPositionId" varchar, "isTrackingEnabled" boolean DEFAULT (0), "deletedAt" datetime, "allowScreenshotCapture" boolean NOT NULL DEFAULT (1), "upworkId" varchar, "linkedInId" varchar, "isOnline" boolean DEFAULT (0), "isTrackingTime" boolean DEFAULT (0), "minimumBillingRate" integer, "isAway" boolean DEFAULT (0), "isArchived" boolean DEFAULT (0), "fix_relational_custom_fields" boolean, "archivedAt" datetime, CONSTRAINT "REL_1c0c1370ecd98040259625e17e" UNIQUE ("contactId"), CONSTRAINT "REL_f4b0d329c4a3cf79ffe9d56504" UNIQUE ("userId"), CONSTRAINT "FK_5e719204dcafa8d6b2ecdeda130" FOREIGN KEY ("organizationPositionId") REFERENCES "organization_position" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION, CONSTRAINT "FK_1c0c1370ecd98040259625e17e2" FOREIGN KEY ("contactId") REFERENCES "contact" ("id") ON DELETE SET NULL ON UPDATE NO ACTION, CONSTRAINT "FK_f4b0d329c4a3cf79ffe9d565047" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_c6a48286f3aa8ae903bee0d1e72" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_4b3303a6b7eb92d237a4379734e" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`);
        await queryRunner.query(`INSERT INTO "employee"("id", "createdAt", "updatedAt", "tenantId", "organizationId", "valueDate", "isActive", "short_description", "description", "startedWorkOn", "endWork", "payPeriod", "billRateValue", "billRateCurrency", "reWeeklyLimit", "offerDate", "acceptDate", "rejectDate", "employeeLevel", "anonymousBonus", "averageIncome", "averageBonus", "totalWorkHours", "averageExpenses", "show_anonymous_bonus", "show_average_bonus", "show_average_expenses", "show_average_income", "show_billrate", "show_payperiod", "show_start_work_on", "isJobSearchActive", "linkedInUrl", "facebookUrl", "instagramUrl", "twitterUrl", "githubUrl", "gitlabUrl", "upworkUrl", "stackoverflowUrl", "isVerified", "isVetted", "totalJobs", "jobSuccess", "profile_link", "userId", "contactId", "organizationPositionId", "isTrackingEnabled", "deletedAt", "allowScreenshotCapture", "upworkId", "linkedInId", "isOnline", "isTrackingTime", "minimumBillingRate", "isAway", "isArchived", "fix_relational_custom_fields", "archivedAt") SELECT "id", "createdAt", "updatedAt", "tenantId", "organizationId", "valueDate", "isActive", "short_description", "description", "startedWorkOn", "endWork", "payPeriod", "billRateValue", "billRateCurrency", "reWeeklyLimit", "offerDate", "acceptDate", "rejectDate", "employeeLevel", "anonymousBonus", "averageIncome", "averageBonus", "totalWorkHours", "averageExpenses", "show_anonymous_bonus", "show_average_bonus", "show_average_expenses", "show_average_income", "show_billrate", "show_payperiod", "show_start_work_on", "isJobSearchActive", "linkedInUrl", "facebookUrl", "instagramUrl", "twitterUrl", "githubUrl", "gitlabUrl", "upworkUrl", "stackoverflowUrl", "isVerified", "isVetted", "totalJobs", "jobSuccess", "profile_link", "userId", "contactId", "organizationPositionId", "isTrackingEnabled", "deletedAt", "allowScreenshotCapture", "upworkId", "linkedInId", "isOnline", "isTrackingTime", "minimumBillingRate", "isAway", "isArchived", "fix_relational_custom_fields", "archivedAt" FROM "temporary_employee"`);
        await queryRunner.query(`DROP TABLE "temporary_employee"`);
        await queryRunner.query(`CREATE INDEX "IDX_175b7be641928a31521224daa8" ON "employee" ("isArchived") `);
        await queryRunner.query(`CREATE INDEX "IDX_510cb87f5da169e57e694d1a5c" ON "employee" ("isActive") `);
        await queryRunner.query(`CREATE INDEX "IDX_4b3303a6b7eb92d237a4379734" ON "employee" ("tenantId") `);
        await queryRunner.query(`CREATE INDEX "IDX_c6a48286f3aa8ae903bee0d1e7" ON "employee" ("organizationId") `);
        await queryRunner.query(`CREATE INDEX "IDX_96dfbcaa2990df01fe5bb39ccc" ON "employee" ("profile_link") `);
        await queryRunner.query(`CREATE INDEX "IDX_f4b0d329c4a3cf79ffe9d56504" ON "employee" ("userId") `);
        await queryRunner.query(`CREATE INDEX "IDX_1c0c1370ecd98040259625e17e" ON "employee" ("contactId") `);
        await queryRunner.query(`CREATE INDEX "IDX_5e719204dcafa8d6b2ecdeda13" ON "employee" ("organizationPositionId") `);
        await queryRunner.query(`DROP INDEX "IDX_f3505a1756b04b59626d1bd836"`);
        await queryRunner.query(`DROP INDEX "IDX_85c20063cd74c766533fd08389"`);
        await queryRunner.query(`DROP INDEX "IDX_94c4d067f73d90faaad8c2d3db"`);
        await queryRunner.query(`DROP INDEX "IDX_89292145eeceb7ff32dac0de83"`);
        await queryRunner.query(`DROP INDEX "IDX_c74a2db6a95bb3a5b788e23a50"`);
        await queryRunner.query(`DROP INDEX "IDX_b484d5942747f0c19372ae8fcd"`);
        await queryRunner.query(`DROP INDEX "IDX_0a62fc4546d596f9e9ce305ecb"`);
        await queryRunner.query(`DROP INDEX "IDX_5820fe8a6385bfc0338c49a508"`);
        await queryRunner.query(`DROP INDEX "IDX_1d6cb060eba156d1e50f7ea4a0"`);
        await queryRunner.query(`DROP INDEX "IDX_66f2fd42fa8f00e11d6960cb39"`);
        await queryRunner.query(`DROP INDEX "IDX_085b00c43479478866d7a27ca9"`);
        await queryRunner.query(`DROP INDEX "IDX_964d6a55608f67f7d92e9827db"`);
        await queryRunner.query(`DROP INDEX "IDX_ada33b1685138be7798aea280b"`);
        await queryRunner.query(`ALTER TABLE "api_call_log" RENAME TO "temporary_api_call_log"`);
        await queryRunner.query(`CREATE TABLE "api_call_log" ("deletedAt" datetime, "id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "tenantId" varchar, "organizationId" varchar, "correlationId" varchar NOT NULL, "url" varchar NOT NULL, "method" integer NOT NULL, "requestHeaders" text NOT NULL, "requestBody" text NOT NULL, "responseBody" text NOT NULL, "statusCode" integer NOT NULL, "requestTime" datetime NOT NULL, "responseTime" datetime NOT NULL, "ipAddress" varchar, "protocol" varchar NOT NULL, "userAgent" varchar NOT NULL, "userId" varchar, CONSTRAINT "FK_ada33b1685138be7798aea280b2" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_89292145eeceb7ff32dac0de83b" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_94c4d067f73d90faaad8c2d3dbd" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`);
        await queryRunner.query(`INSERT INTO "api_call_log"("deletedAt", "id", "createdAt", "updatedAt", "isActive", "isArchived", "archivedAt", "tenantId", "organizationId", "correlationId", "url", "method", "requestHeaders", "requestBody", "responseBody", "statusCode", "requestTime", "responseTime", "ipAddress", "protocol", "userAgent", "userId") SELECT "deletedAt", "id", "createdAt", "updatedAt", "isActive", "isArchived", "archivedAt", "tenantId", "organizationId", "correlationId", "url", "method", "requestHeaders", "requestBody", "responseBody", "statusCode", "requestTime", "responseTime", "ipAddress", "protocol", "userAgent", "userId" FROM "temporary_api_call_log"`);
        await queryRunner.query(`DROP TABLE "temporary_api_call_log"`);
        await queryRunner.query(`CREATE INDEX "IDX_f3505a1756b04b59626d1bd836" ON "api_call_log" ("isActive") `);
        await queryRunner.query(`CREATE INDEX "IDX_85c20063cd74c766533fd08389" ON "api_call_log" ("isArchived") `);
        await queryRunner.query(`CREATE INDEX "IDX_94c4d067f73d90faaad8c2d3db" ON "api_call_log" ("tenantId") `);
        await queryRunner.query(`CREATE INDEX "IDX_89292145eeceb7ff32dac0de83" ON "api_call_log" ("organizationId") `);
        await queryRunner.query(`CREATE INDEX "IDX_c74a2db6a95bb3a5b788e23a50" ON "api_call_log" ("correlationId") `);
        await queryRunner.query(`CREATE INDEX "IDX_b484d5942747f0c19372ae8fcd" ON "api_call_log" ("url") `);
        await queryRunner.query(`CREATE INDEX "IDX_0a62fc4546d596f9e9ce305ecb" ON "api_call_log" ("method") `);
        await queryRunner.query(`CREATE INDEX "IDX_5820fe8a6385bfc0338c49a508" ON "api_call_log" ("statusCode") `);
        await queryRunner.query(`CREATE INDEX "IDX_1d6cb060eba156d1e50f7ea4a0" ON "api_call_log" ("requestTime") `);
        await queryRunner.query(`CREATE INDEX "IDX_66f2fd42fa8f00e11d6960cb39" ON "api_call_log" ("responseTime") `);
        await queryRunner.query(`CREATE INDEX "IDX_085b00c43479478866d7a27ca9" ON "api_call_log" ("ipAddress") `);
        await queryRunner.query(`CREATE INDEX "IDX_964d6a55608f67f7d92e9827db" ON "api_call_log" ("protocol") `);
        await queryRunner.query(`CREATE INDEX "IDX_ada33b1685138be7798aea280b" ON "api_call_log" ("userId") `);
        await queryRunner.query(`CREATE INDEX "IDX_841b729b80bc03ea38d16b8508" ON "resource_link" ("isActive") `);
        await queryRunner.query(`CREATE INDEX "IDX_4c25c2c9d7ebbd0c07edd824ff" ON "resource_link" ("isArchived") `);
        await queryRunner.query(`CREATE INDEX "IDX_f9438f82f6e93bd6a87b8216af" ON "resource_link" ("tenantId") `);
        await queryRunner.query(`CREATE INDEX "IDX_95603855ae10050123e48a6688" ON "resource_link" ("organizationId") `);
        await queryRunner.query(`CREATE INDEX "IDX_44100d3eaf418ee67fa7a756f1" ON "resource_link" ("entity") `);
        await queryRunner.query(`CREATE INDEX "IDX_b73c278619bd8fb7f30f93182c" ON "resource_link" ("entityId") `);
        await queryRunner.query(`CREATE INDEX "IDX_2ef674d18792e8864fd8d484ea" ON "resource_link" ("creatorId") `);
        await queryRunner.query(`DROP INDEX "IDX_68e75e49f06409fd385b4f8774"`);
        await queryRunner.query(`DROP INDEX "IDX_7ae5b4d4bdec77971dab319f2e"`);
        await queryRunner.query(`ALTER TABLE "employee_job_preset" RENAME TO "temporary_employee_job_preset"`);
        await queryRunner.query(`CREATE TABLE "employee_job_preset" ("jobPresetId" varchar NOT NULL, "employeeId" varchar NOT NULL, CONSTRAINT "FK_7ae5b4d4bdec77971dab319f2e2" FOREIGN KEY ("jobPresetId") REFERENCES "job_preset" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION, CONSTRAINT "FK_68e75e49f06409fd385b4f87746" FOREIGN KEY ("employeeId") REFERENCES "employee" ("id") ON DELETE CASCADE ON UPDATE CASCADE, PRIMARY KEY ("jobPresetId", "employeeId"))`);
        await queryRunner.query(`INSERT INTO "employee_job_preset"("jobPresetId", "employeeId") SELECT "jobPresetId", "employeeId" FROM "temporary_employee_job_preset"`);
        await queryRunner.query(`DROP TABLE "temporary_employee_job_preset"`);
        await queryRunner.query(`CREATE INDEX "IDX_68e75e49f06409fd385b4f8774" ON "employee_job_preset" ("employeeId") `);
        await queryRunner.query(`CREATE INDEX "IDX_7ae5b4d4bdec77971dab319f2e" ON "employee_job_preset" ("jobPresetId") `);
        await queryRunner.query(`DROP INDEX "IDX_841b729b80bc03ea38d16b8508"`);
        await queryRunner.query(`DROP INDEX "IDX_4c25c2c9d7ebbd0c07edd824ff"`);
        await queryRunner.query(`DROP INDEX "IDX_f9438f82f6e93bd6a87b8216af"`);
        await queryRunner.query(`DROP INDEX "IDX_95603855ae10050123e48a6688"`);
        await queryRunner.query(`DROP INDEX "IDX_44100d3eaf418ee67fa7a756f1"`);
        await queryRunner.query(`DROP INDEX "IDX_b73c278619bd8fb7f30f93182c"`);
        await queryRunner.query(`DROP INDEX "IDX_2ef674d18792e8864fd8d484ea"`);
        await queryRunner.query(`ALTER TABLE "resource_link" RENAME TO "temporary_resource_link"`);
        await queryRunner.query(`CREATE TABLE "resource_link" ("deletedAt" datetime, "id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "archivedAt" datetime, "tenantId" varchar, "organizationId" varchar, "entity" varchar NOT NULL, "entityId" varchar NOT NULL, "title" varchar NOT NULL, "url" text NOT NULL, "metaData" text, "creatorId" varchar, CONSTRAINT "FK_2ef674d18792e8864fd8d484eac" FOREIGN KEY ("creatorId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_95603855ae10050123e48a66881" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_f9438f82f6e93bd6a87b8216af9" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`);
        await queryRunner.query(`INSERT INTO "resource_link"("deletedAt", "id", "createdAt", "updatedAt", "isActive", "isArchived", "archivedAt", "tenantId", "organizationId", "entity", "entityId", "title", "url", "metaData", "creatorId") SELECT "deletedAt", "id", "createdAt", "updatedAt", "isActive", "isArchived", "archivedAt", "tenantId", "organizationId", "entity", "entityId", "title", "url", "metaData", "creatorId" FROM "temporary_resource_link"`);
        await queryRunner.query(`DROP TABLE "temporary_resource_link"`);
        await queryRunner.query(`CREATE INDEX "IDX_841b729b80bc03ea38d16b8508" ON "resource_link" ("isActive") `);
        await queryRunner.query(`CREATE INDEX "IDX_4c25c2c9d7ebbd0c07edd824ff" ON "resource_link" ("isArchived") `);
        await queryRunner.query(`CREATE INDEX "IDX_f9438f82f6e93bd6a87b8216af" ON "resource_link" ("tenantId") `);
        await queryRunner.query(`CREATE INDEX "IDX_95603855ae10050123e48a6688" ON "resource_link" ("organizationId") `);
        await queryRunner.query(`CREATE INDEX "IDX_44100d3eaf418ee67fa7a756f1" ON "resource_link" ("entity") `);
        await queryRunner.query(`CREATE INDEX "IDX_b73c278619bd8fb7f30f93182c" ON "resource_link" ("entityId") `);
        await queryRunner.query(`CREATE INDEX "IDX_2ef674d18792e8864fd8d484ea" ON "resource_link" ("creatorId") `);
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
