
import { MigrationInterface, QueryRunner } from "typeorm";
import * as chalk from 'chalk';
import { DatabaseTypeEnum } from "@gauzy/config";

export class CreateUserNotificationTable1738217979804 implements MigrationInterface {

    name = 'CreateUserNotificationTable1738217979804';

    /**
     * Up Migration
     *
     * @param queryRunner
     */
    public async up(queryRunner: QueryRunner): Promise<void> {
        console.log(chalk.yellow(this.name + ' start running!'));

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
        await queryRunner.query(`CREATE TABLE "user_notification" ("deletedAt" TIMESTAMP, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "id" uuid NOT NULL DEFAULT gen_random_uuid(), "isActive" boolean DEFAULT true, "isArchived" boolean DEFAULT false, "archivedAt" TIMESTAMP, "tenantId" uuid, "organizationId" uuid, "entity" character varying NOT NULL, "entityId" character varying NOT NULL, "title" character varying NOT NULL, "message" character varying NOT NULL, "type" integer, "isRead" boolean NOT NULL DEFAULT false, "readedAt" TIMESTAMP, "sentById" uuid, "receiverId" uuid, CONSTRAINT "PK_8840aac86dec5f669c541ce67d4" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_6c5f59af45edf24ebe1fb9290a" ON "user_notification" ("isActive") `);
        await queryRunner.query(`CREATE INDEX "IDX_1162ba6e6e4a847017c1edc88b" ON "user_notification" ("isArchived") `);
        await queryRunner.query(`CREATE INDEX "IDX_6b218dc20d7822e0e4d85d81a2" ON "user_notification" ("tenantId") `);
        await queryRunner.query(`CREATE INDEX "IDX_758686e0a822303c4791999a77" ON "user_notification" ("organizationId") `);
        await queryRunner.query(`CREATE INDEX "IDX_6af19d4e214ca45b5fb57d7fc2" ON "user_notification" ("entity") `);
        await queryRunner.query(`CREATE INDEX "IDX_a6de2f2e523b7428765d9fabbe" ON "user_notification" ("entityId") `);
        await queryRunner.query(`CREATE INDEX "IDX_fc3e6d279904252599ae41f5bf" ON "user_notification" ("type") `);
        await queryRunner.query(`CREATE INDEX "IDX_08d1dae7d71c5eb56d06edf10f" ON "user_notification" ("sentById") `);
        await queryRunner.query(`CREATE INDEX "IDX_ff2d84b36dcf89af3e9b13f643" ON "user_notification" ("receiverId") `);
        await queryRunner.query(`ALTER TABLE "user_notification" ADD CONSTRAINT "FK_6b218dc20d7822e0e4d85d81a2a" FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "user_notification" ADD CONSTRAINT "FK_758686e0a822303c4791999a778" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE "user_notification" ADD CONSTRAINT "FK_08d1dae7d71c5eb56d06edf10f0" FOREIGN KEY ("sentById") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "user_notification" ADD CONSTRAINT "FK_ff2d84b36dcf89af3e9b13f643f" FOREIGN KEY ("receiverId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    /**
    * PostgresDB Down Migration
    *
    * @param queryRunner
    */
    public async postgresDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`ALTER TABLE "user_notification" DROP CONSTRAINT "FK_ff2d84b36dcf89af3e9b13f643f"`);
        await queryRunner.query(`ALTER TABLE "user_notification" DROP CONSTRAINT "FK_08d1dae7d71c5eb56d06edf10f0"`);
        await queryRunner.query(`ALTER TABLE "user_notification" DROP CONSTRAINT "FK_758686e0a822303c4791999a778"`);
        await queryRunner.query(`ALTER TABLE "user_notification" DROP CONSTRAINT "FK_6b218dc20d7822e0e4d85d81a2a"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_ff2d84b36dcf89af3e9b13f643"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_08d1dae7d71c5eb56d06edf10f"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_fc3e6d279904252599ae41f5bf"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_a6de2f2e523b7428765d9fabbe"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_6af19d4e214ca45b5fb57d7fc2"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_758686e0a822303c4791999a77"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_6b218dc20d7822e0e4d85d81a2"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_1162ba6e6e4a847017c1edc88b"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_6c5f59af45edf24ebe1fb9290a"`);
        await queryRunner.query(`DROP TABLE "user_notification"`);
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
