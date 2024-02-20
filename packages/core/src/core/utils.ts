import { sample } from 'underscore';
import { BadRequestException } from '@nestjs/common';
import { IDateRange, IUser } from '@gauzy/contracts';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { IDBConnectionOptions } from '@gauzy/common';
import { getConfig, DatabaseTypeEnum } from '@gauzy/config';
import { moment } from './../core/moment-extend';
import { ALPHA_NUMERIC_CODE_LENGTH } from './../constants';
import { SqliteDriver } from '@mikro-orm/sqlite';
import { Collection, FindOptions as MikroORMFindOptions, FilterQuery as MikroFilterQuery } from '@mikro-orm/core';
import { BetterSqliteDriver } from '@mikro-orm/better-sqlite';
import { PostgreSqlDriver } from '@mikro-orm/postgresql';
import { MySqlDriver } from '@mikro-orm/mysql';
import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { FindManyOptions, FindOneOptions, FindOptions as TypeORMFindOptions } from 'typeorm';
import { IMikroOptions } from './crud/icrud.service';

namespace Utils {
	export function generatedLogoColor() {
		return sample(['#269aff', '#ffaf26', '#8b72ff', '#0ecc9D']).replace('#', '');
	}
}

export const getDummyImage = (width: number, height: number, letter: string) => {
	return `https://dummyimage.com/${width}x${height}/${Utils.generatedLogoColor()}/ffffff.jpg&text=${letter}`;
};

export const getUserDummyImage = (user: IUser) => {
	const firstNameLetter = user.firstName ? user.firstName.charAt(0).toUpperCase() : '';
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
export function unixTimestampToDate(timestamps, format = 'YYYY-MM-DD HH:mm:ss') {
	const millisecond = 1000;
	return moment.unix(timestamps / millisecond).format(format);
}

/*
 * To convert any datetime to any datetime format
 */
export function convertToDatetime(datetime): Date | string | null {
	if (moment(new Date(datetime)).isValid()) {
		switch (getConfig().dbConnectionOptions.type) {
			case DatabaseTypeEnum.sqlite:
			case DatabaseTypeEnum.betterSqlite3:
				return moment(new Date(datetime)).format('YYYY-MM-DD HH:mm:ss');
			case DatabaseTypeEnum.postgres:
			case DatabaseTypeEnum.mysql:
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
		if ((startDate && endDate === 'day') || endDate === 'week' || (startDate && !endDate)) {
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
		case DatabaseTypeEnum.sqlite:
		case DatabaseTypeEnum.betterSqlite3:
			start = start.format('YYYY-MM-DD HH:mm:ss');
			end = end.format('YYYY-MM-DD HH:mm:ss');
			break;
		case DatabaseTypeEnum.postgres:
		case DatabaseTypeEnum.mysql:
			if (!isFormat) {
				start = start.toDate();
				end = end.toDate();
			} else {
				start = start.format();
				end = end.format();
			}
			break;
		default:
			throw Error(
				`cannot get date range due to unsupported database type: ${getConfig().dbConnectionOptions.type}`
			);
	}

	return {
		start,
		end
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
		case DatabaseTypeEnum.sqlite:
		case DatabaseTypeEnum.betterSqlite3:
			return {
				start: start.format('YYYY-MM-DD HH:mm:ss'),
				end: end.format('YYYY-MM-DD HH:mm:ss')
			};
		case DatabaseTypeEnum.postgres:
		case DatabaseTypeEnum.mysql:
			return {
				start: start.toDate(),
				end: end.toDate()
			};
		default:
			throw Error(
				`cannot get date range due to unsupported database type: ${getConfig().dbConnectionOptions.type}`
			);
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
	return Math.floor(Math.pow(10, length - 1) + Math.random() * (Math.pow(10, length) - Math.pow(10, length - 1) - 1));
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

		console.log('------ Stopped Timer ------', start.toDate(), end.toDate());

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
 * @param {string} dbConnection - The database connection type.
 * @returns {boolean} - Returns true if the database connection type is SQLite.
 */
export function isSqliteDB(dbConnection?: IDBConnectionOptions): boolean {
	return isDatabaseType([DatabaseTypeEnum.sqlite, DatabaseTypeEnum.betterSqlite3], dbConnection);
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
	if (!process.env.DB_ORM) return defaultValue;

	switch (process.env.DB_ORM) {
		case MultiORMEnum.TypeORM:
			return MultiORMEnum.TypeORM;
		case MultiORMEnum.MikroORM:
			return MultiORMEnum.MikroORM;
		default:
			return defaultValue;
	}
}

/**
 * Gets the database type based on the provided database connection options or default options.
 *
 * @param {IDBConnectionOptions} [dbConnection] - The optional database connection options.
 * @returns {DatabaseTypeEnum} - The detected database type.
 */
export function getDBType(dbConnection?: IDBConnectionOptions): any {
	const dbORM = getORMType();
	if (!dbConnection) {
		dbConnection = getConfig().dbConnectionOptions;
	}

	let dbType: any;
	switch (dbORM) {
		case MultiORMEnum.MikroORM:
			if (dbConnection.driver instanceof SqliteDriver) {
				dbType = DatabaseTypeEnum.sqlite;
			} else if (dbConnection.driver instanceof BetterSqliteDriver) {
				dbType = DatabaseTypeEnum.betterSqlite3;
			} else if (dbConnection.driver instanceof PostgreSqlDriver) {
				dbType = DatabaseTypeEnum.postgres;
			} else if (dbConnection.driver instanceof MySqlDriver) {
				dbType = DatabaseTypeEnum.mysql;
			} else {
				dbType = DatabaseTypeEnum.postgres;
			}
			break;

		default:
			dbType = (dbConnection as TypeOrmModuleOptions).type;
			break;
	}

	return dbType;
}

/**
 * Checks whether the provided database type(s) match the database type of the given connection options.
 * If no connection options are provided, it uses the default options from the configuration.
 *
 * @param {DatabaseTypeEnum | DatabaseTypeEnum[]} types - The expected database type(s) to check against.
 * @param {IDBConnectionOptions} [dbConnection] - The optional database connection options.
 * @returns {boolean} - Returns true if the database type matches any of the provided types.
 */
export function isDatabaseType(types: DatabaseTypeEnum | DatabaseTypeEnum[], dbConnection?: IDBConnectionOptions): boolean {
	// If no connection options are provided, use the default options from the configuration
	if (!dbConnection) {
		dbConnection = getConfig().dbConnectionOptions;
	}

	// Get the database type from the connection options
	let dbType = getDBType(dbConnection);

	// Check if the provided types match the database type
	if (types instanceof Array) {
		return types.includes(dbType);
	} else {
		return types == dbType;
	}
}

/**
 * Recursively flattens nested objects into an array of dot-notated keys.
 * If the input is already an array, returns it as is.
 *
 * @param {any} input - The input object or array to be flattened.
 * @returns {string[]} - An array of dot-notated keys.
 */
export const flatten = (input: any): any => {
	if (Array.isArray(input)) {
		// If input is already an array, return it as is
		return input;
	}

	if (typeof input === 'object' && input !== null) {
		return Object.keys(input).reduce((acc, key) => {
			const value = input[key];
			const nestedKeys = flatten(value);
			const newKey = Array.isArray(value) ? key : nestedKeys.length > 0 ? `${key}.${nestedKeys.join('.')}` : key;
			return acc.concat(newKey);
		}, []);
	}

	// If input is neither an array nor an object, return an empty array
	return [];
};


export function praseMikroORMEntityToJson<T>(entity: any | Collection<any, any> | any[]) {

	return JSON.parse(JSON.stringify(entity));

	// if (entity instanceof Array) {
	// 	console.log('entity instanceof Array', entity)
	// 	return entity.map((item) => praseMikroORMEntityToJson(item)) as T;
	// } else if (entity instanceof Collection) {
	// 	console.log('entity instanceof Collection', entity, entity.toArray())
	// 	return praseMikroORMEntityToJson(entity.toArray()) as T[];
	// } else {
	// 	for (const key in entity) {
	// 		if (Object.prototype.hasOwnProperty.call(entity, key)) {
	// 			const value = entity[key];
	// 			if (value instanceof Collection || value instanceof Array) {
	// 				console.log('value Collection or Array', key, value)
	// 				entity[key] = praseMikroORMEntityToJson(value) as any;
	// 			} else {
	// 				entity[key] = value;
	// 			}
	// 		}
	// 	}

	// 	console.log('entity', entity)
	// 	return entity;
	// }
}

export function concatIdToWhere<T>(id: any, where: MikroFilterQuery<T>) {
	if (where instanceof Array) {
		where = where.concat({ id } as any);
	} else {
		where = {
			id,
			...(where ? where : ({} as any))
		};
	}
	return where;
}

export function parseTypeORMFindToMikroOrm<T>(options: FindManyOptions) {
	const mikroOptions: MikroORMFindOptions<T, any, any, any> = {};
	let where: MikroFilterQuery<T> = {}

	if (options) {


		if (options.where) {
			where = options.where as MikroFilterQuery<T>;
		}

		if (options.relations) {
			mikroOptions.populate = flatten(options.relations) as any;
		}

		if (options.order) {
			mikroOptions.orderBy = Object.entries(options.order).reduce((acc, [key, value]) => {
				acc[key] = `${value}`.toLowerCase();
				return acc;
			}, {});
		}

		if (options.skip !== undefined) {
			mikroOptions.offset = options.skip;
		}

		if (options.take !== undefined) {
			mikroOptions.limit = options.take;
		}

	}

	return { where, mikroOptions };
}
