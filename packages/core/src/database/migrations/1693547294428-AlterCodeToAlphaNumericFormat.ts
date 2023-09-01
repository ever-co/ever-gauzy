
import { MigrationInterface, QueryRunner } from "typeorm";

export class AlterCodeToAlphaNumericFormat1693547294428 implements MigrationInterface {

    name = 'AlterCodeToAlphaNumericFormat1693547294428';

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
        await queryRunner.query(`ALTER TABLE "user" DROP CONSTRAINT "FK_c28e52f758e7bbc53828db92194"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_9e80c9ec749dfda6dbe2cd9704"`);
        await queryRunner.query(`ALTER TABLE "email_reset" ALTER COLUMN "code" TYPE character varying`);
        await queryRunner.query(`ALTER TABLE "invite" ALTER COLUMN "code" TYPE character varying`);
        await queryRunner.query(`ALTER TABLE "organization_team_join_request" ALTER COLUMN "code" TYPE character varying`);
        await queryRunner.query(`ALTER TABLE "user" ALTER COLUMN "code" TYPE character varying`);
        await queryRunner.query(`CREATE INDEX "IDX_9e80c9ec749dfda6dbe2cd9704" ON "email_reset" ("code") `);
        await queryRunner.query(`CREATE INDEX "IDX_9033faf41b23c61ba201c48796" ON "email_sent" ("emailTemplateId") `);
        await queryRunner.query(`ALTER TABLE "user" ADD CONSTRAINT "FK_c28e52f758e7bbc53828db92194" FOREIGN KEY ("roleId") REFERENCES "role"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
    }

    /**
    * PostgresDB Down Migration
    *
    * @param queryRunner
    */
    public async postgresDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`ALTER TABLE "user" DROP CONSTRAINT "FK_c28e52f758e7bbc53828db92194"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_9033faf41b23c61ba201c48796"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_9e80c9ec749dfda6dbe2cd9704"`);
        await queryRunner.query(`ALTER TABLE "user" ALTER COLUMN "code" TYPE integer`);
        await queryRunner.query(`ALTER TABLE "organization_team_join_request" ALTER COLUMN "code" TYPE integer`);
        await queryRunner.query(`ALTER TABLE "invite" ALTER COLUMN "code" TYPE integer`);
        await queryRunner.query(`ALTER TABLE "email_reset" ALTER COLUMN "code" TYPE integer`);
        await queryRunner.query(`CREATE INDEX "IDX_9e80c9ec749dfda6dbe2cd9704" ON "email_reset" ("code") `);
        await queryRunner.query(`ALTER TABLE "user" ADD CONSTRAINT "FK_c28e52f758e7bbc53828db92194" FOREIGN KEY ("roleId") REFERENCES "role"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
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
