
import { MigrationInterface, QueryRunner } from "typeorm";
import { DEFAULT_INTEGRATIONS } from "@gauzy/contracts";
import { getConfig } from "@gauzy/config";
import { copyAssets } from "./../../core/seeds/utils";

export class SeedIntegrationTable1692171665427 implements MigrationInterface {

    config = getConfig();
    name = 'SeedIntegrationTable1692171665427';

    /**
    * Up Migration
    *
    * @param queryRunner
    */
    public async up(queryRunner: QueryRunner): Promise<any> {
        await this.upsertIntegrations(queryRunner);
    }

    /**
    * Down Migration
    *
    * @param queryRunner
    */
    public async down(queryRunner: QueryRunner): Promise<any> { }

    /**
    *
    * @param queryRunner
    */
    public async upsertIntegrations(queryRunner: QueryRunner): Promise<any> {
        const destDir = 'integrations';
        for await (const { name, imgSrc, navigationUrl } of DEFAULT_INTEGRATIONS) {
            try {
                const filepath = `integrations/${imgSrc}`;
                const payload = [name, filepath, navigationUrl];

                const upsertQuery = `
                    INSERT INTO integration (
                        "name", "imgSrc", "navigationUrl"
                    )
                    VALUES (
                        $1, $2, $3
                    )
                    ON CONFLICT(name) DO UPDATE
                    SET
                        "imgSrc" = $2,
                        "navigationUrl" = $3;
                `;
                await queryRunner.query(upsertQuery, payload);
                copyAssets(imgSrc, this.config, destDir);
            } catch (error) {
                // since we have errors let's rollback changes we made
                console.log(`Error while updating integration: (${name}) in production server`, error);
            }
        }
    }
}
