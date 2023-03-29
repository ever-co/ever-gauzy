import { DataSource } from 'typeorm';
import * as path from 'path';
import * as fs from 'fs';
import { imageSize } from 'image-size';
import { getConfig } from '@gauzy/config';
import { FileStorageProviderEnum, IIssueType } from '@gauzy/contracts';
import { ImageAsset } from './../../core/entities/internal';
import { cleanEverIcons, copyEverIcons } from './../../core/seeds/utils';
import { DEFAULT_GLOBAL_ISSUE_TYPES } from './default-global-issue-types';
import { IssueType } from './issue-type.entity';

const config = getConfig();

/**
 * Default global system issue types
 *
 * @param dataSource
 * @returns
 */
export const createDefaultIssueTypes = async (dataSource: DataSource): Promise<IIssueType[]> => {
	await cleanEverIcons(config, 'ever-icons/task-issue-types');

	let issueTypes: IIssueType[] = [];
	try {
		for await (const issueType of DEFAULT_GLOBAL_ISSUE_TYPES) {
			const iconPath = path.join(config.assetOptions.assetPath, ...['seed', 'ever-icons', issueType.icon]);
			const { height, width } = imageSize(iconPath);
			const { size } = fs.statSync(iconPath);

			const icon = new ImageAsset();
			icon.name = issueType.name;
			icon.url = path.join('ever-icons', issueType.icon);
			icon.storageProvider = FileStorageProviderEnum.LOCAL;
			icon.height = height;
			icon.width = width;
			icon.size = size;

			const image = await dataSource.manager.save(icon);
			issueTypes.push(
				new IssueType({
					...issueType,
					icon: copyEverIcons(issueType.icon, config),
					image
				})
			);
		}
	} catch (error) {
		console.log('Error while moving task issue type icons', error);
	}
	return await dataSource.manager.save(issueTypes);
};
