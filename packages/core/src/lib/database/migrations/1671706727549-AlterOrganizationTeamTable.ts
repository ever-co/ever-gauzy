import { MigrationInterface, QueryRunner } from "typeorm";
import * as chalk from "chalk";
import { DatabaseTypeEnum } from "@gauzy/config";

export class AlterOrganizationTeamTable1671706727549 implements MigrationInterface {

    name = 'AlterOrganizationTeamTable1671706727549';

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
        await queryRunner.query(`ALTER TABLE "organization_team" ADD "createdById" uuid`);
        await queryRunner.query(`CREATE INDEX "IDX_da625f694eb1e23e585f301008" ON "organization_team" ("createdById") `);
        await queryRunner.query(`ALTER TABLE "organization_team" ADD CONSTRAINT "FK_da625f694eb1e23e585f3010082" FOREIGN KEY ("createdById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
    }

    /**
    * PostgresDB Down Migration
    *
    * @param queryRunner
    */
    public async postgresDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`ALTER TABLE "organization_team" DROP CONSTRAINT "FK_da625f694eb1e23e585f3010082"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_da625f694eb1e23e585f301008"`);
        await queryRunner.query(`ALTER TABLE "organization_team" DROP COLUMN "createdById"`);
    }

    /**
    * SqliteDB Up Migration
    *
    * @param queryRunner
    */
    public async sqliteUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`DROP INDEX "IDX_176f5ed3c4534f3110d423d569"`);
        await queryRunner.query(`DROP INDEX "IDX_eef1c19a0cb5321223cfe3286c"`);
        await queryRunner.query(`DROP INDEX "IDX_103ae3eb65f4b091efc55cb532"`);
        await queryRunner.query(`CREATE TABLE "temporary_organization_team" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "organizationId" varchar, "name" varchar NOT NULL, "prefix" varchar, "createdById" varchar, CONSTRAINT "FK_176f5ed3c4534f3110d423d5690" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_eef1c19a0cb5321223cfe3286c4" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE)`);
        await queryRunner.query(`INSERT INTO "temporary_organization_team"("id", "createdAt", "updatedAt", "tenantId", "organizationId", "name", "prefix") SELECT "id", "createdAt", "updatedAt", "tenantId", "organizationId", "name", "prefix" FROM "organization_team"`);
        await queryRunner.query(`DROP TABLE "organization_team"`);
        await queryRunner.query(`ALTER TABLE "temporary_organization_team" RENAME TO "organization_team"`);
        await queryRunner.query(`CREATE INDEX "IDX_176f5ed3c4534f3110d423d569" ON "organization_team" ("tenantId") `);
        await queryRunner.query(`CREATE INDEX "IDX_eef1c19a0cb5321223cfe3286c" ON "organization_team" ("organizationId") `);
        await queryRunner.query(`CREATE INDEX "IDX_103ae3eb65f4b091efc55cb532" ON "organization_team" ("name") `);
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
        await queryRunner.query(`CREATE TABLE "temporary_organization" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "name" varchar NOT NULL, "isDefault" boolean NOT NULL DEFAULT (0), "profile_link" varchar, "banner" varchar, "totalEmployees" integer, "short_description" varchar, "client_focus" varchar, "overview" varchar, "imageUrl" varchar(500), "currency" varchar NOT NULL, "valueDate" datetime, "defaultValueDateType" varchar CHECK( "defaultValueDateType" IN ('TODAY','END_OF_MONTH','START_OF_MONTH') ) DEFAULT ('TODAY'), "isActive" boolean NOT NULL DEFAULT (1), "defaultAlignmentType" varchar, "timeZone" varchar, "regionCode" varchar, "brandColor" varchar, "dateFormat" varchar, "officialName" varchar, "startWeekOn" varchar, "taxId" varchar, "numberFormat" varchar, "minimumProjectSize" varchar, "bonusType" varchar, "bonusPercentage" integer, "invitesAllowed" boolean DEFAULT (1), "show_income" boolean, "show_profits" boolean, "show_bonuses_paid" boolean, "show_total_hours" boolean, "show_minimum_project_size" boolean, "show_projects_count" boolean, "show_clients_count" boolean, "show_clients" boolean, "show_employees_count" boolean, "inviteExpiryPeriod" integer, "fiscalStartDate" datetime, "fiscalEndDate" datetime, "registrationDate" datetime, "futureDateAllowed" boolean, "allowManualTime" boolean NOT NULL DEFAULT (1), "allowModifyTime" boolean NOT NULL DEFAULT (1), "allowDeleteTime" boolean NOT NULL DEFAULT (1), "requireReason" boolean NOT NULL DEFAULT (0), "requireDescription" boolean NOT NULL DEFAULT (0), "requireProject" boolean NOT NULL DEFAULT (0), "requireTask" boolean NOT NULL DEFAULT (0), "requireClient" boolean NOT NULL DEFAULT (0), "timeFormat" integer NOT NULL DEFAULT (12), "separateInvoiceItemTaxAndDiscount" boolean, "website" varchar, "fiscalInformation" varchar, "currencyPosition" varchar NOT NULL DEFAULT ('LEFT'), "discountAfterTax" boolean, "defaultStartTime" varchar, "defaultEndTime" varchar, "defaultInvoiceEstimateTerms" varchar, "convertAcceptedEstimates" boolean, "daysUntilDue" integer, "contactId" varchar, "allowTrackInactivity" boolean NOT NULL DEFAULT (1), "inactivityTimeLimit" integer NOT NULL DEFAULT (10), "activityProofDuration" integer NOT NULL DEFAULT (1), CONSTRAINT "FK_745a293c8b2c750bc421fa06332" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_7965db2b12872551b586f76dd79" FOREIGN KEY ("contactId") REFERENCES "contact" ("id") ON DELETE SET NULL ON UPDATE NO ACTION)`);
        await queryRunner.query(`INSERT INTO "temporary_organization"("id", "createdAt", "updatedAt", "tenantId", "name", "isDefault", "profile_link", "banner", "totalEmployees", "short_description", "client_focus", "overview", "imageUrl", "currency", "valueDate", "defaultValueDateType", "isActive", "defaultAlignmentType", "timeZone", "regionCode", "brandColor", "dateFormat", "officialName", "startWeekOn", "taxId", "numberFormat", "minimumProjectSize", "bonusType", "bonusPercentage", "invitesAllowed", "show_income", "show_profits", "show_bonuses_paid", "show_total_hours", "show_minimum_project_size", "show_projects_count", "show_clients_count", "show_clients", "show_employees_count", "inviteExpiryPeriod", "fiscalStartDate", "fiscalEndDate", "registrationDate", "futureDateAllowed", "allowManualTime", "allowModifyTime", "allowDeleteTime", "requireReason", "requireDescription", "requireProject", "requireTask", "requireClient", "timeFormat", "separateInvoiceItemTaxAndDiscount", "website", "fiscalInformation", "currencyPosition", "discountAfterTax", "defaultStartTime", "defaultEndTime", "defaultInvoiceEstimateTerms", "convertAcceptedEstimates", "daysUntilDue", "contactId", "allowTrackInactivity", "inactivityTimeLimit", "activityProofDuration") SELECT "id", "createdAt", "updatedAt", "tenantId", "name", "isDefault", "profile_link", "banner", "totalEmployees", "short_description", "client_focus", "overview", "imageUrl", "currency", "valueDate", "defaultValueDateType", "isActive", "defaultAlignmentType", "timeZone", "regionCode", "brandColor", "dateFormat", "officialName", "startWeekOn", "taxId", "numberFormat", "minimumProjectSize", "bonusType", "bonusPercentage", "invitesAllowed", "show_income", "show_profits", "show_bonuses_paid", "show_total_hours", "show_minimum_project_size", "show_projects_count", "show_clients_count", "show_clients", "show_employees_count", "inviteExpiryPeriod", "fiscalStartDate", "fiscalEndDate", "registrationDate", "futureDateAllowed", "allowManualTime", "allowModifyTime", "allowDeleteTime", "requireReason", "requireDescription", "requireProject", "requireTask", "requireClient", "timeFormat", "separateInvoiceItemTaxAndDiscount", "website", "fiscalInformation", "currencyPosition", "discountAfterTax", "defaultStartTime", "defaultEndTime", "defaultInvoiceEstimateTerms", "convertAcceptedEstimates", "daysUntilDue", "contactId", "allowTrackInactivity", "inactivityTimeLimit", "activityProofDuration" FROM "organization"`);
        await queryRunner.query(`DROP TABLE "organization"`);
        await queryRunner.query(`ALTER TABLE "temporary_organization" RENAME TO "organization"`);
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
        await queryRunner.query(`CREATE INDEX "IDX_da625f694eb1e23e585f301008" ON "organization_team" ("createdById") `);
        await queryRunner.query(`DROP INDEX "IDX_176f5ed3c4534f3110d423d569"`);
        await queryRunner.query(`DROP INDEX "IDX_eef1c19a0cb5321223cfe3286c"`);
        await queryRunner.query(`DROP INDEX "IDX_103ae3eb65f4b091efc55cb532"`);
        await queryRunner.query(`DROP INDEX "IDX_da625f694eb1e23e585f301008"`);
        await queryRunner.query(`CREATE TABLE "temporary_organization_team" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "organizationId" varchar, "name" varchar NOT NULL, "prefix" varchar, "createdById" varchar, CONSTRAINT "FK_176f5ed3c4534f3110d423d5690" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_eef1c19a0cb5321223cfe3286c4" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_da625f694eb1e23e585f3010082" FOREIGN KEY ("createdById") REFERENCES "user" ("id") ON DELETE SET NULL ON UPDATE NO ACTION)`);
        await queryRunner.query(`INSERT INTO "temporary_organization_team"("id", "createdAt", "updatedAt", "tenantId", "organizationId", "name", "prefix", "createdById") SELECT "id", "createdAt", "updatedAt", "tenantId", "organizationId", "name", "prefix", "createdById" FROM "organization_team"`);
        await queryRunner.query(`DROP TABLE "organization_team"`);
        await queryRunner.query(`ALTER TABLE "temporary_organization_team" RENAME TO "organization_team"`);
        await queryRunner.query(`CREATE INDEX "IDX_176f5ed3c4534f3110d423d569" ON "organization_team" ("tenantId") `);
        await queryRunner.query(`CREATE INDEX "IDX_eef1c19a0cb5321223cfe3286c" ON "organization_team" ("organizationId") `);
        await queryRunner.query(`CREATE INDEX "IDX_103ae3eb65f4b091efc55cb532" ON "organization_team" ("name") `);
        await queryRunner.query(`CREATE INDEX "IDX_da625f694eb1e23e585f301008" ON "organization_team" ("createdById") `);
    }

    /**
    * SqliteDB Down Migration
    *
    * @param queryRunner
    */
    public async sqliteDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`DROP INDEX "IDX_da625f694eb1e23e585f301008"`);
        await queryRunner.query(`DROP INDEX "IDX_103ae3eb65f4b091efc55cb532"`);
        await queryRunner.query(`DROP INDEX "IDX_eef1c19a0cb5321223cfe3286c"`);
        await queryRunner.query(`DROP INDEX "IDX_176f5ed3c4534f3110d423d569"`);
        await queryRunner.query(`ALTER TABLE "organization_team" RENAME TO "temporary_organization_team"`);
        await queryRunner.query(`CREATE TABLE "organization_team" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "organizationId" varchar, "name" varchar NOT NULL, "prefix" varchar, "createdById" varchar, CONSTRAINT "FK_176f5ed3c4534f3110d423d5690" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_eef1c19a0cb5321223cfe3286c4" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE)`);
        await queryRunner.query(`INSERT INTO "organization_team"("id", "createdAt", "updatedAt", "tenantId", "organizationId", "name", "prefix", "createdById") SELECT "id", "createdAt", "updatedAt", "tenantId", "organizationId", "name", "prefix", "createdById" FROM "temporary_organization_team"`);
        await queryRunner.query(`DROP TABLE "temporary_organization_team"`);
        await queryRunner.query(`CREATE INDEX "IDX_da625f694eb1e23e585f301008" ON "organization_team" ("createdById") `);
        await queryRunner.query(`CREATE INDEX "IDX_103ae3eb65f4b091efc55cb532" ON "organization_team" ("name") `);
        await queryRunner.query(`CREATE INDEX "IDX_eef1c19a0cb5321223cfe3286c" ON "organization_team" ("organizationId") `);
        await queryRunner.query(`CREATE INDEX "IDX_176f5ed3c4534f3110d423d569" ON "organization_team" ("tenantId") `);
        await queryRunner.query(`DROP INDEX "IDX_da625f694eb1e23e585f301008"`);
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
        await queryRunner.query(`ALTER TABLE "organization" RENAME TO "temporary_organization"`);
        await queryRunner.query(`CREATE TABLE "organization" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "name" varchar NOT NULL, "isDefault" boolean NOT NULL DEFAULT (0), "profile_link" varchar, "banner" varchar, "totalEmployees" integer, "short_description" varchar, "client_focus" varchar, "overview" varchar, "imageUrl" varchar(500), "currency" varchar NOT NULL, "valueDate" datetime, "defaultValueDateType" varchar CHECK( "defaultValueDateType" IN ('TODAY','END_OF_MONTH','START_OF_MONTH') ) DEFAULT ('TODAY'), "isActive" boolean NOT NULL DEFAULT (1), "defaultAlignmentType" varchar, "timeZone" varchar, "regionCode" varchar, "brandColor" varchar, "dateFormat" varchar, "officialName" varchar, "startWeekOn" varchar, "taxId" varchar, "numberFormat" varchar, "minimumProjectSize" varchar, "bonusType" varchar, "bonusPercentage" integer, "invitesAllowed" boolean, "show_income" boolean, "show_profits" boolean, "show_bonuses_paid" boolean, "show_total_hours" boolean, "show_minimum_project_size" boolean, "show_projects_count" boolean, "show_clients_count" boolean, "show_clients" boolean, "show_employees_count" boolean, "inviteExpiryPeriod" integer, "fiscalStartDate" datetime, "fiscalEndDate" datetime, "registrationDate" datetime, "futureDateAllowed" boolean, "allowManualTime" boolean NOT NULL DEFAULT (1), "allowModifyTime" boolean NOT NULL DEFAULT (1), "allowDeleteTime" boolean NOT NULL DEFAULT (1), "requireReason" boolean NOT NULL DEFAULT (0), "requireDescription" boolean NOT NULL DEFAULT (0), "requireProject" boolean NOT NULL DEFAULT (0), "requireTask" boolean NOT NULL DEFAULT (0), "requireClient" boolean NOT NULL DEFAULT (0), "timeFormat" integer NOT NULL DEFAULT (12), "separateInvoiceItemTaxAndDiscount" boolean, "website" varchar, "fiscalInformation" varchar, "currencyPosition" varchar NOT NULL DEFAULT ('LEFT'), "discountAfterTax" boolean, "defaultStartTime" varchar, "defaultEndTime" varchar, "defaultInvoiceEstimateTerms" varchar, "convertAcceptedEstimates" boolean, "daysUntilDue" integer, "contactId" varchar, "allowTrackInactivity" boolean NOT NULL DEFAULT (1), "inactivityTimeLimit" integer NOT NULL DEFAULT (10), "activityProofDuration" integer NOT NULL DEFAULT (1), CONSTRAINT "FK_745a293c8b2c750bc421fa06332" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_7965db2b12872551b586f76dd79" FOREIGN KEY ("contactId") REFERENCES "contact" ("id") ON DELETE SET NULL ON UPDATE NO ACTION)`);
        await queryRunner.query(`INSERT INTO "organization"("id", "createdAt", "updatedAt", "tenantId", "name", "isDefault", "profile_link", "banner", "totalEmployees", "short_description", "client_focus", "overview", "imageUrl", "currency", "valueDate", "defaultValueDateType", "isActive", "defaultAlignmentType", "timeZone", "regionCode", "brandColor", "dateFormat", "officialName", "startWeekOn", "taxId", "numberFormat", "minimumProjectSize", "bonusType", "bonusPercentage", "invitesAllowed", "show_income", "show_profits", "show_bonuses_paid", "show_total_hours", "show_minimum_project_size", "show_projects_count", "show_clients_count", "show_clients", "show_employees_count", "inviteExpiryPeriod", "fiscalStartDate", "fiscalEndDate", "registrationDate", "futureDateAllowed", "allowManualTime", "allowModifyTime", "allowDeleteTime", "requireReason", "requireDescription", "requireProject", "requireTask", "requireClient", "timeFormat", "separateInvoiceItemTaxAndDiscount", "website", "fiscalInformation", "currencyPosition", "discountAfterTax", "defaultStartTime", "defaultEndTime", "defaultInvoiceEstimateTerms", "convertAcceptedEstimates", "daysUntilDue", "contactId", "allowTrackInactivity", "inactivityTimeLimit", "activityProofDuration") SELECT "id", "createdAt", "updatedAt", "tenantId", "name", "isDefault", "profile_link", "banner", "totalEmployees", "short_description", "client_focus", "overview", "imageUrl", "currency", "valueDate", "defaultValueDateType", "isActive", "defaultAlignmentType", "timeZone", "regionCode", "brandColor", "dateFormat", "officialName", "startWeekOn", "taxId", "numberFormat", "minimumProjectSize", "bonusType", "bonusPercentage", "invitesAllowed", "show_income", "show_profits", "show_bonuses_paid", "show_total_hours", "show_minimum_project_size", "show_projects_count", "show_clients_count", "show_clients", "show_employees_count", "inviteExpiryPeriod", "fiscalStartDate", "fiscalEndDate", "registrationDate", "futureDateAllowed", "allowManualTime", "allowModifyTime", "allowDeleteTime", "requireReason", "requireDescription", "requireProject", "requireTask", "requireClient", "timeFormat", "separateInvoiceItemTaxAndDiscount", "website", "fiscalInformation", "currencyPosition", "discountAfterTax", "defaultStartTime", "defaultEndTime", "defaultInvoiceEstimateTerms", "convertAcceptedEstimates", "daysUntilDue", "contactId", "allowTrackInactivity", "inactivityTimeLimit", "activityProofDuration" FROM "temporary_organization"`);
        await queryRunner.query(`DROP TABLE "temporary_organization"`);
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
        await queryRunner.query(`DROP INDEX "IDX_103ae3eb65f4b091efc55cb532"`);
        await queryRunner.query(`DROP INDEX "IDX_eef1c19a0cb5321223cfe3286c"`);
        await queryRunner.query(`DROP INDEX "IDX_176f5ed3c4534f3110d423d569"`);
        await queryRunner.query(`ALTER TABLE "organization_team" RENAME TO "temporary_organization_team"`);
        await queryRunner.query(`CREATE TABLE "organization_team" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "organizationId" varchar, "name" varchar NOT NULL, "prefix" varchar, CONSTRAINT "FK_176f5ed3c4534f3110d423d5690" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_eef1c19a0cb5321223cfe3286c4" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE)`);
        await queryRunner.query(`INSERT INTO "organization_team"("id", "createdAt", "updatedAt", "tenantId", "organizationId", "name", "prefix") SELECT "id", "createdAt", "updatedAt", "tenantId", "organizationId", "name", "prefix" FROM "temporary_organization_team"`);
        await queryRunner.query(`DROP TABLE "temporary_organization_team"`);
        await queryRunner.query(`CREATE INDEX "IDX_103ae3eb65f4b091efc55cb532" ON "organization_team" ("name") `);
        await queryRunner.query(`CREATE INDEX "IDX_eef1c19a0cb5321223cfe3286c" ON "organization_team" ("organizationId") `);
        await queryRunner.query(`CREATE INDEX "IDX_176f5ed3c4534f3110d423d569" ON "organization_team" ("tenantId") `);
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
