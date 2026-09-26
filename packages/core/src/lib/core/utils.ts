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
import { parseToBoolean } from '@gauzy/utils';
import { getConfig, DatabaseTypeEnum } from '@gauzy/config';
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
 * Resolves the time zone a report groups its dates by.
 *
 * `moment().tz(undefined)` and `moment().tz('')` return `undefined` instead of a moment, so a request
 * without a time zone turns the next `.format()` into "Cannot read properties of undefined". Falls back
 * to the server zone, the same default the group-by command handlers use, so the day buckets of a report
 * and the keys its rows are grouped under always come from one and the same zone.
 *
 * An unknown zone name is passed through: moment-timezone logs it and leaves the moment in UTC, which is
 * what it did before this helper existed.
 *
 * @param timeZone - The time zone named by the request, if any.
 * @returns A usable time zone name.
 */
export function resolveTimeZone(timeZone?: string): string {
	return typeof timeZone === 'string' && timeZone.trim() !== '' ? timeZone : moment.tz.guess();
}

/**
 * Get all dates between two dates using Moment.js.
 *
 * @param startDate - The start date.
 * @param endDate - The end date.
 * @param timeZone - The time zone to build the days in; defaults to the server zone.
 * @returns An array of string representations of dates.
 */
export function getDaysBetweenDates(startDate: string | Date, endDate: string | Date, timeZone?: string): string[] {
	timeZone = resolveTimeZone(timeZone);
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
		case MultiORMEnum.MikroORM: {
			// **The configured driver is the class, not an instance.** MikroORM's options state
			// `driver: BetterSqliteDriver`, so an `instanceof` test never matched and every caller — the seeder's
			// clean step, every raw-SQL dialect branch that asks this — was told Postgres on SQLite and MySQL:
			// the seeder then sent `TRUNCATE … RESTART IDENTITY CASCADE` to SQLite. The driver is recognised as
			// the class or an instance, and options shaped like TypeORM's (which callers pass, since
			// `dbConnectionOptions` is the TypeORM configuration) are read by the dialect they name.
			const driver = (dbConnection as { driver?: unknown })?.driver;
			const isDriver = (candidate: Function): boolean =>
				!!driver &&
				(driver === candidate ||
					driver instanceof candidate ||
					(typeof driver === 'function' && driver.prototype instanceof candidate));

			if (isDriver(BetterSqliteDriver)) {
				dbType = DatabaseTypeEnum.betterSqlite3;
			} else if (isDriver(PostgreSqlDriver)) {
				dbType = DatabaseTypeEnum.postgres;
			} else if (isDriver(MySqlDriver)) {
				dbType = DatabaseTypeEnum.mysql;
			} else {
				dbType = (dbConnection as TypeOrmModuleOptions)?.type ?? DatabaseTypeEnum.postgres;
			}
			break;
		}

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
		// A key whose value is falsy (`{ tags: false }`) names nothing and is skipped. It used to end the reduction's
		// accumulator (the callback answered `undefined`), so the next key threw on `undefined.concat` — and a nested
		// object naming several keys (`{ kind: { owner: true, labels: true } }`) became the one path
		// `kind.owner.labels` rather than `kind.owner` and `kind.labels`, a path neither ORM can resolve.
		return Object.keys(input).reduce((acc: string[], key) => {
			const value = input[key];
			if (!value) {
				return acc;
			}
			if (Array.isArray(value)) {
				return acc.concat(key);
			}
			const nestedKeys: string[] = flatten(value);
			return acc.concat(nestedKeys.length > 0 ? nestedKeys.map((nested) => `${key}.${nested}`) : [key]);
		}, []);
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
 * Maximum depth of a client-supplied `relations` value: both how deeply the structure may nest and
 * how many segments one relation path may carry, whichever way the path was spelled (nested keys, a
 * dotted string, or a mixture).
 *
 * The bound exists to keep a hostile payload from exhausting the stack (a body nested thousands of
 * levels deep) or burning CPU on a single enormous dotted path, whose every growing prefix would
 * otherwise be copied and stored. No real entity graph — and no entry in a sensitive-relation
 * config — comes anywhere near it, and TypeORM itself rejects a path whose hops do not exist.
 *
 * Exceeding it is REFUSED rather than truncated. Truncating would hand the caller the paths collected
 * so far while the ORM still joined the whole structure it was given — the relations past the bound
 * would be loaded without ever being offered to a permission check. Since `organization` and the
 * back-relation every `TenantOrganizationBaseEntity` carries form a cycle
 * (`organization.tags.organization.tags…`), an attacker can chain real hops until the bound is
 * reached and hang a protected relation off the far end, so "too deep to check" must mean "refused",
 * not "allowed".
 */
const MAX_RELATION_PATH_DEPTH = 20;

/**
 * How {@link collectRelationPaths} reads an object-form leaf.
 *
 * - `authorize` emits a key WHATEVER its leaf value is. A permission check that cannot interpret a
 *   leaf must fail closed, not skip the relation.
 * - `orm` emits a key only when TypeORM itself would join it: a leaf of `true` or an object, which is
 *   exactly what `SelectQueryBuilder.buildRelations` joins. `{ payments: false }`, and the
 *   `{ payments: 'x' }` a query string produces, name a relation the ORM would NOT load, so rebuilding
 *   them as `true` would widen the query the caller asked for.
 */
type RelationPathMode = 'authorize' | 'orm';

/**
 * Appends one dot-notated relation fragment to `prefix`, adding EVERY intermediate prefix to `paths`.
 *
 * `appendRelationPath('organization', 1, 'payments.invoice', paths)` records `organization.payments`
 * and `organization.payments.invoice`, so a permission lookup matches at whatever depth the config
 * declares the relation.
 *
 * @param prefix - The already canonicalized parent path (`''` at the root).
 * @param prefixSegments - How many segments `prefix` carries.
 * @param fragment - A single relation fragment, possibly itself dot-notated.
 * @param paths - The accumulator every emitted path is added to.
 * @returns The full path for `fragment` with its segment count, or `null` when the fragment is empty.
 * @throws BadRequestException when a segment is prototype-polluting, or when the full path would carry
 *         more than {@link MAX_RELATION_PATH_DEPTH} segments.
 */
function appendRelationPath(
	prefix: string,
	prefixSegments: number,
	fragment: string,
	paths: Set<string>
): { path: string; segments: number } | null {
	const segments = fragment.split('.').filter((segment: string) => segment.length > 0);

	// An empty fragment names nothing.
	if (segments.length === 0) {
		return null;
	}

	// A prototype-polluting segment must never become an object key (the value can originate from an
	// untrusted API `relations` param). It is refused rather than dropped: the checks built on this
	// walk do not rewrite the value they inspect, so a dropped branch would still reach the ORM
	// without ever having been offered to the check.
	if (segments.some((segment: string) => UNSAFE_FIND_OPTION_SEGMENTS.has(segment))) {
		throw new BadRequestException(`The 'relations' option contains an invalid relation name.`);
	}

	// Checked before any prefix is built, so an enormous dotted string costs one split rather than a
	// quadratic series of ever longer copies.
	if (prefixSegments + segments.length > MAX_RELATION_PATH_DEPTH) {
		throw new BadRequestException(
			`A relation path in the 'relations' option may not be longer than ${MAX_RELATION_PATH_DEPTH} segments.`
		);
	}

	let path = prefix;
	for (const segment of segments) {
		path = path ? `${path}.${segment}` : segment;
		paths.add(path);
	}
	return { path, segments: prefixSegments + segments.length };
}

/**
 * Depth-first walk behind {@link normalizeRelationsToPaths} and {@link canonicalizeFindOptionsRelations}.
 *
 * @param value - The (sub-)structure to canonicalize.
 * @param prefix - The canonicalized path of the parent key (`''` at the root).
 * @param prefixSegments - How many segments `prefix` carries.
 * @param paths - The accumulator every emitted path is added to.
 * @param depth - The current recursion depth.
 * @param mode - How an object-form leaf is read; see {@link RelationPathMode}.
 * @throws BadRequestException when the structure nests deeper, or a path runs longer, than
 *         {@link MAX_RELATION_PATH_DEPTH}, or when a relation name is prototype-polluting.
 */
function collectRelationPaths(
	value: unknown,
	prefix: string,
	prefixSegments: number,
	paths: Set<string>,
	depth: number,
	mode: RelationPathMode
): void {
	// Fail closed: see MAX_RELATION_PATH_DEPTH. Returning the paths gathered so far would authorize a
	// prefix of the request while the ORM joined all of it.
	if (depth > MAX_RELATION_PATH_DEPTH) {
		throw new BadRequestException(
			`The 'relations' option may not nest deeper than ${MAX_RELATION_PATH_DEPTH} levels.`
		);
	}

	if (value === null || value === undefined) {
		return;
	}

	// A string is a relation path (or a comma-separated list of them).
	if (typeof value === 'string') {
		for (const fragment of value.split(',')) {
			appendRelationPath(prefix, prefixSegments, fragment.trim(), paths);
		}
		return;
	}

	// An array holds further relation values: strings, or objects (`[{ organization: { payments: true } }]`).
	if (Array.isArray(value)) {
		for (const entry of value) {
			collectRelationPaths(entry, prefix, prefixSegments, paths, depth + 1, mode);
		}
		return;
	}

	if (typeof value === 'object') {
		for (const key of Object.keys(value)) {
			const child = (value as Record<string, unknown>)[key];

			// Only objects and arrays carry further relation names; a scalar leaf (`true`, `'x'`, `1`)
			// terminates the path. In `authorize` mode the path is emitted REGARDLESS of that leaf's
			// value; in `orm` mode only for a leaf TypeORM would join. See RelationPathMode.
			if (mode === 'orm' && child !== true && typeof child !== 'object') {
				continue;
			}

			const appended = appendRelationPath(prefix, prefixSegments, key, paths);

			// An empty key names nothing, and neither does anything under it.
			if (appended === null) {
				continue;
			}

			if (child !== null && typeof child === 'object') {
				collectRelationPaths(child, appended.path, appended.segments, paths, depth + 1, mode);
			}
		}
	}

	// Numbers, booleans and functions name no relation.
}

/**
 * Canonicalizes ANY representation of a `relations` find-option into dot-notated relation paths.
 *
 * A `relations` value reaches the API in several shapes and they must all be understood identically
 * by whatever authorizes the read, because TypeORM understands them all when it JOINs:
 *
 * - a comma-separated string — `'organization,organization.payments'`
 * - the legacy string array — `['organization.payments']` (what the Angular clients send as
 *   `relations[0]=organization.payments`)
 * - TypeORM v1 object form — `{ organization: { payments: true } }`, which Express's extended query
 *   parser produces from `?relations[organization][payments]=x`
 * - and any mixture of the above (`[{ organization: { payments: true } }, 'tags']`)
 *
 * Reading only two of those shapes is exactly how `SensitiveRelationsInterceptor` was bypassed
 * (GHSA-c3cj-m3xm-7j5h): an object-form `relations` normalised to an empty list, so its permission
 * loop ran zero times while TypeORM still joined and selected the protected rows.
 *
 * Every intermediate prefix is emitted (`organization`, `organization.payments`,
 * `organization.payments.invoice`) so a config lookup matches at whatever depth it declares a
 * relation, and the walk fails CLOSED: a key is emitted whatever its leaf value is (even `false`,
 * which TypeORM would not join, since over-asking is the safe direction for a check), and input the
 * walk cannot faithfully read is refused outright.
 *
 * @param relations - The `relations` value in any of the shapes above.
 * @returns The de-duplicated dot-notated relation paths, including every prefix.
 * @throws BadRequestException when the structure nests deeper, or a single path runs longer, than
 *         {@link MAX_RELATION_PATH_DEPTH}, or when a relation name is prototype-polluting
 *         (`__proto__`, `prototype`, `constructor`); such input is refused, never partially accepted.
 */
export function normalizeRelationsToPaths(relations: unknown): string[] {
	const paths = new Set<string>();
	collectRelationPaths(relations, '', 0, paths, 0, 'authorize');
	return Array.from(paths);
}

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
 * Canonicalizes an untrusted `relations` value (string / array / nested object / any mixture) into
 * the single nested-object form TypeORM v1 consumes.
 *
 * Use this wherever a `relations` option crosses the trust boundary — a DTO transform, for example —
 * so that the shape an authorization check inspects downstream is the shape the ORM will join.
 *
 * The conversion never loads anything the ORM would not have loaded from the original value: an
 * object-form key is kept only when its leaf is `true` or an object, which is what TypeORM joins, so
 * `{ payments: false }` or a query-string `{ payments: 'x' }` is dropped rather than rebuilt as `true`.
 * Any string or string-array path is kept as named.
 *
 * @param relations - The `relations` value in any representation.
 * @returns The canonical object form, or `undefined` when no `relations` value was supplied.
 * @throws BadRequestException on the same input {@link normalizeRelationsToPaths} refuses.
 */
export function canonicalizeFindOptionsRelations<T = unknown>(relations: unknown): FindOptionsRelations<T> | undefined {
	if (relations === null || relations === undefined) {
		return undefined;
	}
	const paths = new Set<string>();
	collectRelationPaths(relations, '', 0, paths, 0, 'orm');
	return stringArrayToFindOptionsObject(Array.from(paths)) as FindOptionsRelations<T>;
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

	// If options state 'withDeleted', lift the SOFT_DELETABLE_FILTER. Read as the boolean it states: a raw
	// query delivers `?withDeleted=false` as the string 'false', which a truthiness test read as true.
	if (options && parseToBoolean(options.withDeleted)) {
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
 *
 * **Every operator TypeORM can produce is translated, and one it cannot express is refused rather
 * than dropped.** The reason is what an untranslated operator used to mean: the default branch
 * warned to the console and answered `{}`, and an empty condition on a property is not a narrower
 * read — it is *no condition at all*. So under `DB_ORM=mikro-orm` a sweep predicated on
 * `LessThan(expiresAt)` selected every row in the table, a search predicated on `Like('%term%')`
 * matched everything, and a tax read predicated on an effective-date range returned rates that are
 * not in force. The read succeeded, returned rows, and was wrong — which is the failure that costs
 * the most to find, because nothing anywhere reports it.
 *
 * `raw` and `jsonContains` have no MikroORM equivalent at all: the first is a SQL fragment the other
 * ORM never sees, and the second is a dialect-specific JSON predicate. Both raise, because a caller
 * that reaches one of them on this ORM has to be told, and telling it by returning every row is not
 * telling it.
 *
 * @param operator A FindOperator object containing the type of condition and its corresponding value.
 * @returns A query condition in the format of a Record<string, any> that represents the translated condition.
 * @throws Error when the operator has no MikroORM equivalent, rather than widening the read.
 */
/**
 * Marks the parts of an `And(...)` that state the same operator, which `processFindOperator` cannot fold into one
 * object; `convertTypeORMConditionToMikroORM` states each at the entity level.
 */
const AND_PARTS = '__andParts';

export function processFindOperator<T>(operator: FindOperator<T>) {
	switch (operator.type) {
		case 'isNull': {
			return null;
		}
		case 'not': {
			// If the nested value is also a FindOperator, process it recursively
			if (operator.child && operator.child instanceof FindOperator) {
				const child = processFindOperator(operator.child);

				// `Not(IsNull())` is `$ne: null`, and so is `Not(<scalar>)`. A child that translated to a
				// condition *object* — `Not(In([...]))`, `Not(Like('%x%'))` — is negated with `$not`:
				// `{ $ne: { $in: [...] } }` compares the column against an object and matches nothing.
				// MikroORM negates a condition only at the entity level, so `convertTypeORMConditionToMikroORM`
				// lifts this `$not` off the property before the statement is built.
				// `Not(Not(x))` is `x`: negating the negation keeps it off the property, where MikroORM refuses it.
				if (child !== null && typeof child === 'object' && Object.keys(child).length === 1 && '$not' in child) {
					return (child as { $not: unknown }).$not;
				}
				return child !== null && typeof child === 'object' ? { $not: child } : { $ne: child };
			}

			// `|| null` here turned `Not(0)`, `Not(false)` and `Not('')` into `IS NOT NULL`, which is a
			// different question and one that is true for almost every row.
			return { $ne: operator.value === undefined ? null : operator.value };
		}
		case 'in': {
			return { $in: operator.value };
		}
		case 'any': {
			// `Any([...])` is `= ANY(array)`, which is membership — the same question `$in` asks.
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
		case 'lessThanOrEqual': {
			return { $lte: operator.value };
		}
		case 'lessThan': {
			return { $lt: operator.value };
		}
		case 'like': {
			// The caller's value already carries its own `%` wildcards, in both ORMs.
			return { $like: operator.value };
		}
		case 'ilike': {
			return { $ilike: operator.value };
		}
		case 'arrayContains': {
			return { $contains: operator.value };
		}
		case 'arrayContainedBy': {
			return { $contained: operator.value };
		}
		case 'arrayOverlap': {
			return { $overlap: operator.value };
		}
		case 'and': {
			// `And(a, b)` is several conditions on one property, which MikroORM spells as one object
			// carrying both — `{ $gte: 1, $lte: 5 }` — rather than as a list.
			const parts = (Array.isArray(operator.value) ? operator.value : [operator.value]).map((part: unknown) =>
				part instanceof FindOperator ? processFindOperator(part) : { $eq: part }
			);

			// Parts that state the same operator (`And(Not(1), Not(4))`, `And(MoreThan(3), MoreThan(1))`) cannot share one
			// object: merged, the last one replaced the others and the read asked a different question. They are kept as
			// a list instead, which `convertTypeORMConditionToMikroORM` states at the entity level, one part each.
			const operators = parts.flatMap((part) => (part && typeof part === 'object' ? Object.keys(part) : []));
			if (new Set(operators).size !== operators.length) {
				return { [AND_PARTS]: parts };
			}

			return Object.assign({}, ...parts);
		}
		default: {
			// `raw` and `jsonContains` land here, and so would any operator a future TypeORM adds. An
			// empty condition would be answered as "every row", so the caller is told instead.
			throw new Error(
				`UNSUPPORTED_FIND_OPERATOR: "${operator.type}" has no MikroORM equivalent, so the read it ` +
					`predicates cannot be translated. Answering it without the predicate would return every ` +
					`row; express the condition with a supported operator, or keep this read on the TypeORM ` +
					`repository.`
			);
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

	// The conditions of this level stated at the entity level: each negation lifted off its property, and each part of an
	// `And(...)` whose parts could not share one object (see below).
	const negations: Record<string, unknown>[] = [];

	for (const [key, value] of Object.entries(where)) {
		if (typeof value === 'object' && value !== null && !(value instanceof Array)) {
			if (value instanceof FindOperator) {
				// Convert nested FindOperators
				const condition = processFindOperator(value);

				// `Not(In([...]))`, `Not(Like('%x%'))`, `Not(MoreThan(n))` translate to `{ $not: <condition> }` on
				// the property, and MikroORM's SQL drivers have no `$not` on a property: knex refuses the whole
				// statement with `The operator "not" is not permitted` — a find, a count, an update and a delete
				// alike. So under `DB_ORM=mikro-orm` every statement predicated on such a negation failed; a role
				// was never deleted (`RoleService.delete` guards the system roles with `Not(In([...]))`), and its
				// name stayed taken. MikroORM negates at the entity level — `{ $not: { name: { $in: [...] } } }`
				// is `not (name in (...))`, the SQL TypeORM writes for `Not(In([...]))` — so the negation is
				// lifted there. Each one is its own `$not` under `$and`: a single `$not` over two properties
				// would negate their conjunction, which is a different question.
				// `And(...)` parts that could not share one object (see `processFindOperator`): each is its own condition
				// on the property, in the entity-level conjunction, and a negated one is lifted like any other.
				const parts =
					condition !== null && typeof condition === 'object' && AND_PARTS in condition
						? ((condition as Record<string, unknown>)[AND_PARTS] as Record<string, unknown>[])
						: [condition as Record<string, unknown>];

				for (const part of parts) {
					if (part !== null && typeof part === 'object' && '$not' in part) {
						const { $not: negated, ...rest } = part as Record<string, unknown>;
						negations.push({ $not: { [key]: negated } });

						// What `And(...)` folded in beside the negation stays on the property.
						if (Object.keys(rest).length > 0) {
							if (parts.length > 1) {
								negations.push({ [key]: rest });
							} else {
								mikroORMCondition[key] = rest;
							}
						}
					} else if (parts.length > 1) {
						negations.push({ [key]: part });
					} else {
						mikroORMCondition[key] = part;
					}
				}
			} else {
				// Recursively convert nested objects
				mikroORMCondition[key] = convertTypeORMConditionToMikroORM(value);
			}
		} else {
			// Assign simple key-value pairs directly
			mikroORMCondition[key] = value;
		}
	}

	if (negations.length > 0) {
		const conjunction = mikroORMCondition['$and'];
		mikroORMCondition['$and'] = [
			...(conjunction === undefined ? [] : Array.isArray(conjunction) ? conjunction : [conjunction]),
			...negations
		];
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
