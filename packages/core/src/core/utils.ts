import { sample } from 'underscore';
import { BadRequestException } from '@nestjs/common';
import { IDateRange, IUser } from '@gauzy/contracts';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { IDBConnectionOptions } from '@gauzy/common';
import { getConfig, databaseTypes } from '@gauzy/config';
import { moment } from './../core/moment-extend';
import { ALPHA_NUMERIC_CODE_LENGTH } from './../constants';
import { SqliteDriver } from '@mikro-orm/sqlite';
import { BetterSqliteDriver } from '@mikro-orm/better-sqlite';
import { PostgreSqlDriver } from '@mikro-orm/postgresql';
import { MySqlDriver } from '@mikro-orm/mysql';
import { TypeOrmModuleOptions } from '@nestjs/typeorm';

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
			[current[key]]: current[value],
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
export function convertToDatetime(datetime): Date | string | null {
	if (moment(new Date(datetime)).isValid()) {
		switch (getConfig().dbConnectionOptions.type) {
			case databaseTypes.sqlite:
			case databaseTypes.betterSqlite3:
				return moment(new Date(datetime)).format('YYYY-MM-DD HH:mm:ss');
			case databaseTypes.postgres:
			case databaseTypes.mysql:
				return moment(new Date(datetime)).toDate();
			default:
				throw Error('cannot convert to date time');
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
 * Get date range according for different unitOfTimes
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
		throw 'End date must be greater than start date.';
	}

	switch (getConfig().dbConnectionOptions.type) {
		case databaseTypes.sqlite:
		case databaseTypes.betterSqlite3:
			start = start.format('YYYY-MM-DD HH:mm:ss');
			end = end.format('YYYY-MM-DD HH:mm:ss');
			break;
		case databaseTypes.postgres:
		case databaseTypes.mysql:
			if (!isFormat) {
				start = start.toDate();
				end = end.toDate();
			} else {
				start = start.format();
				end = end.format();
			}
			break;
		default:
			throw Error(`cannot get date range due to unsupported database type: ${getConfig().dbConnectionOptions.type}`)
	}

	return {
		start,
		end,
	};
}

export const getOrganizationDummyImage = (name: string) => {
	const firstNameLetter = name ? name.charAt(0).toUpperCase() : '';
	return getDummyImage(330, 300, firstNameLetter);
};

export const getTenantLogo = (name: string) => {
	const firstNameLetter = name ? name.charAt(0).toUpperCase() : '';
	return getDummyImage(330, 300, firstNameLetter);
};

/**
 * Merge Overlapping Date & Time
 *
 * @param ranges
 * @returns
 */
export function mergeOverlappingDateRanges(ranges: IDateRange[]): IDateRange[] {
	const sorted = ranges.sort(
		// By start, ascending
		(a, b) => a.start.getTime() - b.start.getTime()
	);

	const dates = sorted.reduce((acc, curr) => {
		// Skip the first range
		if (acc.length === 0) {
			return [curr];
		}

		const prev = acc.pop();

		if (curr.end <= prev.end) {
			// Current range is completely inside previous
			return [...acc, prev];
		}

		// Merges overlapping (<) and contiguous (==) ranges
		if (curr.start <= prev.end) {
			// Current range overlaps previous
			return [...acc, { start: prev.start, end: curr.end }];
		}

		// Ranges do not overlap
		return [...acc, prev, curr];
	}, [] as IDateRange[]);

	return dates;
}

/**
 * GET Date Range Format
 *
 * @param startDate
 * @param endDate
 * @returns
 */
export function getDateRangeFormat(
	startDate: moment.Moment,
	endDate: moment.Moment
): {
	start: string | Date;
	end: string | Date;
} {
	let start = moment(startDate);
	let end = moment(endDate);

	if (!start.isValid() || !end.isValid()) {
		return;
	}
	if (end.isBefore(start)) {
		throw 'End date must be greater than start date.';
	}

	switch (getConfig().dbConnectionOptions.type) {
		case databaseTypes.sqlite:
		case databaseTypes.betterSqlite3:
			return {
				start: start.format('YYYY-MM-DD HH:mm:ss'),
				end: end.format('YYYY-MM-DD HH:mm:ss'),
			};
		case databaseTypes.postgres:
		case databaseTypes.mysql:
			return {
				start: start.toDate(),
				end: end.toDate(),
			};
		default:
			throw Error(`cannot get date range due to unsupported database type: ${getConfig().dbConnectionOptions.type}`)
	}
}

/**
 * Get all dates between two dates using Moment.js.
 *
 * @param startDate - The start date.
 * @param endDate - The end date.
 * @returns An array of string representations of dates.
 */
export function getDaysBetweenDates(
	startDate: string | Date,
	endDate: string | Date,
	timezone: string = moment.tz.guess()
): string[] {
	const start = moment.utc(startDate).tz(timezone).toDate();
	const end = moment.utc(endDate).tz(timezone).toDate();
	const range = Array.from(moment.range(start, end).by('days'));

	return range.map((date: moment.Moment) => date.format('YYYY-MM-DD'));
}

/**
 * Generating a random integer number with flexible length
 *
 * @param length
 */
export function generateRandomInteger(length = 6) {
	return Math.floor(
		Math.pow(10, length - 1) +
		Math.random() *
		(Math.pow(10, length) - Math.pow(10, length - 1) - 1)
	);
}

/**
 * Generate a random alphanumeric code.
 * @param length The length of the code. Default is 6.
 * @returns The generated code.
 */
export function generateRandomAlphaNumericCode(length: number = ALPHA_NUMERIC_CODE_LENGTH): string {
	const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
	let code = '';

	for (let i = 0; i < length; i++) {
		const index = Math.floor(Math.random() * characters.length);
		code += characters[index];
	}

	return code;
}

/**
 * Get a fresh timestamp for the entity.
 *
 * @returns {Date}
 */
export function freshTimestamp(): Date {
	return new Date(moment.now());
}

/**
 * Function that performs the date range validation
 *
 * @param startedAt
 * @param stoppedAt
 * @returns
 */
export function validateDateRange(startedAt: Date, stoppedAt: Date): void {
	try {
		const start = moment(startedAt);
		const end = moment(stoppedAt);

		console.log(
			'------ Stopped Timer ------',
			start.toDate(),
			end.toDate()
		);

		if (!start.isValid() || !end.isValid()) {
			throw 'Started and Stopped date must be valid date.';
			// If either start or end date is invalid, return without throwing an exception
		}

		if (end.isBefore(start)) {
			throw 'Stopped date must be greater than started date.';
		}
	} catch (error) {
		// If any error occurs during date validation, throw a BadRequestException
		throw new BadRequestException(error);
	}
}

/**
 * Function that returns intersection of 2 array
 * @param arr1
 * @param arr2
 * @returns
 */
export function findIntersection(arr1: any[], arr2: any[]) {
	const set1 = new Set(arr1);
	const intersection = arr2.filter((element) => set1.has(element));
	return intersection;
}

/**
 * Check if the given database connection type is SQLite.
 *
 * @param {string} connectionType - The database connection type.
 * @returns {boolean} - Returns true if the database connection type is SQLite.
 */
export function isSqliteDB(dbConnection?: IDBConnectionOptions): boolean {
	return isDatabaseType([databaseTypes.sqlite, databaseTypes.betterSqlite3], dbConnection)
}

/**
 * Enum representing different ORM types.
 */
export enum MultiORMEnum {
	TypeORM = 'typeorm',
	MikroORM = 'mikro-orm'
}

/**
 * Type representing the ORM types.
 */
export type MultiORM = 'typeorm' | 'mikro-orm';

/**
 * Gets the ORM type based on the environment variable or a default value.
 * @param defaultValue The default ORM type.
 * @returns The ORM type ('typeorm' or 'mikro-orm').
 */
export function getORMType(defaultValue: MultiORM = MultiORMEnum.TypeORM): MultiORM {
	return (process.env.DB_ORM as MultiORM) || defaultValue;
}

/**
 *
 * @param dbConnection
 * @returns
 */
export function getDBType(dbConnection?: IDBConnectionOptions) {
	const dbORM = getORMType();
	if (!dbConnection) {
		dbConnection = getConfig().dbConnectionOptions
	}
	let dbType;
	switch (dbORM) {
		case 'mikro-orm':
			if (dbConnection.driver instanceof SqliteDriver) {
				dbType = databaseTypes.sqlite
			}
			else if (dbConnection.driver instanceof BetterSqliteDriver) {
				dbType = databaseTypes.betterSqlite3
			}
			else if (dbConnection.driver instanceof PostgreSqlDriver) {
				dbType = databaseTypes.postgres
			}
			else if (dbConnection.driver instanceof MySqlDriver) {
				dbType = databaseTypes.mysql
			} else {
				dbType = databaseTypes.postgres
			}
			break;

		default:
			dbType = (dbConnection as TypeOrmModuleOptions).type
			break;
	}

	return dbType
}


export function isDatabaseType(types: databaseTypes | databaseTypes[], dbConnection?: IDBConnectionOptions) {
	if (!dbConnection) {
		dbConnection = getConfig().dbConnectionOptions
	}
	let dbType = getDBType(dbConnection)

	if (types instanceof Array) {
		return types.includes(dbType);
	} else {
		return types == dbType;
	}
}
