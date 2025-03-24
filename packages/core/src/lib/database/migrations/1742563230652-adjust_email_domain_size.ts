
import { MigrationInterface, QueryRunner } from "typeorm";
import { DatabaseTypeEnum } from "@gauzy/config";

export class AdjustEmailDomainSize1742563230652 implements MigrationInterface {

    name = 'AdjustEmailDomainSize1742563230652';

    /**
     * Up Migration
     *
     * @param queryRunner
     */
    public async up(queryRunner: QueryRunner): Promise<void> {
        if (queryRunner.connection.options.type !== DatabaseTypeEnum.postgres) {
            throw Error(`Unsupported database: ${queryRunner.connection.options.type}`);
        }

        await queryRunner.query(`DROP INDEX "public"."IDX_20ff57b9178bf4ee401365fe6c"`);
        await queryRunner.query(`ALTER TABLE "organization" DROP COLUMN "emailDomain"`);
        await queryRunner.query(`ALTER TABLE "organization" ADD "emailDomain" character varying(255)`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_20ff57b9178bf4ee401365fe6c" ON "organization" ("emailDomain") WHERE ("emailDomain" IS NOT NULL)`);
    }

    /**
     * Down Migration
     *
     * @param queryRunner
     */
    public async down(queryRunner: QueryRunner): Promise<void> {
        if (queryRunner.connection.options.type !== DatabaseTypeEnum.postgres) {
            throw Error(`Unsupported database: ${queryRunner.connection.options.type}`);
        }

        await queryRunner.query(`DROP INDEX "public"."IDX_20ff57b9178bf4ee401365fe6c"`);
        await queryRunner.query(`ALTER TABLE "organization" DROP COLUMN "emailDomain"`);
        await queryRunner.query(`ALTER TABLE "organization" ADD "emailDomain" character varying(1024) DEFAULT NULL`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_20ff57b9178bf4ee401365fe6c" ON "organization" ("emailDomain") WHERE ("emailDomain" IS NOT NULL)`);
    }
}
