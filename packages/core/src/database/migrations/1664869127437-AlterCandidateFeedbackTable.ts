
import { MigrationInterface, QueryRunner } from "typeorm";

export class AlterCandidateFeedbackTable1664869127437 implements MigrationInterface {

    name = 'AlterCandidateFeedbackTable1664869127437';

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
        await queryRunner.query(`ALTER TABLE "candidate_feedback" DROP COLUMN "status"`);
        await queryRunner.query(`CREATE TYPE "public"."candidate_feedback_status_enum" AS ENUM('APPLIED', 'REJECTED', 'HIRED')`);
        await queryRunner.query(`ALTER TABLE "candidate_feedback" ADD "status" "public"."candidate_feedback_status_enum"`);
    }

    /**
    * PostgresDB Down Migration
    *
    * @param queryRunner
    */
    public async postgresDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`ALTER TABLE "candidate_feedback" DROP COLUMN "status"`);
        await queryRunner.query(`DROP TYPE "public"."candidate_feedback_status_enum"`);
        await queryRunner.query(`ALTER TABLE "candidate_feedback" ADD "status" character varying`);
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
