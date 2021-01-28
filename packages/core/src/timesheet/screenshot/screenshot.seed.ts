import * as fs from 'fs';
import * as path from 'path';
import * as faker from 'faker';
import * as moment from 'moment';
import { ConfigService, environment as env } from '@gauzy/config';
import { Screenshot, Tenant, TimeSlot } from '../../core/entities/internal';

let fileList: string[] = [];

export const createRandomScreenshot = async (
	timeSlot: TimeSlot,
	tenant: Tenant
): Promise<Screenshot[]> => {
	const configService = new ConfigService();

	let dir: string;
	let baseDir: string;
	if (env.isElectron) {
		dir = path.join(
			path.resolve(env.gauzyUserPath, ...['src', 'assets', 'seed']),
			'screenshots'
		);
		baseDir = path.join(path.resolve(env.gauzyUserPath));
	} else {
		dir =
			path.join(
				configService.assetOptions.assetPath,
				...['seed', 'screenshots']
			) ||
			path.resolve(
				__dirname,
				'../../../',
				...['apps', 'api', 'src', 'assets', 'seed', 'screenshots']
			);
		baseDir =
			path.join(configService.assetOptions.assetPublicPath, '../') ||
			path.resolve(__dirname, '../../../', ...['apps', 'api']);
	}

	const fileDir = path.join('screenshots', moment().format('YYYY/MM/DD'));
	const destDir = path.join('public', fileDir);

	await getList(dir);

	const screenshots: Screenshot[] = [];
	for (
		let index = 0;
		index < faker.random.number({ min: 1, max: 2 });
		index++
	) {
		const sourceFile = faker.random.arrayElement(fileList);
		const sourceName =
			'screenshot-' + moment().unix() + faker.random.number(999) + '.jpg';

		const destFile = path.join(destDir, sourceName);

		fs.mkdirSync(path.join(baseDir, destDir), { recursive: true });

		const file = await new Promise<string>((resolve, reject) => {
			const sourceFilePath = path.join(dir, sourceFile);
			const destFilePath = path.join(baseDir, destFile);

			fs.copyFile(sourceFilePath, destFilePath, (err) => {
				if (err) {
					resolve('');
				}
				resolve(path.join(fileDir, sourceName));
			});
		});

		if (file) {
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
	}

	return screenshots;
};

const getList = (dir) => {
	return new Promise((resolve, reject) => {
		fs.readdir(dir, (err, items) => {
			if (err) {
				reject();
			} else {
				fileList = items;
				resolve(items);
			}
		});
	});
};
