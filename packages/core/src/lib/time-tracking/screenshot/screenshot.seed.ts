import { faker } from '@faker-js/faker';
import { copyFileSync, mkdirSync, readdir } from 'fs';
import * as moment from 'moment';
import * as path from 'path';
import { ApplicationPluginConfig } from '@gauzy/common';
import { environment as env } from '@gauzy/config';
import { FileStorageProviderEnum, ID } from '@gauzy/contracts';
import { Screenshot } from '../../core/entities/internal';
import { randomSeedConfig } from './../../core/seeds/random-seed-config';
import { getApiPublicPath } from '../../core/util';
import { AppsNames } from './../activity/activity.seed';

/**
 * Generates random screenshots for a given tenant and organization within a specified time range.
 *
 * @param {Partial<ApplicationPluginConfig>} config - Configuration for asset paths and public paths.
 * @param {ID} tenantId - The unique identifier for the tenant.
 * @param {ID} organizationId - The unique identifier for the organization.
 * @param {Date} startedAt - The start timestamp for the time range.
 * @param {Date} stoppedAt - The end timestamp for the time range.
 * @returns {Promise<Screenshot[]>} - A promise that resolves with an array of generated screenshots.
 */
export const createRandomScreenshot = async (
	config: Partial<ApplicationPluginConfig>,
	tenantId: ID,
	organizationId: ID,
	employeeId: ID,
	startedAt: Date,
	stoppedAt: Date
): Promise<Screenshot[]> => {
	// Determine directories based on environment
	const isElectron = env.isElectron;
	const isDist = __dirname.includes('dist');

	// Helper to resolve paths based on environment
	const resolvePath = (isDist: boolean, distPath: string, devPath: string) =>
		isDist ? path.resolve(process.cwd(), distPath) : path.resolve(__dirname, devPath);

	// Resolve public directory
	const publicDir = getApiPublicPath();

	// Resolve asset public directory
	const assetPublicDir = isElectron
		? path.resolve(env.gauzyUserPath, 'public')
		: config.assetOptions?.assetPublicPath || publicDir;

	// Resolve asset path
	const assetPath = resolvePath(isDist, 'dist/apps/api/assets', '../../../apps/api/src/assets');

	// Resolve seed source directory
	const seedSourceDir = isElectron
		? path.resolve(env.gauzySeedPath, 'screenshots')
		: path.resolve(config.assetOptions.assetPath || assetPath, 'seed/screenshots');

	const screenshotsDir = path.join('screenshots', moment().format('YYYY/MM/DD'), tenantId, employeeId);
	const destinationDir = path.join(assetPublicDir, screenshotsDir);

	// Ensure the destination directory exists
	mkdirSync(destinationDir, { recursive: true });

	// Retrieve the list of files from the source directory
	const fileList = await getList(seedSourceDir);

	const screenshots: Screenshot[] = [];

	// Generate random screenshots
	for (let i = 0; i < randomSeedConfig.noOfScreenshotPerTimeSlot; i++) {
		// Get a random file from the file list
		const sourceFile = faker.helpers.arrayElement(fileList);
		// Get the full path to the file
		const sourceFilePath = path.join(seedSourceDir, sourceFile);
		// Generate a unique file name for the screenshot
		const fileName = `screenshot-${moment().unix()}-${faker.number.int(9999)}.png`;
		// Get the full path to the destination file
		const destFilePath = path.join(destinationDir, fileName);
		// Copy the screenshot file to the destination directory
		copyFileSync(sourceFilePath, destFilePath);
		// Get the relative path to the destination file
		const relativePath = path.join(screenshotsDir, fileName);

		// Construct the screenshot metadata
		const screenshot = new Screenshot();
		screenshot.tenantId = tenantId;
		screenshot.organizationId = organizationId;
		screenshot.fullUrl = relativePath;
		screenshot.file = relativePath;
		screenshot.thumb = relativePath;
		screenshot.thumbUrl = relativePath;
		screenshot.recordedAt = faker.date.between({ from: startedAt, to: stoppedAt });
		screenshot.storageProvider = FileStorageProviderEnum.LOCAL;
		screenshot.isWorkRelated = faker.helpers.arrayElement([true, false]);
		screenshot.apps = faker.helpers.arrayElements(AppsNames, 2);
		screenshot.description = faker.lorem.sentences({ min: 1, max: 3 });

		screenshots.push(screenshot);
	}

	return screenshots;
};

/**
 * Retrieves a list of files and directories from the specified directory.
 *
 * @param {string} dir - The path to the directory to read.
 * @returns {Promise<string[]>} - A promise that resolves with an array of file and directory names.
 * @throws {Error} - If the directory cannot be read, the promise is rejected.
 */
const getList = (dir: string): Promise<string[]> => {
	return new Promise((resolve, reject) => {
		readdir(dir, (err, items) => {
			if (err) {
				reject(err); // Pass the error for better debugging
			} else {
				resolve(items); // Resolve with the list of items
			}
		});
	});
};
