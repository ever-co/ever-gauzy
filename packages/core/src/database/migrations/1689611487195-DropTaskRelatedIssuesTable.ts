
import { MigrationInterface, QueryRunner } from "typeorm";

export class DropTaskRelatedIssuesTable1689611487195 implements MigrationInterface {

    name = 'DropTaskRelatedIssuesTable1689611487195';

    /**
    * Up Migration
    *
    * @param queryRunner
    */
    public async up(queryRunner: QueryRunner): Promise<any> {
        if (['sqlite', 'better-sqlite3'].includes(queryRunner.connection.options.type)) {
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
        if (['sqlite', 'better-sqlite3'].includes(queryRunner.connection.options.type)) {
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
        await queryRunner.query(`ALTER TABLE "task_related_issues" DROP CONSTRAINT "FK_425ec34e019f63336fe8d2940ce"`);
		await queryRunner.query(`ALTER TABLE "task_related_issues" DROP CONSTRAINT "FK_c93e2e6d5d0e3a1d7af2725f9fc"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_425ec34e019f63336fe8d2940c"`);
		await queryRunner.query(`DROP INDEX "public"."IDX_c93e2e6d5d0e3a1d7af2725f9f"`);
		await queryRunner.query(`DROP TABLE "task_related_issues"`);
    }

    /**
    * PostgresDB Down Migration
    *
    * @param queryRunner
    */
    public async postgresDownQueryRunner(queryRunner: QueryRunner): Promise<any> {

    }

    /**
    * SqliteDB Up Migration
    *
    * @param queryRunner
    */
    public async sqliteUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`DROP INDEX "IDX_425ec34e019f63336fe8d2940c"`);
		await queryRunner.query(`DROP INDEX "IDX_c93e2e6d5d0e3a1d7af2725f9f"`);
		await queryRunner.query(`ALTER TABLE "task_related_issues" RENAME TO "temporary_task_related_issues"`);
		await queryRunner.query(`CREATE TABLE "task_related_issues" ("taskId_1" varchar NOT NULL, "taskId_2" varchar NOT NULL, PRIMARY KEY ("taskId_1", "taskId_2"))`);
		await queryRunner.query(`INSERT INTO "task_related_issues"("taskId_1", "taskId_2") SELECT "taskId_1", "taskId_2" FROM "temporary_task_related_issues"`);
		await queryRunner.query(`DROP TABLE "temporary_task_related_issues"`);
		await queryRunner.query(`CREATE INDEX "IDX_425ec34e019f63336fe8d2940c" ON "task_related_issues" ("taskId_2")`);
		await queryRunner.query(`CREATE INDEX "IDX_c93e2e6d5d0e3a1d7af2725f9f" ON "task_related_issues" ("taskId_1")`);
		await queryRunner.query(`DROP INDEX "IDX_425ec34e019f63336fe8d2940c"`);
		await queryRunner.query(`DROP INDEX "IDX_c93e2e6d5d0e3a1d7af2725f9f"`);
		await queryRunner.query(`DROP TABLE "task_related_issues"`);
    }

    /**
    * SqliteDB Down Migration
    *
    * @param queryRunner
    */
    public async sqliteDownQueryRunner(queryRunner: QueryRunner): Promise<any> {

    }
}
