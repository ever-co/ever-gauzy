import { MigrationInterface, QueryRunner } from "typeorm";

export class AlterExpenseTable1653482244724 implements MigrationInterface {

    name = 'AlterExpenseTable1653482244724';

    public async up(queryRunner: QueryRunner): Promise<void> {
        if (queryRunner.connection.options.type === 'sqlite') {
            await this.sqliteUpQueryRunner(queryRunner);
        } else {
            await this.postgresUpQueryRunner(queryRunner);
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
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
        await queryRunner.query(`ALTER TABLE "expense" DROP CONSTRAINT "FK_eacb116ab0521ad9b96f2bb53ba"`);
        await queryRunner.query(`ALTER TABLE "expense" DROP CONSTRAINT "FK_42eea5debc63f4d1bf89881c10a"`);
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
        await queryRunner.query(`ALTER TABLE "expense" ADD CONSTRAINT "FK_42eea5debc63f4d1bf89881c10a" FOREIGN KEY ("categoryId") REFERENCES "expense_category"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "expense" ADD CONSTRAINT "FK_eacb116ab0521ad9b96f2bb53ba" FOREIGN KEY ("vendorId") REFERENCES "organization_vendor"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
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