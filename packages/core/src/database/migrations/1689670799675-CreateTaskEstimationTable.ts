
import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateTaskEstimationTable1689670799675 implements MigrationInterface {

    name = 'CreateTaskEstimationTable1689670799675';

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
        await queryRunner.query(`CREATE TABLE "task_estimation" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "tenantId" uuid, "organizationId" uuid, "estimate" integer NOT NULL, "employeeId" uuid NOT NULL, "taskId" uuid NOT NULL, CONSTRAINT "PK_66744e711a8663030cbe16e2799" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_87bfea6d0b9a1ec602ee88e5f6" ON "task_estimation" ("tenantId") `);
        await queryRunner.query(`CREATE INDEX "IDX_16507eb222e3c50be077fb4ace" ON "task_estimation" ("organizationId") `);
        await queryRunner.query(`CREATE INDEX "IDX_8f274646f2bdf4e12990feeb04" ON "task_estimation" ("employeeId") `);
        await queryRunner.query(`CREATE INDEX "IDX_a3ee022203211f678376cd919b" ON "task_estimation" ("taskId") `);
        await queryRunner.query(`ALTER TABLE "task_estimation" ADD CONSTRAINT "FK_87bfea6d0b9a1ec602ee88e5f68" FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "task_estimation" ADD CONSTRAINT "FK_16507eb222e3c50be077fb4ace2" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE "task_estimation" ADD CONSTRAINT "FK_8f274646f2bdf4e12990feeb040" FOREIGN KEY ("employeeId") REFERENCES "employee"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "task_estimation" ADD CONSTRAINT "FK_a3ee022203211f678376cd919bb" FOREIGN KEY ("taskId") REFERENCES "task"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    /**
    * PostgresDB Down Migration
    *
    * @param queryRunner
    */
    public async postgresDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`ALTER TABLE "task_estimation" DROP CONSTRAINT "FK_a3ee022203211f678376cd919bb"`);
        await queryRunner.query(`ALTER TABLE "task_estimation" DROP CONSTRAINT "FK_8f274646f2bdf4e12990feeb040"`);
        await queryRunner.query(`ALTER TABLE "task_estimation" DROP CONSTRAINT "FK_16507eb222e3c50be077fb4ace2"`);
        await queryRunner.query(`ALTER TABLE "task_estimation" DROP CONSTRAINT "FK_87bfea6d0b9a1ec602ee88e5f68"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_a3ee022203211f678376cd919b"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_8f274646f2bdf4e12990feeb04"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_16507eb222e3c50be077fb4ace"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_87bfea6d0b9a1ec602ee88e5f6"`);
        await queryRunner.query(`DROP TABLE "task_estimation"`);
    }

    /**
    * SqliteDB Up Migration
    *
    * @param queryRunner
    */
    public async sqliteUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
        
    }

    /**
    * SqliteDB Down Migration
    *
    * @param queryRunner
    */
    public async sqliteDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
        
    }
}
