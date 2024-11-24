import { DataSource } from 'typeorm';
import * as path from 'path';
import { environment as env, getConfig } from '@gauzy/config';
import { FileStorageProviderEnum, IIssueType } from '@gauzy/contracts';
import { ImageAsset } from './../../core/entities/internal';
import { cleanAssets, copyAssets, getImageDimensions } from './../../core/seeds/utils';
import { DEFAULT_GLOBAL_ISSUE_TYPES } from './default-global-issue-types';
import { IssueType } from './issue-type.entity';


// Get the application configuration
const config = getConfig();

/**
 * Creates default issue types for the system.
 *
 * This function is responsible for:
 * - Cleaning existing assets related to issue types.
 * - Copying default issue type icons to the appropriate asset directories.
 * - Calculating dimensions and size of the icons.
 * - Saving the issue types along with their associated icons in the database.
 *
 * @param dataSource The database connection/data source.
 * @returns A promise resolving to an array of saved issue types.
 *
 * @throws Logs errors related to asset copying, icon saving, or issue type saving.
 */
export const createDefaultIssueTypes = async (
    dataSource: DataSource
): Promise<IIssueType[]> => {
	// Check if running in Electron
	const isElectron = env.isElectron;

	// Determine if running from dist or source
	const isDist = __dirname.includes('dist');

	// Default public directory for assets
	const publicDir = isDist
		? path.resolve(process.cwd(), 'apps/api/public') // Adjusted for dist structure
		: path.resolve(__dirname, '../../../apps/api/public');

	// Determine the base directory for assets
	const assetPublicPath = isElectron
		? path.resolve(env.gauzyUserPath, 'public')
		: config.assetOptions?.assetPublicPath || publicDir; // Custom public directory path from configuration.

    try {
		// Clean up old issue type assets
		await cleanAssets(config, path.join('ever-icons', 'task-issue-types'));

		let issueTypes: IIssueType[] = [];

        // Iterate through default global issue types and process each.
        for await (const issueType of DEFAULT_GLOBAL_ISSUE_TYPES) {
            try {
                // Copy issue type icon and get its path.
                const iconPath = await copyAssets(issueType.icon, config);
				// Calculate dimensions and size of the icon.
                const absoluteFilePath = path.join(assetPublicPath, iconPath);
				// Get image dimensions.
				const { height, width, size } = await getImageDimensions(absoluteFilePath);

                // Create a new image asset for the icon.
                const icon = new ImageAsset();
                icon.name = issueType.name;
                icon.url = iconPath;
                icon.storageProvider = FileStorageProviderEnum.LOCAL;
                icon.height = height;
                icon.width = width;
                icon.size = size;

                // Save the image asset in the database.
                const image = await dataSource.getRepository(ImageAsset).save(icon);

                // Create and save the issue type with the associated icon.
                issueTypes.push(new IssueType({ ...issueType, icon: iconPath, image }));
            } catch (error) {
				console.error('Error while saving issue type icon:', error?.message);
                // Fallback to creating the issue type without an associated icon.
                issueTypes.push(new IssueType({ ...issueType, icon: undefined }));
            }
        }

		// Save all issue types in the database.
        return await dataSource.manager.save(issueTypes);
    } catch (error) {
        console.log('Error while moving task issue type icons', error);
    }
};
