
import { MigrationInterface, QueryRunner } from "typeorm";
import * as chalk from 'chalk';
import { DatabaseTypeEnum } from "@gauzy/config";

export class AddInvoiceAmount1758708594794 implements MigrationInterface {

    name = 'AddInvoiceAmount1758708594794';

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
        await queryRunner.query(`CREATE TABLE "invoice_amount" ("deletedAt" TIMESTAMP, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "createdByUserId" uuid, "updatedByUserId" uuid, "deletedByUserId" uuid, "id" uuid NOT NULL DEFAULT gen_random_uuid(), "isActive" boolean DEFAULT true, "isArchived" boolean DEFAULT false, "archivedAt" TIMESTAMP, "tenantId" uuid, "organizationId" uuid, "totalValue" numeric, "currency" character varying, "invoiceId" uuid, CONSTRAINT "PK_08acf694acac8004aa6c9a88610" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_c7a1697f2356c6af661c6b0430" ON "invoice_amount" ("createdByUserId") `);
        await queryRunner.query(`CREATE INDEX "IDX_37efac4da805e463681d2176cf" ON "invoice_amount" ("updatedByUserId") `);
        await queryRunner.query(`CREATE INDEX "IDX_d15694c79a6a27d5cf0bb20c08" ON "invoice_amount" ("deletedByUserId") `);
        await queryRunner.query(`CREATE INDEX "IDX_9d8a66cdbc3a704dc763ce63bc" ON "invoice_amount" ("isActive") `);
        await queryRunner.query(`CREATE INDEX "IDX_8e15e07dac0502af4c799d963c" ON "invoice_amount" ("isArchived") `);
        await queryRunner.query(`CREATE INDEX "IDX_9928a2e0aa0fbfb757348f9fa5" ON "invoice_amount" ("tenantId") `);
        await queryRunner.query(`CREATE INDEX "IDX_6d27b3bebd314c13693443d644" ON "invoice_amount" ("organizationId") `);
        await queryRunner.query(`CREATE INDEX "IDX_7954aa432887e1cfd5642722de" ON "invoice_amount" ("invoiceId") `);
        await queryRunner.query(`ALTER TABLE "invoice_item" ALTER COLUMN "totalValue" DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "invoice" ALTER COLUMN "currency" DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "invoice_amount" ADD CONSTRAINT "FK_c7a1697f2356c6af661c6b04304" FOREIGN KEY ("createdByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "invoice_amount" ADD CONSTRAINT "FK_37efac4da805e463681d2176cf9" FOREIGN KEY ("updatedByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "invoice_amount" ADD CONSTRAINT "FK_d15694c79a6a27d5cf0bb20c08c" FOREIGN KEY ("deletedByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "invoice_amount" ADD CONSTRAINT "FK_9928a2e0aa0fbfb757348f9fa50" FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "invoice_amount" ADD CONSTRAINT "FK_6d27b3bebd314c13693443d644c" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE "invoice_amount" ADD CONSTRAINT "FK_7954aa432887e1cfd5642722de8" FOREIGN KEY ("invoiceId") REFERENCES "invoice"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    /**
    * PostgresDB Down Migration
    *
    * @param queryRunner
    */
    public async postgresDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`ALTER TABLE "invoice_amount" DROP CONSTRAINT "FK_7954aa432887e1cfd5642722de8"`);
        await queryRunner.query(`ALTER TABLE "invoice_amount" DROP CONSTRAINT "FK_6d27b3bebd314c13693443d644c"`);
        await queryRunner.query(`ALTER TABLE "invoice_amount" DROP CONSTRAINT "FK_9928a2e0aa0fbfb757348f9fa50"`);
        await queryRunner.query(`ALTER TABLE "invoice_amount" DROP CONSTRAINT "FK_d15694c79a6a27d5cf0bb20c08c"`);
        await queryRunner.query(`ALTER TABLE "invoice_amount" DROP CONSTRAINT "FK_37efac4da805e463681d2176cf9"`);
        await queryRunner.query(`ALTER TABLE "invoice_amount" DROP CONSTRAINT "FK_c7a1697f2356c6af661c6b04304"`);
        await queryRunner.query(`ALTER TABLE "invoice" ALTER COLUMN "currency" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "invoice_item" ALTER COLUMN "totalValue" SET NOT NULL`);
        await queryRunner.query(`DROP INDEX "public"."IDX_7954aa432887e1cfd5642722de"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_6d27b3bebd314c13693443d644"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_9928a2e0aa0fbfb757348f9fa5"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_8e15e07dac0502af4c799d963c"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_9d8a66cdbc3a704dc763ce63bc"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_d15694c79a6a27d5cf0bb20c08"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_37efac4da805e463681d2176cf"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_c7a1697f2356c6af661c6b0430"`);
        await queryRunner.query(`DROP TABLE "invoice_amount"`);
    }

    /**
    * SqliteDB and BetterSQlite3DB Up Migration
    *
    * @param queryRunner
    */
    public async sqliteUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
        
    }

    /**
    * SqliteDB and BetterSQlite3DB Down Migration
    *
    * @param queryRunner
    */
    public async sqliteDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
        
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
