import { MigrationInterface, QueryRunner } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import * as chalk from 'chalk';
import { getConfig, DatabaseTypeEnum } from '@gauzy/config';
import { copyAssets } from './../../core/seeds/utils';
import { DEFAULT_SYSTEM_INTEGRATIONS } from './../../integration/default-integration';
import { IntegrationsUtils } from './../../integration/utils';
import * as path from 'path';

export class SeedIntegrationTable1691494801748 implements MigrationInterface {
	name = 'SeedIntegrationTable1691494801748';

	/**
	 * Up Migration
	 *
	 * @param queryRunner
	 */
	public async up(queryRunner: QueryRunner): Promise<void> {
		console.log(chalk.yellow(this.name + ' start running!'));

		switch (queryRunner.connection.options.type) {
			case DatabaseTypeEnum.sqlite:
			case DatabaseTypeEnum.betterSqlite3:
				await this.sqliteUpsertIntegrationsAndIntegrationTypes(queryRunner);
				break;
			case DatabaseTypeEnum.postgres:
				await this.postgresUpsertIntegrationsAndIntegrationTypes(queryRunner);
				break;
			case DatabaseTypeEnum.mysql:
				await this.mysqlUpsertIntegrationsAndIntegrationTypes(queryRunner);
				break;
			default:
				throw Error(`Unsupported database: ${queryRunner.connection.options.type}`);
		}
	}
	/**
	 * Down Migration
	 *
	 * @param queryRunner
	 */
	public async down(queryRunner: QueryRunner): Promise<void> { }

	/**
	 * Sqlite Upsert integrations and integration types
	 *
	 * @param queryRunner
	 */
	public async sqliteUpsertIntegrationsAndIntegrationTypes(queryRunner: QueryRunner): Promise<any> {
		const destDir = 'integrations';

		for await (const { name, imgSrc, isComingSoon, order, integrationTypesMap } of DEFAULT_SYSTEM_INTEGRATIONS) {
			try {
				const filePath = copyAssets(path.join(destDir, imgSrc), getConfig(), '');
				const payload = [name, filePath, isComingSoon ? 1 : 0, order];

				// For SQLite, manually generate a UUID using uuidv4()
				const generatedId = uuidv4();
				payload.push(generatedId);

				const upsertQuery = `
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
			} catch (error) {
				// since we have errors let's rollback changes we made
				console.log(`Error while updating integration: (${name}) in production server`, error);
			}
		}
	}

	/**
	 * Postgres Upsert integrations and integration types
	 *
	 * @param queryRunner
	 */
	public async postgresUpsertIntegrationsAndIntegrationTypes(queryRunner: QueryRunner): Promise<any> {
		const destDir = 'integrations';

		for await (const { name, imgSrc, isComingSoon, order, integrationTypesMap } of DEFAULT_SYSTEM_INTEGRATIONS) {
			try {
				const filePath = copyAssets(path.join(destDir, imgSrc), getConfig(), '');
				const payload = [name, filePath, isComingSoon, order];

				const upsertQuery = `
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

			} catch (error) {
				// since we have errors let's rollback changes we made
				console.log(`Error while updating integration: (${name}) in production server`, error);
			}
		}
	}

	/**
	 * Postgres Upsert integrations and integration types
	 *
	 * @param queryRunner
	 */
	public async mysqlUpsertIntegrationsAndIntegrationTypes(queryRunner: QueryRunner): Promise<any> { }
}
