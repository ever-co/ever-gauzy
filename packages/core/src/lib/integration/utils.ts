import { QueryRunner } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { DatabaseTypeEnum, getConfig } from '@gauzy/config';
import { prepareSQLQuery as p } from './../database/database.helper';
import { IIntegration, IIntegrationType, IntegrationTypeEnum } from '@gauzy/contracts';
import { copyAssets } from './../core/seeds/utils';
import { DEFAULT_INTEGRATION_TYPES } from './default-integration-type';
import * as path from 'path';

export class IntegrationsUtils {
	/**
	 *
	 * @param queryRunner
	 */
	public static async upsertIntegrationsAndIntegrationTypes(
		queryRunner: QueryRunner,
		integrations: any[]
	): Promise<any> {
		const destDir = 'integrations';
		for await (const {
			name,
			imgSrc,
			isComingSoon,
			order,
			redirectUrl,
			provider,
			integrationTypesMap
		} of integrations) {
			try {
				const filePath = await copyAssets(path.join(destDir, imgSrc), getConfig(), '');

				const sqliteUpsertQuery = `
					INSERT INTO integration (
						"name", "imgSrc", "isComingSoon", "order", "redirectUrl", "provider", "id"
					)
					VALUES (
						?, ?, ?, ?, ?, ?, ?
					)
					ON CONFLICT("name")
					DO UPDATE SET "imgSrc" = EXCLUDED."imgSrc",
									"isComingSoon" = EXCLUDED."isComingSoon",
									"order" = EXCLUDED."order",
									"redirectUrl" = EXCLUDED."redirectUrl",
									"provider" = EXCLUDED."provider"
					RETURNING id;
				`;
				const postgresUpsertQuery = `
					INSERT INTO "integration" (
						"name", "imgSrc", "isComingSoon", "order", "redirectUrl", "provider"
					)
					VALUES (
						$1, $2, $3, $4, $5, $6
					)
					ON CONFLICT(name) DO UPDATE
					SET
						"imgSrc" = $2,
						"isComingSoon" = $3,
						"order" = $4,
						"redirectUrl" = $5,
						"provider" = $6
					RETURNING id;
				`;
				const mysqlUpsertQuery = p(`
					INSERT INTO "integration" (
						"name", "imgSrc", "isComingSoon", "order", "redirectUrl", "provider"
					) VALUES (
						?, ?, ?, ?, ?, ?
					) ON DUPLICATE KEY UPDATE
					"imgSrc" = VALUES("imgSrc"),
					"isComingSoon" = VALUES("isComingSoon"),
					"order" = VALUES("order"),
					"redirectUrl" = VALUES("redirectUrl"),
					"provider" = VALUES("provider");
				`);

				let upsertQuery = ``;
				let payload: any[];

				switch (queryRunner.connection.options.type) {
					case DatabaseTypeEnum.sqlite:
					case DatabaseTypeEnum.betterSqlite3:
						payload = [name, filePath, isComingSoon ? 1 : 0, order, redirectUrl, provider];
						// For SQLite, manually generate a UUID using uuidv4()
						const generatedId = uuidv4();
						payload.push(generatedId);
						upsertQuery = sqliteUpsertQuery;
						break;
					case DatabaseTypeEnum.postgres:
						payload = [name, filePath, isComingSoon, order, redirectUrl, provider];
						upsertQuery = postgresUpsertQuery;
						break;
					case DatabaseTypeEnum.mysql:
						payload = [name, filePath, isComingSoon, order, redirectUrl, provider];
						upsertQuery = mysqlUpsertQuery;
						break;
					default:
						throw Error(`cannot upsert integration and integration types due to unsupported database type: ${queryRunner.connection.options.type}`);
				}

				const [integration] = await queryRunner.query(upsertQuery, payload);

				// Step 3: Insert entry in join table to associate Integration with IntegrationType
				await IntegrationsUtils.syncIntegrationType(
					queryRunner,
					integration,
					await this.getIntegrationTypeByName(queryRunner, integrationTypesMap)
				);
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
	public static async getIntegrationTypeByName(
		queryRunner: QueryRunner,
		integrationTypeNames: any[]
	): Promise<IIntegrationType[]> {
		try {
			return await queryRunner.query(
				p(`SELECT * FROM "integration_type" WHERE "integration_type"."name" IN ('${integrationTypeNames.join(
					"','"
				)}')`)
			);
		} catch (error) {
			console.log('Error while querying integration types:', error);
			return [];
		}
	}

	/**
	 *
	 * @param queryRunner
	 * @param integrationTypeName
	 */
	public static async upsertIntegrationTypes(queryRunner: QueryRunner, integrationTypeNames: IntegrationTypeEnum[]) {
		for await (const integrationTypeName of integrationTypeNames) {
			const { name, description, icon, groupName, order } = DEFAULT_INTEGRATION_TYPES.find(
				(type) => type.name === integrationTypeName
			);
			const payload = [name, description, icon, groupName, order];
			const sqliteUpsertQuery = `
				INSERT INTO "integration_type" (
					"name", "description", "icon", "groupName", "order", "id"
				)
				VALUES (
					?, ?, ?, ?, ?, ?
				)
				ON CONFLICT("name")
				DO UPDATE SET "description" = EXCLUDED."description",
								"icon" = EXCLUDED."icon",
								"groupName" = EXCLUDED."groupName",
								"order" = EXCLUDED."order"
				RETURNING id;
			`;
			const postgresUpsertQuery = `
				INSERT INTO "integration_type" (
					"name", "description", "icon", "groupName", "order"
				)
				VALUES (
					$1, $2, $3, $4, $5
				)
				ON CONFLICT(name) DO UPDATE
				SET
					"description" = $2,
					"icon" = $3,
					"groupName" = $4,
					"order" = $5
				RETURNING id;
			`;
			const mysqlUpsertQuery = p(`
				INSERT INTO "integration_type" (
					"name", "description", "icon", "groupName", "order"
				) VALUES (
					?, ?, ?, ?, ?
				) ON DUPLICATE KEY UPDATE
					"description" = VALUES("description"),
					"icon" = VALUES("icon"),
					"groupName" = VALUES("groupName"),
					"order" = VALUES("order")
				RETURNING id;
			`);

			let upsertQuery = ``;

			switch (queryRunner.connection.options.type) {
				case DatabaseTypeEnum.sqlite:
				case DatabaseTypeEnum.betterSqlite3:
					// For SQLite, manually generate a UUID using uuidv4()
					const generatedId = uuidv4();
					payload.push(generatedId);
					upsertQuery = sqliteUpsertQuery;
					break;
				case DatabaseTypeEnum.postgres:
					upsertQuery = postgresUpsertQuery;
					break;
				case DatabaseTypeEnum.mysql:
					upsertQuery = mysqlUpsertQuery;
					break;
				default:
					throw Error(`cannot upsert integration types due to unsupported database type: ${queryRunner.connection.options.type}`);
			}
			await queryRunner.query(upsertQuery, payload);
		}
	}

	/**
	 *
	 *
	 * @param queryRunner
	 * @param integration
	 * @param integrationTypes
	 */
	public static async syncIntegrationType(
		queryRunner: QueryRunner,
		integration: IIntegration,
		integrationTypes: IIntegrationType[]
	) {
		if (integration) {
			const integrationId = integration.id;
			for await (const integrationType of integrationTypes) {
				let insertPivotQuery = ``;
				const sqliteUpsertQuery = `
					INSERT OR IGNORE INTO integration_integration_type (integrationId, integrationTypeId) VALUES (?, ?);
				`;
				const postgresUpsertQuery = `
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
				const mysqlUpsertQuery = p(`
					INSERT INTO integration_integration_type (integrationId, integrationTypeId)
					SELECT
						?, ?
					FROM
						DUAL
					WHERE NOT EXISTS (
						SELECT 1
						FROM integration_integration_type
						WHERE
							integrationId = ? AND
							integrationTypeId = ?
					);
				`);
				switch (queryRunner.connection.options.type) {
					case DatabaseTypeEnum.sqlite:
					case DatabaseTypeEnum.betterSqlite3:
						insertPivotQuery = sqliteUpsertQuery;
						break;
					case DatabaseTypeEnum.postgres:
						insertPivotQuery = postgresUpsertQuery;
						break;
					case DatabaseTypeEnum.mysql:
						insertPivotQuery = mysqlUpsertQuery;
						break;
					default:
						throw Error(`cannot sync integration types due to unsupported database type: ${queryRunner.connection.options.type}`);
				}
				await queryRunner.query(insertPivotQuery, [integrationId, integrationType.id]);
			}
		}
	}
}
