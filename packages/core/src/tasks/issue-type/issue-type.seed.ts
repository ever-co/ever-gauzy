import { DataSource } from 'typeorm';
import * as path from 'path';
import * as fs from 'fs';
import { imageSize } from 'image-size';
import { environment as env, getConfig } from '@gauzy/config';
import { FileStorageProviderEnum, IIssueType } from '@gauzy/contracts';
import { ImageAsset } from './../../core/entities/internal';
import { cleanAssets, copyAssets } from './../../core/seeds/utils';
import { DEFAULT_GLOBAL_ISSUE_TYPES } from './default-global-issue-types';
import { IssueType } from './issue-type.entity';

/**
 * Default global system issue types
 *
 * @param dataSource
 * @returns
 */
export const createDefaultIssueTypes = async (dataSource: DataSource): Promise<IIssueType[]> => {
	await cleanAssets(getConfig(), path.join('ever-icons', 'task-issue-types'));

	try {
		let issueTypes: IIssueType[] = [];

		const isElectron = env.isElectron; // Check if electron
		const publicDir = path.resolve(__dirname, '../../../', ...['apps', 'api', 'public']); // Default public directory for assets
		const assetPublicPath = getConfig().assetOptions.assetPublicPath || publicDir; // Custom public directory for assets
		const baseDir = isElectron ? path.resolve(env.gauzyUserPath, ...['public']) : assetPublicPath; // Base directory for assets

		// Copy default issue types icons
		for await (const issueType of DEFAULT_GLOBAL_ISSUE_TYPES) {
			//Copy issue type icon
			const iconPath = copyAssets(issueType.icon, getConfig());

			const absoluteFilePath = path.join(baseDir, iconPath);
			const { height = 0, width = 0 } = imageSize(absoluteFilePath);
			const { size } = fs.statSync(absoluteFilePath);

			try {
				const icon = new ImageAsset();
				icon.name = issueType.name;
				icon.url = iconPath;
				icon.storageProvider = FileStorageProviderEnum.LOCAL;
				icon.height = height;
				icon.width = width;
				icon.size = size;

				const image = await dataSource.getRepository(ImageAsset).save(icon);
				issueTypes.push(new IssueType({ ...issueType, icon: iconPath, image }));
			} catch (error) {
				console.error('Error while saving issue type icon', error?.message);
				issueTypes.push(new IssueType({ ...issueType, icon: undefined }));
			}
		}

		try {
			return await dataSource.manager.save(issueTypes);
		} catch (error) {
			console.log('Error while saving issue types', error);
		}
	} catch (error) {
		console.log('Error while moving task issue type icons', error);
	}
};
