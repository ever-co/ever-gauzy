
import { MigrationInterface, QueryRunner } from "typeorm";
import { v4 as uuidv4 } from 'uuid';
import { getConfig } from "@gauzy/config";
import { copyAssets } from "./../../core/seeds/utils";
import { DEFAULT_INTEGRATIONS } from "./../../integration/default-integration";

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
        for await (const { name, imgSrc, provider, redirect_url } of DEFAULT_INTEGRATIONS) {
            try {
                const filepath = `integrations/${imgSrc}`;
                const payload = [name, filepath, provider, redirect_url];

                let upsertQuery = ``;

                if (queryRunner.connection.options.type === 'sqlite') {
                    // For SQLite, manually generate a UUID using uuidv4()
                    const generatedId = uuidv4(); payload.push(generatedId);

                    upsertQuery = `
                        INSERT INTO integration (
                            "name", "imgSrc", "provider", "redirect_url", "id"
                        )
                        VALUES (
                            $1, $2, $3, $4, $5
                        )
                        ON CONFLICT(name) DO UPDATE
                        SET
                            "imgSrc" = $2,
                            "provider" = $3,
                            "redirect_url" = $4;
                    `;

                } else {
                    upsertQuery = `
                        INSERT INTO integration (
                            "name", "imgSrc", "provider", "redirect_url"
                        )
                        VALUES (
                            $1, $2, $3, $4
                        )
                        ON CONFLICT(name) DO UPDATE
                        SET
                            "imgSrc" = $2,
                            "provider" = $3,
                            "redirect_url" = $4;
                    `;
                }
                const [integration] = await queryRunner.query(upsertQuery, payload);
                console.log(integration);
                copyAssets(imgSrc, this.config, destDir);
            } catch (error) {
                // since we have errors let's rollback changes we made
                console.log(`Error while updating integration: (${name}) in production server`, error);
            }
        }
    }
}
