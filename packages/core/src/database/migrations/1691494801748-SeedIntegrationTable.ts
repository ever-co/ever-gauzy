
import { MigrationInterface, QueryRunner } from "typeorm";
import { v4 as uuidv4 } from 'uuid';
import { IIntegration, IIntegrationType } from "@gauzy/contracts";
import { getConfig } from "@gauzy/config";
import { copyAssets } from "./../../core/seeds/utils";
import { DEFAULT_INTEGRATIONS } from "./../../integration/default-integration";

export class SeedIntegrationTable1691494801748 implements MigrationInterface {

    config = getConfig();
    name = 'SeedIntegrationTable1691494801748';

    /**
    * Up Migration
    *
    * @param queryRunner
    */
    public async up(queryRunner: QueryRunner): Promise<any> {
        await this.upsertIntegrationsAndIntegrationTypes(queryRunner);
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
    public async upsertIntegrationsAndIntegrationTypes(queryRunner: QueryRunner): Promise<any> {
        const destDir = 'integrations';

        for await (const { name, imgSrc, isComingSoon, order, provider, redirect_url, integrationTypesMap } of DEFAULT_INTEGRATIONS) {
            try {
                const filepath = `integrations/${imgSrc}`;

                let upsertQuery = ``;
                const payload = [name, filepath, isComingSoon, order, provider, redirect_url];

                if (queryRunner.connection.options.type === 'sqlite') {
                    // For SQLite, manually generate a UUID using uuidv4()
                    const generatedId = uuidv4(); payload.push(generatedId);

                    upsertQuery = `
                        INSERT INTO integration (
                            "name", "imgSrc", "isComingSoon", "order", "provider", "redirect_url", "id"
                        )
                        VALUES (
                            $1, $2, $3, $4, $5, $6, $7
                        )
                        ON CONFLICT(name) DO UPDATE
                        SET
                            "imgSrc" = $2,
                            "isComingSoon" = $3,
                            "order" = $4,
                            "provider" = $5,
                            "redirect_url" = $6
                        RETURNING id;
                    `;
                } else {
                    upsertQuery = `
                        INSERT INTO "integration" (
                            "name", "imgSrc", "isComingSoon", "order", "provider", "redirect_url"
                        )
                        VALUES (
                            $1, $2, $3, $4, $5, $6
                        )
                        ON CONFLICT(name) DO UPDATE
                        SET
                            "imgSrc" = $2,
                            "isComingSoon" = $3,
                            "order" = $4,
                            "provider" = $5,
                            "redirect_url" = $6
                        RETURNING id;
                    `;
                }

                const [integration] = await queryRunner.query(upsertQuery, payload);

                // Step 3: Insert entry in join table to associate Integration with IntegrationType
                await this.syncIntegrationType(
                    queryRunner,
                    integration,
                    await this.getIntegrationTypeByName(queryRunner, integrationTypesMap)
                )

                copyAssets(imgSrc, this.config, destDir);
            } catch (error) {
                // since we have errors let's rollback changes we made
                console.log(`Error while updating integration: (${name}) in production server`, error);
            }
        }
    }

    /**
     *
     * @param queryRunner
     * @param integrationTypesMap
     * @returns
     */
    private async getIntegrationTypeByName(
        queryRunner: QueryRunner,
        integrationTypeNames: any[]
    ): Promise<IIntegrationType[]> {
        try {
            return await queryRunner.query(`SELECT * FROM "integration_type" WHERE "integration_type"."name" IN ('${integrationTypeNames.join("','")}')`);
        } catch (error) {
            console.log('Error while querying integration types:', error);
            return [];
        }
    }

    /**
     *
     *
     * @param queryRunner
     * @param integration
     * @param integrationTypes
     */
    private async syncIntegrationType(
        queryRunner: QueryRunner,
        integration: IIntegration,
        integrationTypes: IIntegrationType[]
    ) {
        if (integration) {
            const integrationId = integration.id;
            for await (const integrationType of integrationTypes) {
                const insertPivotQuery = `
                    INSERT INTO "integration_integration_type" (
                        "integrationId",
                        "integrationTypeId"
                    )
                    SELECT
                        $1, $2
                    WHERE NOT EXISTS (
                        SELECT 1
                            FROM "integration_integration_type"
                        WHERE
                            "integrationId" = $1 AND
                            "integrationTypeId" = $2
                    )
                `;
                await queryRunner.query(insertPivotQuery, [integrationId, integrationType.id]);
            }
        }
    }
}
