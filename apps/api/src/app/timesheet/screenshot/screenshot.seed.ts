import * as fs from 'fs';
import * as path from 'path';
import * as faker from 'faker';
import { TimeSlot } from '../time-slot.entity';
import { Screenshot } from '../screenshot.entity';
import * as moment from 'moment';

let fileList: string[] = [];
let dir = path.join(
	process.cwd(),
	'apps',
	'api',
	'src',
	'assets',
	'seed',
	'screenshots'
);
fs.readdir(dir, function (err, items) {
	fileList = items;
});

const baseDir = path.join(process.cwd(), 'apps', 'api');
const destDir = path.join(
	'public',
	'screenshots',
	moment().format('YYYY/MM/DD')
);

export const createRandomScreenshot = async (timeSlot: TimeSlot) => {
	await getlist();

	const screenshots: Screenshot[] = [];
	// for (let index = 0; index < faker.random.number(3); index++) {
	const screenshot = new Screenshot();
	const sourceFile = faker.random.arrayElement(fileList);

	path.join(
		destDir,
		'screenshot-' + moment().unix() + faker.random.number(999) + '.jpg'
	);

	fs.mkdirSync(path.join(baseDir, destDir), { recursive: true });
	/*const file = await new Promise<string>((resolve, reject) => {
	  console.log('path.join(dir, sourceFile),', path.join(dir, sourceFile),);
	  console.log('path.join(baseDir, destFile),', path.join(baseDir, destFile),);
		fs.copyFile(
			path.join(dir, sourceFile),
			path.join(baseDir, destFile),
			(err) => {
				if (err) {
					// reject(err);
					// return;
          console.log('resolve empty');
          resolve('');
				}
				resolve(destFile);
			}
		);
	});*/
	const file = sourceFile;

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
	// }
	return screenshots;
};

const getlist = function () {
	return new Promise((resolve, reject) => {
		dir = path.join(process.cwd(), 'src', 'assets', 'seed', 'screenshots');
		fs.readdir(dir, function (err, items) {
			if (err) {
				reject();
			} else {
				fileList = items;
				resolve();
			}
		});
	});
};
