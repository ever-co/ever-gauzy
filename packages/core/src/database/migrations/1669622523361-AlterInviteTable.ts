
import { MigrationInterface, QueryRunner } from "typeorm";

export class AlterInviteTable1669622523361 implements MigrationInterface {

    name = 'AlterInviteTable1669622523361';

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
        await queryRunner.query(`DROP INDEX "public"."IDX_658d8246180c0345d32a100544"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_83dbe83cb33c3e8468c8045ea7"`);
    }

    /**
    * PostgresDB Down Migration
    *
    * @param queryRunner
    */
    public async postgresDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_83dbe83cb33c3e8468c8045ea7" ON "invite" ("token") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_658d8246180c0345d32a100544" ON "invite" ("email") `);
    }

    /**
    * SqliteDB Up Migration
    *
    * @param queryRunner
    */
    public async sqliteUpQueryRunner(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`DROP INDEX "IDX_658d8246180c0345d32a100544"`);
        await queryRunner.query(`DROP INDEX "IDX_83dbe83cb33c3e8468c8045ea7"`);
    }

    /**
    * SqliteDB Down Migration
    *
    * @param queryRunner
    */
    public async sqliteDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_83dbe83cb33c3e8468c8045ea7" ON "invite" ("token") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_658d8246180c0345d32a100544" ON "invite" ("email") `);
    }
}
