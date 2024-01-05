import { MigrationInterface, QueryRunner } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import * as chalk from 'chalk';
import { getConfig } from '@gauzy/config';
import { copyAssets } from '../../core/seeds/utils';
import { DEFAULT_SYSTEM_INTEGRATIONS } from '../../integration/default-integration';
import { IntegrationsUtils } from '../../integration/utils';

export class SeedIntegrationTable1691494801748 implements MigrationInterface {
	name = 'SeedIntegrationTable1691494801748';

	/**
	 * Up Migration
	 *
	 * @param queryRunner
	 */
	public async up(queryRunner: QueryRunner): Promise<any> {
		console.log(chalk.yellow(this.name + ' start running!'));

		await this.upsertIntegrationsAndIntegrationTypes(queryRunner);
	}

	/**
	 * Down Migration
	 *
	 * @param queryRunner
	 */
	public async down(queryRunner: QueryRunner): Promise<any> {}

	/**
	 *
	 * @param queryRunner
	 */
	public async upsertIntegrationsAndIntegrationTypes(queryRunner: QueryRunner): Promise<any> {
		const destDir = 'integrations';

		for await (const { name, imgSrc, isComingSoon, order, integrationTypesMap } of DEFAULT_SYSTEM_INTEGRATIONS) {
			try {
				const filepath = `integrations/${imgSrc}`;

				let upsertQuery = ``;

				if (['sqlite', 'better-sqlite3'].includes(queryRunner.connection.options.type)) {
					const payload = [name, filepath, isComingSoon ? 1 : 0, order];

					// For SQLite, manually generate a UUID using uuidv4()
					const generatedId = uuidv4();
					payload.push(generatedId);

					upsertQuery = `
                        INSERT INTO "integration" ("name", "imgSrc", "isComingSoon", "order", "id")
						VALUES (?, ?, ?, ?, ?)
						ON CONFLICT ("name")
						DO UPDATE SET "imgSrc" = EXCLUDED."imgSrc",
									  "isComingSoon" = EXCLUDED."isComingSoon",
									  "order" = EXCLUDED."order"
						RETURNING "id";
                    `;

					const [integration] = await queryRunner.query(upsertQuery, payload);

					await IntegrationsUtils.syncIntegrationType(
						queryRunner,
						integration,
						await IntegrationsUtils.getIntegrationTypeByName(queryRunner, integrationTypesMap)
					);
				} else {
					const payload = [name, filepath, isComingSoon, order];

					upsertQuery = `
                        INSERT INTO "integration" (
                            "name", "imgSrc", "isComingSoon", "order"
                        )
                        VALUES (
                            $1, $2, $3, $4
                        )
                        ON CONFLICT(name) DO UPDATE
                        SET
                            "imgSrc" = $2,
                            "isComingSoon" = $3,
                            "order" = $4
                        RETURNING id;
                    `;

					const [integration] = await queryRunner.query(upsertQuery, payload);

					await IntegrationsUtils.syncIntegrationType(
						queryRunner,
						integration,
						await IntegrationsUtils.getIntegrationTypeByName(queryRunner, integrationTypesMap)
					);
				}

				// Step 3: Insert entry in join table to associate Integration with IntegrationType
				copyAssets(imgSrc, getConfig(), destDir);
			} catch (error) {
				// since we have errors let's rollback changes we made
				console.log(`Error while updating integration: (${name}) in production server`, error);
			}
		}
	}
}
