import { MigrationInterface, QueryRunner } from "typeorm";
    
export class AlterEmployeeTable1644915598578 implements MigrationInterface {

    name = 'AlterEmployeeTable1644915598578';

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
        await queryRunner.query(`ALTER TABLE "employee" ALTER COLUMN "totalWorkHours" DROP NOT NULL`);
    }

    /**
    * PostgresDB Down Migration
    * 
    * @param queryRunner 
    */
    public async postgresDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`ALTER TABLE "employee" ALTER COLUMN "totalWorkHours" SET NOT NULL`);
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