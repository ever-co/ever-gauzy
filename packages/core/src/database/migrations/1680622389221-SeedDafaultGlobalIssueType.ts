import { MigrationInterface, QueryRunner } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import * as path from 'path';
import * as fs from 'fs';
import { imageSize } from 'image-size';
import { getConfig } from '@gauzy/config';
import { FileStorageProviderEnum } from '@gauzy/contracts';
import { copyAssets } from './../../core/seeds/utils';
import { DEFAULT_GLOBAL_ISSUE_TYPES } from './../../tasks/issue-type/default-global-issue-types';

export class SeedDafaultGlobalIssueType1680622389221 implements MigrationInterface {

	private config = getConfig();
	name = 'SeedDafaultGlobalIssueType1680622389221';

	/**
	 * Up Migration
	 *
	 * @param queryRunner
	 */
	public async up(queryRunner: QueryRunner): Promise<any> {
		await this.seedDefaultIssueTypes(queryRunner);
	}

	/**
	 * Down Migration
	 *
	 * @param queryRunner
	 */
	public async down(queryRunner: QueryRunner): Promise<any> { }

	/**
	 * Default global issue types
	 *
	 * @param queryRunner
	 */
	async seedDefaultIssueTypes(queryRunner: QueryRunner) {
		try {
			for await (const issueType of DEFAULT_GLOBAL_ISSUE_TYPES) {
				const { name, value, description, icon, color, isSystem } = issueType;

				/** Move issue types icons to the public static folder */
				const filepath = path.join('ever-icons', icon);
				copyAssets(icon, this.config);

				const iconPath = path.join(this.config.assetOptions.assetPath, ...['seed', 'ever-icons', icon]);
				const { height, width } = imageSize(iconPath);
				const { size } = fs.statSync(iconPath);

				const imageAsset = [
					name,
					filepath,
					FileStorageProviderEnum.LOCAL,
					height,
					width,
					size
				];

				const payload = [
					name,
					value,
					description,
					filepath,
					color,
					isSystem
				];

				if (['sqlite', 'better-sqlite3'].includes(queryRunner.connection.options.type)) {
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
					await queryRunner.connection.manager.query(`
						INSERT INTO "issue_type" (
							"name", "value", "description", "icon", "color", "isSystem", "id", "imageId"
						) VALUES (
							?, ?, ?, ?, ?, ?, ?, ?);
						`, payload);
				} else {
					const insertQuery = `
						INSERT INTO "image_asset" (
							"name", "url", "storageProvider", "height", "width", "size"
						) VALUES (
							$1, $2, $3, $4, $5, $6
						)
						RETURNING id;
					`;
					const image_asset = await queryRunner.connection.manager.query(insertQuery, imageAsset);
					const imageAssetId = image_asset[0]['id'];

					payload.push(imageAssetId);
					await queryRunner.connection.manager.query(`
						INSERT INTO "issue_type" (
							"name", "value", "description", "icon", "color", "isSystem", "imageId"
						) VALUES (
							$1, $2, $3, $4, $5, $6, $7
						);
					`, payload);
				}
			}
		} catch (error) {
			// since we have errors let's rollback changes we made
			console.log('Error while insert default global issue types in production server', error);
		}
	}
}
