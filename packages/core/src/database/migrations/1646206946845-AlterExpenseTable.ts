import { MigrationInterface, QueryRunner } from "typeorm";
import * as chalk from "chalk";
import { DatabaseTypeEnum } from "@gauzy/config";

export class AlterExpenseTable1646206946845 implements MigrationInterface {

    name = 'AlterExpenseTable1646206946845';

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
        await queryRunner.query(`ALTER TABLE "expense" DROP CONSTRAINT "FK_eacb116ab0521ad9b96f2bb53ba"`);
        await queryRunner.query(`ALTER TABLE "expense" DROP CONSTRAINT "FK_42eea5debc63f4d1bf89881c10a"`);
        await queryRunner.query(`ALTER TABLE "expense" ADD CONSTRAINT "FK_eacb116ab0521ad9b96f2bb53ba" FOREIGN KEY ("vendorId") REFERENCES "organization_vendor"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "expense" ADD CONSTRAINT "FK_42eea5debc63f4d1bf89881c10a" FOREIGN KEY ("categoryId") REFERENCES "expense_category"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
    }

    /**
    * PostgresDB Down Migration
    *
    * @param queryRunner
    */
    public async postgresDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`ALTER TABLE "expense" DROP CONSTRAINT "FK_42eea5debc63f4d1bf89881c10a"`);
        await queryRunner.query(`ALTER TABLE "expense" DROP CONSTRAINT "FK_eacb116ab0521ad9b96f2bb53ba"`);
        await queryRunner.query(`ALTER TABLE "expense" ADD CONSTRAINT "FK_42eea5debc63f4d1bf89881c10a" FOREIGN KEY ("categoryId") REFERENCES "expense_category"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "expense" ADD CONSTRAINT "FK_eacb116ab0521ad9b96f2bb53ba" FOREIGN KEY ("vendorId") REFERENCES "organization_vendor"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }


    /**
   * SqliteDB Up Migration
   *
   * @param queryRunner
   */
    public async sqliteUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`DROP INDEX "IDX_047b8b5c0782d5a6d4c8bfc1a4"`);
        await queryRunner.query(`DROP INDEX "IDX_9971c4171ae051e74b833984a3"`);
        await queryRunner.query(`DROP INDEX "IDX_42eea5debc63f4d1bf89881c10"`);
        await queryRunner.query(`DROP INDEX "IDX_eacb116ab0521ad9b96f2bb53b"`);
        await queryRunner.query(`DROP INDEX "IDX_5e7b197dbac69012dbdb4964f3"`);
        await queryRunner.query(`DROP INDEX "IDX_5f57d077c28b378a6c885e81c5"`);
        await queryRunner.query(`DROP INDEX "IDX_97ed0e2b80f2e7ec260fd81cd9"`);
        await queryRunner.query(`DROP INDEX "IDX_0006d3025b6c92fbd4089b9465"`);
        await queryRunner.query(`DROP INDEX "IDX_dd8ab9312fb8d787982b9feebf"`);
        await queryRunner.query(`DROP INDEX "IDX_cbfebdb1419f9b8036a8b0546e"`);
        await queryRunner.query(`DROP INDEX "IDX_89508d119b1a279c037d9da151"`);
        await queryRunner.query(`DROP INDEX "IDX_3826d6ca74a08a8498fa17d330"`);
        await queryRunner.query(`DROP INDEX "IDX_b5bb8f62d401475fcc8c2ba35e"`);
        await queryRunner.query(`DROP INDEX "IDX_846a933af451a33b95b7b198c6"`);
        await queryRunner.query(`DROP INDEX "IDX_c5fb146726ff128e600f23d0a1"`);
        await queryRunner.query(`DROP INDEX "IDX_6d171c9d5f81095436b99da5e6"`);
        await queryRunner.query(`CREATE TABLE "temporary_expense" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "organizationId" varchar, "amount" numeric NOT NULL, "typeOfExpense" varchar, "notes" varchar, "currency" varchar NOT NULL, "valueDate" datetime, "purpose" varchar, "taxType" varchar, "taxLabel" varchar, "rateValue" numeric, "receipt" varchar, "splitExpense" boolean, "reference" varchar, "status" varchar, "employeeId" varchar, "vendorId" varchar NOT NULL, "categoryId" varchar NOT NULL, "projectId" varchar, "organizationContactId" varchar, CONSTRAINT "FK_047b8b5c0782d5a6d4c8bfc1a4e" FOREIGN KEY ("organizationContactId") REFERENCES "organization_contact" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_9971c4171ae051e74b833984a30" FOREIGN KEY ("projectId") REFERENCES "organization_project" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_5e7b197dbac69012dbdb4964f37" FOREIGN KEY ("employeeId") REFERENCES "employee" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_c5fb146726ff128e600f23d0a1b" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_6d171c9d5f81095436b99da5e62" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`);
        await queryRunner.query(`INSERT INTO "temporary_expense"("id", "createdAt", "updatedAt", "tenantId", "organizationId", "amount", "typeOfExpense", "notes", "currency", "valueDate", "purpose", "taxType", "taxLabel", "rateValue", "receipt", "splitExpense", "reference", "status", "employeeId", "vendorId", "categoryId", "projectId", "organizationContactId") SELECT "id", "createdAt", "updatedAt", "tenantId", "organizationId", "amount", "typeOfExpense", "notes", "currency", "valueDate", "purpose", "taxType", "taxLabel", "rateValue", "receipt", "splitExpense", "reference", "status", "employeeId", "vendorId", "categoryId", "projectId", "organizationContactId" FROM "expense"`);
        await queryRunner.query(`DROP TABLE "expense"`);
        await queryRunner.query(`ALTER TABLE "temporary_expense" RENAME TO "expense"`);
        await queryRunner.query(`CREATE INDEX "IDX_047b8b5c0782d5a6d4c8bfc1a4" ON "expense" ("organizationContactId") `);
        await queryRunner.query(`CREATE INDEX "IDX_9971c4171ae051e74b833984a3" ON "expense" ("projectId") `);
        await queryRunner.query(`CREATE INDEX "IDX_42eea5debc63f4d1bf89881c10" ON "expense" ("categoryId") `);
        await queryRunner.query(`CREATE INDEX "IDX_eacb116ab0521ad9b96f2bb53b" ON "expense" ("vendorId") `);
        await queryRunner.query(`CREATE INDEX "IDX_5e7b197dbac69012dbdb4964f3" ON "expense" ("employeeId") `);
        await queryRunner.query(`CREATE INDEX "IDX_5f57d077c28b378a6c885e81c5" ON "expense" ("receipt") `);
        await queryRunner.query(`CREATE INDEX "IDX_97ed0e2b80f2e7ec260fd81cd9" ON "expense" ("rateValue") `);
        await queryRunner.query(`CREATE INDEX "IDX_0006d3025b6c92fbd4089b9465" ON "expense" ("taxLabel") `);
        await queryRunner.query(`CREATE INDEX "IDX_dd8ab9312fb8d787982b9feebf" ON "expense" ("taxType") `);
        await queryRunner.query(`CREATE INDEX "IDX_cbfebdb1419f9b8036a8b0546e" ON "expense" ("purpose") `);
        await queryRunner.query(`CREATE INDEX "IDX_89508d119b1a279c037d9da151" ON "expense" ("currency") `);
        await queryRunner.query(`CREATE INDEX "IDX_3826d6ca74a08a8498fa17d330" ON "expense" ("notes") `);
        await queryRunner.query(`CREATE INDEX "IDX_b5bb8f62d401475fcc8c2ba35e" ON "expense" ("typeOfExpense") `);
        await queryRunner.query(`CREATE INDEX "IDX_846a933af451a33b95b7b198c6" ON "expense" ("amount") `);
        await queryRunner.query(`CREATE INDEX "IDX_c5fb146726ff128e600f23d0a1" ON "expense" ("organizationId") `);
        await queryRunner.query(`CREATE INDEX "IDX_6d171c9d5f81095436b99da5e6" ON "expense" ("tenantId") `);
        await queryRunner.query(`DROP INDEX "IDX_047b8b5c0782d5a6d4c8bfc1a4"`);
        await queryRunner.query(`DROP INDEX "IDX_9971c4171ae051e74b833984a3"`);
        await queryRunner.query(`DROP INDEX "IDX_42eea5debc63f4d1bf89881c10"`);
        await queryRunner.query(`DROP INDEX "IDX_eacb116ab0521ad9b96f2bb53b"`);
        await queryRunner.query(`DROP INDEX "IDX_5e7b197dbac69012dbdb4964f3"`);
        await queryRunner.query(`DROP INDEX "IDX_5f57d077c28b378a6c885e81c5"`);
        await queryRunner.query(`DROP INDEX "IDX_97ed0e2b80f2e7ec260fd81cd9"`);
        await queryRunner.query(`DROP INDEX "IDX_0006d3025b6c92fbd4089b9465"`);
        await queryRunner.query(`DROP INDEX "IDX_dd8ab9312fb8d787982b9feebf"`);
        await queryRunner.query(`DROP INDEX "IDX_cbfebdb1419f9b8036a8b0546e"`);
        await queryRunner.query(`DROP INDEX "IDX_89508d119b1a279c037d9da151"`);
        await queryRunner.query(`DROP INDEX "IDX_3826d6ca74a08a8498fa17d330"`);
        await queryRunner.query(`DROP INDEX "IDX_b5bb8f62d401475fcc8c2ba35e"`);
        await queryRunner.query(`DROP INDEX "IDX_846a933af451a33b95b7b198c6"`);
        await queryRunner.query(`DROP INDEX "IDX_c5fb146726ff128e600f23d0a1"`);
        await queryRunner.query(`DROP INDEX "IDX_6d171c9d5f81095436b99da5e6"`);
        await queryRunner.query(`CREATE TABLE "temporary_expense" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "organizationId" varchar, "amount" numeric NOT NULL, "typeOfExpense" varchar, "notes" varchar, "currency" varchar NOT NULL, "valueDate" datetime, "purpose" varchar, "taxType" varchar, "taxLabel" varchar, "rateValue" numeric, "receipt" varchar, "splitExpense" boolean, "reference" varchar, "status" varchar, "employeeId" varchar, "vendorId" varchar, "categoryId" varchar, "projectId" varchar, "organizationContactId" varchar, CONSTRAINT "FK_047b8b5c0782d5a6d4c8bfc1a4e" FOREIGN KEY ("organizationContactId") REFERENCES "organization_contact" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_9971c4171ae051e74b833984a30" FOREIGN KEY ("projectId") REFERENCES "organization_project" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_5e7b197dbac69012dbdb4964f37" FOREIGN KEY ("employeeId") REFERENCES "employee" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_c5fb146726ff128e600f23d0a1b" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_6d171c9d5f81095436b99da5e62" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`);
        await queryRunner.query(`INSERT INTO "temporary_expense"("id", "createdAt", "updatedAt", "tenantId", "organizationId", "amount", "typeOfExpense", "notes", "currency", "valueDate", "purpose", "taxType", "taxLabel", "rateValue", "receipt", "splitExpense", "reference", "status", "employeeId", "vendorId", "categoryId", "projectId", "organizationContactId") SELECT "id", "createdAt", "updatedAt", "tenantId", "organizationId", "amount", "typeOfExpense", "notes", "currency", "valueDate", "purpose", "taxType", "taxLabel", "rateValue", "receipt", "splitExpense", "reference", "status", "employeeId", "vendorId", "categoryId", "projectId", "organizationContactId" FROM "expense"`);
        await queryRunner.query(`DROP TABLE "expense"`);
        await queryRunner.query(`ALTER TABLE "temporary_expense" RENAME TO "expense"`);
        await queryRunner.query(`CREATE INDEX "IDX_047b8b5c0782d5a6d4c8bfc1a4" ON "expense" ("organizationContactId") `);
        await queryRunner.query(`CREATE INDEX "IDX_9971c4171ae051e74b833984a3" ON "expense" ("projectId") `);
        await queryRunner.query(`CREATE INDEX "IDX_42eea5debc63f4d1bf89881c10" ON "expense" ("categoryId") `);
        await queryRunner.query(`CREATE INDEX "IDX_eacb116ab0521ad9b96f2bb53b" ON "expense" ("vendorId") `);
        await queryRunner.query(`CREATE INDEX "IDX_5e7b197dbac69012dbdb4964f3" ON "expense" ("employeeId") `);
        await queryRunner.query(`CREATE INDEX "IDX_5f57d077c28b378a6c885e81c5" ON "expense" ("receipt") `);
        await queryRunner.query(`CREATE INDEX "IDX_97ed0e2b80f2e7ec260fd81cd9" ON "expense" ("rateValue") `);
        await queryRunner.query(`CREATE INDEX "IDX_0006d3025b6c92fbd4089b9465" ON "expense" ("taxLabel") `);
        await queryRunner.query(`CREATE INDEX "IDX_dd8ab9312fb8d787982b9feebf" ON "expense" ("taxType") `);
        await queryRunner.query(`CREATE INDEX "IDX_cbfebdb1419f9b8036a8b0546e" ON "expense" ("purpose") `);
        await queryRunner.query(`CREATE INDEX "IDX_89508d119b1a279c037d9da151" ON "expense" ("currency") `);
        await queryRunner.query(`CREATE INDEX "IDX_3826d6ca74a08a8498fa17d330" ON "expense" ("notes") `);
        await queryRunner.query(`CREATE INDEX "IDX_b5bb8f62d401475fcc8c2ba35e" ON "expense" ("typeOfExpense") `);
        await queryRunner.query(`CREATE INDEX "IDX_846a933af451a33b95b7b198c6" ON "expense" ("amount") `);
        await queryRunner.query(`CREATE INDEX "IDX_c5fb146726ff128e600f23d0a1" ON "expense" ("organizationId") `);
        await queryRunner.query(`CREATE INDEX "IDX_6d171c9d5f81095436b99da5e6" ON "expense" ("tenantId") `);
        await queryRunner.query(`DROP INDEX "IDX_047b8b5c0782d5a6d4c8bfc1a4"`);
        await queryRunner.query(`DROP INDEX "IDX_9971c4171ae051e74b833984a3"`);
        await queryRunner.query(`DROP INDEX "IDX_42eea5debc63f4d1bf89881c10"`);
        await queryRunner.query(`DROP INDEX "IDX_eacb116ab0521ad9b96f2bb53b"`);
        await queryRunner.query(`DROP INDEX "IDX_5e7b197dbac69012dbdb4964f3"`);
        await queryRunner.query(`DROP INDEX "IDX_5f57d077c28b378a6c885e81c5"`);
        await queryRunner.query(`DROP INDEX "IDX_97ed0e2b80f2e7ec260fd81cd9"`);
        await queryRunner.query(`DROP INDEX "IDX_0006d3025b6c92fbd4089b9465"`);
        await queryRunner.query(`DROP INDEX "IDX_dd8ab9312fb8d787982b9feebf"`);
        await queryRunner.query(`DROP INDEX "IDX_cbfebdb1419f9b8036a8b0546e"`);
        await queryRunner.query(`DROP INDEX "IDX_89508d119b1a279c037d9da151"`);
        await queryRunner.query(`DROP INDEX "IDX_3826d6ca74a08a8498fa17d330"`);
        await queryRunner.query(`DROP INDEX "IDX_b5bb8f62d401475fcc8c2ba35e"`);
        await queryRunner.query(`DROP INDEX "IDX_846a933af451a33b95b7b198c6"`);
        await queryRunner.query(`DROP INDEX "IDX_c5fb146726ff128e600f23d0a1"`);
        await queryRunner.query(`DROP INDEX "IDX_6d171c9d5f81095436b99da5e6"`);
        await queryRunner.query(`CREATE TABLE "temporary_expense" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "organizationId" varchar, "amount" numeric NOT NULL, "typeOfExpense" varchar, "notes" varchar, "currency" varchar NOT NULL, "valueDate" datetime, "purpose" varchar, "taxType" varchar, "taxLabel" varchar, "rateValue" numeric, "receipt" varchar, "splitExpense" boolean, "reference" varchar, "status" varchar, "employeeId" varchar, "vendorId" varchar, "categoryId" varchar, "projectId" varchar, "organizationContactId" varchar, CONSTRAINT "FK_047b8b5c0782d5a6d4c8bfc1a4e" FOREIGN KEY ("organizationContactId") REFERENCES "organization_contact" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_9971c4171ae051e74b833984a30" FOREIGN KEY ("projectId") REFERENCES "organization_project" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_5e7b197dbac69012dbdb4964f37" FOREIGN KEY ("employeeId") REFERENCES "employee" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_c5fb146726ff128e600f23d0a1b" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_6d171c9d5f81095436b99da5e62" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_eacb116ab0521ad9b96f2bb53ba" FOREIGN KEY ("vendorId") REFERENCES "organization_vendor" ("id") ON DELETE SET NULL ON UPDATE NO ACTION, CONSTRAINT "FK_42eea5debc63f4d1bf89881c10a" FOREIGN KEY ("categoryId") REFERENCES "expense_category" ("id") ON DELETE SET NULL ON UPDATE NO ACTION)`);
        await queryRunner.query(`INSERT INTO "temporary_expense"("id", "createdAt", "updatedAt", "tenantId", "organizationId", "amount", "typeOfExpense", "notes", "currency", "valueDate", "purpose", "taxType", "taxLabel", "rateValue", "receipt", "splitExpense", "reference", "status", "employeeId", "vendorId", "categoryId", "projectId", "organizationContactId") SELECT "id", "createdAt", "updatedAt", "tenantId", "organizationId", "amount", "typeOfExpense", "notes", "currency", "valueDate", "purpose", "taxType", "taxLabel", "rateValue", "receipt", "splitExpense", "reference", "status", "employeeId", "vendorId", "categoryId", "projectId", "organizationContactId" FROM "expense"`);
        await queryRunner.query(`DROP TABLE "expense"`);
        await queryRunner.query(`ALTER TABLE "temporary_expense" RENAME TO "expense"`);
        await queryRunner.query(`CREATE INDEX "IDX_047b8b5c0782d5a6d4c8bfc1a4" ON "expense" ("organizationContactId") `);
        await queryRunner.query(`CREATE INDEX "IDX_9971c4171ae051e74b833984a3" ON "expense" ("projectId") `);
        await queryRunner.query(`CREATE INDEX "IDX_42eea5debc63f4d1bf89881c10" ON "expense" ("categoryId") `);
        await queryRunner.query(`CREATE INDEX "IDX_eacb116ab0521ad9b96f2bb53b" ON "expense" ("vendorId") `);
        await queryRunner.query(`CREATE INDEX "IDX_5e7b197dbac69012dbdb4964f3" ON "expense" ("employeeId") `);
        await queryRunner.query(`CREATE INDEX "IDX_5f57d077c28b378a6c885e81c5" ON "expense" ("receipt") `);
        await queryRunner.query(`CREATE INDEX "IDX_97ed0e2b80f2e7ec260fd81cd9" ON "expense" ("rateValue") `);
        await queryRunner.query(`CREATE INDEX "IDX_0006d3025b6c92fbd4089b9465" ON "expense" ("taxLabel") `);
        await queryRunner.query(`CREATE INDEX "IDX_dd8ab9312fb8d787982b9feebf" ON "expense" ("taxType") `);
        await queryRunner.query(`CREATE INDEX "IDX_cbfebdb1419f9b8036a8b0546e" ON "expense" ("purpose") `);
        await queryRunner.query(`CREATE INDEX "IDX_89508d119b1a279c037d9da151" ON "expense" ("currency") `);
        await queryRunner.query(`CREATE INDEX "IDX_3826d6ca74a08a8498fa17d330" ON "expense" ("notes") `);
        await queryRunner.query(`CREATE INDEX "IDX_b5bb8f62d401475fcc8c2ba35e" ON "expense" ("typeOfExpense") `);
        await queryRunner.query(`CREATE INDEX "IDX_846a933af451a33b95b7b198c6" ON "expense" ("amount") `);
        await queryRunner.query(`CREATE INDEX "IDX_c5fb146726ff128e600f23d0a1" ON "expense" ("organizationId") `);
        await queryRunner.query(`CREATE INDEX "IDX_6d171c9d5f81095436b99da5e6" ON "expense" ("tenantId") `);
    }

    /**
     * SqliteDB Down Migration
     *
     * @param queryRunner
     */
    public async sqliteDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`DROP INDEX "IDX_6d171c9d5f81095436b99da5e6"`);
        await queryRunner.query(`DROP INDEX "IDX_c5fb146726ff128e600f23d0a1"`);
        await queryRunner.query(`DROP INDEX "IDX_846a933af451a33b95b7b198c6"`);
        await queryRunner.query(`DROP INDEX "IDX_b5bb8f62d401475fcc8c2ba35e"`);
        await queryRunner.query(`DROP INDEX "IDX_3826d6ca74a08a8498fa17d330"`);
        await queryRunner.query(`DROP INDEX "IDX_89508d119b1a279c037d9da151"`);
        await queryRunner.query(`DROP INDEX "IDX_cbfebdb1419f9b8036a8b0546e"`);
        await queryRunner.query(`DROP INDEX "IDX_dd8ab9312fb8d787982b9feebf"`);
        await queryRunner.query(`DROP INDEX "IDX_0006d3025b6c92fbd4089b9465"`);
        await queryRunner.query(`DROP INDEX "IDX_97ed0e2b80f2e7ec260fd81cd9"`);
        await queryRunner.query(`DROP INDEX "IDX_5f57d077c28b378a6c885e81c5"`);
        await queryRunner.query(`DROP INDEX "IDX_5e7b197dbac69012dbdb4964f3"`);
        await queryRunner.query(`DROP INDEX "IDX_eacb116ab0521ad9b96f2bb53b"`);
        await queryRunner.query(`DROP INDEX "IDX_42eea5debc63f4d1bf89881c10"`);
        await queryRunner.query(`DROP INDEX "IDX_9971c4171ae051e74b833984a3"`);
        await queryRunner.query(`DROP INDEX "IDX_047b8b5c0782d5a6d4c8bfc1a4"`);
        await queryRunner.query(`ALTER TABLE "expense" RENAME TO "temporary_expense"`);
        await queryRunner.query(`CREATE TABLE "expense" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "organizationId" varchar, "amount" numeric NOT NULL, "typeOfExpense" varchar, "notes" varchar, "currency" varchar NOT NULL, "valueDate" datetime, "purpose" varchar, "taxType" varchar, "taxLabel" varchar, "rateValue" numeric, "receipt" varchar, "splitExpense" boolean, "reference" varchar, "status" varchar, "employeeId" varchar, "vendorId" varchar, "categoryId" varchar, "projectId" varchar, "organizationContactId" varchar, CONSTRAINT "FK_047b8b5c0782d5a6d4c8bfc1a4e" FOREIGN KEY ("organizationContactId") REFERENCES "organization_contact" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_9971c4171ae051e74b833984a30" FOREIGN KEY ("projectId") REFERENCES "organization_project" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_5e7b197dbac69012dbdb4964f37" FOREIGN KEY ("employeeId") REFERENCES "employee" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_c5fb146726ff128e600f23d0a1b" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_6d171c9d5f81095436b99da5e62" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`);
        await queryRunner.query(`INSERT INTO "expense"("id", "createdAt", "updatedAt", "tenantId", "organizationId", "amount", "typeOfExpense", "notes", "currency", "valueDate", "purpose", "taxType", "taxLabel", "rateValue", "receipt", "splitExpense", "reference", "status", "employeeId", "vendorId", "categoryId", "projectId", "organizationContactId") SELECT "id", "createdAt", "updatedAt", "tenantId", "organizationId", "amount", "typeOfExpense", "notes", "currency", "valueDate", "purpose", "taxType", "taxLabel", "rateValue", "receipt", "splitExpense", "reference", "status", "employeeId", "vendorId", "categoryId", "projectId", "organizationContactId" FROM "temporary_expense"`);
        await queryRunner.query(`DROP TABLE "temporary_expense"`);
        await queryRunner.query(`CREATE INDEX "IDX_6d171c9d5f81095436b99da5e6" ON "expense" ("tenantId") `);
        await queryRunner.query(`CREATE INDEX "IDX_c5fb146726ff128e600f23d0a1" ON "expense" ("organizationId") `);
        await queryRunner.query(`CREATE INDEX "IDX_846a933af451a33b95b7b198c6" ON "expense" ("amount") `);
        await queryRunner.query(`CREATE INDEX "IDX_b5bb8f62d401475fcc8c2ba35e" ON "expense" ("typeOfExpense") `);
        await queryRunner.query(`CREATE INDEX "IDX_3826d6ca74a08a8498fa17d330" ON "expense" ("notes") `);
        await queryRunner.query(`CREATE INDEX "IDX_89508d119b1a279c037d9da151" ON "expense" ("currency") `);
        await queryRunner.query(`CREATE INDEX "IDX_cbfebdb1419f9b8036a8b0546e" ON "expense" ("purpose") `);
        await queryRunner.query(`CREATE INDEX "IDX_dd8ab9312fb8d787982b9feebf" ON "expense" ("taxType") `);
        await queryRunner.query(`CREATE INDEX "IDX_0006d3025b6c92fbd4089b9465" ON "expense" ("taxLabel") `);
        await queryRunner.query(`CREATE INDEX "IDX_97ed0e2b80f2e7ec260fd81cd9" ON "expense" ("rateValue") `);
        await queryRunner.query(`CREATE INDEX "IDX_5f57d077c28b378a6c885e81c5" ON "expense" ("receipt") `);
        await queryRunner.query(`CREATE INDEX "IDX_5e7b197dbac69012dbdb4964f3" ON "expense" ("employeeId") `);
        await queryRunner.query(`CREATE INDEX "IDX_eacb116ab0521ad9b96f2bb53b" ON "expense" ("vendorId") `);
        await queryRunner.query(`CREATE INDEX "IDX_42eea5debc63f4d1bf89881c10" ON "expense" ("categoryId") `);
        await queryRunner.query(`CREATE INDEX "IDX_9971c4171ae051e74b833984a3" ON "expense" ("projectId") `);
        await queryRunner.query(`CREATE INDEX "IDX_047b8b5c0782d5a6d4c8bfc1a4" ON "expense" ("organizationContactId") `);
        await queryRunner.query(`DROP INDEX "IDX_6d171c9d5f81095436b99da5e6"`);
        await queryRunner.query(`DROP INDEX "IDX_c5fb146726ff128e600f23d0a1"`);
        await queryRunner.query(`DROP INDEX "IDX_846a933af451a33b95b7b198c6"`);
        await queryRunner.query(`DROP INDEX "IDX_b5bb8f62d401475fcc8c2ba35e"`);
        await queryRunner.query(`DROP INDEX "IDX_3826d6ca74a08a8498fa17d330"`);
        await queryRunner.query(`DROP INDEX "IDX_89508d119b1a279c037d9da151"`);
        await queryRunner.query(`DROP INDEX "IDX_cbfebdb1419f9b8036a8b0546e"`);
        await queryRunner.query(`DROP INDEX "IDX_dd8ab9312fb8d787982b9feebf"`);
        await queryRunner.query(`DROP INDEX "IDX_0006d3025b6c92fbd4089b9465"`);
        await queryRunner.query(`DROP INDEX "IDX_97ed0e2b80f2e7ec260fd81cd9"`);
        await queryRunner.query(`DROP INDEX "IDX_5f57d077c28b378a6c885e81c5"`);
        await queryRunner.query(`DROP INDEX "IDX_5e7b197dbac69012dbdb4964f3"`);
        await queryRunner.query(`DROP INDEX "IDX_eacb116ab0521ad9b96f2bb53b"`);
        await queryRunner.query(`DROP INDEX "IDX_42eea5debc63f4d1bf89881c10"`);
        await queryRunner.query(`DROP INDEX "IDX_9971c4171ae051e74b833984a3"`);
        await queryRunner.query(`DROP INDEX "IDX_047b8b5c0782d5a6d4c8bfc1a4"`);
        await queryRunner.query(`ALTER TABLE "expense" RENAME TO "temporary_expense"`);
        await queryRunner.query(`CREATE TABLE "expense" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "organizationId" varchar, "amount" numeric NOT NULL, "typeOfExpense" varchar, "notes" varchar, "currency" varchar NOT NULL, "valueDate" datetime, "purpose" varchar, "taxType" varchar, "taxLabel" varchar, "rateValue" numeric, "receipt" varchar, "splitExpense" boolean, "reference" varchar, "status" varchar, "employeeId" varchar, "vendorId" varchar NOT NULL, "categoryId" varchar NOT NULL, "projectId" varchar, "organizationContactId" varchar, CONSTRAINT "FK_047b8b5c0782d5a6d4c8bfc1a4e" FOREIGN KEY ("organizationContactId") REFERENCES "organization_contact" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_9971c4171ae051e74b833984a30" FOREIGN KEY ("projectId") REFERENCES "organization_project" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_5e7b197dbac69012dbdb4964f37" FOREIGN KEY ("employeeId") REFERENCES "employee" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_c5fb146726ff128e600f23d0a1b" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_6d171c9d5f81095436b99da5e62" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`);
        await queryRunner.query(`INSERT INTO "expense"("id", "createdAt", "updatedAt", "tenantId", "organizationId", "amount", "typeOfExpense", "notes", "currency", "valueDate", "purpose", "taxType", "taxLabel", "rateValue", "receipt", "splitExpense", "reference", "status", "employeeId", "vendorId", "categoryId", "projectId", "organizationContactId") SELECT "id", "createdAt", "updatedAt", "tenantId", "organizationId", "amount", "typeOfExpense", "notes", "currency", "valueDate", "purpose", "taxType", "taxLabel", "rateValue", "receipt", "splitExpense", "reference", "status", "employeeId", "vendorId", "categoryId", "projectId", "organizationContactId" FROM "temporary_expense"`);
        await queryRunner.query(`DROP TABLE "temporary_expense"`);
        await queryRunner.query(`CREATE INDEX "IDX_6d171c9d5f81095436b99da5e6" ON "expense" ("tenantId") `);
        await queryRunner.query(`CREATE INDEX "IDX_c5fb146726ff128e600f23d0a1" ON "expense" ("organizationId") `);
        await queryRunner.query(`CREATE INDEX "IDX_846a933af451a33b95b7b198c6" ON "expense" ("amount") `);
        await queryRunner.query(`CREATE INDEX "IDX_b5bb8f62d401475fcc8c2ba35e" ON "expense" ("typeOfExpense") `);
        await queryRunner.query(`CREATE INDEX "IDX_3826d6ca74a08a8498fa17d330" ON "expense" ("notes") `);
        await queryRunner.query(`CREATE INDEX "IDX_89508d119b1a279c037d9da151" ON "expense" ("currency") `);
        await queryRunner.query(`CREATE INDEX "IDX_cbfebdb1419f9b8036a8b0546e" ON "expense" ("purpose") `);
        await queryRunner.query(`CREATE INDEX "IDX_dd8ab9312fb8d787982b9feebf" ON "expense" ("taxType") `);
        await queryRunner.query(`CREATE INDEX "IDX_0006d3025b6c92fbd4089b9465" ON "expense" ("taxLabel") `);
        await queryRunner.query(`CREATE INDEX "IDX_97ed0e2b80f2e7ec260fd81cd9" ON "expense" ("rateValue") `);
        await queryRunner.query(`CREATE INDEX "IDX_5f57d077c28b378a6c885e81c5" ON "expense" ("receipt") `);
        await queryRunner.query(`CREATE INDEX "IDX_5e7b197dbac69012dbdb4964f3" ON "expense" ("employeeId") `);
        await queryRunner.query(`CREATE INDEX "IDX_eacb116ab0521ad9b96f2bb53b" ON "expense" ("vendorId") `);
        await queryRunner.query(`CREATE INDEX "IDX_42eea5debc63f4d1bf89881c10" ON "expense" ("categoryId") `);
        await queryRunner.query(`CREATE INDEX "IDX_9971c4171ae051e74b833984a3" ON "expense" ("projectId") `);
        await queryRunner.query(`CREATE INDEX "IDX_047b8b5c0782d5a6d4c8bfc1a4" ON "expense" ("organizationContactId") `);
        await queryRunner.query(`DROP INDEX "IDX_6d171c9d5f81095436b99da5e6"`);
        await queryRunner.query(`DROP INDEX "IDX_c5fb146726ff128e600f23d0a1"`);
        await queryRunner.query(`DROP INDEX "IDX_846a933af451a33b95b7b198c6"`);
        await queryRunner.query(`DROP INDEX "IDX_b5bb8f62d401475fcc8c2ba35e"`);
        await queryRunner.query(`DROP INDEX "IDX_3826d6ca74a08a8498fa17d330"`);
        await queryRunner.query(`DROP INDEX "IDX_89508d119b1a279c037d9da151"`);
        await queryRunner.query(`DROP INDEX "IDX_cbfebdb1419f9b8036a8b0546e"`);
        await queryRunner.query(`DROP INDEX "IDX_dd8ab9312fb8d787982b9feebf"`);
        await queryRunner.query(`DROP INDEX "IDX_0006d3025b6c92fbd4089b9465"`);
        await queryRunner.query(`DROP INDEX "IDX_97ed0e2b80f2e7ec260fd81cd9"`);
        await queryRunner.query(`DROP INDEX "IDX_5f57d077c28b378a6c885e81c5"`);
        await queryRunner.query(`DROP INDEX "IDX_5e7b197dbac69012dbdb4964f3"`);
        await queryRunner.query(`DROP INDEX "IDX_eacb116ab0521ad9b96f2bb53b"`);
        await queryRunner.query(`DROP INDEX "IDX_42eea5debc63f4d1bf89881c10"`);
        await queryRunner.query(`DROP INDEX "IDX_9971c4171ae051e74b833984a3"`);
        await queryRunner.query(`DROP INDEX "IDX_047b8b5c0782d5a6d4c8bfc1a4"`);
        await queryRunner.query(`ALTER TABLE "expense" RENAME TO "temporary_expense"`);
        await queryRunner.query(`CREATE TABLE "expense" ("id" varchar PRIMARY KEY NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "tenantId" varchar, "organizationId" varchar, "amount" numeric NOT NULL, "typeOfExpense" varchar, "notes" varchar, "currency" varchar NOT NULL, "valueDate" datetime, "purpose" varchar, "taxType" varchar, "taxLabel" varchar, "rateValue" numeric, "receipt" varchar, "splitExpense" boolean, "reference" varchar, "status" varchar, "employeeId" varchar, "vendorId" varchar NOT NULL, "categoryId" varchar NOT NULL, "projectId" varchar, "organizationContactId" varchar, CONSTRAINT "FK_047b8b5c0782d5a6d4c8bfc1a4e" FOREIGN KEY ("organizationContactId") REFERENCES "organization_contact" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_9971c4171ae051e74b833984a30" FOREIGN KEY ("projectId") REFERENCES "organization_project" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_42eea5debc63f4d1bf89881c10a" FOREIGN KEY ("categoryId") REFERENCES "expense_category" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION, CONSTRAINT "FK_eacb116ab0521ad9b96f2bb53ba" FOREIGN KEY ("vendorId") REFERENCES "organization_vendor" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_5e7b197dbac69012dbdb4964f37" FOREIGN KEY ("employeeId") REFERENCES "employee" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, CONSTRAINT "FK_c5fb146726ff128e600f23d0a1b" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_6d171c9d5f81095436b99da5e62" FOREIGN KEY ("tenantId") REFERENCES "tenant" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`);
        await queryRunner.query(`INSERT INTO "expense"("id", "createdAt", "updatedAt", "tenantId", "organizationId", "amount", "typeOfExpense", "notes", "currency", "valueDate", "purpose", "taxType", "taxLabel", "rateValue", "receipt", "splitExpense", "reference", "status", "employeeId", "vendorId", "categoryId", "projectId", "organizationContactId") SELECT "id", "createdAt", "updatedAt", "tenantId", "organizationId", "amount", "typeOfExpense", "notes", "currency", "valueDate", "purpose", "taxType", "taxLabel", "rateValue", "receipt", "splitExpense", "reference", "status", "employeeId", "vendorId", "categoryId", "projectId", "organizationContactId" FROM "temporary_expense"`);
        await queryRunner.query(`DROP TABLE "temporary_expense"`);
        await queryRunner.query(`CREATE INDEX "IDX_6d171c9d5f81095436b99da5e6" ON "expense" ("tenantId") `);
        await queryRunner.query(`CREATE INDEX "IDX_c5fb146726ff128e600f23d0a1" ON "expense" ("organizationId") `);
        await queryRunner.query(`CREATE INDEX "IDX_846a933af451a33b95b7b198c6" ON "expense" ("amount") `);
        await queryRunner.query(`CREATE INDEX "IDX_b5bb8f62d401475fcc8c2ba35e" ON "expense" ("typeOfExpense") `);
        await queryRunner.query(`CREATE INDEX "IDX_3826d6ca74a08a8498fa17d330" ON "expense" ("notes") `);
        await queryRunner.query(`CREATE INDEX "IDX_89508d119b1a279c037d9da151" ON "expense" ("currency") `);
        await queryRunner.query(`CREATE INDEX "IDX_cbfebdb1419f9b8036a8b0546e" ON "expense" ("purpose") `);
        await queryRunner.query(`CREATE INDEX "IDX_dd8ab9312fb8d787982b9feebf" ON "expense" ("taxType") `);
        await queryRunner.query(`CREATE INDEX "IDX_0006d3025b6c92fbd4089b9465" ON "expense" ("taxLabel") `);
        await queryRunner.query(`CREATE INDEX "IDX_97ed0e2b80f2e7ec260fd81cd9" ON "expense" ("rateValue") `);
        await queryRunner.query(`CREATE INDEX "IDX_5f57d077c28b378a6c885e81c5" ON "expense" ("receipt") `);
        await queryRunner.query(`CREATE INDEX "IDX_5e7b197dbac69012dbdb4964f3" ON "expense" ("employeeId") `);
        await queryRunner.query(`CREATE INDEX "IDX_eacb116ab0521ad9b96f2bb53b" ON "expense" ("vendorId") `);
        await queryRunner.query(`CREATE INDEX "IDX_42eea5debc63f4d1bf89881c10" ON "expense" ("categoryId") `);
        await queryRunner.query(`CREATE INDEX "IDX_9971c4171ae051e74b833984a3" ON "expense" ("projectId") `);
        await queryRunner.query(`CREATE INDEX "IDX_047b8b5c0782d5a6d4c8bfc1a4" ON "expense" ("organizationContactId") `);
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
