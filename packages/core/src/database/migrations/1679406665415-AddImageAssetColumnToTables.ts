
import { MigrationInterface, QueryRunner } from "typeorm";

export class AddImageAssetColumnToTables1679406665415 implements MigrationInterface {

    name = 'AddImageAssetColumnToTables1679406665415';

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
        await queryRunner.query(`ALTER TABLE "organization_contact" ADD "imageId" uuid`);
        await queryRunner.query(`ALTER TABLE "organization_project" ADD "imageId" uuid`);
        await queryRunner.query(`ALTER TABLE "organization_team" ADD "imageId" uuid`);
        await queryRunner.query(`ALTER TABLE "tenant" ADD "imageId" uuid`);
        await queryRunner.query(`ALTER TABLE "user" ADD "imageId" uuid`);
        await queryRunner.query(`CREATE INDEX "IDX_8cfcdc6bc8fb55e273d9ace5fd" ON "organization_contact" ("imageId") `);
        await queryRunner.query(`CREATE INDEX "IDX_063324fdceb51f7086e401ed2c" ON "organization_project" ("imageId") `);
        await queryRunner.query(`CREATE INDEX "IDX_51e91be110fa0b8e70066f5727" ON "organization_team" ("imageId") `);
        await queryRunner.query(`CREATE INDEX "IDX_d154d06dac0d0e0a5d9a083e25" ON "tenant" ("imageId") `);
        await queryRunner.query(`CREATE INDEX "IDX_5e028298e103e1694147ada69e" ON "user" ("imageId") `);
        await queryRunner.query(`ALTER TABLE "organization_contact" ADD CONSTRAINT "FK_8cfcdc6bc8fb55e273d9ace5fd5" FOREIGN KEY ("imageId") REFERENCES "image_asset"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "organization_project" ADD CONSTRAINT "FK_063324fdceb51f7086e401ed2c9" FOREIGN KEY ("imageId") REFERENCES "image_asset"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "organization_team" ADD CONSTRAINT "FK_51e91be110fa0b8e70066f5727f" FOREIGN KEY ("imageId") REFERENCES "image_asset"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "tenant" ADD CONSTRAINT "FK_d154d06dac0d0e0a5d9a083e253" FOREIGN KEY ("imageId") REFERENCES "image_asset"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "user" ADD CONSTRAINT "FK_5e028298e103e1694147ada69e5" FOREIGN KEY ("imageId") REFERENCES "image_asset"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
    }

    /**
    * PostgresDB Down Migration
    *
    * @param queryRunner
    */
    public async postgresDownQueryRunner(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`ALTER TABLE "user" DROP CONSTRAINT "FK_5e028298e103e1694147ada69e5"`);
        await queryRunner.query(`ALTER TABLE "tenant" DROP CONSTRAINT "FK_d154d06dac0d0e0a5d9a083e253"`);
        await queryRunner.query(`ALTER TABLE "organization_team" DROP CONSTRAINT "FK_51e91be110fa0b8e70066f5727f"`);
        await queryRunner.query(`ALTER TABLE "organization_project" DROP CONSTRAINT "FK_063324fdceb51f7086e401ed2c9"`);
        await queryRunner.query(`ALTER TABLE "organization_contact" DROP CONSTRAINT "FK_8cfcdc6bc8fb55e273d9ace5fd5"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_5e028298e103e1694147ada69e"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_d154d06dac0d0e0a5d9a083e25"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_51e91be110fa0b8e70066f5727"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_063324fdceb51f7086e401ed2c"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_8cfcdc6bc8fb55e273d9ace5fd"`);
        await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "imageId"`);
        await queryRunner.query(`ALTER TABLE "tenant" DROP COLUMN "imageId"`);
        await queryRunner.query(`ALTER TABLE "organization_team" DROP COLUMN "imageId"`);
        await queryRunner.query(`ALTER TABLE "organization_project" DROP COLUMN "imageId"`);
        await queryRunner.query(`ALTER TABLE "organization_contact" DROP COLUMN "imageId"`);
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
}
