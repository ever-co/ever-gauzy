
import { Logger } from '@nestjs/common';
import { MigrationInterface, QueryRunner } from "typeorm";
import { yellow } from "chalk";
import { DatabaseTypeEnum } from "@gauzy/config";

export class CreateScreeningTaskEntity1733566941638 implements MigrationInterface {

    name = 'CreateScreeningTaskEntity1733566941638';

    /**
     * Up Migration
     *
     * @param queryRunner
     */
    public async up(queryRunner: QueryRunner): Promise<void> {
        Logger.debug(yellow(this.name + ' start running!'), 'Migration');

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
        await queryRunner.query(`CREATE TABLE "screening-task" ("deletedAt" TIMESTAMP, "id" uuid NOT NULL DEFAULT gen_random_uuid(), "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "isActive" boolean DEFAULT true, "isArchived" boolean DEFAULT false, "archivedAt" TIMESTAMP, "tenantId" uuid, "organizationId" uuid, "status" character varying NOT NULL, "onHoldUntil" TIMESTAMP, "taskId" uuid NOT NULL, "creatorId" uuid, CONSTRAINT "REL_ba7e9c148ba684f34bb72bac6d" UNIQUE ("taskId"), CONSTRAINT "PK_372878e199a54ba3d3233c010cc" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_dd2e3b930072f1bfdf82756efc" ON "screening-task" ("isActive") `);
        await queryRunner.query(`CREATE INDEX "IDX_850eb939f558df6f97cde349fc" ON "screening-task" ("isArchived") `);
        await queryRunner.query(`CREATE INDEX "IDX_7b63a7c4bb3cb8388003281d0c" ON "screening-task" ("tenantId") `);
        await queryRunner.query(`CREATE INDEX "IDX_40ec003f52889f9389735e8012" ON "screening-task" ("organizationId") `);
        await queryRunner.query(`CREATE INDEX "IDX_5424134603415636eaa8dd22e3" ON "screening-task" ("status") `);
        await queryRunner.query(`CREATE INDEX "IDX_ba7e9c148ba684f34bb72bac6d" ON "screening-task" ("taskId") `);
        await queryRunner.query(`CREATE INDEX "IDX_e272af2d4d0ef95e4bb81d2746" ON "screening-task" ("creatorId") `);
        await queryRunner.query(`ALTER TABLE "task" ADD "isScreeningTask" boolean DEFAULT false`);
        await queryRunner.query(`ALTER TABLE "screening-task" ADD CONSTRAINT "FK_7b63a7c4bb3cb8388003281d0cf" FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "screening-task" ADD CONSTRAINT "FK_40ec003f52889f9389735e80122" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE "screening-task" ADD CONSTRAINT "FK_ba7e9c148ba684f34bb72bac6d1" FOREIGN KEY ("taskId") REFERENCES "task"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "screening-task" ADD CONSTRAINT "FK_e272af2d4d0ef95e4bb81d2746d" FOREIGN KEY ("creatorId") REFERENCES "user"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    /**
    * PostgresDB Down Migration
    *
    * @param queryRunner
    */
    public async postgresDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`ALTER TABLE "screening-task" DROP CONSTRAINT "FK_e272af2d4d0ef95e4bb81d2746d"`);
        await queryRunner.query(`ALTER TABLE "screening-task" DROP CONSTRAINT "FK_ba7e9c148ba684f34bb72bac6d1"`);
        await queryRunner.query(`ALTER TABLE "screening-task" DROP CONSTRAINT "FK_40ec003f52889f9389735e80122"`);
        await queryRunner.query(`ALTER TABLE "screening-task" DROP CONSTRAINT "FK_7b63a7c4bb3cb8388003281d0cf"`);
        await queryRunner.query(`ALTER TABLE "task" DROP COLUMN "isScreeningTask"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_e272af2d4d0ef95e4bb81d2746"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_ba7e9c148ba684f34bb72bac6d"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_5424134603415636eaa8dd22e3"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_40ec003f52889f9389735e8012"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_7b63a7c4bb3cb8388003281d0c"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_850eb939f558df6f97cde349fc"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_dd2e3b930072f1bfdf82756efc"`);
        await queryRunner.query(`DROP TABLE "screening-task"`);
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
