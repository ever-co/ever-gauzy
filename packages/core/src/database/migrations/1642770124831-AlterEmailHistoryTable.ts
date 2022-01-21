import { MigrationInterface, QueryRunner } from "typeorm";
    
export class AlterEmailHistoryTable1642770124831 implements MigrationInterface {

    name = 'AlterEmailHistoryTable1642770124831';
    
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
        await queryRunner.query(`ALTER TABLE "email_sent" ALTER COLUMN "name" DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "email_sent" ALTER COLUMN "content" DROP NOT NULL`);
        await queryRunner.query(`CREATE INDEX "IDX_a954fda57cca81dc48446e73b8" ON "email_sent" ("email") `);
    }

    /**
     * PostgresDB Down Migration
     * 
     * @param queryRunner 
     */
    public async postgresDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`DROP INDEX "public"."IDX_a954fda57cca81dc48446e73b8"`);
        await queryRunner.query(`ALTER TABLE "email_sent" ALTER COLUMN "content" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "email_sent" ALTER COLUMN "name" SET NOT NULL`);
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