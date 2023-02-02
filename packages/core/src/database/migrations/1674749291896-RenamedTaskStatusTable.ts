
import { MigrationInterface, QueryRunner } from "typeorm";

export class RenamedTaskStatusTable1674749291896 implements MigrationInterface {

    name = 'RenamedTaskStatusTable1674749291896';

    /**
    * Up Migration
    *
    * @param queryRunner
    */
    public async up(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`ALTER TABLE "status" RENAME TO "task_status"`);
    }

    /**
    * Down Migration
    *
    * @param queryRunner
    */
    public async down(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`ALTER TABLE "task_status" RENAME TO "status"`);
    }
}
