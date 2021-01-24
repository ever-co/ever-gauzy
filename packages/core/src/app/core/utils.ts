import { sample } from 'lodash';
import { IUser } from '@gauzy/contracts';
import * as moment from 'moment';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';

namespace Utils {
	export function generatedLogoColor() {
		return sample(['#269aff', '#ffaf26', '#8b72ff', '#0ecc9D']).replace(
			'#',
			''
		);
	}
}

export const getDummyImage = (
	width: number,
	height: number,
	letter: string
) => {
	return `https://dummyimage.com/${width}x${height}/${Utils.generatedLogoColor()}/ffffff.jpg&text=${letter}`;
};

export const getUserDummyImage = (user: IUser) => {
	const firstNameLetter = user.firstName
		? user.firstName.charAt(0).toUpperCase()
		: '';
	if (firstNameLetter) {
		return getDummyImage(330, 300, firstNameLetter);
	} else {
		const firstCityLetter = user.email.charAt(0).toUpperCase();

		return getDummyImage(330, 300, firstCityLetter);
	}
};

export function reflect(promise) {
	return promise.then(
		(item) => ({ item, status: 'fulfilled' }),
		(error) => ({ error, status: 'rejected' })
	);
}

/**
 * To calculate the last day of a month, we need to set date=0 and month as the next month.
 * So, if we want the last day of February (February is month = 1) we'll need to perform 'new Date(year, 2, 0).getDate()'
 */
export function getLastDayOfMonth(year, month) {
	return new Date(year, month + 1, 0).getDate();
}

export function arrayToObject(array, key, value) {
	return array.reduce((prev, current) => {
		return {
			...prev,
			[current[key]]: current[value]
		};
	}, {});
}

/*
 * To convert unix timestamp to datetime using date format
 */
export function unixTimestampToDate(
	timestamps,
	format = 'YYYY-MM-DD HH:mm:ss'
) {
	const millisecond = 1000;
	return moment.unix(timestamps / millisecond).format(format);
}

/*
 * To convert any datetime to any datetime format
 */
export function convertToDatetime(datetime, format = 'YYYY-MM-DD HH:mm:ss') {
	if (moment(datetime).isValid()) {
		return moment(datetime).format(format);
	}

	return null;
}

export async function tempFile(prefix) {
	const tempPath = path.join(os.tmpdir(), prefix);
	const folder = await fs.promises.mkdtemp(tempPath);
	return path.join(folder, prefix + moment().unix() + Math.random() * 10000);
}
