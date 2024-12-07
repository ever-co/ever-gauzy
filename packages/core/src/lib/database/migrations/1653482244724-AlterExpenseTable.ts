import { MigrationInterface, QueryRunner } from "typeorm";
import * as chalk from "chalk";
import { DatabaseTypeEnum } from "@gauzy/config";

export class AlterExpenseTable1653482244724 implements MigrationInterface {

    name = 'AlterExpenseTable1653482244724';

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
        await queryRunner.query(`ALTER TABLE "expense" DROP CONSTRAINT "FK_eacb116ab0521ad9b96f2bb53ba"`);
        await queryRunner.query(`ALTER TABLE "expense" DROP CONSTRAINT "FK_42eea5debc63f4d1bf89881c10a"`);
        await queryRunner.query(`ALTER TABLE "expense" DROP COLUMN "status"`);
        await queryRunner.query(`CREATE TYPE "public"."expense_status_enum" AS ENUM('INVOICED', 'UNINVOICED', 'PAID', 'NOT_BILLABLE')`);
        await queryRunner.query(`ALTER TABLE "expense" ADD "status" "public"."expense_status_enum"`);
        await queryRunner.query(`ALTER TABLE "expense" ALTER COLUMN "vendorId" DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "expense" ALTER COLUMN "categoryId" DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "organization_project" ALTER COLUMN "membersCount" DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "expense" ADD CONSTRAINT "FK_eacb116ab0521ad9b96f2bb53ba" FOREIGN KEY ("vendorId") REFERENCES "organization_vendor"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "expense" ADD CONSTRAINT "FK_42eea5debc63f4d1bf89881c10a" FOREIGN KEY ("categoryId") REFERENCES "expense_category"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
    }

    /**
    * PostgresDB Down Migration
    *
    * @param queryRunner
    */
    public async postgresDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`ALTER TABLE "expense" DROP CONSTRAINT "FK_42eea5debc63f4d1bf89881c10a"`);
        await queryRunner.query(`ALTER TABLE "expense" DROP CONSTRAINT "FK_eacb116ab0521ad9b96f2bb53ba"`);
        await queryRunner.query(`ALTER TABLE "organization_project" ALTER COLUMN "membersCount" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "expense" ALTER COLUMN "categoryId" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "expense" ALTER COLUMN "vendorId" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "expense" DROP COLUMN "status"`);
        await queryRunner.query(`DROP TYPE "public"."expense_status_enum"`);
        await queryRunner.query(`ALTER TABLE "expense" ADD "status" character varying`);
        await queryRunner.query(`ALTER TABLE "expense" ADD CONSTRAINT "FK_42eea5debc63f4d1bf89881c10a" FOREIGN KEY ("categoryId") REFERENCES "expense_category"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "expense" ADD CONSTRAINT "FK_eacb116ab0521ad9b96f2bb53ba" FOREIGN KEY ("vendorId") REFERENCES "organization_vendor"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
    }

    /**
     * SqliteDB Up Migration
     *
     * @param queryRunner
     */
    public async sqliteUpQueryRunner(queryRunner: QueryRunner): Promise<any> { }

    /**
     * SqliteDB Down Migration
     *
     * @param queryRunner
     */
    public async sqliteDownQueryRunner(queryRunner: QueryRunner): Promise<any> { }

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
