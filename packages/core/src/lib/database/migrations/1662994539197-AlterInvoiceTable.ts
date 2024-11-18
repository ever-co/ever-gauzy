import { MigrationInterface, QueryRunner } from "typeorm";
import * as chalk from "chalk";
import { DatabaseTypeEnum } from "@gauzy/config";

export class AlterInvoiceTable1662994539197 implements MigrationInterface {

    name = 'AlterInvoiceTable1662994539197';

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
        await queryRunner.query(`ALTER TABLE "invoice" DROP COLUMN "publicLink"`);
    }

    /**
    * PostgresDB Down Migration
    *
    * @param queryRunner
    */
    public async postgresDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`ALTER TABLE "invoice" ADD "publicLink" character varying`);
    }

    /**
    * SqliteDB Up Migration
    *
    * @param queryRunner
    */
    public async sqliteUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`DROP INDEX "IDX_7fb52a5f267f53b7d93af3d8c3"`);
        await queryRunner.query(`DROP INDEX "IDX_058ef835f99e28fc6717cd7c80"`);
        await queryRunner.query(`DROP INDEX "IDX_b5c33892e630b66c65d623baf8"`);
        await queryRunner.query(`DROP INDEX "IDX_d9e965da0f63c94983d3a1006a"`);
        await queryRunner.query(`CREATE TABLE "temporary_invoice" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "organizationId" varchar, "invoiceDate" datetime, "invoiceNumber" numeric, "dueDate" datetime, "currency" varchar NOT NULL, "discountValue" numeric NOT NULL, "paid" boolean, "tax" numeric, "tax2" numeric, "terms" varchar NOT NULL, "totalValue" numeric, "status" varchar NOT NULL, "isEstimate" boolean, "isAccepted" boolean, "discountType" varchar, "taxType" varchar, "tax2Type" varchar, "invoiceType" varchar, "sentTo" varchar, "organizationContactId" varchar, "internalNote" varchar, "alreadyPaid" numeric, "amountDue" numeric, "hasRemainingAmountInvoiced" boolean, "token" varchar, "isArchived" boolean DEFAULT (0), "fromOrganizationId" varchar NOT NULL, "toContactId" varchar, CONSTRAINT "UQ_d7bed97fb47876e03fd7d7c285a" UNIQUE ("invoiceNumber"), CONSTRAINT "FK_7fb52a5f267f53b7d93af3d8c3c" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_058ef835f99e28fc6717cd7c80f" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_b5c33892e630b66c65d623baf8e" FOREIGN KEY ("fromOrganizationId") REFERENCES "organization" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION, CONSTRAINT "FK_d9e965da0f63c94983d3a1006ac" FOREIGN KEY ("toContactId") REFERENCES "organization_contact" ("id") ON DELETE SET NULL ON UPDATE NO ACTION)`);
        await queryRunner.query(`INSERT INTO "temporary_invoice"("id", "createdAt", "updatedAt", "tenantId", "organizationId", "invoiceDate", "invoiceNumber", "dueDate", "currency", "discountValue", "paid", "tax", "tax2", "terms", "totalValue", "status", "isEstimate", "isAccepted", "discountType", "taxType", "tax2Type", "invoiceType", "sentTo", "organizationContactId", "internalNote", "alreadyPaid", "amountDue", "hasRemainingAmountInvoiced", "token", "isArchived", "fromOrganizationId", "toContactId") SELECT "id", "createdAt", "updatedAt", "tenantId", "organizationId", "invoiceDate", "invoiceNumber", "dueDate", "currency", "discountValue", "paid", "tax", "tax2", "terms", "totalValue", "status", "isEstimate", "isAccepted", "discountType", "taxType", "tax2Type", "invoiceType", "sentTo", "organizationContactId", "internalNote", "alreadyPaid", "amountDue", "hasRemainingAmountInvoiced", "token", "isArchived", "fromOrganizationId", "toContactId" FROM "invoice"`);
        await queryRunner.query(`DROP TABLE "invoice"`);
        await queryRunner.query(`ALTER TABLE "temporary_invoice" RENAME TO "invoice"`);
        await queryRunner.query(`CREATE INDEX "IDX_7fb52a5f267f53b7d93af3d8c3" ON "invoice" ("tenantId") `);
        await queryRunner.query(`CREATE INDEX "IDX_058ef835f99e28fc6717cd7c80" ON "invoice" ("organizationId") `);
        await queryRunner.query(`CREATE INDEX "IDX_b5c33892e630b66c65d623baf8" ON "invoice" ("fromOrganizationId") `);
        await queryRunner.query(`CREATE INDEX "IDX_d9e965da0f63c94983d3a1006a" ON "invoice" ("toContactId") `);
    }

    /**
    * SqliteDB Down Migration
    *
    * @param queryRunner
    */
    public async sqliteDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`DROP INDEX "IDX_d9e965da0f63c94983d3a1006a"`);
        await queryRunner.query(`DROP INDEX "IDX_b5c33892e630b66c65d623baf8"`);
        await queryRunner.query(`DROP INDEX "IDX_058ef835f99e28fc6717cd7c80"`);
        await queryRunner.query(`DROP INDEX "IDX_7fb52a5f267f53b7d93af3d8c3"`);
        await queryRunner.query(`ALTER TABLE "invoice" RENAME TO "temporary_invoice"`);
        await queryRunner.query(`CREATE TABLE "invoice" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "organizationId" varchar, "invoiceDate" datetime, "invoiceNumber" numeric, "dueDate" datetime, "currency" varchar NOT NULL, "discountValue" numeric NOT NULL, "paid" boolean, "tax" numeric, "tax2" numeric, "terms" varchar NOT NULL, "totalValue" numeric, "status" varchar NOT NULL, "isEstimate" boolean, "isAccepted" boolean, "discountType" varchar, "taxType" varchar, "tax2Type" varchar, "invoiceType" varchar, "sentTo" varchar, "organizationContactId" varchar, "internalNote" varchar, "alreadyPaid" numeric, "amountDue" numeric, "hasRemainingAmountInvoiced" boolean, "publicLink" varchar, "token" varchar, "isArchived" boolean DEFAULT (0), "fromOrganizationId" varchar NOT NULL, "toContactId" varchar, CONSTRAINT "UQ_d7bed97fb47876e03fd7d7c285a" UNIQUE ("invoiceNumber"), CONSTRAINT "FK_7fb52a5f267f53b7d93af3d8c3c" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_058ef835f99e28fc6717cd7c80f" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_b5c33892e630b66c65d623baf8e" FOREIGN KEY ("fromOrganizationId") REFERENCES "organization" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION, CONSTRAINT "FK_d9e965da0f63c94983d3a1006ac" FOREIGN KEY ("toContactId") REFERENCES "organization_contact" ("id") ON DELETE SET NULL ON UPDATE NO ACTION)`);
        await queryRunner.query(`INSERT INTO "invoice"("id", "createdAt", "updatedAt", "tenantId", "organizationId", "invoiceDate", "invoiceNumber", "dueDate", "currency", "discountValue", "paid", "tax", "tax2", "terms", "totalValue", "status", "isEstimate", "isAccepted", "discountType", "taxType", "tax2Type", "invoiceType", "sentTo", "organizationContactId", "internalNote", "alreadyPaid", "amountDue", "hasRemainingAmountInvoiced", "token", "isArchived", "fromOrganizationId", "toContactId") SELECT "id", "createdAt", "updatedAt", "tenantId", "organizationId", "invoiceDate", "invoiceNumber", "dueDate", "currency", "discountValue", "paid", "tax", "tax2", "terms", "totalValue", "status", "isEstimate", "isAccepted", "discountType", "taxType", "tax2Type", "invoiceType", "sentTo", "organizationContactId", "internalNote", "alreadyPaid", "amountDue", "hasRemainingAmountInvoiced", "token", "isArchived", "fromOrganizationId", "toContactId" FROM "temporary_invoice"`);
        await queryRunner.query(`DROP TABLE "temporary_invoice"`);
        await queryRunner.query(`CREATE INDEX "IDX_d9e965da0f63c94983d3a1006a" ON "invoice" ("toContactId") `);
        await queryRunner.query(`CREATE INDEX "IDX_b5c33892e630b66c65d623baf8" ON "invoice" ("fromOrganizationId") `);
        await queryRunner.query(`CREATE INDEX "IDX_058ef835f99e28fc6717cd7c80" ON "invoice" ("organizationId") `);
        await queryRunner.query(`CREATE INDEX "IDX_7fb52a5f267f53b7d93af3d8c3" ON "invoice" ("tenantId") `);
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
