import { BadRequestException } from '@nestjs/common';
import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import {
	FindOptions as MikroORMFindOptions,
	FilterQuery as MikroFilterQuery,
	OrderDefinition,
	wrap
} from '@mikro-orm/core';
import { SOFT_DELETABLE_FILTER } from 'mikro-orm-soft-delete';
import { BetterSqliteDriver } from '@mikro-orm/better-sqlite';
import { PostgreSqlDriver } from '@mikro-orm/postgresql';
import { MySqlDriver } from '@mikro-orm/mysql';
import {
	FindManyOptions,
	FindOneOptions,
	FindOperator,
	FindOptionsOrder,
	FindOptionsRelations,
	FindOptionsSelect
} from 'typeorm';
import { sample } from 'underscore';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { DateRange, IDateRange, IUser } from '@gauzy/contracts';
import { IDBConnectionOptions } from '@gauzy/common';
import { getConfig, DatabaseTypeEnum, environment } from '@gauzy/config';
import { moment } from './../core/moment-extend';

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
		switch (getConfig().dbConnectionOptions.type as DatabaseTypeEnum) {
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

	switch (getConfig().dbConnectionOptions.type as DatabaseTypeEnum) {
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
export function getDateRangeFormat(startDate: moment.Moment, endDate: moment.Moment): DateRange {
	let start = moment(startDate);
	let end = moment(endDate);

	if (!start.isValid() || !end.isValid()) {
		return;
	}
	if (end.isBefore(start)) {
		throw 'End date must be greater than start date.';
	}

	switch (getConfig().dbConnectionOptions.type as DatabaseTypeEnum) {
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
	timeZone: string = moment.tz.guess()
): string[] {
	// Convert start and end dates to the specified timezone
	const start = moment.utc(startDate, 'YYYY-MM-DD HH:mm:ss').clone().tz(timeZone);
	const end = moment.utc(endDate, 'YYYY-MM-DD HH:mm:ss').clone().tz(timeZone);

	// Create a range using the moment-range library
	const ranges = moment.range(start, end);

	// Generate an array of dates within the range, formatted as 'YYYY-MM-DD'
	return Array.from(ranges.by('day')).map((date: moment.Moment) => date.format('YYYY-MM-DD'));
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
 * Validates the date range between startedAt and stoppedAt.
 *
 * @param startedAt The start date of the range.
 * @param stoppedAt The end date of the range.
 * @throws BadRequestException if the stoppedAt date is before the startedAt date.
 */
export function validateDateRange(startedAt: Date, stoppedAt: Date): void {
	const start = moment(startedAt);
	const end = moment(stoppedAt);

	// Validate that both dates are valid
	if (!start.isValid() || !end.isValid()) {
		throw new BadRequestException('Started and Stopped date must be valid dates.');
	}

	// Only throw error if stoppedAt is smaller than startedAt
	if (end.isBefore(start)) {
		throw new BadRequestException('Stopped date must be greater than or equal to the started date.');
	}
}

/**
 * Function that returns intersection of 2 arrays
 * @param arr1 Array 1
 * @param arr2 Array 2
 * @returns Intersection of arr1 and arr2
 */
export function getArrayIntersection(arr1: any[], arr2: any[]): any[] {
	const set1 = new Set(arr1);
	return arr2.filter((element) => set1.has(element));
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
 * Get the Object-Relational Mapping (ORM) type from the environment variable `DB_ORM`.
 * @param {MultiORM} defaultValue - The default ORM type to use if `DB_ORM` is not set or an invalid value is provided.
 * @returns {MultiORM} - The determined ORM type.
 */
export function getORMType(defaultValue: MultiORM = MultiORMEnum.TypeORM): MultiORM {
	// Check if the environment variable `DB_ORM` is not set, and return the default value.
	if (!process.env.DB_ORM) return defaultValue;

	// Determine the ORM type based on the value of `DB_ORM`.
	switch (process.env.DB_ORM) {
		case MultiORMEnum.TypeORM:
			return MultiORMEnum.TypeORM;
		case MultiORMEnum.MikroORM:
			return MultiORMEnum.MikroORM;
		default:
			// If an invalid value is provided, return the default value.
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
			if (dbConnection.driver instanceof BetterSqliteDriver) {
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
export function isDatabaseType(
	types: DatabaseTypeEnum | DatabaseTypeEnum[],
	dbConnection?: IDBConnectionOptions
): boolean {
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
		return (
			Object.keys(input).reduce((acc, key) => {
				const value = input[key];
				if (value) {
					const nestedKeys = flatten(value);
					const newKey = Array.isArray(value)
						? key
						: nestedKeys.length > 0
						? `${key}.${nestedKeys.join('.')}`
						: key;
					return acc.concat(newKey);
				}
			}, []) || []
		);
	}

	// If input is neither an array nor an object, return an empty array
	return [];
};

/**
 * TypeORM `FindManyOptions` widened to also accept the legacy string-array `relations`/`select`
 * syntax that TypeORM removed in v1.0 (e.g. `relations: ['role', 'tenant.featureOrganizations']`).
 *
 * Ever Gauzy still passes this syntax in many dynamic call sites. Rather than patching TypeORM's own
 * type declarations (the old `patches/typeorm+1.0.0.patch` approach), we widen our own option types
 * and convert the arrays to object form at the TypeORM data-access boundary (see
 * {@link parseTypeORMFindOptions}). The `relations`/`select` element types are pulled from TypeORM
 * via indexed access so they track upstream automatically.
 */
export type LegacyFindManyOptions<T> = Omit<FindManyOptions<T>, 'relations' | 'select'> & {
	relations?: FindManyOptions<T>['relations'] | string[];
	select?: FindManyOptions<T>['select'] | string[];
};

/**
 * TypeORM `FindOneOptions` widened to also accept the legacy string-array `relations`/`select`
 * syntax. See {@link LegacyFindManyOptions}.
 */
export type LegacyFindOneOptions<T> = Omit<FindOneOptions<T>, 'relations' | 'select'> & {
	relations?: FindOneOptions<T>['relations'] | string[];
	select?: FindOneOptions<T>['select'] | string[];
};

/**
 * Path segments that must never be used as object keys when building find-option objects from
 * (potentially untrusted) string input, to avoid prototype-pollution assignments.
 */
const UNSAFE_FIND_OPTION_SEGMENTS = new Set(['__proto__', 'prototype', 'constructor']);

/**
 * Converts the legacy string-array find-option syntax (`['role', 'tenant.featureOrganizations']`)
 * into the nested object form TypeORM v1 requires (`{ role: true, tenant: { featureOrganizations: true } }`).
 * A dot in a segment denotes nesting.
 *
 * This replaces the runtime compatibility shim that previously lived in
 * `patches/typeorm+1.0.0.patch` (TypeORM removed the string-array `relations`/`select` syntax in
 * v1.0). Applying the conversion in application code — at the TypeORM data-access boundary — lets us
 * drop that node_modules patch while keeping the many dynamic `string[]` call sites working.
 *
 * The merge rules match the shim exactly so behaviour is unchanged: a leaf only sets `true` when the
 * key is still unset (an existing nested object from a longer sibling path is preserved), and an
 * intermediate segment upgrades a `true` leaf to a nested object. Empty / non-string segments are
 * skipped.
 *
 * @param paths - The dot-notated relation/column paths to convert.
 * @returns The equivalent nested object form.
 */
export function stringArrayToFindOptionsObject(paths: readonly string[]): Record<string, any> {
	let result: Record<string, any> = {};

	for (const rawPath of paths) {
		if (typeof rawPath !== 'string' || rawPath.length === 0) {
			continue;
		}

		// Drop empty segments so malformed inputs like `role.` or `tenant..settings` don't create
		// bogus `''` relation keys, and reject any path that carries a prototype-polluting segment
		// (these values can originate from untrusted API `relations`/`select` query params).
		const segments = rawPath.split('.').filter((segment) => segment.length > 0);
		if (segments.length === 0 || segments.some((segment) => UNSAFE_FIND_OPTION_SEGMENTS.has(segment))) {
			continue;
		}

		let cursor = result;
		for (let i = 0; i < segments.length; i++) {
			const segment = segments[i];
			const isLeaf = i === segments.length - 1;

			if (isLeaf) {
				if (cursor[segment] === undefined) {
					cursor[segment] = true;
				}
			} else {
				if (cursor[segment] === true || cursor[segment] === undefined) {
					cursor[segment] = {};
				}
				cursor = cursor[segment];
			}
		}
	}

	return result;
}

/**
 * Normalizes a TypeORM `relations` find-option, converting the legacy `string[]` form to the object
 * form v1 expects and passing the object form (or `undefined`) through unchanged. Safe to call on any
 * `relations` value, so it can wrap options that may already use either syntax.
 *
 * @param relations - The `relations` option in either legacy `string[]` or object form.
 * @returns The `relations` option in object form, or the original value when not an array.
 */
export function parseFindOptionsRelations<T = unknown>(
	relations: string[] | FindOptionsRelations<any> | undefined
): FindOptionsRelations<T> | undefined {
	// NOTE: the parameter is intentionally `FindOptionsRelations<any>` (not `FindOptionsRelations<T>`)
	// so `T` is inferred from the assignment context (the field being populated), never from the
	// argument. Inferring `T` from a `string[]` argument makes `FindOptionsRelations<T>` resolve to a
	// bogus array type, which would then reject at every call site.
	if (Array.isArray(relations)) {
		return stringArrayToFindOptionsObject(relations) as FindOptionsRelations<T>;
	}
	return relations as FindOptionsRelations<T> | undefined;
}

/**
 * Normalizes a TypeORM `select` find-option, converting the legacy `string[]` form to the object form
 * v1 expects and passing the object form (or `undefined`) through unchanged. Safe to call on any
 * `select` value, so it can wrap options that may already use either syntax.
 *
 * @param select - The `select` option in either legacy `string[]` or object form.
 * @returns The `select` option in object form, or the original value when not an array.
 */
export function parseFindOptionsSelect<T = unknown>(
	select: string[] | FindOptionsSelect<any> | undefined
): FindOptionsSelect<T> | undefined {
	// See parseFindOptionsRelations: parameter is `FindOptionsSelect<any>` so `T` is inferred from the
	// assignment context rather than a `string[]` argument.
	if (Array.isArray(select)) {
		return stringArrayToFindOptionsObject(select) as FindOptionsSelect<T>;
	}
	return select as FindOptionsSelect<T> | undefined;
}

/**
 * Normalizes the `relations` and `select` members of a TypeORM find-options object in place-safe
 * fashion, returning a shallow copy with the legacy `string[]` form converted to object form. Any
 * other options (`where`, `order`, `skip`, `take`, …) are preserved untouched.
 *
 * Use this at TypeORM data-access boundaries (repository / query-builder calls) that must not receive
 * the legacy `string[]` syntax now that the TypeORM patch is removed. The MikroORM path does NOT need
 * this — {@link flatten} already accepts both forms — so callers should convert only on the TypeORM
 * branch to keep MikroORM behaviour identical.
 *
 * @param options - The find-options to normalize. `null`/`undefined` is returned unchanged.
 * @returns A normalized shallow copy, or the original value when there is nothing to convert.
 */
export function parseTypeORMFindOptions<T, O extends { relations?: any; select?: any }>(options: O): O {
	if (!options || typeof options !== 'object') {
		return options;
	}

	const hasArrayRelations = Array.isArray(options.relations);
	const hasArraySelect = Array.isArray(options.select);

	if (!hasArrayRelations && !hasArraySelect) {
		return options;
	}

	return {
		...options,
		...(hasArrayRelations ? { relations: stringArrayToFindOptionsObject(options.relations) } : {}),
		...(hasArraySelect ? { select: stringArrayToFindOptionsObject(options.select) } : {})
	};
}

/**
 * Concatenate an ID to the given MikroORM where condition.
 *
 * @param id - The ID to concatenate to the where condition.
 * @param where - MikroORM where condition.
 * @returns Concatenated MikroORM where condition.
 */
export function concatIdToWhere<T>(id: any, where: MikroFilterQuery<T>): MikroFilterQuery<T> {
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

/**
 * Adds 'tenantId' to a 'where' clause, supporting both objects and arrays.
 *
 * @param tenantId - The tenant ID to add.
 * @param where - The current 'where' clause.
 * @returns An updated 'where' clause including the 'tenantId'.
 */
export function enhanceWhereWithTenantId<T>(tenantId: any, where: MikroFilterQuery<T>): MikroFilterQuery<T> {
	if (Array.isArray(where)) {
		// Merge tenantId into each object of the array
		return where.map((condition) => ({ ...condition, tenantId }));
	} else {
		// Merge where with tenantId if where is an object
		return { ...where, tenantId };
	}
}

/**
 * Convert TypeORM's FindManyOptions to MikroORM's equivalent options.
 *
 * @param options - TypeORM's FindManyOptions.
 * @returns An object with MikroORM's where and options.
 */
export function parseTypeORMFindToMikroOrm<T>(options: LegacyFindManyOptions<any>): {
	where: MikroFilterQuery<T>;
	mikroOptions: MikroORMFindOptions<T, any, any, any>;
} {
	// The parameter accepts the legacy string-array `relations`/`select` form: the MikroORM path
	// consumes both forms natively (see `flatten`), so no conversion is applied here.
	const mikroOptions: MikroORMFindOptions<T, any, any, any> = {
		disableIdentityMap: true,
		populate: []
	};
	let where: MikroFilterQuery<T> = {};

	// Parses TypeORM `where` option to MikroORM `where` option
	if (options && options.where) {
		where = convertTypeORMWhereToMikroORM(options.where as MikroFilterQuery<T>);
	}

	// Parses TypeORM `select` option to MikroORM `fields` option
	if (options && options.select) {
		mikroOptions.fields = flatten(options.select) as string[];
	}

	// Parses TypeORM `relations` option to MikroORM `populate` option
	if (options && options.relations) {
		mikroOptions.populate = flatten(options.relations) as string[];
	}

	// Parses TypeORM `order` option to MikroORM `orderBy` option
	if (options && options.order) {
		mikroOptions.orderBy = parseOrderOptions(options.order) as OrderDefinition<T>;
	}

	// Parses TypeORM `skip` option to MikroORM `offset` option
	if (options && options.skip) {
		mikroOptions.offset = options.take * (options.skip - 1);
	}

	// Parses TypeORM `take` option to MikroORM `limit` option
	if (options && options.take) {
		mikroOptions.limit = options.take;
	}

	// If options contain 'withDeleted', add the SOFT_DELETABLE_FILTER to existing filters
	if (options && options.withDeleted) {
		mikroOptions.filters = { [SOFT_DELETABLE_FILTER]: false };
	}

	return { where, mikroOptions };
}

/**
 * Parses TypeORM 'order' option to MikroORM 'orderBy' option.
 * @param order TypeORM 'order' option
 * @returns Parsed MikroORM 'orderBy' option
 */
export function parseOrderOptions(order: FindOptionsOrder<any>) {
	return Object.entries(order).reduce((acc, [key, value]) => {
		acc[key] = `${value}`.toLowerCase();
		return acc;
	}, {});
}

/**
 * Transforms a FindOperator object into a query condition suitable for database operations.
 * It handles simple conditions such as 'equal', 'in' and 'between',
 * as well as complex conditions like recursive 'not' operators and range queries with 'between'.
 *
 * @param operator A FindOperator object containing the type of condition and its corresponding value.
 * @returns A query condition in the format of a Record<string, any> that represents the translated condition.
 *
 */
export function processFindOperator<T>(operator: FindOperator<T>) {
	switch (operator.type) {
		case 'isNull': {
			return null;
		}
		case 'not': {
			// If the nested value is also a FindOperator, process it recursively
			if (operator.child && operator.child instanceof FindOperator) {
				return { $ne: processFindOperator(operator.child) };
			} else {
				const nested = operator.value || null;
				return { $ne: nested };
			}
		}
		case 'in': {
			return { $in: operator.value };
		}
		case 'equal': {
			return { $eq: operator.value };
		}
		case 'between': {
			// Assuming the value for 'between' is an array with two elements
			return {
				$gte: operator.value[0],
				$lte: operator.value[1]
			};
		}
		case 'moreThanOrEqual': {
			return { $gte: operator.value };
		}
		case 'moreThan': {
			return { $gt: operator.value };
		}
		// Add additional cases for other operator types if needed
		default: {
			// Handle unknown or unimplemented operator types
			console.warn(`Unsupported FindOperator type: ${operator.type}`);
			return {};
		}
	}
}

/**
 * Converts a TypeORM query condition into a format that is compatible with MikroORM.
 * This function recursively processes each condition, handling both simple key-value
 * pairs and complex nested objects including FindOperators.
 *
 * @param where The TypeORM condition to be converted, typically as a filter query object.
 * @returns An object representing the MikroORM compatible condition.
 */
export function convertTypeORMConditionToMikroORM<T>(where: MikroFilterQuery<T>) {
	const mikroORMCondition = {};

	for (const [key, value] of Object.entries(where)) {
		if (typeof value === 'object' && value !== null && !(value instanceof Array)) {
			if (value instanceof FindOperator) {
				// Convert nested FindOperators
				mikroORMCondition[key] = processFindOperator(value);
			} else {
				// Recursively convert nested objects
				mikroORMCondition[key] = convertTypeORMConditionToMikroORM(value);
			}
		} else {
			// Assign simple key-value pairs directly
			mikroORMCondition[key] = value;
		}
	}

	return mikroORMCondition;
}

/**
 * Converts TypeORM 'where' conditions into a format compatible with MikroORM.
 * This function can handle both individual condition objects and arrays of conditions,
 * applying the necessary conversion to each condition.
 *
 * @param where The TypeORM 'where' condition or an array of conditions to be converted.
 * @returns A MikroORM compatible condition or array of conditions.
 */
export function convertTypeORMWhereToMikroORM<T>(where: MikroFilterQuery<T>) {
	// If 'where' is an array, process each condition in the array
	if (Array.isArray(where)) {
		return where.map((condition: MikroFilterQuery<T>) => convertTypeORMConditionToMikroORM(condition));
	}
	// Otherwise, just convert the single condition object
	return convertTypeORMConditionToMikroORM(where);
}

/**
 * Serializes the provided entity based on the ORM type.
 * @param entity The entity to be serialized.
 * @returns The serialized entity.
 */
export function wrapSerialize<T extends object>(entity: T): T {
	// If using MikroORM, use wrap(entity).toJSON() for serialization
	return wrap(entity).toJSON() as T;
}

/**
 * Converts the given entity instance to a plain object.
 *
 * This function creates a shallow copy of the entity, retaining its properties as a plain object,
 * making it suitable for use in contexts where a non-class representation is required.
 *
 * @param entity - The entity instance to be converted to a plain object.
 * @returns A plain object representation of the given entity instance.
 */
export function toPlain(entity: any): Record<string, any> {
	return { ...entity };
}

/**
 * Converts the given entity instance to a JSON object.
 *
 * This function creates a deep copy of the entity, converting it into a JSON-compatible structure,
 * making it suitable for serialization or transferring over a network.
 *
 * @param entity - The entity instance to be converted to a JSON object.
 * @returns A JSON representation of the given entity instance.
 */
export function toJSON(entity: any): Record<string, any> {
	return JSON.parse(JSON.stringify(toPlain(entity)));
}

/**
 * Replace $ placeholders with ? for mysql, sqlite, and better-sqlite3
 * @param query - The SQL query with $ placeholders
 * @param dbType - The database type
 * @returns The SQL query with ? placeholders if applicable
 */
export function replacePlaceholders(query: string, dbType: DatabaseTypeEnum): string {
	if ([DatabaseTypeEnum.sqlite, DatabaseTypeEnum.betterSqlite3, DatabaseTypeEnum.mysql].includes(dbType)) {
		return query.replace(/\$\d+/g, '?');
	}
	if ([DatabaseTypeEnum.mysql].includes(dbType)) {
		// Replace double quotes with backticks for MySQL
		query = query.replace(/"/g, '`');
	}

	return query;
}

/**
 * Retries a given asynchronous query function for a specified number of times.
 *
 * @param query - A function returning a Promise of type T.
 * @param retries - The number of retries allowed (default is 3).
 * @returns A Promise that resolves with the query result if successful.
 * @throws An error if all retries fail.
 */
export async function retryQuery<T>(query: () => Promise<T>, retries = 3): Promise<T> {
	try {
		return await query();
	} catch (error) {
		if (retries > 0) {
			await new Promise((resolve) => setTimeout(resolve, 1000));
			return retryQuery(query, retries - 1);
		}

		throw new Error(`Failed to fetch data: ${error?.message}`, error);
	}
}

/**
 * Whether the API runs as a development instance: NODE_ENV=development on a non-production build.
 * Both checks are needed because NODE_ENV is a runtime setting while `environment.production`
 * is fixed at build time. Use it to keep developer-only diagnostics out of staging and production.
 */
export function isDevelopment(): boolean {
	return process.env.NODE_ENV === 'development' && !environment.production;
}
