import * as fs from 'fs';
import * as path from 'path';
import * as faker from 'faker';
import { TimeSlot } from '../time-slot.entity';
import { Screenshot } from '../screenshot.entity';
import * as moment from 'moment';

let fileList: string[] = [];

const dir = path.join(
	process.cwd(),
	'apps',
	'api',
	'src',
	'assets',
	'seed',
	'screenshots'
);

const baseDir = path.join(process.cwd(), 'apps', 'api');

const destDir = path.join(
	'public',
	'screenshots',
	moment().format('YYYY/MM/DD')
);

export const createRandomScreenshot = async (timeSlot: TimeSlot, tenant) => {
	await getList();

	const screenshots: Screenshot[] = [];
	for (
		let index = 0;
		index < faker.random.number({ min: 1, max: 3 });
		index++
	) {
		const sourceFile = faker.random.arrayElement(fileList);
		const destFile = path.join(
			destDir,
			'screenshot-' + moment().unix() + faker.random.number(999) + '.jpg'
		);

		fs.mkdirSync(path.join(baseDir, destDir), { recursive: true });

		const file = await new Promise<string>((resolve, reject) => {
			const sourceFilePath = path.join(dir, sourceFile);
			const destFilePath = path.join(baseDir, destFile);

			fs.copyFile(sourceFilePath, destFilePath, (err) => {
				if (err) {
					resolve('');
				}
				resolve(destFile);
			});
		});

		if (file) {
			const screenshot = new Screenshot();
			screenshot.tenant = tenant;
			screenshot.organizationId = timeSlot.organizationId;

			screenshot.fullUrl = file;
			screenshot.file = sourceFile;
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

const getList = () => {
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
