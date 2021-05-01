import { readdir, mkdirSync, copyFileSync } from 'fs';
import * as path from 'path';
import * as faker from 'faker';
import * as moment from 'moment';
import { environment as env } from '@gauzy/config';
import { Screenshot, Tenant, TimeSlot } from '../../core/entities/internal';
import { IPluginConfig } from '@gauzy/common';

let fileList: string[] = [];

export const createRandomScreenshot = async (
	timeSlot: TimeSlot,
	tenant: Tenant,
	config: IPluginConfig
): Promise<Screenshot[]> => {
	const destDirName = 'screenshots';

	let dir: string;
	let baseDir: string;

	if (env.isElectron) {
		dir = path.join(
			path.resolve(env.gauzyUserPath, ...['src', 'assets', 'seed']),
			'screenshots'
		);
		baseDir = path.join(path.resolve(env.gauzyUserPath));
	} else {
		if (config.assetOptions.assetPath) {
			dir = path.join(
				config.assetOptions.assetPath,
				...['seed', destDirName]
			);
		} else {
			dir = path.resolve(
				__dirname,
				'../../../',
				...['apps', 'api', 'src', 'assets', 'seed', destDirName]
			);
		}

		if (config.assetOptions.assetPublicPath) {
			baseDir = path.join(config.assetOptions.assetPublicPath, '../');
		} else {
			baseDir = path.resolve(__dirname, '../../../', ...['apps', 'api']);
		}
	}

	// console.log('SCREENSHOT SEED -> dir: ' + dir);
	// console.log('SCREENSHOT SEED -> baseDir: ' + baseDir);

	const fileDir = path.join(destDirName, moment().format('YYYY/MM/DD'));
	const destDir = path.join('public', fileDir);

	const finalDir = path.join(baseDir, destDir);

	// console.log('SCREENSHOT SEED -> finalDir: ' + finalDir);

	mkdirSync(finalDir, { recursive: true });

	await getList(dir);

	const screenshots: Screenshot[] = [];

	for (
		let index = 0;
		index < faker.datatype.number({ min: 1, max: 2 });
		index++
	) {
		const sourceFile = faker.random.arrayElement(fileList);

		const sourceName =
			'screenshot-' + moment().unix() + faker.datatype.number(999) + '.png';

		const destFile = path.join(destDir, sourceName);

		const sourceFilePath = path.join(dir, sourceFile);
		const destFilePath = path.join(baseDir, destFile);

		copyFileSync(sourceFilePath, destFilePath);

		const file = path.join(fileDir, sourceName);

		const screenshot = new Screenshot();

		screenshot.tenant = tenant;
		screenshot.organizationId = timeSlot.organizationId;
		screenshot.fullUrl = file;
		screenshot.file = file;
		screenshot.thumb = file;
		screenshot.timeSlot = timeSlot;
		screenshot.thumbUrl = file;
		screenshot.recordedAt = faker.date.between(
			timeSlot.startedAt,
			timeSlot.stoppedAt
		);
		screenshot.deletedAt = null;
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
