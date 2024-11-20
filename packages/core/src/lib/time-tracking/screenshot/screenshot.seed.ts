import { faker } from '@faker-js/faker';
import { ApplicationPluginConfig } from '@gauzy/common';
import { environment as env } from '@gauzy/config';
import { FileStorageProviderEnum } from '@gauzy/contracts';
import { copyFileSync, mkdirSync, readdir } from 'fs';
import * as moment from 'moment';
import * as path from 'path';
import { Screenshot } from '../../core/entities/internal';
import { randomSeedConfig } from './../../core/seeds/random-seed-config';
import { AppsNames } from './../activity/activity.seed';

let fileList: string[] = [];

export const createRandomScreenshot = async (
	config: Partial<ApplicationPluginConfig>,
	tenantId: string,
	organizationId: string,
	startedAt: Date,
	stoppedAt: Date
): Promise<Screenshot[]> => {
	const destDirName = 'screenshots';

	let dir: string;
	let baseDir: string;

	if (env.isElectron) {
		dir = path.join(env.gauzySeedPath, destDirName);
		baseDir = path.join(path.resolve(env.gauzyUserPath));
	} else {
		if (config.assetOptions.assetPath) {
			dir = path.join(config.assetOptions.assetPath, ...['seed', destDirName]);
		} else {
			dir = path.resolve(__dirname, '../../../', ...['apps', 'api', 'src', 'assets', 'seed', destDirName]);
		}

		if (config.assetOptions.assetPublicPath) {
			baseDir = path.join(config.assetOptions.assetPublicPath, '../');
		} else {
			baseDir = path.resolve(__dirname, '../../../', ...['apps', 'api']);
		}
	}

	// console.log('SCREENSHOT SEED -> dir: ' + dir);
	// console.log('SCREENSHOT SEED -> baseDir: ' + baseDir);

	const fileDir = path.join(destDirName, moment().format('YYYY/MM/DD'), tenantId);
	const destDir = path.join('public', fileDir);

	const finalDir = path.join(baseDir, destDir);

	// console.log('SCREENSHOT SEED -> finalDir: ' + finalDir);

	mkdirSync(finalDir, { recursive: true });

	await getList(dir);

	const screenshots: Screenshot[] = [];

	for (let index = 0; index < randomSeedConfig.noOfScreenshotPerTimeSlot; index++) {
		const sourceFile = faker.helpers.arrayElement(fileList);
		const sourceName = 'screenshot-' + moment().unix() + faker.number.int(999) + '.png';
		const destFile = path.join(destDir, sourceName);
		const sourceFilePath = path.join(dir, sourceFile);
		const destFilePath = path.join(baseDir, destFile);

		copyFileSync(sourceFilePath, destFilePath);
		const file = path.join(fileDir, sourceName);

		const screenshot = new Screenshot();
		screenshot.tenantId = tenantId;
		screenshot.organizationId = organizationId;
		screenshot.fullUrl = file;
		screenshot.file = file;
		screenshot.thumb = file;
		screenshot.thumbUrl = file;
		screenshot.recordedAt = faker.date.between({ from: startedAt, to: stoppedAt });
		screenshot.storageProvider = FileStorageProviderEnum.LOCAL;
		screenshot.isWorkRelated = faker.helpers.arrayElement([true, false]);
		screenshot.apps = faker.helpers.arrayElements(AppsNames, 2);
		screenshot.description = faker.lorem.sentences({ min: 1, max: 3 });
		screenshots.push(screenshot);
	}
	return screenshots;
};

const getList = (dir) => {
	return new Promise((resolve, reject) => {
		readdir(dir, (err, items) => {
			if (err) {
				reject();
			} else {
				fileList = items;
				resolve(items);
			}
		});
	});
};
