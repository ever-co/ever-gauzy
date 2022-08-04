import { MigrationInterface, QueryRunner } from "typeorm";

export class AlterInvoiceEstimateHistory1659618978087 implements MigrationInterface {

    name = 'AlterInvoiceEstimateHistory1659618978087';

    public async up(queryRunner: QueryRunner): Promise<void> {
        if (queryRunner.connection.options.type === 'sqlite') {
            await this.sqliteUpQueryRunner(queryRunner);
        } else {
            await this.postgresUpQueryRunner(queryRunner);
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        if (queryRunner.connection.options.type === 'sqlite') {
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
        await queryRunner.query(`ALTER TABLE "invoice_estimate_history" DROP CONSTRAINT "FK_da2893697d57368470952a76f65"`);
        await queryRunner.query(`ALTER TABLE "invoice_estimate_history" ALTER COLUMN "userId" DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "invoice_estimate_history" ADD CONSTRAINT "FK_da2893697d57368470952a76f65" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
    }

    /**
    * PostgresDB Down Migration
    *
    * @param queryRunner
    */
    public async postgresDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`ALTER TABLE "invoice_estimate_history" DROP CONSTRAINT "FK_da2893697d57368470952a76f65"`);
        await queryRunner.query(`ALTER TABLE "invoice_estimate_history" ALTER COLUMN "userId" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "invoice_estimate_history" ADD CONSTRAINT "FK_da2893697d57368470952a76f65" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
    }

    /**
    * SqliteDB Up Migration
    *
    * @param queryRunner
    */
    public async sqliteUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`DROP INDEX "IDX_31ec3d5a6b0985cec544c64217"`);
        await queryRunner.query(`DROP INDEX "IDX_da2893697d57368470952a76f6"`);
        await queryRunner.query(`DROP INDEX "IDX_856f24297f120604f8ae294276"`);
        await queryRunner.query(`DROP INDEX "IDX_cc0ac824ba89deda98bb418e8c"`);
        await queryRunner.query(`CREATE TABLE "temporary_invoice_estimate_history" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "organizationId" varchar, "action" varchar NOT NULL, "userId" varchar NOT NULL, "invoiceId" varchar NOT NULL, CONSTRAINT "FK_31ec3d5a6b0985cec544c642178" FOREIGN KEY ("invoiceId") REFERENCES "invoice" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_da2893697d57368470952a76f65" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE SET NULL ON UPDATE NO ACTION, CONSTRAINT "FK_856f24297f120604f8ae2942769" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_cc0ac824ba89deda98bb418e8ca" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`);
        await queryRunner.query(`INSERT INTO "temporary_invoice_estimate_history"("id", "createdAt", "updatedAt", "tenantId", "organizationId", "action", "userId", "invoiceId") SELECT "id", "createdAt", "updatedAt", "tenantId", "organizationId", "action", "userId", "invoiceId" FROM "invoice_estimate_history"`);
        await queryRunner.query(`DROP TABLE "invoice_estimate_history"`);
        await queryRunner.query(`ALTER TABLE "temporary_invoice_estimate_history" RENAME TO "invoice_estimate_history"`);
        await queryRunner.query(`CREATE INDEX "IDX_31ec3d5a6b0985cec544c64217" ON "invoice_estimate_history" ("invoiceId") `);
        await queryRunner.query(`CREATE INDEX "IDX_da2893697d57368470952a76f6" ON "invoice_estimate_history" ("userId") `);
        await queryRunner.query(`CREATE INDEX "IDX_856f24297f120604f8ae294276" ON "invoice_estimate_history" ("organizationId") `);
        await queryRunner.query(`CREATE INDEX "IDX_cc0ac824ba89deda98bb418e8c" ON "invoice_estimate_history" ("tenantId") `);
        await queryRunner.query(`DROP INDEX "IDX_31ec3d5a6b0985cec544c64217"`);
        await queryRunner.query(`DROP INDEX "IDX_da2893697d57368470952a76f6"`);
        await queryRunner.query(`DROP INDEX "IDX_856f24297f120604f8ae294276"`);
        await queryRunner.query(`DROP INDEX "IDX_cc0ac824ba89deda98bb418e8c"`);
        await queryRunner.query(`CREATE TABLE "temporary_invoice_estimate_history" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "organizationId" varchar, "action" varchar NOT NULL, "userId" varchar NOT NULL, "invoiceId" varchar NOT NULL)`);
        await queryRunner.query(`INSERT INTO "temporary_invoice_estimate_history"("id", "createdAt", "updatedAt", "tenantId", "organizationId", "action", "userId", "invoiceId") SELECT "id", "createdAt", "updatedAt", "tenantId", "organizationId", "action", "userId", "invoiceId" FROM "invoice_estimate_history"`);
        await queryRunner.query(`DROP TABLE "invoice_estimate_history"`);
        await queryRunner.query(`ALTER TABLE "temporary_invoice_estimate_history" RENAME TO "invoice_estimate_history"`);
        await queryRunner.query(`CREATE INDEX "IDX_31ec3d5a6b0985cec544c64217" ON "invoice_estimate_history" ("invoiceId") `);
        await queryRunner.query(`CREATE INDEX "IDX_da2893697d57368470952a76f6" ON "invoice_estimate_history" ("userId") `);
        await queryRunner.query(`CREATE INDEX "IDX_856f24297f120604f8ae294276" ON "invoice_estimate_history" ("organizationId") `);
        await queryRunner.query(`CREATE INDEX "IDX_cc0ac824ba89deda98bb418e8c" ON "invoice_estimate_history" ("tenantId") `);
        await queryRunner.query(`DROP INDEX "IDX_31ec3d5a6b0985cec544c64217"`);
        await queryRunner.query(`DROP INDEX "IDX_da2893697d57368470952a76f6"`);
        await queryRunner.query(`DROP INDEX "IDX_856f24297f120604f8ae294276"`);
        await queryRunner.query(`DROP INDEX "IDX_cc0ac824ba89deda98bb418e8c"`);
        await queryRunner.query(`CREATE TABLE "temporary_invoice_estimate_history" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "organizationId" varchar, "action" varchar NOT NULL, "userId" varchar, "invoiceId" varchar NOT NULL)`);
        await queryRunner.query(`INSERT INTO "temporary_invoice_estimate_history"("id", "createdAt", "updatedAt", "tenantId", "organizationId", "action", "userId", "invoiceId") SELECT "id", "createdAt", "updatedAt", "tenantId", "organizationId", "action", "userId", "invoiceId" FROM "invoice_estimate_history"`);
        await queryRunner.query(`DROP TABLE "invoice_estimate_history"`);
        await queryRunner.query(`ALTER TABLE "temporary_invoice_estimate_history" RENAME TO "invoice_estimate_history"`);
        await queryRunner.query(`CREATE INDEX "IDX_31ec3d5a6b0985cec544c64217" ON "invoice_estimate_history" ("invoiceId") `);
        await queryRunner.query(`CREATE INDEX "IDX_da2893697d57368470952a76f6" ON "invoice_estimate_history" ("userId") `);
        await queryRunner.query(`CREATE INDEX "IDX_856f24297f120604f8ae294276" ON "invoice_estimate_history" ("organizationId") `);
        await queryRunner.query(`CREATE INDEX "IDX_cc0ac824ba89deda98bb418e8c" ON "invoice_estimate_history" ("tenantId") `);
        await queryRunner.query(`DROP INDEX "IDX_31ec3d5a6b0985cec544c64217"`);
        await queryRunner.query(`DROP INDEX "IDX_da2893697d57368470952a76f6"`);
        await queryRunner.query(`DROP INDEX "IDX_856f24297f120604f8ae294276"`);
        await queryRunner.query(`DROP INDEX "IDX_cc0ac824ba89deda98bb418e8c"`);
        await queryRunner.query(`CREATE TABLE "temporary_invoice_estimate_history" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "organizationId" varchar, "action" varchar NOT NULL, "userId" varchar, "invoiceId" varchar NOT NULL, CONSTRAINT "FK_cc0ac824ba89deda98bb418e8ca" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_856f24297f120604f8ae2942769" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_da2893697d57368470952a76f65" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE SET NULL ON UPDATE NO ACTION, CONSTRAINT "FK_31ec3d5a6b0985cec544c642178" FOREIGN KEY ("invoiceId") REFERENCES "invoice" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`);
        await queryRunner.query(`INSERT INTO "temporary_invoice_estimate_history"("id", "createdAt", "updatedAt", "tenantId", "organizationId", "action", "userId", "invoiceId") SELECT "id", "createdAt", "updatedAt", "tenantId", "organizationId", "action", "userId", "invoiceId" FROM "invoice_estimate_history"`);
        await queryRunner.query(`DROP TABLE "invoice_estimate_history"`);
        await queryRunner.query(`ALTER TABLE "temporary_invoice_estimate_history" RENAME TO "invoice_estimate_history"`);
        await queryRunner.query(`CREATE INDEX "IDX_31ec3d5a6b0985cec544c64217" ON "invoice_estimate_history" ("invoiceId") `);
        await queryRunner.query(`CREATE INDEX "IDX_da2893697d57368470952a76f6" ON "invoice_estimate_history" ("userId") `);
        await queryRunner.query(`CREATE INDEX "IDX_856f24297f120604f8ae294276" ON "invoice_estimate_history" ("organizationId") `);
        await queryRunner.query(`CREATE INDEX "IDX_cc0ac824ba89deda98bb418e8c" ON "invoice_estimate_history" ("tenantId") `);
    }

    /**
    * SqliteDB Down Migration
    *
    * @param queryRunner
    */
    public async sqliteDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`DROP INDEX "IDX_cc0ac824ba89deda98bb418e8c"`);
        await queryRunner.query(`DROP INDEX "IDX_856f24297f120604f8ae294276"`);
        await queryRunner.query(`DROP INDEX "IDX_da2893697d57368470952a76f6"`);
        await queryRunner.query(`DROP INDEX "IDX_31ec3d5a6b0985cec544c64217"`);
        await queryRunner.query(`ALTER TABLE "invoice_estimate_history" RENAME TO "temporary_invoice_estimate_history"`);
        await queryRunner.query(`CREATE TABLE "invoice_estimate_history" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "organizationId" varchar, "action" varchar NOT NULL, "userId" varchar, "invoiceId" varchar NOT NULL)`);
        await queryRunner.query(`INSERT INTO "invoice_estimate_history"("id", "createdAt", "updatedAt", "tenantId", "organizationId", "action", "userId", "invoiceId") SELECT "id", "createdAt", "updatedAt", "tenantId", "organizationId", "action", "userId", "invoiceId" FROM "temporary_invoice_estimate_history"`);
        await queryRunner.query(`DROP TABLE "temporary_invoice_estimate_history"`);
        await queryRunner.query(`CREATE INDEX "IDX_cc0ac824ba89deda98bb418e8c" ON "invoice_estimate_history" ("tenantId") `);
        await queryRunner.query(`CREATE INDEX "IDX_856f24297f120604f8ae294276" ON "invoice_estimate_history" ("organizationId") `);
        await queryRunner.query(`CREATE INDEX "IDX_da2893697d57368470952a76f6" ON "invoice_estimate_history" ("userId") `);
        await queryRunner.query(`CREATE INDEX "IDX_31ec3d5a6b0985cec544c64217" ON "invoice_estimate_history" ("invoiceId") `);
        await queryRunner.query(`DROP INDEX "IDX_cc0ac824ba89deda98bb418e8c"`);
        await queryRunner.query(`DROP INDEX "IDX_856f24297f120604f8ae294276"`);
        await queryRunner.query(`DROP INDEX "IDX_da2893697d57368470952a76f6"`);
        await queryRunner.query(`DROP INDEX "IDX_31ec3d5a6b0985cec544c64217"`);
        await queryRunner.query(`ALTER TABLE "invoice_estimate_history" RENAME TO "temporary_invoice_estimate_history"`);
        await queryRunner.query(`CREATE TABLE "invoice_estimate_history" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "organizationId" varchar, "action" varchar NOT NULL, "userId" varchar NOT NULL, "invoiceId" varchar NOT NULL)`);
        await queryRunner.query(`INSERT INTO "invoice_estimate_history"("id", "createdAt", "updatedAt", "tenantId", "organizationId", "action", "userId", "invoiceId") SELECT "id", "createdAt", "updatedAt", "tenantId", "organizationId", "action", "userId", "invoiceId" FROM "temporary_invoice_estimate_history"`);
        await queryRunner.query(`DROP TABLE "temporary_invoice_estimate_history"`);
        await queryRunner.query(`CREATE INDEX "IDX_cc0ac824ba89deda98bb418e8c" ON "invoice_estimate_history" ("tenantId") `);
        await queryRunner.query(`CREATE INDEX "IDX_856f24297f120604f8ae294276" ON "invoice_estimate_history" ("organizationId") `);
        await queryRunner.query(`CREATE INDEX "IDX_da2893697d57368470952a76f6" ON "invoice_estimate_history" ("userId") `);
        await queryRunner.query(`CREATE INDEX "IDX_31ec3d5a6b0985cec544c64217" ON "invoice_estimate_history" ("invoiceId") `);
        await queryRunner.query(`DROP INDEX "IDX_cc0ac824ba89deda98bb418e8c"`);
        await queryRunner.query(`DROP INDEX "IDX_856f24297f120604f8ae294276"`);
        await queryRunner.query(`DROP INDEX "IDX_da2893697d57368470952a76f6"`);
        await queryRunner.query(`DROP INDEX "IDX_31ec3d5a6b0985cec544c64217"`);
        await queryRunner.query(`ALTER TABLE "invoice_estimate_history" RENAME TO "temporary_invoice_estimate_history"`);
        await queryRunner.query(`CREATE TABLE "invoice_estimate_history" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "organizationId" varchar, "action" varchar NOT NULL, "userId" varchar NOT NULL, "invoiceId" varchar NOT NULL, CONSTRAINT "FK_da2893697d57368470952a76f65" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE SET NULL ON UPDATE NO ACTION)`);
        await queryRunner.query(`INSERT INTO "invoice_estimate_history"("id", "createdAt", "updatedAt", "tenantId", "organizationId", "action", "userId", "invoiceId") SELECT "id", "createdAt", "updatedAt", "tenantId", "organizationId", "action", "userId", "invoiceId" FROM "temporary_invoice_estimate_history"`);
        await queryRunner.query(`DROP TABLE "temporary_invoice_estimate_history"`);
        await queryRunner.query(`CREATE INDEX "IDX_cc0ac824ba89deda98bb418e8c" ON "invoice_estimate_history" ("tenantId") `);
        await queryRunner.query(`CREATE INDEX "IDX_856f24297f120604f8ae294276" ON "invoice_estimate_history" ("organizationId") `);
        await queryRunner.query(`CREATE INDEX "IDX_da2893697d57368470952a76f6" ON "invoice_estimate_history" ("userId") `);
        await queryRunner.query(`CREATE INDEX "IDX_31ec3d5a6b0985cec544c64217" ON "invoice_estimate_history" ("invoiceId") `);
        await queryRunner.query(`DROP INDEX "IDX_60468af1ce34043a900809c84f"`);
        await queryRunner.query(`DROP INDEX "IDX_cc0ac824ba89deda98bb418e8c"`);
        await queryRunner.query(`DROP INDEX "IDX_856f24297f120604f8ae294276"`);
        await queryRunner.query(`DROP INDEX "IDX_da2893697d57368470952a76f6"`);
        await queryRunner.query(`DROP INDEX "IDX_31ec3d5a6b0985cec544c64217"`);
        await queryRunner.query(`ALTER TABLE "invoice_estimate_history" RENAME TO "temporary_invoice_estimate_history"`);
        await queryRunner.query(`CREATE TABLE "invoice_estimate_history" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "organizationId" varchar, "action" varchar NOT NULL, "userId" varchar NOT NULL, "invoiceId" varchar NOT NULL, CONSTRAINT "FK_31ec3d5a6b0985cec544c642178" FOREIGN KEY ("invoiceId") REFERENCES "invoice" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_da2893697d57368470952a76f65" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE SET NULL ON UPDATE NO ACTION, CONSTRAINT "FK_856f24297f120604f8ae2942769" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_cc0ac824ba89deda98bb418e8ca" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`);
        await queryRunner.query(`INSERT INTO "invoice_estimate_history"("id", "createdAt", "updatedAt", "tenantId", "organizationId", "action", "userId", "invoiceId") SELECT "id", "createdAt", "updatedAt", "tenantId", "organizationId", "action", "userId", "invoiceId" FROM "temporary_invoice_estimate_history"`);
        await queryRunner.query(`DROP TABLE "temporary_invoice_estimate_history"`);
        await queryRunner.query(`CREATE INDEX "IDX_cc0ac824ba89deda98bb418e8c" ON "invoice_estimate_history" ("tenantId") `);
        await queryRunner.query(`CREATE INDEX "IDX_856f24297f120604f8ae294276" ON "invoice_estimate_history" ("organizationId") `);
        await queryRunner.query(`CREATE INDEX "IDX_da2893697d57368470952a76f6" ON "invoice_estimate_history" ("userId") `);
    await queryRunner.query(`CREATE INDEX "IDX_31ec3d5a6b0985cec544c64217" ON "invoice_estimate_history" ("invoiceId") `);
    }
}