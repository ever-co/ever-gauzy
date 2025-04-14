
import { MigrationInterface, QueryRunner } from "typeorm";
import { DatabaseTypeEnum } from "@gauzy/config";

export class RevertWrongDateFieldToTimestamp1744378987976 implements MigrationInterface {

    name = 'RevertWrongDateFieldToTimestamp1744378987976';

    /**
     * Up Migration
     *
     * @param queryRunner
     */
    public async up(queryRunner: QueryRunner): Promise<void> {
        if (queryRunner.connection.options.type !== DatabaseTypeEnum.postgres) {
            throw Error(`Unsupported database: ${queryRunner.connection.options.type}`);
        }
    
        await queryRunner.query(`ALTER TABLE "invoice" ALTER COLUMN "invoiceDate" TYPE TIMESTAMP`);
        await queryRunner.query(`ALTER TABLE "invoice" ALTER COLUMN "dueDate" TYPE TIMESTAMP`);
    }

    /**
     * Down Migration
     *
     * @param queryRunner
     */
    public async down(queryRunner: QueryRunner): Promise<void> {
        if (queryRunner.connection.options.type !== DatabaseTypeEnum.postgres) {
            throw Error(`Unsupported database: ${queryRunner.connection.options.type}`);
        }
    
        await queryRunner.query(`ALTER TABLE "invoice" ALTER COLUMN "invoiceDate" TYPE DATE`);
        await queryRunner.query(`ALTER TABLE "invoice" ALTER COLUMN "dueDate" TYPE DATE`);
    }
}
