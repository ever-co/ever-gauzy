
import { MigrationInterface, QueryRunner } from "typeorm";

export class AlterWarehouseMerchant1661599336316 implements MigrationInterface {

    name = 'AlterWarehouseMerchant1661599336316';

    /**
    * Up Migration
    *
    * @param queryRunner
    */
    public async up(queryRunner: QueryRunner): Promise<any> {
        if (queryRunner.connection.options.type === 'sqlite') {
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
}
