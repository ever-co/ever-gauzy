import slugify from 'slugify';

/**
 * Check is function .
 * @param item
 * @returns {boolean}
 */
export function isFunction(item: any): boolean {
	return item && typeof item === 'function' && !Array.isArray(item);
}

/**
 * Simple object check.
 * @param item
 * @returns {boolean}
 * From https://stackoverflow.com/a/34749873/772859
 */
export function isObject(item: any): boolean {
	return item && typeof item === 'object' && !Array.isArray(item);
}

/**
 * Check is object or function.
 * @param item
 * @returns {boolean}
 */
export function isObjectOrFunction(item: any): boolean {
	return isFunction(item) || isObject(item);
}

/**
 * Check is class instance.
 * @param item
 * @returns {boolean}
 */
export function isClassInstance(item: any): boolean {
	return isObject(item) && item.constructor.name !== 'Object';
}

/**
 * Check value not empty.
 * @param item
 * @returns {boolean}
 */
export function isNotEmpty(item: any): boolean {
	return !isEmpty(item);
}

/**
 * Check value empty.
 * @param item
 * @returns {boolean}
 */
export function isEmpty(item: any) {
	if (item instanceof Array) {
		item = item.filter((val) => !isEmpty(val));
		return item.length === 0;
	} else if (item && typeof item === 'object') {
		for (var key in item) {
			if (item[key] === null || item[key] === undefined || item[key] === '') {
				delete item[key];
			}
		}
		return Object.keys(item).length === 0;
	} else {
		return !item || (item + '').toLocaleLowerCase() === 'null' || (item + '').toLocaleLowerCase() === 'undefined';
	}
}

export function isJsObject(object: any) {
	return object !== null && object !== undefined && typeof object === 'object';
}

/*
 * Get average value column in array object
 */
export function average(items: any, column: string) {
	let sum = 0;
	if (items.length > 0) {
		items.forEach((item) => {
			sum += parseFloat(item[column]);
		});
	}
	return sum / items.length;
}

export const ArraySum = function (t, n) {
	return parseFloat(t) + parseFloat(n);
};

/*
 * Retrieve name from email address
 */
export function retrieveNameFromEmail(email: string): string {
	if (email) {
		return ucFirst(email.substring(0, email.lastIndexOf('@')));
	}
	return;
}

/*
 * Capitalize the first letter of a string being
 */
export function ucFirst(str: string, force: boolean = true): string {
	str = force ? str.toLowerCase() : str;
	return str.replace(/(\b)([a-zA-Z])/, function (firstLetter: string) {
		return firstLetter.toUpperCase();
	});
}

/**
 * Remove duplicates from an array
 *
 * @param data
 * @returns
 */
export function removeDuplicates(data: string[]) {
	return [...new Set(data)];
}

/**
 * Check string is null or undefined
 * From https://github.com/typeorm/typeorm/issues/873#issuecomment-502294597
 *
 * @param obj
 * @returns
 */
export function isNullOrUndefined<T>(value: T | null | undefined): value is null | undefined {
	return value === undefined || value === null;
}

/**
 * Checks if a value is not null or undefined.
 * @param value The value to be checked.
 * @returns true if the value is not null or undefined, false otherwise.
 */
export function isNotNullOrUndefined<T>(value: T | undefined | null): value is T {
	return value !== undefined && value !== null;
}

/**
 * Split the `items` array into multiple, smaller arrays of the given `size`.
 *
 * @param {Array} items
 * @param {Number} size
 *
 * @returns {Array[]}
 */
export function chunks(items: any[], size: number): any[] {
	const chunks = [];
	items = [].concat(...items);
	while (items.length) {
		chunks.push(items.splice(0, size));
	}
	return chunks;
}

/**
 * Parses the given value and converts it to a boolean using JSON.parse.
 *
 * @param value - The value to be parsed.
 * @returns {boolean} - The boolean representation of the parsed value.
 */
export const parseToBoolean = (value: any): boolean => Boolean(JSON.parse(value));

/**
 * Generate slug from string value
 *
 * @param string
 * @param replacement
 * @returns {string}
 */
export function sluggable(string: string, replacement: any = '-'): string {
	return slugify(string, {
		replacement: replacement, // replace spaces with replacement character, defaults to `-`
		remove: /[*+~()'"!:@,.]/g, // remove characters that match regex, defaults to `undefined`
		lower: true, // convert to lower case, defaults to `false`
		trim: true // trim leading and trailing replacement chars, defaults to `true`
	}).replace(/[_]/g, replacement);
}

/**
 * How To Make A Sleep Function In TypeScript?
 *
 * @param ms
 * @returns
 */
export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Trim a string value and return it if not empty, otherwise return undefined
 * @param value - The string value to trim
 * @returns Trimmed string value or undefined if empty
 */
export const trimAndGetValue = (value?: string): string | undefined => {
	return isNotEmpty(value) ? value.trim() : undefined;
};

/**
 * Adds "http://" prefix to a URL if it's missing.
 * @param url - The URL to ensure has the "http://" prefix.
 * @returns The URL with the "http://" prefix.
 */
export const addHttpsPrefix = (url: string, prefix = 'https'): string => {
	if (url && !url.startsWith('http://') && !url.startsWith('https://')) {
		return `${prefix}://${url}`;
	}

	return url;
};
