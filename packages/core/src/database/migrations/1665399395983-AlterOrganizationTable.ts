import { MigrationInterface, QueryRunner } from "typeorm";
import * as chalk from "chalk";

export class AlterOrganizationTable1665399395983 implements MigrationInterface {

    name = 'AlterOrganizationTable1665399395983';

    /**
    * Up Migration
    *
    * @param queryRunner
    */
    public async up(queryRunner: QueryRunner): Promise<any> {
        console.log(chalk.yellow(this.name + ' start running!'));

        if (['sqlite', 'better-sqlite3'].includes(queryRunner.connection.options.type)) {
            await this.sqliteUpQueryRunner(queryRunner);
        } else {
            await this.postgresUpQueryRunner(queryRunner);
        }
    }

    /**
    * Down Migration
    *
    * @param queryRunner
    */
    public async down(queryRunner: QueryRunner): Promise<any> {
        if (['sqlite', 'better-sqlite3'].includes(queryRunner.connection.options.type)) {
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
        await queryRunner.query(`ALTER TABLE "organization" ADD "allowTrackInactivity" boolean NOT NULL DEFAULT true`);
        await queryRunner.query(`ALTER TABLE "organization" ADD "inactivityTimeLimit" integer NOT NULL DEFAULT '1'`);
        await queryRunner.query(`ALTER TABLE "organization" ADD "activityProofDuration" integer NOT NULL DEFAULT '1'`);
    }

    /**
    * PostgresDB Down Migration
    *
    * @param queryRunner
    */
    public async postgresDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`ALTER TABLE "organization" DROP COLUMN "activityProofDuration"`);
        await queryRunner.query(`ALTER TABLE "organization" DROP COLUMN "inactivityTimeLimit"`);
        await queryRunner.query(`ALTER TABLE "organization" DROP COLUMN "allowTrackInactivity"`);
    }

    /**
    * SqliteDB Up Migration
    *
    * @param queryRunner
    */
    public async sqliteUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`DROP INDEX "IDX_84594016a98da8b87e0f51cd93"`);
        await queryRunner.query(`DROP INDEX "IDX_f502dc6d9802306f9d1584932b"`);
        await queryRunner.query(`DROP INDEX "IDX_f5735eafddabdb4b20f621a976"`);
        await queryRunner.query(`DROP INDEX "IDX_9b2f00761a6b1b77cb6289e3ff"`);
        await queryRunner.query(`CREATE TABLE "temporary_warehouse" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "organizationId" varchar, "name" varchar NOT NULL, "code" varchar NOT NULL, "email" varchar NOT NULL, "description" varchar, "active" boolean NOT NULL DEFAULT (1), "logoId" varchar, "contactId" varchar NOT NULL, CONSTRAINT "REL_84594016a98da8b87e0f51cd93" UNIQUE ("contactId"), CONSTRAINT "FK_84594016a98da8b87e0f51cd931" FOREIGN KEY ("contactId") REFERENCES "contact" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_f502dc6d9802306f9d1584932b8" FOREIGN KEY ("logoId") REFERENCES "image_asset" ("id") ON DELETE SET NULL ON UPDATE NO ACTION, CONSTRAINT "FK_f5735eafddabdb4b20f621a976a" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_9b2f00761a6b1b77cb6289e3fff" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`);
        await queryRunner.query(`INSERT INTO "temporary_warehouse"("id", "createdAt", "updatedAt", "tenantId", "organizationId", "name", "code", "email", "description", "active", "logoId", "contactId") SELECT "id", "createdAt", "updatedAt", "tenantId", "organizationId", "name", "code", "email", "description", "active", "logoId", "contactId" FROM "warehouse"`);
        await queryRunner.query(`DROP TABLE "warehouse"`);
        await queryRunner.query(`ALTER TABLE "temporary_warehouse" RENAME TO "warehouse"`);
        await queryRunner.query(`CREATE INDEX "IDX_84594016a98da8b87e0f51cd93" ON "warehouse" ("contactId") `);
        await queryRunner.query(`CREATE INDEX "IDX_f502dc6d9802306f9d1584932b" ON "warehouse" ("logoId") `);
        await queryRunner.query(`CREATE INDEX "IDX_f5735eafddabdb4b20f621a976" ON "warehouse" ("organizationId") `);
        await queryRunner.query(`CREATE INDEX "IDX_9b2f00761a6b1b77cb6289e3ff" ON "warehouse" ("tenantId") `);
        await queryRunner.query(`DROP INDEX "IDX_7965db2b12872551b586f76dd7"`);
        await queryRunner.query(`DROP INDEX "IDX_2360aa7a4b5ab99e026584f305"`);
        await queryRunner.query(`DROP INDEX "IDX_15458cef74076623c270500053"`);
        await queryRunner.query(`DROP INDEX "IDX_9ea70bf5c390b00e7bb96b86ed"`);
        await queryRunner.query(`DROP INDEX "IDX_c75285bf286b17c7ca5537857b"`);
        await queryRunner.query(`DROP INDEX "IDX_f37d866c3326eca5f579cef35c"`);
        await queryRunner.query(`DROP INDEX "IDX_b03a8a28f6ebdb6df8f630216b"`);
        await queryRunner.query(`DROP INDEX "IDX_6cc2b2052744e352834a4c9e78"`);
        await queryRunner.query(`DROP INDEX "IDX_40460ab803bf6e5a62b75a35c5"`);
        await queryRunner.query(`DROP INDEX "IDX_03e5eecc2328eb545ff748cbdd"`);
        await queryRunner.query(`DROP INDEX "IDX_c21e615583a3ebbb0977452afb"`);
        await queryRunner.query(`DROP INDEX "IDX_745a293c8b2c750bc421fa0633"`);
        await queryRunner.query(`CREATE TABLE "temporary_organization" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "name" varchar NOT NULL, "isDefault" boolean NOT NULL DEFAULT (0), "profile_link" varchar, "banner" varchar, "totalEmployees" integer, "short_description" varchar, "client_focus" varchar, "overview" varchar, "imageUrl" varchar(500), "currency" varchar NOT NULL, "valueDate" datetime, "defaultValueDateType" varchar NOT NULL, "isActive" boolean NOT NULL DEFAULT (1), "defaultAlignmentType" varchar, "timeZone" varchar, "regionCode" varchar, "brandColor" varchar, "dateFormat" varchar, "officialName" varchar, "startWeekOn" varchar, "taxId" varchar, "numberFormat" varchar, "minimumProjectSize" varchar, "bonusType" varchar, "bonusPercentage" integer, "invitesAllowed" boolean, "show_income" boolean, "show_profits" boolean, "show_bonuses_paid" boolean, "show_total_hours" boolean, "show_minimum_project_size" boolean, "show_projects_count" boolean, "show_clients_count" boolean, "show_clients" boolean, "show_employees_count" boolean, "inviteExpiryPeriod" integer, "fiscalStartDate" datetime, "fiscalEndDate" datetime, "registrationDate" datetime, "futureDateAllowed" boolean, "allowManualTime" boolean NOT NULL DEFAULT (1), "allowModifyTime" boolean NOT NULL DEFAULT (1), "allowDeleteTime" boolean NOT NULL DEFAULT (1), "requireReason" boolean NOT NULL DEFAULT (0), "requireDescription" boolean NOT NULL DEFAULT (0), "requireProject" boolean NOT NULL DEFAULT (0), "requireTask" boolean NOT NULL DEFAULT (0), "requireClient" boolean NOT NULL DEFAULT (0), "timeFormat" integer NOT NULL DEFAULT (12), "separateInvoiceItemTaxAndDiscount" boolean, "website" varchar, "fiscalInformation" varchar, "currencyPosition" varchar NOT NULL DEFAULT ('LEFT'), "discountAfterTax" boolean, "defaultStartTime" varchar, "defaultEndTime" varchar, "defaultInvoiceEstimateTerms" varchar, "convertAcceptedEstimates" boolean, "daysUntilDue" integer, "contactId" varchar, "allowTrackInactivity" boolean NOT NULL DEFAULT (1), "inactivityTimeLimit" integer NOT NULL DEFAULT (1), "activityProofDuration" integer NOT NULL DEFAULT (1), CONSTRAINT "FK_7965db2b12872551b586f76dd79" FOREIGN KEY ("contactId") REFERENCES "contact" ("id") ON DELETE SET NULL ON UPDATE NO ACTION, CONSTRAINT "FK_745a293c8b2c750bc421fa06332" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`);
        await queryRunner.query(`INSERT INTO "temporary_organization"("id", "createdAt", "updatedAt", "tenantId", "name", "isDefault", "profile_link", "banner", "totalEmployees", "short_description", "client_focus", "overview", "imageUrl", "currency", "valueDate", "defaultValueDateType", "isActive", "defaultAlignmentType", "timeZone", "regionCode", "brandColor", "dateFormat", "officialName", "startWeekOn", "taxId", "numberFormat", "minimumProjectSize", "bonusType", "bonusPercentage", "invitesAllowed", "show_income", "show_profits", "show_bonuses_paid", "show_total_hours", "show_minimum_project_size", "show_projects_count", "show_clients_count", "show_clients", "show_employees_count", "inviteExpiryPeriod", "fiscalStartDate", "fiscalEndDate", "registrationDate", "futureDateAllowed", "allowManualTime", "allowModifyTime", "allowDeleteTime", "requireReason", "requireDescription", "requireProject", "requireTask", "requireClient", "timeFormat", "separateInvoiceItemTaxAndDiscount", "website", "fiscalInformation", "currencyPosition", "discountAfterTax", "defaultStartTime", "defaultEndTime", "defaultInvoiceEstimateTerms", "convertAcceptedEstimates", "daysUntilDue", "contactId") SELECT "id", "createdAt", "updatedAt", "tenantId", "name", "isDefault", "profile_link", "banner", "totalEmployees", "short_description", "client_focus", "overview", "imageUrl", "currency", "valueDate", "defaultValueDateType", "isActive", "defaultAlignmentType", "timeZone", "regionCode", "brandColor", "dateFormat", "officialName", "startWeekOn", "taxId", "numberFormat", "minimumProjectSize", "bonusType", "bonusPercentage", "invitesAllowed", "show_income", "show_profits", "show_bonuses_paid", "show_total_hours", "show_minimum_project_size", "show_projects_count", "show_clients_count", "show_clients", "show_employees_count", "inviteExpiryPeriod", "fiscalStartDate", "fiscalEndDate", "registrationDate", "futureDateAllowed", "allowManualTime", "allowModifyTime", "allowDeleteTime", "requireReason", "requireDescription", "requireProject", "requireTask", "requireClient", "timeFormat", "separateInvoiceItemTaxAndDiscount", "website", "fiscalInformation", "currencyPosition", "discountAfterTax", "defaultStartTime", "defaultEndTime", "defaultInvoiceEstimateTerms", "convertAcceptedEstimates", "daysUntilDue", "contactId" FROM "organization"`);
        await queryRunner.query(`DROP TABLE "organization"`);
        await queryRunner.query(`ALTER TABLE "temporary_organization" RENAME TO "organization"`);
        await queryRunner.query(`CREATE INDEX "IDX_7965db2b12872551b586f76dd7" ON "organization" ("contactId") `);
        await queryRunner.query(`CREATE INDEX "IDX_2360aa7a4b5ab99e026584f305" ON "organization" ("defaultValueDateType") `);
        await queryRunner.query(`CREATE INDEX "IDX_15458cef74076623c270500053" ON "organization" ("currency") `);
        await queryRunner.query(`CREATE INDEX "IDX_9ea70bf5c390b00e7bb96b86ed" ON "organization" ("overview") `);
        await queryRunner.query(`CREATE INDEX "IDX_c75285bf286b17c7ca5537857b" ON "organization" ("client_focus") `);
        await queryRunner.query(`CREATE INDEX "IDX_f37d866c3326eca5f579cef35c" ON "organization" ("short_description") `);
        await queryRunner.query(`CREATE INDEX "IDX_b03a8a28f6ebdb6df8f630216b" ON "organization" ("totalEmployees") `);
        await queryRunner.query(`CREATE INDEX "IDX_6cc2b2052744e352834a4c9e78" ON "organization" ("banner") `);
        await queryRunner.query(`CREATE INDEX "IDX_40460ab803bf6e5a62b75a35c5" ON "organization" ("profile_link") `);
        await queryRunner.query(`CREATE INDEX "IDX_03e5eecc2328eb545ff748cbdd" ON "organization" ("isDefault") `);
        await queryRunner.query(`CREATE INDEX "IDX_c21e615583a3ebbb0977452afb" ON "organization" ("name") `);
        await queryRunner.query(`CREATE INDEX "IDX_745a293c8b2c750bc421fa0633" ON "organization" ("tenantId") `);
        await queryRunner.query(`DROP INDEX "IDX_84594016a98da8b87e0f51cd93"`);
        await queryRunner.query(`DROP INDEX "IDX_f502dc6d9802306f9d1584932b"`);
        await queryRunner.query(`DROP INDEX "IDX_f5735eafddabdb4b20f621a976"`);
        await queryRunner.query(`DROP INDEX "IDX_9b2f00761a6b1b77cb6289e3ff"`);
        await queryRunner.query(`CREATE TABLE "temporary_warehouse" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "organizationId" varchar, "name" varchar NOT NULL, "code" varchar NOT NULL, "email" varchar NOT NULL, "description" varchar, "active" boolean NOT NULL DEFAULT (1), "logoId" varchar, "contactId" varchar NOT NULL, CONSTRAINT "REL_84594016a98da8b87e0f51cd93" UNIQUE ("contactId"))`);
        await queryRunner.query(`INSERT INTO "temporary_warehouse"("id", "createdAt", "updatedAt", "tenantId", "organizationId", "name", "code", "email", "description", "active", "logoId", "contactId") SELECT "id", "createdAt", "updatedAt", "tenantId", "organizationId", "name", "code", "email", "description", "active", "logoId", "contactId" FROM "warehouse"`);
        await queryRunner.query(`DROP TABLE "warehouse"`);
        await queryRunner.query(`ALTER TABLE "temporary_warehouse" RENAME TO "warehouse"`);
        await queryRunner.query(`CREATE INDEX "IDX_84594016a98da8b87e0f51cd93" ON "warehouse" ("contactId") `);
        await queryRunner.query(`CREATE INDEX "IDX_f502dc6d9802306f9d1584932b" ON "warehouse" ("logoId") `);
        await queryRunner.query(`CREATE INDEX "IDX_f5735eafddabdb4b20f621a976" ON "warehouse" ("organizationId") `);
        await queryRunner.query(`CREATE INDEX "IDX_9b2f00761a6b1b77cb6289e3ff" ON "warehouse" ("tenantId") `);
        await queryRunner.query(`DROP INDEX "IDX_84594016a98da8b87e0f51cd93"`);
        await queryRunner.query(`DROP INDEX "IDX_f502dc6d9802306f9d1584932b"`);
        await queryRunner.query(`DROP INDEX "IDX_f5735eafddabdb4b20f621a976"`);
        await queryRunner.query(`DROP INDEX "IDX_9b2f00761a6b1b77cb6289e3ff"`);
        await queryRunner.query(`CREATE TABLE "temporary_warehouse" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "organizationId" varchar, "name" varchar NOT NULL, "code" varchar NOT NULL, "email" varchar NOT NULL, "description" varchar, "active" boolean NOT NULL DEFAULT (1), "logoId" varchar, "contactId" varchar, CONSTRAINT "REL_84594016a98da8b87e0f51cd93" UNIQUE ("contactId"))`);
        await queryRunner.query(`INSERT INTO "temporary_warehouse"("id", "createdAt", "updatedAt", "tenantId", "organizationId", "name", "code", "email", "description", "active", "logoId", "contactId") SELECT "id", "createdAt", "updatedAt", "tenantId", "organizationId", "name", "code", "email", "description", "active", "logoId", "contactId" FROM "warehouse"`);
        await queryRunner.query(`DROP TABLE "warehouse"`);
        await queryRunner.query(`ALTER TABLE "temporary_warehouse" RENAME TO "warehouse"`);
        await queryRunner.query(`CREATE INDEX "IDX_84594016a98da8b87e0f51cd93" ON "warehouse" ("contactId") `);
        await queryRunner.query(`CREATE INDEX "IDX_f502dc6d9802306f9d1584932b" ON "warehouse" ("logoId") `);
        await queryRunner.query(`CREATE INDEX "IDX_f5735eafddabdb4b20f621a976" ON "warehouse" ("organizationId") `);
        await queryRunner.query(`CREATE INDEX "IDX_9b2f00761a6b1b77cb6289e3ff" ON "warehouse" ("tenantId") `);
        await queryRunner.query(`DROP INDEX "IDX_84594016a98da8b87e0f51cd93"`);
        await queryRunner.query(`DROP INDEX "IDX_f502dc6d9802306f9d1584932b"`);
        await queryRunner.query(`DROP INDEX "IDX_f5735eafddabdb4b20f621a976"`);
        await queryRunner.query(`DROP INDEX "IDX_9b2f00761a6b1b77cb6289e3ff"`);
        await queryRunner.query(`CREATE TABLE "temporary_warehouse" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "organizationId" varchar, "name" varchar NOT NULL, "code" varchar NOT NULL, "email" varchar NOT NULL, "description" varchar, "active" boolean NOT NULL DEFAULT (1), "logoId" varchar, "contactId" varchar, CONSTRAINT "REL_84594016a98da8b87e0f51cd93" UNIQUE ("contactId"), CONSTRAINT "FK_9b2f00761a6b1b77cb6289e3fff" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_f5735eafddabdb4b20f621a976a" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_f502dc6d9802306f9d1584932b8" FOREIGN KEY ("logoId") REFERENCES "image_asset" ("id") ON DELETE SET NULL ON UPDATE NO ACTION, CONSTRAINT "FK_84594016a98da8b87e0f51cd931" FOREIGN KEY ("contactId") REFERENCES "contact" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`);
        await queryRunner.query(`INSERT INTO "temporary_warehouse"("id", "createdAt", "updatedAt", "tenantId", "organizationId", "name", "code", "email", "description", "active", "logoId", "contactId") SELECT "id", "createdAt", "updatedAt", "tenantId", "organizationId", "name", "code", "email", "description", "active", "logoId", "contactId" FROM "warehouse"`);
        await queryRunner.query(`DROP TABLE "warehouse"`);
        await queryRunner.query(`ALTER TABLE "temporary_warehouse" RENAME TO "warehouse"`);
        await queryRunner.query(`CREATE INDEX "IDX_84594016a98da8b87e0f51cd93" ON "warehouse" ("contactId") `);
        await queryRunner.query(`CREATE INDEX "IDX_f502dc6d9802306f9d1584932b" ON "warehouse" ("logoId") `);
        await queryRunner.query(`CREATE INDEX "IDX_f5735eafddabdb4b20f621a976" ON "warehouse" ("organizationId") `);
        await queryRunner.query(`CREATE INDEX "IDX_9b2f00761a6b1b77cb6289e3ff" ON "warehouse" ("tenantId") `);
    }

    /**
    * SqliteDB Down Migration
    *
    * @param queryRunner
    */
    public async sqliteDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`DROP INDEX "IDX_9b2f00761a6b1b77cb6289e3ff"`);
        await queryRunner.query(`DROP INDEX "IDX_f5735eafddabdb4b20f621a976"`);
        await queryRunner.query(`DROP INDEX "IDX_f502dc6d9802306f9d1584932b"`);
        await queryRunner.query(`DROP INDEX "IDX_84594016a98da8b87e0f51cd93"`);
        await queryRunner.query(`ALTER TABLE "warehouse" RENAME TO "temporary_warehouse"`);
        await queryRunner.query(`CREATE TABLE "warehouse" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "organizationId" varchar, "name" varchar NOT NULL, "code" varchar NOT NULL, "email" varchar NOT NULL, "description" varchar, "active" boolean NOT NULL DEFAULT (1), "logoId" varchar, "contactId" varchar, CONSTRAINT "REL_84594016a98da8b87e0f51cd93" UNIQUE ("contactId"))`);
        await queryRunner.query(`INSERT INTO "warehouse"("id", "createdAt", "updatedAt", "tenantId", "organizationId", "name", "code", "email", "description", "active", "logoId", "contactId") SELECT "id", "createdAt", "updatedAt", "tenantId", "organizationId", "name", "code", "email", "description", "active", "logoId", "contactId" FROM "temporary_warehouse"`);
        await queryRunner.query(`DROP TABLE "temporary_warehouse"`);
        await queryRunner.query(`CREATE INDEX "IDX_9b2f00761a6b1b77cb6289e3ff" ON "warehouse" ("tenantId") `);
        await queryRunner.query(`CREATE INDEX "IDX_f5735eafddabdb4b20f621a976" ON "warehouse" ("organizationId") `);
        await queryRunner.query(`CREATE INDEX "IDX_f502dc6d9802306f9d1584932b" ON "warehouse" ("logoId") `);
        await queryRunner.query(`CREATE INDEX "IDX_84594016a98da8b87e0f51cd93" ON "warehouse" ("contactId") `);
        await queryRunner.query(`DROP INDEX "IDX_9b2f00761a6b1b77cb6289e3ff"`);
        await queryRunner.query(`DROP INDEX "IDX_f5735eafddabdb4b20f621a976"`);
        await queryRunner.query(`DROP INDEX "IDX_f502dc6d9802306f9d1584932b"`);
        await queryRunner.query(`DROP INDEX "IDX_84594016a98da8b87e0f51cd93"`);
        await queryRunner.query(`ALTER TABLE "warehouse" RENAME TO "temporary_warehouse"`);
        await queryRunner.query(`CREATE TABLE "warehouse" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "organizationId" varchar, "name" varchar NOT NULL, "code" varchar NOT NULL, "email" varchar NOT NULL, "description" varchar, "active" boolean NOT NULL DEFAULT (1), "logoId" varchar, "contactId" varchar NOT NULL, CONSTRAINT "REL_84594016a98da8b87e0f51cd93" UNIQUE ("contactId"))`);
        await queryRunner.query(`INSERT INTO "warehouse"("id", "createdAt", "updatedAt", "tenantId", "organizationId", "name", "code", "email", "description", "active", "logoId", "contactId") SELECT "id", "createdAt", "updatedAt", "tenantId", "organizationId", "name", "code", "email", "description", "active", "logoId", "contactId" FROM "temporary_warehouse"`);
        await queryRunner.query(`DROP TABLE "temporary_warehouse"`);
        await queryRunner.query(`CREATE INDEX "IDX_9b2f00761a6b1b77cb6289e3ff" ON "warehouse" ("tenantId") `);
        await queryRunner.query(`CREATE INDEX "IDX_f5735eafddabdb4b20f621a976" ON "warehouse" ("organizationId") `);
        await queryRunner.query(`CREATE INDEX "IDX_f502dc6d9802306f9d1584932b" ON "warehouse" ("logoId") `);
        await queryRunner.query(`CREATE INDEX "IDX_84594016a98da8b87e0f51cd93" ON "warehouse" ("contactId") `);
        await queryRunner.query(`DROP INDEX "IDX_9b2f00761a6b1b77cb6289e3ff"`);
        await queryRunner.query(`DROP INDEX "IDX_f5735eafddabdb4b20f621a976"`);
        await queryRunner.query(`DROP INDEX "IDX_f502dc6d9802306f9d1584932b"`);
        await queryRunner.query(`DROP INDEX "IDX_84594016a98da8b87e0f51cd93"`);
        await queryRunner.query(`ALTER TABLE "warehouse" RENAME TO "temporary_warehouse"`);
        await queryRunner.query(`CREATE TABLE "warehouse" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "organizationId" varchar, "name" varchar NOT NULL, "code" varchar NOT NULL, "email" varchar NOT NULL, "description" varchar, "active" boolean NOT NULL DEFAULT (1), "logoId" varchar, "contactId" varchar NOT NULL, CONSTRAINT "REL_84594016a98da8b87e0f51cd93" UNIQUE ("contactId"), CONSTRAINT "FK_84594016a98da8b87e0f51cd931" FOREIGN KEY ("contactId") REFERENCES "contact" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`);
        await queryRunner.query(`INSERT INTO "warehouse"("id", "createdAt", "updatedAt", "tenantId", "organizationId", "name", "code", "email", "description", "active", "logoId", "contactId") SELECT "id", "createdAt", "updatedAt", "tenantId", "organizationId", "name", "code", "email", "description", "active", "logoId", "contactId" FROM "temporary_warehouse"`);
        await queryRunner.query(`DROP TABLE "temporary_warehouse"`);
        await queryRunner.query(`CREATE INDEX "IDX_9b2f00761a6b1b77cb6289e3ff" ON "warehouse" ("tenantId") `);
        await queryRunner.query(`CREATE INDEX "IDX_f5735eafddabdb4b20f621a976" ON "warehouse" ("organizationId") `);
        await queryRunner.query(`CREATE INDEX "IDX_f502dc6d9802306f9d1584932b" ON "warehouse" ("logoId") `);
        await queryRunner.query(`CREATE INDEX "IDX_84594016a98da8b87e0f51cd93" ON "warehouse" ("contactId") `);
        await queryRunner.query(`DROP INDEX "IDX_745a293c8b2c750bc421fa0633"`);
        await queryRunner.query(`DROP INDEX "IDX_c21e615583a3ebbb0977452afb"`);
        await queryRunner.query(`DROP INDEX "IDX_03e5eecc2328eb545ff748cbdd"`);
        await queryRunner.query(`DROP INDEX "IDX_40460ab803bf6e5a62b75a35c5"`);
        await queryRunner.query(`DROP INDEX "IDX_6cc2b2052744e352834a4c9e78"`);
        await queryRunner.query(`DROP INDEX "IDX_b03a8a28f6ebdb6df8f630216b"`);
        await queryRunner.query(`DROP INDEX "IDX_f37d866c3326eca5f579cef35c"`);
        await queryRunner.query(`DROP INDEX "IDX_c75285bf286b17c7ca5537857b"`);
        await queryRunner.query(`DROP INDEX "IDX_9ea70bf5c390b00e7bb96b86ed"`);
        await queryRunner.query(`DROP INDEX "IDX_15458cef74076623c270500053"`);
        await queryRunner.query(`DROP INDEX "IDX_2360aa7a4b5ab99e026584f305"`);
        await queryRunner.query(`DROP INDEX "IDX_7965db2b12872551b586f76dd7"`);
        await queryRunner.query(`ALTER TABLE "organization" RENAME TO "temporary_organization"`);
        await queryRunner.query(`CREATE TABLE "organization" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "name" varchar NOT NULL, "isDefault" boolean NOT NULL DEFAULT (0), "profile_link" varchar, "banner" varchar, "totalEmployees" integer, "short_description" varchar, "client_focus" varchar, "overview" varchar, "imageUrl" varchar(500), "currency" varchar NOT NULL, "valueDate" datetime, "defaultValueDateType" varchar NOT NULL, "isActive" boolean NOT NULL DEFAULT (1), "defaultAlignmentType" varchar, "timeZone" varchar, "regionCode" varchar, "brandColor" varchar, "dateFormat" varchar, "officialName" varchar, "startWeekOn" varchar, "taxId" varchar, "numberFormat" varchar, "minimumProjectSize" varchar, "bonusType" varchar, "bonusPercentage" integer, "invitesAllowed" boolean, "show_income" boolean, "show_profits" boolean, "show_bonuses_paid" boolean, "show_total_hours" boolean, "show_minimum_project_size" boolean, "show_projects_count" boolean, "show_clients_count" boolean, "show_clients" boolean, "show_employees_count" boolean, "inviteExpiryPeriod" integer, "fiscalStartDate" datetime, "fiscalEndDate" datetime, "registrationDate" datetime, "futureDateAllowed" boolean, "allowManualTime" boolean NOT NULL DEFAULT (1), "allowModifyTime" boolean NOT NULL DEFAULT (1), "allowDeleteTime" boolean NOT NULL DEFAULT (1), "requireReason" boolean NOT NULL DEFAULT (0), "requireDescription" boolean NOT NULL DEFAULT (0), "requireProject" boolean NOT NULL DEFAULT (0), "requireTask" boolean NOT NULL DEFAULT (0), "requireClient" boolean NOT NULL DEFAULT (0), "timeFormat" integer NOT NULL DEFAULT (12), "separateInvoiceItemTaxAndDiscount" boolean, "website" varchar, "fiscalInformation" varchar, "currencyPosition" varchar NOT NULL DEFAULT ('LEFT'), "discountAfterTax" boolean, "defaultStartTime" varchar, "defaultEndTime" varchar, "defaultInvoiceEstimateTerms" varchar, "convertAcceptedEstimates" boolean, "daysUntilDue" integer, "contactId" varchar, CONSTRAINT "FK_7965db2b12872551b586f76dd79" FOREIGN KEY ("contactId") REFERENCES "contact" ("id") ON DELETE SET NULL ON UPDATE NO ACTION, CONSTRAINT "FK_745a293c8b2c750bc421fa06332" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`);
        await queryRunner.query(`INSERT INTO "organization"("id", "createdAt", "updatedAt", "tenantId", "name", "isDefault", "profile_link", "banner", "totalEmployees", "short_description", "client_focus", "overview", "imageUrl", "currency", "valueDate", "defaultValueDateType", "isActive", "defaultAlignmentType", "timeZone", "regionCode", "brandColor", "dateFormat", "officialName", "startWeekOn", "taxId", "numberFormat", "minimumProjectSize", "bonusType", "bonusPercentage", "invitesAllowed", "show_income", "show_profits", "show_bonuses_paid", "show_total_hours", "show_minimum_project_size", "show_projects_count", "show_clients_count", "show_clients", "show_employees_count", "inviteExpiryPeriod", "fiscalStartDate", "fiscalEndDate", "registrationDate", "futureDateAllowed", "allowManualTime", "allowModifyTime", "allowDeleteTime", "requireReason", "requireDescription", "requireProject", "requireTask", "requireClient", "timeFormat", "separateInvoiceItemTaxAndDiscount", "website", "fiscalInformation", "currencyPosition", "discountAfterTax", "defaultStartTime", "defaultEndTime", "defaultInvoiceEstimateTerms", "convertAcceptedEstimates", "daysUntilDue", "contactId") SELECT "id", "createdAt", "updatedAt", "tenantId", "name", "isDefault", "profile_link", "banner", "totalEmployees", "short_description", "client_focus", "overview", "imageUrl", "currency", "valueDate", "defaultValueDateType", "isActive", "defaultAlignmentType", "timeZone", "regionCode", "brandColor", "dateFormat", "officialName", "startWeekOn", "taxId", "numberFormat", "minimumProjectSize", "bonusType", "bonusPercentage", "invitesAllowed", "show_income", "show_profits", "show_bonuses_paid", "show_total_hours", "show_minimum_project_size", "show_projects_count", "show_clients_count", "show_clients", "show_employees_count", "inviteExpiryPeriod", "fiscalStartDate", "fiscalEndDate", "registrationDate", "futureDateAllowed", "allowManualTime", "allowModifyTime", "allowDeleteTime", "requireReason", "requireDescription", "requireProject", "requireTask", "requireClient", "timeFormat", "separateInvoiceItemTaxAndDiscount", "website", "fiscalInformation", "currencyPosition", "discountAfterTax", "defaultStartTime", "defaultEndTime", "defaultInvoiceEstimateTerms", "convertAcceptedEstimates", "daysUntilDue", "contactId" FROM "temporary_organization"`);
        await queryRunner.query(`DROP TABLE "temporary_organization"`);
        await queryRunner.query(`CREATE INDEX "IDX_745a293c8b2c750bc421fa0633" ON "organization" ("tenantId") `);
        await queryRunner.query(`CREATE INDEX "IDX_c21e615583a3ebbb0977452afb" ON "organization" ("name") `);
        await queryRunner.query(`CREATE INDEX "IDX_03e5eecc2328eb545ff748cbdd" ON "organization" ("isDefault") `);
        await queryRunner.query(`CREATE INDEX "IDX_40460ab803bf6e5a62b75a35c5" ON "organization" ("profile_link") `);
        await queryRunner.query(`CREATE INDEX "IDX_6cc2b2052744e352834a4c9e78" ON "organization" ("banner") `);
        await queryRunner.query(`CREATE INDEX "IDX_b03a8a28f6ebdb6df8f630216b" ON "organization" ("totalEmployees") `);
        await queryRunner.query(`CREATE INDEX "IDX_f37d866c3326eca5f579cef35c" ON "organization" ("short_description") `);
        await queryRunner.query(`CREATE INDEX "IDX_c75285bf286b17c7ca5537857b" ON "organization" ("client_focus") `);
        await queryRunner.query(`CREATE INDEX "IDX_9ea70bf5c390b00e7bb96b86ed" ON "organization" ("overview") `);
        await queryRunner.query(`CREATE INDEX "IDX_15458cef74076623c270500053" ON "organization" ("currency") `);
        await queryRunner.query(`CREATE INDEX "IDX_2360aa7a4b5ab99e026584f305" ON "organization" ("defaultValueDateType") `);
        await queryRunner.query(`CREATE INDEX "IDX_7965db2b12872551b586f76dd7" ON "organization" ("contactId") `);
        await queryRunner.query(`DROP INDEX "IDX_9b2f00761a6b1b77cb6289e3ff"`);
        await queryRunner.query(`DROP INDEX "IDX_f5735eafddabdb4b20f621a976"`);
        await queryRunner.query(`DROP INDEX "IDX_f502dc6d9802306f9d1584932b"`);
        await queryRunner.query(`DROP INDEX "IDX_84594016a98da8b87e0f51cd93"`);
        await queryRunner.query(`ALTER TABLE "warehouse" RENAME TO "temporary_warehouse"`);
        await queryRunner.query(`CREATE TABLE "warehouse" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "organizationId" varchar, "name" varchar NOT NULL, "code" varchar NOT NULL, "email" varchar NOT NULL, "description" varchar, "active" boolean NOT NULL DEFAULT (1), "logoId" varchar, "contactId" varchar NOT NULL, CONSTRAINT "REL_84594016a98da8b87e0f51cd93" UNIQUE ("contactId"), CONSTRAINT "FK_84594016a98da8b87e0f51cd931" FOREIGN KEY ("contactId") REFERENCES "contact" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_f502dc6d9802306f9d1584932b8" FOREIGN KEY ("logoId") REFERENCES "image_asset" ("id") ON DELETE SET NULL ON UPDATE NO ACTION, CONSTRAINT "FK_f5735eafddabdb4b20f621a976a" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_9b2f00761a6b1b77cb6289e3fff" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`);
        await queryRunner.query(`INSERT INTO "warehouse"("id", "createdAt", "updatedAt", "tenantId", "organizationId", "name", "code", "email", "description", "active", "logoId", "contactId") SELECT "id", "createdAt", "updatedAt", "tenantId", "organizationId", "name", "code", "email", "description", "active", "logoId", "contactId" FROM "temporary_warehouse"`);
        await queryRunner.query(`DROP TABLE "temporary_warehouse"`);
        await queryRunner.query(`CREATE INDEX "IDX_9b2f00761a6b1b77cb6289e3ff" ON "warehouse" ("tenantId") `);
        await queryRunner.query(`CREATE INDEX "IDX_f5735eafddabdb4b20f621a976" ON "warehouse" ("organizationId") `);
        await queryRunner.query(`CREATE INDEX "IDX_f502dc6d9802306f9d1584932b" ON "warehouse" ("logoId") `);
        await queryRunner.query(`CREATE INDEX "IDX_84594016a98da8b87e0f51cd93" ON "warehouse" ("contactId") `);
    }
}
