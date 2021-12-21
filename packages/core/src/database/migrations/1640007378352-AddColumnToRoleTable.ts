import { MigrationInterface, QueryRunner } from "typeorm";
    
export class AddColumnToRoleTable1640007378352 implements MigrationInterface {

    name = 'AddColumnToRoleTable1640007378352';
    
    public async up(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`ALTER TABLE "role" ADD "isSystem" boolean NOT NULL DEFAULT false`);
    }
    
    public async down(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`ALTER TABLE "role" DROP COLUMN "isSystem"`);
    }
}