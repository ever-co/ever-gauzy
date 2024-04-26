
import { MigrationInterface, QueryRunner } from "typeorm";
import { yellow } from "chalk";
import { DatabaseTypeEnum } from "@gauzy/config";

export class CreateDailyPlanTasksEntity1714098437821 implements MigrationInterface {

    name = 'CreateDailyPlanTasksEntity1714098437821';

    /**
     * Up Migration
     *
     * @param queryRunner
     */
    public async up(queryRunner: QueryRunner): Promise<void> {
        console.log(yellow(this.name + ' start running!'));

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
        await queryRunner.query(`CREATE TABLE "daily_plan_task" ("deletedAt" TIMESTAMP, "id" uuid NOT NULL DEFAULT gen_random_uuid(), "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "isActive" boolean DEFAULT true, "isArchived" boolean DEFAULT false, "tenantId" uuid, "organizationId" uuid, "dailyPlanId" uuid, "taskId" uuid, CONSTRAINT "PK_d6f27a2c1e08d7b0ea5ab00a5b9" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_fbe6399dd99e8b4bc1ed9a4fc1" ON "daily_plan_task" ("isActive") `);
        await queryRunner.query(`CREATE INDEX "IDX_1a541bae1d230b11bbdd256e09" ON "daily_plan_task" ("isArchived") `);
        await queryRunner.query(`CREATE INDEX "IDX_559a1e1055d1ef1bd83e33f9ff" ON "daily_plan_task" ("tenantId") `);
        await queryRunner.query(`CREATE INDEX "IDX_b0a8166ba2272bc6868b7042e6" ON "daily_plan_task" ("organizationId") `);
        await queryRunner.query(`CREATE INDEX "IDX_44d86eb47db0ffbf7e79bf7ff0" ON "daily_plan_task" ("dailyPlanId") `);
        await queryRunner.query(`CREATE INDEX "IDX_791067c0a03b37ab50578e60d4" ON "daily_plan_task" ("taskId") `);
        await queryRunner.query(`ALTER TABLE "daily_plan_task" ADD CONSTRAINT "FK_559a1e1055d1ef1bd83e33f9ffc" FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "daily_plan_task" ADD CONSTRAINT "FK_b0a8166ba2272bc6868b7042e6d" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE "daily_plan_task" ADD CONSTRAINT "FK_44d86eb47db0ffbf7e79bf7ff0d" FOREIGN KEY ("dailyPlanId") REFERENCES "daily_plan"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "daily_plan_task" ADD CONSTRAINT "FK_791067c0a03b37ab50578e60d4d" FOREIGN KEY ("taskId") REFERENCES "task"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    /**
    * PostgresDB Down Migration
    *
    * @param queryRunner
    */
    public async postgresDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`ALTER TABLE "daily_plan_task" DROP CONSTRAINT "FK_791067c0a03b37ab50578e60d4d"`);
        await queryRunner.query(`ALTER TABLE "daily_plan_task" DROP CONSTRAINT "FK_44d86eb47db0ffbf7e79bf7ff0d"`);
        await queryRunner.query(`ALTER TABLE "daily_plan_task" DROP CONSTRAINT "FK_b0a8166ba2272bc6868b7042e6d"`);
        await queryRunner.query(`ALTER TABLE "daily_plan_task" DROP CONSTRAINT "FK_559a1e1055d1ef1bd83e33f9ffc"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_791067c0a03b37ab50578e60d4"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_44d86eb47db0ffbf7e79bf7ff0"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_b0a8166ba2272bc6868b7042e6"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_559a1e1055d1ef1bd83e33f9ff"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_1a541bae1d230b11bbdd256e09"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_fbe6399dd99e8b4bc1ed9a4fc1"`);
        await queryRunner.query(`DROP TABLE "daily_plan_task"`);
    }

    /**
    * SqliteDB and BetterSQlite3DB Up Migration
    *
    * @param queryRunner
    */
    public async sqliteUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
        
    }

    /**
    * SqliteDB and BetterSQlite3DB Down Migration
    *
    * @param queryRunner
    */
    public async sqliteDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
        
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
