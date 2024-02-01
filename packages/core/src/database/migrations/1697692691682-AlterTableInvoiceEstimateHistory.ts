import { MigrationInterface, QueryRunner } from "typeorm";
import * as chalk from "chalk";
import { DatabaseTypeEnum } from "@gauzy/config";

export class AlterTableInvoiceEstimateHistory1697692691682 implements MigrationInterface {

    name = 'AlterTableInvoiceEstimateHistory1697692691682';

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
        await queryRunner.query(`ALTER TABLE "invoice_estimate_history" ADD "title" character varying`);
    }

    /**
     * PostgresDB Down Migration
     *
     * @param queryRunner
     */
    public async postgresDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`ALTER TABLE "invoice_estimate_history" DROP COLUMN "title"`);
    }

    /**
    * SqliteDB and BetterSQlite3DB Up Migration
    *
    * @param queryRunner
    */
    public async sqliteUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`DROP INDEX "IDX_8106063f79cce8e67790d79092"`);
        await queryRunner.query(`DROP INDEX "IDX_483eb296a94d821ebedb375858"`);
        await queryRunner.query(`DROP INDEX "IDX_31ec3d5a6b0985cec544c64217"`);
        await queryRunner.query(`DROP INDEX "IDX_da2893697d57368470952a76f6"`);
        await queryRunner.query(`DROP INDEX "IDX_856f24297f120604f8ae294276"`);
        await queryRunner.query(`DROP INDEX "IDX_cc0ac824ba89deda98bb418e8c"`);
        await queryRunner.query(`CREATE TABLE "temporary_invoice_estimate_history" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "organizationId" varchar, "action" varchar NOT NULL, "userId" varchar, "invoiceId" varchar NOT NULL, "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), "title" varchar, CONSTRAINT "FK_cc0ac824ba89deda98bb418e8ca" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_856f24297f120604f8ae2942769" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_da2893697d57368470952a76f65" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE SET NULL ON UPDATE NO ACTION, CONSTRAINT "FK_31ec3d5a6b0985cec544c642178" FOREIGN KEY ("invoiceId") REFERENCES "invoice" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`);
        await queryRunner.query(`INSERT INTO "temporary_invoice_estimate_history"("id", "createdAt", "updatedAt", "tenantId", "organizationId", "action", "userId", "invoiceId", "isActive", "isArchived") SELECT "id", "createdAt", "updatedAt", "tenantId", "organizationId", "action", "userId", "invoiceId", "isActive", "isArchived" FROM "invoice_estimate_history"`);
        await queryRunner.query(`DROP TABLE "invoice_estimate_history"`);
        await queryRunner.query(`ALTER TABLE "temporary_invoice_estimate_history" RENAME TO "invoice_estimate_history"`);
        await queryRunner.query(`CREATE INDEX "IDX_8106063f79cce8e67790d79092" ON "invoice_estimate_history" ("isArchived") `);
        await queryRunner.query(`CREATE INDEX "IDX_483eb296a94d821ebedb375858" ON "invoice_estimate_history" ("isActive") `);
        await queryRunner.query(`CREATE INDEX "IDX_31ec3d5a6b0985cec544c64217" ON "invoice_estimate_history" ("invoiceId") `);
        await queryRunner.query(`CREATE INDEX "IDX_da2893697d57368470952a76f6" ON "invoice_estimate_history" ("userId") `);
        await queryRunner.query(`CREATE INDEX "IDX_856f24297f120604f8ae294276" ON "invoice_estimate_history" ("organizationId") `);
        await queryRunner.query(`CREATE INDEX "IDX_cc0ac824ba89deda98bb418e8c" ON "invoice_estimate_history" ("tenantId") `);
    }

    /**
    * SqliteDB and BetterSQlite3DB Down Migration
    *
    * @param queryRunner
    */
    public async sqliteDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`DROP INDEX "IDX_cc0ac824ba89deda98bb418e8c"`);
        await queryRunner.query(`DROP INDEX "IDX_856f24297f120604f8ae294276"`);
        await queryRunner.query(`DROP INDEX "IDX_da2893697d57368470952a76f6"`);
        await queryRunner.query(`DROP INDEX "IDX_31ec3d5a6b0985cec544c64217"`);
        await queryRunner.query(`DROP INDEX "IDX_483eb296a94d821ebedb375858"`);
        await queryRunner.query(`DROP INDEX "IDX_8106063f79cce8e67790d79092"`);
        await queryRunner.query(`ALTER TABLE "invoice_estimate_history" RENAME TO "temporary_invoice_estimate_history"`);
        await queryRunner.query(`CREATE TABLE "invoice_estimate_history" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "organizationId" varchar, "action" varchar NOT NULL, "userId" varchar, "invoiceId" varchar NOT NULL, "isActive" boolean DEFAULT (1), "isArchived" boolean DEFAULT (0), CONSTRAINT "FK_cc0ac824ba89deda98bb418e8ca" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_856f24297f120604f8ae2942769" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_da2893697d57368470952a76f65" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE SET NULL ON UPDATE NO ACTION, CONSTRAINT "FK_31ec3d5a6b0985cec544c642178" FOREIGN KEY ("invoiceId") REFERENCES "invoice" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`);
        await queryRunner.query(`INSERT INTO "invoice_estimate_history"("id", "createdAt", "updatedAt", "tenantId", "organizationId", "action", "userId", "invoiceId", "isActive", "isArchived") SELECT "id", "createdAt", "updatedAt", "tenantId", "organizationId", "action", "userId", "invoiceId", "isActive", "isArchived" FROM "temporary_invoice_estimate_history"`);
        await queryRunner.query(`DROP TABLE "temporary_invoice_estimate_history"`);
        await queryRunner.query(`CREATE INDEX "IDX_cc0ac824ba89deda98bb418e8c" ON "invoice_estimate_history" ("tenantId") `);
        await queryRunner.query(`CREATE INDEX "IDX_856f24297f120604f8ae294276" ON "invoice_estimate_history" ("organizationId") `);
        await queryRunner.query(`CREATE INDEX "IDX_da2893697d57368470952a76f6" ON "invoice_estimate_history" ("userId") `);
        await queryRunner.query(`CREATE INDEX "IDX_31ec3d5a6b0985cec544c64217" ON "invoice_estimate_history" ("invoiceId") `);
        await queryRunner.query(`CREATE INDEX "IDX_483eb296a94d821ebedb375858" ON "invoice_estimate_history" ("isActive") `);
        await queryRunner.query(`CREATE INDEX "IDX_8106063f79cce8e67790d79092" ON "invoice_estimate_history" ("isArchived") `);
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
