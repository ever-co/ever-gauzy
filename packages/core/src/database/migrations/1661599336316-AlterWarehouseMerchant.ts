import { MigrationInterface, QueryRunner } from "typeorm";
import * as chalk from "chalk";
import { DatabaseTypeEnum } from "@gauzy/config";

export class AlterWarehouseMerchant1661599336316 implements MigrationInterface {

    name = 'AlterWarehouseMerchant1661599336316';

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
        await queryRunner.query(`ALTER TABLE "warehouse_merchant" DROP CONSTRAINT "FK_a6bfc0dc6e5234e8e7ef698a36a"`);
        await queryRunner.query(`ALTER TABLE "warehouse_merchant" ADD CONSTRAINT "FK_a6bfc0dc6e5234e8e7ef698a36a" FOREIGN KEY ("warehouseId") REFERENCES "warehouse"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    /**
    * PostgresDB Down Migration
    *
    * @param queryRunner
    */
    public async postgresDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`ALTER TABLE "warehouse_merchant" DROP CONSTRAINT "FK_a6bfc0dc6e5234e8e7ef698a36a"`);
        await queryRunner.query(`ALTER TABLE "warehouse_merchant" ADD CONSTRAINT "FK_a6bfc0dc6e5234e8e7ef698a36a" FOREIGN KEY ("warehouseId") REFERENCES "warehouse"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
    }

    /**
    * SqliteDB Up Migration
    *
    * @param queryRunner
    */
    public async sqliteUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`DROP INDEX "IDX_a6bfc0dc6e5234e8e7ef698a36"`);
        await queryRunner.query(`DROP INDEX "IDX_812f0cfb560ac6dda0d1345765"`);
        await queryRunner.query(`CREATE TABLE "temporary_warehouse_merchant" ("merchantId" varchar NOT NULL, "warehouseId" varchar NOT NULL, CONSTRAINT "FK_812f0cfb560ac6dda0d1345765b" FOREIGN KEY ("merchantId") REFERENCES "merchant" ("id") ON DELETE CASCADE ON UPDATE CASCADE, PRIMARY KEY ("merchantId", "warehouseId"))`);
        await queryRunner.query(`INSERT INTO "temporary_warehouse_merchant"("merchantId", "warehouseId") SELECT "merchantId", "warehouseId" FROM "warehouse_merchant"`);
        await queryRunner.query(`DROP TABLE "warehouse_merchant"`);
        await queryRunner.query(`ALTER TABLE "temporary_warehouse_merchant" RENAME TO "warehouse_merchant"`);
        await queryRunner.query(`CREATE INDEX "IDX_a6bfc0dc6e5234e8e7ef698a36" ON "warehouse_merchant" ("warehouseId") `);
        await queryRunner.query(`CREATE INDEX "IDX_812f0cfb560ac6dda0d1345765" ON "warehouse_merchant" ("merchantId") `);
        await queryRunner.query(`DROP INDEX "IDX_a6bfc0dc6e5234e8e7ef698a36"`);
        await queryRunner.query(`DROP INDEX "IDX_812f0cfb560ac6dda0d1345765"`);
        await queryRunner.query(`CREATE TABLE "temporary_warehouse_merchant" ("merchantId" varchar NOT NULL, "warehouseId" varchar NOT NULL, CONSTRAINT "FK_812f0cfb560ac6dda0d1345765b" FOREIGN KEY ("merchantId") REFERENCES "merchant" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_a6bfc0dc6e5234e8e7ef698a36a" FOREIGN KEY ("warehouseId") REFERENCES "warehouse" ("id") ON DELETE CASCADE ON UPDATE NO ACTION, PRIMARY KEY ("merchantId", "warehouseId"))`);
        await queryRunner.query(`INSERT INTO "temporary_warehouse_merchant"("merchantId", "warehouseId") SELECT "merchantId", "warehouseId" FROM "warehouse_merchant"`);
        await queryRunner.query(`DROP TABLE "warehouse_merchant"`);
        await queryRunner.query(`ALTER TABLE "temporary_warehouse_merchant" RENAME TO "warehouse_merchant"`);
        await queryRunner.query(`CREATE INDEX "IDX_a6bfc0dc6e5234e8e7ef698a36" ON "warehouse_merchant" ("warehouseId") `);
        await queryRunner.query(`CREATE INDEX "IDX_812f0cfb560ac6dda0d1345765" ON "warehouse_merchant" ("merchantId") `);
    }

    /**
    * SqliteDB Down Migration
    *
    * @param queryRunner
    */
    public async sqliteDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`DROP INDEX "IDX_812f0cfb560ac6dda0d1345765"`);
        await queryRunner.query(`DROP INDEX "IDX_a6bfc0dc6e5234e8e7ef698a36"`);
        await queryRunner.query(`ALTER TABLE "warehouse_merchant" RENAME TO "temporary_warehouse_merchant"`);
        await queryRunner.query(`CREATE TABLE "warehouse_merchant" ("merchantId" varchar NOT NULL, "warehouseId" varchar NOT NULL, CONSTRAINT "FK_812f0cfb560ac6dda0d1345765b" FOREIGN KEY ("merchantId") REFERENCES "merchant" ("id") ON DELETE CASCADE ON UPDATE CASCADE, PRIMARY KEY ("merchantId", "warehouseId"))`);
        await queryRunner.query(`INSERT INTO "warehouse_merchant"("merchantId", "warehouseId") SELECT "merchantId", "warehouseId" FROM "temporary_warehouse_merchant"`);
        await queryRunner.query(`DROP TABLE "temporary_warehouse_merchant"`);
        await queryRunner.query(`CREATE INDEX "IDX_812f0cfb560ac6dda0d1345765" ON "warehouse_merchant" ("merchantId") `);
        await queryRunner.query(`CREATE INDEX "IDX_a6bfc0dc6e5234e8e7ef698a36" ON "warehouse_merchant" ("warehouseId") `);
        await queryRunner.query(`DROP INDEX "IDX_812f0cfb560ac6dda0d1345765"`);
        await queryRunner.query(`DROP INDEX "IDX_a6bfc0dc6e5234e8e7ef698a36"`);
        await queryRunner.query(`ALTER TABLE "warehouse_merchant" RENAME TO "temporary_warehouse_merchant"`);
        await queryRunner.query(`CREATE TABLE "warehouse_merchant" ("merchantId" varchar NOT NULL, "warehouseId" varchar NOT NULL, CONSTRAINT "FK_a6bfc0dc6e5234e8e7ef698a36a" FOREIGN KEY ("warehouseId") REFERENCES "warehouse" ("id") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT "FK_812f0cfb560ac6dda0d1345765b" FOREIGN KEY ("merchantId") REFERENCES "merchant" ("id") ON DELETE CASCADE ON UPDATE CASCADE, PRIMARY KEY ("merchantId", "warehouseId"))`);
        await queryRunner.query(`INSERT INTO "warehouse_merchant"("merchantId", "warehouseId") SELECT "merchantId", "warehouseId" FROM "temporary_warehouse_merchant"`);
        await queryRunner.query(`DROP TABLE "temporary_warehouse_merchant"`);
        await queryRunner.query(`CREATE INDEX "IDX_812f0cfb560ac6dda0d1345765" ON "warehouse_merchant" ("merchantId") `);
        await queryRunner.query(`CREATE INDEX "IDX_a6bfc0dc6e5234e8e7ef698a36" ON "warehouse_merchant" ("warehouseId") `);
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
