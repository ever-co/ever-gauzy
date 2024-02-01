import { DataSource } from 'typeorm';
import * as path from 'path';
import * as fs from 'fs';
import { imageSize } from 'image-size';
import { getConfig } from '@gauzy/config';
import { FileStorageProviderEnum, IIssueType } from '@gauzy/contracts';
import { ImageAsset } from './../../core/entities/internal';
import { cleanAssets, copyAssets } from './../../core/seeds/utils';
import { DEFAULT_GLOBAL_ISSUE_TYPES } from './default-global-issue-types';
import { IssueType } from './issue-type.entity';
import { environment as env } from '@gauzy/config';

/**
 * Default global system issue types
 *
 * @param dataSource
 * @returns
 */
export const createDefaultIssueTypes = async (dataSource: DataSource): Promise<IIssueType[]> => {
	await cleanAssets(getConfig(), path.join('ever-icons', 'task-issue-types'));

	let issueTypes: IIssueType[] = [];
	try {
		for await (const issueType of DEFAULT_GLOBAL_ISSUE_TYPES) {
			const iconPath = copyAssets(issueType.icon, getConfig());
			const baseDir = env.isElectron
				? path.resolve(env.gauzyUserPath, ...['public'])
				: getConfig().assetOptions.assetPublicPath ||
				path.resolve(__dirname, '../../../', ...['apps', 'api', 'public']);
			const absoluteFilePath = path.join(baseDir, iconPath)
			const { height = 0, width = 0 } = imageSize(absoluteFilePath);
			const { size } = fs.statSync(absoluteFilePath);
			const icon = new ImageAsset();
			icon.name = issueType.name;
			icon.url = iconPath;
			icon.storageProvider = FileStorageProviderEnum.LOCAL;
			icon.height = height;
			icon.width = width;
			icon.size = size;

			const image = await dataSource.manager.save(icon);
			issueTypes.push(
				new IssueType({
					...issueType,
					icon: iconPath,
					image
				})
			);
		}
	} catch (error) {
		console.log('Error while moving task issue type icons', error);
	}
	return await dataSource.manager.save(issueTypes);
};
