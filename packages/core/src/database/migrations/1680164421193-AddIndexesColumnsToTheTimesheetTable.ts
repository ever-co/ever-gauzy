
import { MigrationInterface, QueryRunner } from "typeorm";

export class AddIndexesColumnsToTheTimesheetTable1680164421193 implements MigrationInterface {

    name = 'AddIndexesColumnsToTheTimesheetTable1680164421193';

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
        await queryRunner.query(`CREATE INDEX "IDX_930e2b28de9ecb1ea689d5a97a" ON "timesheet" ("startedAt") `);
        await queryRunner.query(`CREATE INDEX "IDX_f6558fbb3158ab90da1c41d943" ON "timesheet" ("stoppedAt") `);
        await queryRunner.query(`CREATE INDEX "IDX_6a79eb7534066b11f59243ede1" ON "timesheet" ("approvedAt") `);
        await queryRunner.query(`CREATE INDEX "IDX_3f8fc4b5718fcaa913f9438e27" ON "timesheet" ("submittedAt") `);
        await queryRunner.query(`CREATE INDEX "IDX_3502c60f98a7cda58dea75bcb5" ON "timesheet" ("lockedAt") `);
        await queryRunner.query(`CREATE INDEX "IDX_c828facbb4250117f83416d9f7" ON "timesheet" ("isBilled") `);
        await queryRunner.query(`CREATE INDEX "IDX_23fdffa8369387d87101090684" ON "timesheet" ("status") `);
        await queryRunner.query(`CREATE INDEX "IDX_d9c9895301adc96bb9eedbc27f" ON "timesheet" ("deletedAt") `);
    }

    /**
    * PostgresDB Down Migration
    *
    * @param queryRunner
    */
    public async postgresDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`DROP INDEX "public"."IDX_d9c9895301adc96bb9eedbc27f"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_23fdffa8369387d87101090684"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_c828facbb4250117f83416d9f7"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_3502c60f98a7cda58dea75bcb5"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_3f8fc4b5718fcaa913f9438e27"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_6a79eb7534066b11f59243ede1"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_f6558fbb3158ab90da1c41d943"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_930e2b28de9ecb1ea689d5a97a"`);
    }

    /**
    * SqliteDB Up Migration
    *
    * @param queryRunner
    */
    public async sqliteUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`CREATE INDEX "IDX_930e2b28de9ecb1ea689d5a97a" ON "timesheet" ("startedAt") `);
        await queryRunner.query(`CREATE INDEX "IDX_f6558fbb3158ab90da1c41d943" ON "timesheet" ("stoppedAt") `);
        await queryRunner.query(`CREATE INDEX "IDX_6a79eb7534066b11f59243ede1" ON "timesheet" ("approvedAt") `);
        await queryRunner.query(`CREATE INDEX "IDX_3f8fc4b5718fcaa913f9438e27" ON "timesheet" ("submittedAt") `);
        await queryRunner.query(`CREATE INDEX "IDX_3502c60f98a7cda58dea75bcb5" ON "timesheet" ("lockedAt") `);
        await queryRunner.query(`CREATE INDEX "IDX_c828facbb4250117f83416d9f7" ON "timesheet" ("isBilled") `);
        await queryRunner.query(`CREATE INDEX "IDX_23fdffa8369387d87101090684" ON "timesheet" ("status") `);
        await queryRunner.query(`CREATE INDEX "IDX_d9c9895301adc96bb9eedbc27f" ON "timesheet" ("deletedAt") `);
    }

    /**
    * SqliteDB Down Migration
    *
    * @param queryRunner
    */
    public async sqliteDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`DROP INDEX "IDX_d9c9895301adc96bb9eedbc27f"`);
        await queryRunner.query(`DROP INDEX "IDX_23fdffa8369387d87101090684"`);
        await queryRunner.query(`DROP INDEX "IDX_c828facbb4250117f83416d9f7"`);
        await queryRunner.query(`DROP INDEX "IDX_3502c60f98a7cda58dea75bcb5"`);
        await queryRunner.query(`DROP INDEX "IDX_3f8fc4b5718fcaa913f9438e27"`);
        await queryRunner.query(`DROP INDEX "IDX_6a79eb7534066b11f59243ede1"`);
        await queryRunner.query(`DROP INDEX "IDX_f6558fbb3158ab90da1c41d943"`);
        await queryRunner.query(`DROP INDEX "IDX_930e2b28de9ecb1ea689d5a97a"`);
    }
}
