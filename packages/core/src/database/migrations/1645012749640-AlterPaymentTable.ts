import { MigrationInterface, QueryRunner } from "typeorm";
    
export class AlterPaymentTable1645012749640 implements MigrationInterface {

    name = 'AlterPaymentTable1645012749640';

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
        await queryRunner.query(`ALTER TABLE "payment" DROP COLUMN "paymentMethod"`);
        await queryRunner.query(`CREATE TYPE "public"."payment_paymentmethod_enum" AS ENUM('BANK_TRANSFER', 'CASH', 'CHEQUE', 'CREDIT_CARD', 'DEBIT', 'ONLINE')`);
        await queryRunner.query(`ALTER TABLE "payment" ADD "paymentMethod" "public"."payment_paymentmethod_enum"`);
    }

    /**
    * PostgresDB Down Migration
    * 
    * @param queryRunner 
    */
    public async postgresDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`ALTER TABLE "payment" DROP COLUMN "paymentMethod"`);
        await queryRunner.query(`DROP TYPE "public"."payment_paymentmethod_enum"`);
        await queryRunner.query(`ALTER TABLE "payment" ADD "paymentMethod" character varying`);
    }

    /**
    * SqliteDB Up Migration
    * 
    * @param queryRunner 
    */
    public async sqliteUpQueryRunner(queryRunner: QueryRunner): Promise<any> {}

    /**
     * SqliteDB Down Migration
     * 
     * @param queryRunner 
     */
    public async sqliteDownQueryRunner(queryRunner: QueryRunner): Promise<any> {}
}