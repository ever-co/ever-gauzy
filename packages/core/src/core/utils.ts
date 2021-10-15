import { sample } from 'underscore';
import { IUser } from '@gauzy/contracts';
import * as moment from 'moment';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import slugify from 'slugify';
import { getConfig } from '@gauzy/config';

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
		const firstEmailLetter = user.email.charAt(0).toUpperCase();
		return getDummyImage(330, 300, firstEmailLetter);
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
export function convertToDatetime(datetime) {
	if (moment(new Date(datetime)).isValid()) {
		const dbType = getConfig().dbConnectionOptions.type || 'sqlite';		
		if (dbType === 'sqlite') {
			return moment(new Date(datetime)).format('YYYY-MM-DD HH:mm:ss');
		} else {
			return moment(new Date(datetime)).toDate();
		}
	}
	return null;
}

export async function tempFile(prefix) {
	const tempPath = path.join(os.tmpdir(), prefix);
	const folder = await fs.promises.mkdtemp(tempPath);
	return path.join(folder, prefix + moment().unix() + Math.random() * 10000);
}

/*
 * Get date range according for diffrent unitOfTimes
 */
export function getDateRange(
	startDate?: string | Date,
	endDate?: string | Date,
	type: 'day' | 'week' = 'day',
	isFormat: boolean = false
) {
	if (endDate === 'day' || endDate === 'week') {
		type = endDate;
	}

	let start: any = moment.utc().startOf(type);
	let end: any = moment.utc().endOf(type);

	if (startDate && endDate !== 'day' && endDate !== 'week') {
		start = moment.utc(startDate).startOf(type);
		end = moment.utc(endDate).endOf(type);
	} else {
		if (
			(startDate && endDate === 'day') ||
			endDate === 'week' ||
			(startDate && !endDate)
		) {
			start = moment.utc(startDate).startOf(type);
			end = moment.utc(startDate).endOf(type);
		}
	}

	if (!start.isValid() || !end.isValid()) {
		return;
	}

	if (end.isBefore(start)) {
		throw 'End date must be greated than start date.';
	}

	const dbType = getConfig().dbConnectionOptions.type || 'sqlite';
	if (dbType === 'sqlite') {
		start = start.format('YYYY-MM-DD HH:mm:ss');
		end = end.format('YYYY-MM-DD HH:mm:ss');
	} else {
		if (!isFormat) {
			start = start.toDate();
			end = end.toDate();
		} else {
			start = start.format();
			end = end.format();
		}
	}

	return {
		start,
		end
	};
}

/*
* Convert date range to dbType formate for SQLite, PostgresSQL
*/
export function getDateRangeFormat(
	startDate: string | Date,
	endDate: string | Date,
	isFormat: boolean = false
) {
	let start: any = moment(startDate).startOf('day');
	let end: any = moment(endDate).endOf('day');

	if (!start.isValid() || !end.isValid()) {
		return;
	}

	if (end.isBefore(start)) {
		throw 'End date must be greated than start date.';
	}

	const dbType = getConfig().dbConnectionOptions.type || 'sqlite';
	if (dbType === 'sqlite') {
		start = start.format('YYYY-MM-DD HH:mm:ss');
		end = end.format('YYYY-MM-DD HH:mm:ss');
	} else {
		if (!isFormat) {
			start = start.toDate();
			end = end.toDate();
		} else {
			start = start.format();
			end = end.format();
		}
	}

	return {
		start,
		end
	};
}

export function generateSlug(string: string) {
	return slugify(string, {
		replacement: '-', // replace spaces with replacement character, defaults to `-`
		remove: /[*+~()'"!:@,.]/g, // remove characters that match regex, defaults to `undefined`
		lower: true, // convert to lower case, defaults to `false`
		trim: true // trim leading and trailing replacement chars, defaults to `true`
	});
}

export const getOrganizationDummyImage = (name: string) => {
	const firstNameLetter = name ? name.charAt(0).toUpperCase() : '';
	return getDummyImage(330, 300, firstNameLetter);
};