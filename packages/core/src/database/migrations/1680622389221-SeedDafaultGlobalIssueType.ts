import { MigrationInterface, QueryRunner } from 'typeorm';
import * as chalk from 'chalk';
import { v4 as uuidv4 } from 'uuid';
import * as path from 'path';
import * as fs from 'fs';
import { imageSize } from 'image-size';
import { getConfig, environment as env, DatabaseTypeEnum } from '@gauzy/config';
import { FileStorageProviderEnum } from '@gauzy/contracts';
import { copyAssets } from './../../core/seeds/utils';
import { DEFAULT_GLOBAL_ISSUE_TYPES } from './../../tasks/issue-type/default-global-issue-types';

export class SeedDafaultGlobalIssueType1680622389221 implements MigrationInterface {
	name = 'SeedDafaultGlobalIssueType1680622389221';

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
				await this.sqliteSeedDefaultIssueTypes(queryRunner);
				break;
			case DatabaseTypeEnum.postgres:
				await this.postgresSeedDefaultIssueTypes(queryRunner);
				break;
			case DatabaseTypeEnum.mysql:
				await this.mysqlSeedDefaultIssueTypes(queryRunner);
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
	 * Sqlite default global issue types
	 *
	 * @param queryRunner
	 */
	async sqliteSeedDefaultIssueTypes(queryRunner: QueryRunner) {
		try {
			for await (const issueType of DEFAULT_GLOBAL_ISSUE_TYPES) {
				const { name, value, description, icon, color, isSystem } = issueType;
				// 	/** Move issue types icons to the public static folder */
				// 	const filepath = path.join('ever-icons', icon);
				// 	copyAssets(icon, this.config);
				// 	const iconPath = path.join(this.config.assetOptions.assetPath, ...['seed', 'ever-icons', icon]);
				// 	const { height, width } = imageSize(iconPath);
				// 	const { size } = fs.statSync(iconPath);
				// 	const imageAsset = [name, filepath, FileStorageProviderEnum.LOCAL, height, width, size];
				// 	const payload = [name, value, description, filepath, color, isSystem ? 1 : 0];
				// 	const imageAssetId = uuidv4();


				// 	imageAsset.push(imageAssetId);
				// 	const insertQuery = `
				// 		INSERT INTO image_asset (
				// 			"name", "url", "storageProvider", "height", "width", "size", "id"
				// 		)
				// 		VALUES (
				// 			?, ?, ?, ?, ?, ?, ?
				// 		);
				// 	`;

				// 	await queryRunner.connection.manager.query(insertQuery, imageAsset);
				// 	payload.push(uuidv4(), imageAssetId);
				// 	await queryRunner.connection.manager.query(
				// 		`
				// 		INSERT INTO "issue_type" (
				// 			"name", "value", "description", "icon", "color", "isSystem", "id", "imageId"
				// 		) VALUES (
				// 			?, ?, ?, ?, ?, ?, ?, ?);
				// 		`,
				// 		payload
				// 	);
				// }
				const destDirName = 'ever-icons';
				const filePath = copyAssets(icon, getConfig(), destDirName);
				const baseDir = env.isElectron
					? path.resolve(env.gauzyUserPath, ...['public'])
					: getConfig().assetOptions.assetPublicPath ||
					path.resolve(__dirname, '../../../', ...['apps', 'api', 'public']);
				const absoluteFilePath = path.join(baseDir, filePath);
				const { height = 0, width = 0 } = imageSize(absoluteFilePath);
				const { size } = fs.statSync(absoluteFilePath);
				const payload = [name, value, description, filePath, color, isSystem ? 1 : 0];
				const imageAsset = [name, filePath, FileStorageProviderEnum.LOCAL, height, width, size];

				const imageAssetId = uuidv4();
				imageAsset.push(imageAssetId);

				const insertQuery = `
					INSERT INTO image_asset (
						"name", "url", "storageProvider", "height", "width", "size", "id"
					)
					VALUES (
						?, ?, ?, ?, ?, ?, ?
					);
				`;

				await queryRunner.connection.manager.query(insertQuery, imageAsset);

				payload.push(uuidv4(), imageAssetId);

				await queryRunner.connection.manager.query(
					`
					INSERT INTO "issue_type" (
						"name", "value", "description", "icon", "color", "isSystem", "id", "imageId"
					) VALUES (
						?, ?, ?, ?, ?, ?, ?, ?);
					`,
					payload
				);
			}
		} catch (error) {
			// since we have errors let's rollback changes we made
			console.log('Error while insert default global issue types in production server', error);
		}
	}

	/**
	 * Postgres default global issue types
	 *
	 * @param queryRunner
	 */
	async postgresSeedDefaultIssueTypes(queryRunner: QueryRunner) {
		try {
			for await (const issueType of DEFAULT_GLOBAL_ISSUE_TYPES) {
				const { name, value, description, icon, color, isSystem } = issueType;
				const destDirName = 'ever-icons';
				const filePath = copyAssets(icon, getConfig(), destDirName);
				const payload = [name, value, description, filePath, color, isSystem];
				const baseDir = env.isElectron
					? path.resolve(env.gauzyUserPath, ...['public'])
					: getConfig().assetOptions.assetPublicPath ||
					path.resolve(__dirname, '../../../', ...['apps', 'api', 'public']);
				const absoluteFilePath = path.join(baseDir, filePath);

				const { height = 0, width = 0 } = imageSize(absoluteFilePath);
				const { size } = fs.statSync(absoluteFilePath);

				const insertQuery = `
					INSERT INTO "image_asset" (
						"name", "url", "storageProvider", "height", "width", "size"
					) VALUES (
						$1, $2, $3, $4, $5, $6
					)
					RETURNING id;
				`;
				const imageAsset = [name, filePath, FileStorageProviderEnum.LOCAL, height, width, size];
				const image_asset = await queryRunner.connection.manager.query(insertQuery, imageAsset);
				const imageAssetId = image_asset[0]['id'];

				payload.push(imageAssetId);
				await queryRunner.connection.manager.query(
					`
					INSERT INTO "issue_type" (
						"name", "value", "description", "icon", "color", "isSystem", "imageId"
					) VALUES (
						$1, $2, $3, $4, $5, $6, $7
					);
				`,
					payload
				);
			}
		} catch (error) {
			// since we have errors let's rollback changes we made
			console.log('Error while insert default global issue types in production server', error);
		}
	}

	/**
	 * MySQL default global issue types
	 *
	 * @param queryRunner
	 */
	async mysqlSeedDefaultIssueTypes(queryRunner: QueryRunner) { }
}
