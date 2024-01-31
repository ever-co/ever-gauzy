import { MigrationInterface, QueryRunner } from "typeorm";
import * as chalk from "chalk";
import { DatabaseTypeEnum } from "@gauzy/config";

export class AlterEmployeeRecurringExpenseTable1646056129050 implements MigrationInterface {

    name = 'AlterEmployeeRecurringExpenseTable1646056129050';

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
        await queryRunner.query(`ALTER TABLE "employee_recurring_expense" DROP CONSTRAINT "FK_0ac8526c48a3daa267c86225fb5"`);
        await queryRunner.query(`ALTER TABLE "employee_recurring_expense" ALTER COLUMN "employeeId" DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "employee_recurring_expense" ADD CONSTRAINT "FK_0ac8526c48a3daa267c86225fb5" FOREIGN KEY ("employeeId") REFERENCES "employee"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    /**
    * PostgresDB Down Migration
    *
    * @param queryRunner
    */
    public async postgresDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`ALTER TABLE "employee_recurring_expense" DROP CONSTRAINT "FK_0ac8526c48a3daa267c86225fb5"`);
        await queryRunner.query(`ALTER TABLE "employee_recurring_expense" ALTER COLUMN "employeeId" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "employee_recurring_expense" ADD CONSTRAINT "FK_0ac8526c48a3daa267c86225fb5" FOREIGN KEY ("employeeId") REFERENCES "employee"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }


    /**
   * SqliteDB Up Migration
   *
   * @param queryRunner
   */
    public async sqliteUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`DROP INDEX "IDX_0ac8526c48a3daa267c86225fb"`);
        await queryRunner.query(`DROP INDEX "IDX_6e570174fda71e97616e9d2eea"`);
        await queryRunner.query(`DROP INDEX "IDX_739f8cdce21cc72d400559ce00"`);
        await queryRunner.query(`DROP INDEX "IDX_a4b5a2ea2afecf1ee254f1a704"`);
        await queryRunner.query(`DROP INDEX "IDX_3ee5147bb1fde625fa33c0e956"`);
        await queryRunner.query(`DROP INDEX "IDX_5fde7be40b3c03bc0fdac0c2f6"`);
        await queryRunner.query(`CREATE TABLE "temporary_employee_recurring_expense" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "organizationId" varchar, "startDay" integer NOT NULL, "startMonth" integer NOT NULL, "startYear" integer NOT NULL, "startDate" datetime NOT NULL, "endDay" integer, "endMonth" integer, "endYear" integer, "endDate" datetime, "categoryName" varchar NOT NULL, "value" numeric NOT NULL, "currency" varchar NOT NULL, "parentRecurringExpenseId" varchar, "employeeId" varchar NOT NULL, CONSTRAINT "FK_0ac8526c48a3daa267c86225fb5" FOREIGN KEY ("employeeId") REFERENCES "employee" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_3ee5147bb1fde625fa33c0e956b" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_5fde7be40b3c03bc0fdac0c2f66" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`);
        await queryRunner.query(`INSERT INTO "temporary_employee_recurring_expense"("id", "createdAt", "updatedAt", "tenantId", "organizationId", "startDay", "startMonth", "startYear", "startDate", "endDay", "endMonth", "endYear", "endDate", "categoryName", "value", "currency", "parentRecurringExpenseId", "employeeId") SELECT "id", "createdAt", "updatedAt", "tenantId", "organizationId", "startDay", "startMonth", "startYear", "startDate", "endDay", "endMonth", "endYear", "endDate", "categoryName", "value", "currency", "parentRecurringExpenseId", "employeeId" FROM "employee_recurring_expense"`);
        await queryRunner.query(`DROP TABLE "employee_recurring_expense"`);
        await queryRunner.query(`ALTER TABLE "temporary_employee_recurring_expense" RENAME TO "employee_recurring_expense"`);
        await queryRunner.query(`CREATE INDEX "IDX_0ac8526c48a3daa267c86225fb" ON "employee_recurring_expense" ("employeeId") `);
        await queryRunner.query(`CREATE INDEX "IDX_6e570174fda71e97616e9d2eea" ON "employee_recurring_expense" ("parentRecurringExpenseId") `);
        await queryRunner.query(`CREATE INDEX "IDX_739f8cdce21cc72d400559ce00" ON "employee_recurring_expense" ("currency") `);
        await queryRunner.query(`CREATE INDEX "IDX_a4b5a2ea2afecf1ee254f1a704" ON "employee_recurring_expense" ("categoryName") `);
        await queryRunner.query(`CREATE INDEX "IDX_3ee5147bb1fde625fa33c0e956" ON "employee_recurring_expense" ("organizationId") `);
        await queryRunner.query(`CREATE INDEX "IDX_5fde7be40b3c03bc0fdac0c2f6" ON "employee_recurring_expense" ("tenantId") `);
        await queryRunner.query(`DROP INDEX "IDX_0ac8526c48a3daa267c86225fb"`);
        await queryRunner.query(`DROP INDEX "IDX_6e570174fda71e97616e9d2eea"`);
        await queryRunner.query(`DROP INDEX "IDX_739f8cdce21cc72d400559ce00"`);
        await queryRunner.query(`DROP INDEX "IDX_a4b5a2ea2afecf1ee254f1a704"`);
        await queryRunner.query(`DROP INDEX "IDX_3ee5147bb1fde625fa33c0e956"`);
        await queryRunner.query(`DROP INDEX "IDX_5fde7be40b3c03bc0fdac0c2f6"`);
        await queryRunner.query(`CREATE TABLE "temporary_employee_recurring_expense" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "organizationId" varchar, "startDay" integer NOT NULL, "startMonth" integer NOT NULL, "startYear" integer NOT NULL, "startDate" datetime NOT NULL, "endDay" integer, "endMonth" integer, "endYear" integer, "endDate" datetime, "categoryName" varchar NOT NULL, "value" numeric NOT NULL, "currency" varchar NOT NULL, "parentRecurringExpenseId" varchar, "employeeId" varchar NOT NULL)`);
        await queryRunner.query(`INSERT INTO "temporary_employee_recurring_expense"("id", "createdAt", "updatedAt", "tenantId", "organizationId", "startDay", "startMonth", "startYear", "startDate", "endDay", "endMonth", "endYear", "endDate", "categoryName", "value", "currency", "parentRecurringExpenseId", "employeeId") SELECT "id", "createdAt", "updatedAt", "tenantId", "organizationId", "startDay", "startMonth", "startYear", "startDate", "endDay", "endMonth", "endYear", "endDate", "categoryName", "value", "currency", "parentRecurringExpenseId", "employeeId" FROM "employee_recurring_expense"`);
        await queryRunner.query(`DROP TABLE "employee_recurring_expense"`);
        await queryRunner.query(`ALTER TABLE "temporary_employee_recurring_expense" RENAME TO "employee_recurring_expense"`);
        await queryRunner.query(`CREATE INDEX "IDX_0ac8526c48a3daa267c86225fb" ON "employee_recurring_expense" ("employeeId") `);
        await queryRunner.query(`CREATE INDEX "IDX_6e570174fda71e97616e9d2eea" ON "employee_recurring_expense" ("parentRecurringExpenseId") `);
        await queryRunner.query(`CREATE INDEX "IDX_739f8cdce21cc72d400559ce00" ON "employee_recurring_expense" ("currency") `);
        await queryRunner.query(`CREATE INDEX "IDX_a4b5a2ea2afecf1ee254f1a704" ON "employee_recurring_expense" ("categoryName") `);
        await queryRunner.query(`CREATE INDEX "IDX_3ee5147bb1fde625fa33c0e956" ON "employee_recurring_expense" ("organizationId") `);
        await queryRunner.query(`CREATE INDEX "IDX_5fde7be40b3c03bc0fdac0c2f6" ON "employee_recurring_expense" ("tenantId") `);
        await queryRunner.query(`DROP INDEX "IDX_0ac8526c48a3daa267c86225fb"`);
        await queryRunner.query(`DROP INDEX "IDX_6e570174fda71e97616e9d2eea"`);
        await queryRunner.query(`DROP INDEX "IDX_739f8cdce21cc72d400559ce00"`);
        await queryRunner.query(`DROP INDEX "IDX_a4b5a2ea2afecf1ee254f1a704"`);
        await queryRunner.query(`DROP INDEX "IDX_3ee5147bb1fde625fa33c0e956"`);
        await queryRunner.query(`DROP INDEX "IDX_5fde7be40b3c03bc0fdac0c2f6"`);
        await queryRunner.query(`CREATE TABLE "temporary_employee_recurring_expense" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "organizationId" varchar, "startDay" integer NOT NULL, "startMonth" integer NOT NULL, "startYear" integer NOT NULL, "startDate" datetime NOT NULL, "endDay" integer, "endMonth" integer, "endYear" integer, "endDate" datetime, "categoryName" varchar NOT NULL, "value" numeric NOT NULL, "currency" varchar NOT NULL, "parentRecurringExpenseId" varchar, "employeeId" varchar)`);
        await queryRunner.query(`INSERT INTO "temporary_employee_recurring_expense"("id", "createdAt", "updatedAt", "tenantId", "organizationId", "startDay", "startMonth", "startYear", "startDate", "endDay", "endMonth", "endYear", "endDate", "categoryName", "value", "currency", "parentRecurringExpenseId", "employeeId") SELECT "id", "createdAt", "updatedAt", "tenantId", "organizationId", "startDay", "startMonth", "startYear", "startDate", "endDay", "endMonth", "endYear", "endDate", "categoryName", "value", "currency", "parentRecurringExpenseId", "employeeId" FROM "employee_recurring_expense"`);
        await queryRunner.query(`DROP TABLE "employee_recurring_expense"`);
        await queryRunner.query(`ALTER TABLE "temporary_employee_recurring_expense" RENAME TO "employee_recurring_expense"`);
        await queryRunner.query(`CREATE INDEX "IDX_0ac8526c48a3daa267c86225fb" ON "employee_recurring_expense" ("employeeId") `);
        await queryRunner.query(`CREATE INDEX "IDX_6e570174fda71e97616e9d2eea" ON "employee_recurring_expense" ("parentRecurringExpenseId") `);
        await queryRunner.query(`CREATE INDEX "IDX_739f8cdce21cc72d400559ce00" ON "employee_recurring_expense" ("currency") `);
        await queryRunner.query(`CREATE INDEX "IDX_a4b5a2ea2afecf1ee254f1a704" ON "employee_recurring_expense" ("categoryName") `);
        await queryRunner.query(`CREATE INDEX "IDX_3ee5147bb1fde625fa33c0e956" ON "employee_recurring_expense" ("organizationId") `);
        await queryRunner.query(`CREATE INDEX "IDX_5fde7be40b3c03bc0fdac0c2f6" ON "employee_recurring_expense" ("tenantId") `);
        await queryRunner.query(`DROP INDEX "IDX_0ac8526c48a3daa267c86225fb"`);
        await queryRunner.query(`DROP INDEX "IDX_6e570174fda71e97616e9d2eea"`);
        await queryRunner.query(`DROP INDEX "IDX_739f8cdce21cc72d400559ce00"`);
        await queryRunner.query(`DROP INDEX "IDX_a4b5a2ea2afecf1ee254f1a704"`);
        await queryRunner.query(`DROP INDEX "IDX_3ee5147bb1fde625fa33c0e956"`);
        await queryRunner.query(`DROP INDEX "IDX_5fde7be40b3c03bc0fdac0c2f6"`);
        await queryRunner.query(`CREATE TABLE "temporary_employee_recurring_expense" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "organizationId" varchar, "startDay" integer NOT NULL, "startMonth" integer NOT NULL, "startYear" integer NOT NULL, "startDate" datetime NOT NULL, "endDay" integer, "endMonth" integer, "endYear" integer, "endDate" datetime, "categoryName" varchar NOT NULL, "value" numeric NOT NULL, "currency" varchar NOT NULL, "parentRecurringExpenseId" varchar, "employeeId" varchar, CONSTRAINT "FK_5fde7be40b3c03bc0fdac0c2f66" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_3ee5147bb1fde625fa33c0e956b" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_0ac8526c48a3daa267c86225fb5" FOREIGN KEY ("employeeId") REFERENCES "employee" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`);
        await queryRunner.query(`INSERT INTO "temporary_employee_recurring_expense"("id", "createdAt", "updatedAt", "tenantId", "organizationId", "startDay", "startMonth", "startYear", "startDate", "endDay", "endMonth", "endYear", "endDate", "categoryName", "value", "currency", "parentRecurringExpenseId", "employeeId") SELECT "id", "createdAt", "updatedAt", "tenantId", "organizationId", "startDay", "startMonth", "startYear", "startDate", "endDay", "endMonth", "endYear", "endDate", "categoryName", "value", "currency", "parentRecurringExpenseId", "employeeId" FROM "employee_recurring_expense"`);
        await queryRunner.query(`DROP TABLE "employee_recurring_expense"`);
        await queryRunner.query(`ALTER TABLE "temporary_employee_recurring_expense" RENAME TO "employee_recurring_expense"`);
        await queryRunner.query(`CREATE INDEX "IDX_0ac8526c48a3daa267c86225fb" ON "employee_recurring_expense" ("employeeId") `);
        await queryRunner.query(`CREATE INDEX "IDX_6e570174fda71e97616e9d2eea" ON "employee_recurring_expense" ("parentRecurringExpenseId") `);
        await queryRunner.query(`CREATE INDEX "IDX_739f8cdce21cc72d400559ce00" ON "employee_recurring_expense" ("currency") `);
        await queryRunner.query(`CREATE INDEX "IDX_a4b5a2ea2afecf1ee254f1a704" ON "employee_recurring_expense" ("categoryName") `);
        await queryRunner.query(`CREATE INDEX "IDX_3ee5147bb1fde625fa33c0e956" ON "employee_recurring_expense" ("organizationId") `);
        await queryRunner.query(`CREATE INDEX "IDX_5fde7be40b3c03bc0fdac0c2f6" ON "employee_recurring_expense" ("tenantId") `);
    }

    /**
     * SqliteDB Down Migration
     *
     * @param queryRunner
     */
    public async sqliteDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`DROP INDEX "IDX_5fde7be40b3c03bc0fdac0c2f6"`);
        await queryRunner.query(`DROP INDEX "IDX_3ee5147bb1fde625fa33c0e956"`);
        await queryRunner.query(`DROP INDEX "IDX_a4b5a2ea2afecf1ee254f1a704"`);
        await queryRunner.query(`DROP INDEX "IDX_739f8cdce21cc72d400559ce00"`);
        await queryRunner.query(`DROP INDEX "IDX_6e570174fda71e97616e9d2eea"`);
        await queryRunner.query(`DROP INDEX "IDX_0ac8526c48a3daa267c86225fb"`);
        await queryRunner.query(`ALTER TABLE "employee_recurring_expense" RENAME TO "temporary_employee_recurring_expense"`);
        await queryRunner.query(`CREATE TABLE "employee_recurring_expense" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "organizationId" varchar, "startDay" integer NOT NULL, "startMonth" integer NOT NULL, "startYear" integer NOT NULL, "startDate" datetime NOT NULL, "endDay" integer, "endMonth" integer, "endYear" integer, "endDate" datetime, "categoryName" varchar NOT NULL, "value" numeric NOT NULL, "currency" varchar NOT NULL, "parentRecurringExpenseId" varchar, "employeeId" varchar)`);
        await queryRunner.query(`INSERT INTO "employee_recurring_expense"("id", "createdAt", "updatedAt", "tenantId", "organizationId", "startDay", "startMonth", "startYear", "startDate", "endDay", "endMonth", "endYear", "endDate", "categoryName", "value", "currency", "parentRecurringExpenseId", "employeeId") SELECT "id", "createdAt", "updatedAt", "tenantId", "organizationId", "startDay", "startMonth", "startYear", "startDate", "endDay", "endMonth", "endYear", "endDate", "categoryName", "value", "currency", "parentRecurringExpenseId", "employeeId" FROM "temporary_employee_recurring_expense"`);
        await queryRunner.query(`DROP TABLE "temporary_employee_recurring_expense"`);
        await queryRunner.query(`CREATE INDEX "IDX_5fde7be40b3c03bc0fdac0c2f6" ON "employee_recurring_expense" ("tenantId") `);
        await queryRunner.query(`CREATE INDEX "IDX_3ee5147bb1fde625fa33c0e956" ON "employee_recurring_expense" ("organizationId") `);
        await queryRunner.query(`CREATE INDEX "IDX_a4b5a2ea2afecf1ee254f1a704" ON "employee_recurring_expense" ("categoryName") `);
        await queryRunner.query(`CREATE INDEX "IDX_739f8cdce21cc72d400559ce00" ON "employee_recurring_expense" ("currency") `);
        await queryRunner.query(`CREATE INDEX "IDX_6e570174fda71e97616e9d2eea" ON "employee_recurring_expense" ("parentRecurringExpenseId") `);
        await queryRunner.query(`CREATE INDEX "IDX_0ac8526c48a3daa267c86225fb" ON "employee_recurring_expense" ("employeeId") `);
        await queryRunner.query(`DROP INDEX "IDX_5fde7be40b3c03bc0fdac0c2f6"`);
        await queryRunner.query(`DROP INDEX "IDX_3ee5147bb1fde625fa33c0e956"`);
        await queryRunner.query(`DROP INDEX "IDX_a4b5a2ea2afecf1ee254f1a704"`);
        await queryRunner.query(`DROP INDEX "IDX_739f8cdce21cc72d400559ce00"`);
        await queryRunner.query(`DROP INDEX "IDX_6e570174fda71e97616e9d2eea"`);
        await queryRunner.query(`DROP INDEX "IDX_0ac8526c48a3daa267c86225fb"`);
        await queryRunner.query(`ALTER TABLE "employee_recurring_expense" RENAME TO "temporary_employee_recurring_expense"`);
        await queryRunner.query(`CREATE TABLE "employee_recurring_expense" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "organizationId" varchar, "startDay" integer NOT NULL, "startMonth" integer NOT NULL, "startYear" integer NOT NULL, "startDate" datetime NOT NULL, "endDay" integer, "endMonth" integer, "endYear" integer, "endDate" datetime, "categoryName" varchar NOT NULL, "value" numeric NOT NULL, "currency" varchar NOT NULL, "parentRecurringExpenseId" varchar, "employeeId" varchar NOT NULL)`);
        await queryRunner.query(`INSERT INTO "employee_recurring_expense"("id", "createdAt", "updatedAt", "tenantId", "organizationId", "startDay", "startMonth", "startYear", "startDate", "endDay", "endMonth", "endYear", "endDate", "categoryName", "value", "currency", "parentRecurringExpenseId", "employeeId") SELECT "id", "createdAt", "updatedAt", "tenantId", "organizationId", "startDay", "startMonth", "startYear", "startDate", "endDay", "endMonth", "endYear", "endDate", "categoryName", "value", "currency", "parentRecurringExpenseId", "employeeId" FROM "temporary_employee_recurring_expense"`);
        await queryRunner.query(`DROP TABLE "temporary_employee_recurring_expense"`);
        await queryRunner.query(`CREATE INDEX "IDX_5fde7be40b3c03bc0fdac0c2f6" ON "employee_recurring_expense" ("tenantId") `);
        await queryRunner.query(`CREATE INDEX "IDX_3ee5147bb1fde625fa33c0e956" ON "employee_recurring_expense" ("organizationId") `);
        await queryRunner.query(`CREATE INDEX "IDX_a4b5a2ea2afecf1ee254f1a704" ON "employee_recurring_expense" ("categoryName") `);
        await queryRunner.query(`CREATE INDEX "IDX_739f8cdce21cc72d400559ce00" ON "employee_recurring_expense" ("currency") `);
        await queryRunner.query(`CREATE INDEX "IDX_6e570174fda71e97616e9d2eea" ON "employee_recurring_expense" ("parentRecurringExpenseId") `);
        await queryRunner.query(`CREATE INDEX "IDX_0ac8526c48a3daa267c86225fb" ON "employee_recurring_expense" ("employeeId") `);
        await queryRunner.query(`DROP INDEX "IDX_5fde7be40b3c03bc0fdac0c2f6"`);
        await queryRunner.query(`DROP INDEX "IDX_3ee5147bb1fde625fa33c0e956"`);
        await queryRunner.query(`DROP INDEX "IDX_a4b5a2ea2afecf1ee254f1a704"`);
        await queryRunner.query(`DROP INDEX "IDX_739f8cdce21cc72d400559ce00"`);
        await queryRunner.query(`DROP INDEX "IDX_6e570174fda71e97616e9d2eea"`);
        await queryRunner.query(`DROP INDEX "IDX_0ac8526c48a3daa267c86225fb"`);
        await queryRunner.query(`ALTER TABLE "employee_recurring_expense" RENAME TO "temporary_employee_recurring_expense"`);
        await queryRunner.query(`CREATE TABLE "employee_recurring_expense" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "organizationId" varchar, "startDay" integer NOT NULL, "startMonth" integer NOT NULL, "startYear" integer NOT NULL, "startDate" datetime NOT NULL, "endDay" integer, "endMonth" integer, "endYear" integer, "endDate" datetime, "categoryName" varchar NOT NULL, "value" numeric NOT NULL, "currency" varchar NOT NULL, "parentRecurringExpenseId" varchar, "employeeId" varchar NOT NULL, CONSTRAINT "FK_0ac8526c48a3daa267c86225fb5" FOREIGN KEY ("employeeId") REFERENCES "employee" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`);
        await queryRunner.query(`INSERT INTO "employee_recurring_expense"("id", "createdAt", "updatedAt", "tenantId", "organizationId", "startDay", "startMonth", "startYear", "startDate", "endDay", "endMonth", "endYear", "endDate", "categoryName", "value", "currency", "parentRecurringExpenseId", "employeeId") SELECT "id", "createdAt", "updatedAt", "tenantId", "organizationId", "startDay", "startMonth", "startYear", "startDate", "endDay", "endMonth", "endYear", "endDate", "categoryName", "value", "currency", "parentRecurringExpenseId", "employeeId" FROM "temporary_employee_recurring_expense"`);
        await queryRunner.query(`DROP TABLE "temporary_employee_recurring_expense"`);
        await queryRunner.query(`CREATE INDEX "IDX_5fde7be40b3c03bc0fdac0c2f6" ON "employee_recurring_expense" ("tenantId") `);
        await queryRunner.query(`CREATE INDEX "IDX_3ee5147bb1fde625fa33c0e956" ON "employee_recurring_expense" ("organizationId") `);
        await queryRunner.query(`CREATE INDEX "IDX_a4b5a2ea2afecf1ee254f1a704" ON "employee_recurring_expense" ("categoryName") `);
        await queryRunner.query(`CREATE INDEX "IDX_739f8cdce21cc72d400559ce00" ON "employee_recurring_expense" ("currency") `);
        await queryRunner.query(`CREATE INDEX "IDX_6e570174fda71e97616e9d2eea" ON "employee_recurring_expense" ("parentRecurringExpenseId") `);
        await queryRunner.query(`CREATE INDEX "IDX_0ac8526c48a3daa267c86225fb" ON "employee_recurring_expense" ("employeeId") `);
        await queryRunner.query(`DROP INDEX "IDX_5fde7be40b3c03bc0fdac0c2f6"`);
        await queryRunner.query(`DROP INDEX "IDX_3ee5147bb1fde625fa33c0e956"`);
        await queryRunner.query(`DROP INDEX "IDX_a4b5a2ea2afecf1ee254f1a704"`);
        await queryRunner.query(`DROP INDEX "IDX_739f8cdce21cc72d400559ce00"`);
        await queryRunner.query(`DROP INDEX "IDX_6e570174fda71e97616e9d2eea"`);
        await queryRunner.query(`DROP INDEX "IDX_0ac8526c48a3daa267c86225fb"`);
        await queryRunner.query(`ALTER TABLE "employee_recurring_expense" RENAME TO "temporary_employee_recurring_expense"`);
        await queryRunner.query(`CREATE TABLE "employee_recurring_expense" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "organizationId" varchar, "startDay" integer NOT NULL, "startMonth" integer NOT NULL, "startYear" integer NOT NULL, "startDate" datetime NOT NULL, "endDay" integer, "endMonth" integer, "endYear" integer, "endDate" datetime, "categoryName" varchar NOT NULL, "value" numeric NOT NULL, "currency" varchar NOT NULL, "parentRecurringExpenseId" varchar, "employeeId" varchar NOT NULL, CONSTRAINT "FK_0ac8526c48a3daa267c86225fb5" FOREIGN KEY ("employeeId") REFERENCES "employee" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_3ee5147bb1fde625fa33c0e956b" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_5fde7be40b3c03bc0fdac0c2f66" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`);
        await queryRunner.query(`INSERT INTO "employee_recurring_expense"("id", "createdAt", "updatedAt", "tenantId", "organizationId", "startDay", "startMonth", "startYear", "startDate", "endDay", "endMonth", "endYear", "endDate", "categoryName", "value", "currency", "parentRecurringExpenseId", "employeeId") SELECT "id", "createdAt", "updatedAt", "tenantId", "organizationId", "startDay", "startMonth", "startYear", "startDate", "endDay", "endMonth", "endYear", "endDate", "categoryName", "value", "currency", "parentRecurringExpenseId", "employeeId" FROM "temporary_employee_recurring_expense"`);
        await queryRunner.query(`DROP TABLE "temporary_employee_recurring_expense"`);
        await queryRunner.query(`CREATE INDEX "IDX_5fde7be40b3c03bc0fdac0c2f6" ON "employee_recurring_expense" ("tenantId") `);
        await queryRunner.query(`CREATE INDEX "IDX_3ee5147bb1fde625fa33c0e956" ON "employee_recurring_expense" ("organizationId") `);
        await queryRunner.query(`CREATE INDEX "IDX_a4b5a2ea2afecf1ee254f1a704" ON "employee_recurring_expense" ("categoryName") `);
        await queryRunner.query(`CREATE INDEX "IDX_739f8cdce21cc72d400559ce00" ON "employee_recurring_expense" ("currency") `);
        await queryRunner.query(`CREATE INDEX "IDX_6e570174fda71e97616e9d2eea" ON "employee_recurring_expense" ("parentRecurringExpenseId") `);
        await queryRunner.query(`CREATE INDEX "IDX_0ac8526c48a3daa267c86225fb" ON "employee_recurring_expense" ("employeeId") `);
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
