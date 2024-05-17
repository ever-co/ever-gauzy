import { HttpParams } from '@angular/common/http';
import * as moment from 'moment';
import * as timezone from 'moment-timezone';
import { Observable } from 'rxjs';
import { distinctUntilChanged } from 'rxjs/operators';
import slugify from 'slugify';

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

// It will use for pass nested object or array in query params in get method.
export function toParams(query: any) {
	let params: HttpParams = new HttpParams();
	Object.keys(query).forEach((key) => {
		if (isJsObject(query[key])) {
			params = toSubParams(params, key, query[key]);
		} else {
			params = params.append(key.toString(), query[key]);
		}
	});
	return params;
}

/**
 * Checks if the given value is a JavaScript object.
 * @param object The value to check.
 * @returns `true` if the value is a JavaScript object, `false` otherwise.
 */
export function isJsObject(object: any): boolean {
	return object !== null && object !== undefined && typeof object === 'object';
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
export function isEmpty(item: any): boolean {
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

function toSubParams(params: HttpParams, key: string, object: any) {
	Object.keys(object).forEach((childKey) => {
		if (isJsObject(object[childKey])) {
			params = toSubParams(params, `${key}[${childKey}]`, object[childKey]);
		} else {
			params = params.append(`${key}[${childKey}]`, object[childKey]);
		}
	});

	return params;
}

// It will use when file uploading from angular, just pass object of with file it will convert it to from data
export function toFormData(obj: any, form?: any, namespace?: any) {
	const fd = form || new FormData();
	let formKey;
	for (const property in obj) {
		if (obj.hasOwnProperty(property) && obj[property]) {
			if (namespace) {
				formKey = namespace + '[' + property + ']';
			} else {
				formKey = property;
			}

			// if the property is an object, but not a File, use recursively.
			if (obj[property] instanceof Date) {
				fd.append(formKey, obj[property].toISOString());
			} else if (typeof obj[property] === 'object' && !(obj[property] instanceof File)) {
				toFormData(obj[property], fd, formKey);
			} else {
				// if it's a string or a File object
				fd.append(formKey, obj[property]);
			}
		}
	}
	return fd;
}

export function progressStatus(value) {
	if (value <= 25) {
		return 'danger';
	} else if (value <= 50) {
		return 'warning';
	} else if (value <= 75) {
		return 'info';
	} else {
		return 'success';
	}
}

/**
 * Determines the contrasting color (black or white) based on the given hexadecimal color.
 * @param hex The hexadecimal color code (with or without the '#' prefix).
 * @returns The contrasting color ('#000000' for dark backgrounds, '#ffffff' for light backgrounds).
 */
export function getContrastColor(hex: string): string {
	const threshold = 130;
	const hexToRGB = (hex: string) => {
		const hexValue = hex.charAt(0) === '#' ? hex.substring(1, 7) : hex;
		return {
			red: parseInt(hexValue.substring(0, 2), 16),
			green: parseInt(hexValue.substring(2, 4), 16),
			blue: parseInt(hexValue.substring(4, 6), 16)
		};
	};
	const { red, green, blue } = hexToRGB(hex);
	const cBrightness = (red * 299 + green * 587 + blue * 114) / 1000;

	return cBrightness > threshold ? '#000000' : '#ffffff';
}

/**
 * The precision for a decimal (exact numeric applies only for decimal column), which is the maximum
 * number of digits that are stored.
 */
export function convertPrecisionFloatDigit(val: number, digit: number = 6) {
	return parseFloat(parseFloat(val.toString()).toFixed(digit));
}

/*
 * Retrieve name from email address
 */
export function retrieveNameFromEmail(email: string): string {
	if (email) {
		return ucFirst(email.substring(0, email.lastIndexOf('@')), true);
	}
	return;
}

// convert local time to another timezone
export function convertLocalToTimezone(
	localDt: string | Date,
	localDtFormat: string,
	timeZone: string,
	format = 'YYYY-MM-DD hh:mm:ss'
) {
	return timezone(localDt, localDtFormat).tz(timeZone).format(format);
}

/*
 * Capitalize the first letter of a string being
 */
export function ucFirst(str: string, force: boolean): string {
	str = force ? str.toLowerCase() : str;
	return str.replace(/(\b)([a-zA-Z])/, function (firstLetter: string) {
		return firstLetter.toUpperCase();
	});
}

/**
 * Converts the given date to the local timezone.
 * @param date The date to convert to local timezone.
 * @returns A moment object representing the date in the local timezone.
 */
export function toLocal(date: string | Date | moment.Moment): moment.Moment {
	return moment.utc(date).local();
}

/**
 * Converts the given date to the UTC timezone.
 * @param date The date to convert to UTC timezone.
 * @returns A moment object representing the date in UTC timezone.
 */
export function toUTC(date: string | Date | moment.Moment): moment.Moment {
	return moment(date).utc();
}

/**
 * Returns an operator function that filters out consecutive duplicate values in an observable sequence.
 * @returns An operator function that filters out consecutive duplicate values in an observable sequence.
 */
export function distinctUntilChange<T>(): (source: Observable<T>) => Observable<T> {
	return (source: Observable<T>): Observable<T> => {
		return source.pipe(distinctUntilChanged((a, b) => JSON.stringify(a) === JSON.stringify(b)));
	};
}

/**
 * Compares two dates.
 * @param date1 The first date to compare.
 * @param date2 The second date to compare.
 * @returns `true` if `date1` is greater than `date2`, `false` if they are equal or `date1` is less than `date2`.
 */
export const compareDate = (date1: any, date2: any): boolean => {
	const d1 = new Date(date1);
	const d2 = new Date(date2);

	const same = d1.getTime() === d2.getTime();
	if (same) {
		return false;
	}
	return d1 > d2;
};

/**
 * Splits a camelCase or snake_case string into separate words.
 * @param word The input string to split.
 * @returns The input string split into separate words, with each word capitalized.
 * @throws If the input parameter is not a string.
 */
export function splitCamelCase(word: string): string {
	if (typeof word !== 'string') {
		throw new Error('The "word" parameter must be a string.');
	}

	const split = word.split('_');
	const output = split.map((text: string) => ucFirst(text, true));

	return output.join(' ');
}

/**
 * Deep Merge
 *
 * @param target
 * @param sources
 * @returns
 */
export function mergeDeep(target: any, ...sources: any) {
	if (!sources.length) return target;
	const source = sources.shift();

	if (isJsObject(target) && isJsObject(source)) {
		for (const key in source) {
			if (isJsObject(source[key])) {
				if (!target[key])
					Object.assign(target, {
						[key]: {}
					});
				mergeDeep(target[key], source[key]);
			} else {
				Object.assign(target, {
					[key]: source[key]
				});
			}
		}
	}
	return mergeDeep(target, ...sources);
}

/**
 * Delete Keys from nested object
 *
 * @param data
 * @param deleteKeys
 * @returns
 */
export function cleanKeys(data: any, deleteKeys: any) {
	// There is nothing to be done if `data` is not an object,
	if (typeof data != 'object') return;
	if (!data) return; // null object

	for (const key in data) {
		if (deleteKeys.includes(key)) {
			delete data[key];
		} else {
			// If the key is not deleted from the current `data` object,
			// the value should be check for black-listed keys.
			cleanKeys(data[key], deleteKeys);
		}
	}
}

/**
 * Maps a row of employee data to a partial employee state object.
 * @param row The row of employee data to map.
 * @returns A partial employee state object containing 'name', 'fullName', 'id', and 'imageUrl' properties.
 */
export function employeeMapper(row: any): {
	name: string | null;
	fullName: string | null;
	id: string | null;
	imageUrl: string | null;
} {
	return {
		name: row.employee && row.employee.user ? row.employee.fullName : null,
		fullName: row.employee && row.employee.user ? row.employee.fullName : null,
		id: row.employee ? row.employee.id : null,
		imageUrl: row.employee && row.employee.user ? row.employee.user.imageUrl : null
	};
}

/**
 * Adding Trailing Slash In URL
 *
 * "/#/pages/home"
 * console.log(addTrailingSlashIfMissing('#/pages/home'));
 *
 * "/pages/home"
 * console.log(addTrailingSlashIfMissing('pages/home'));
 *
 */
export function addTrailingSlash(str: string) {
	if (!str) {
		return;
	}
	const slashChar = str.startsWith('/') ? '' : '/';
	return slashChar + str;
}

/**
 * Removing Trailing Slash In URL
 *
 * "example.com"
 * console.log(stripTrailingSlash('example.com/'));
 *
 */
export function removeTrailingSlash(str: string) {
	if (!str) {
		return;
	}
	return str.endsWith('/') ? str.replace(/\/+$/, '') : str;
}

/**
 * Prepare external URL
 *
 * @param url
 * @returns
 */
export function __prepareExternalUrlLocation(url: string) {
	return [removeTrailingSlash(location.origin), addTrailingSlash(url)].join('');
}

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
 * It takes a base64 image, compresses it to a given width and height, and returns a promise that
 * resolves to the compressed image
 * @param {string} base64Image - The base64 image string
 * @param {number} width - The width of the image you want to compress.
 * @param {number} height - The height of the image in pixels.
 * @returns A promise that resolves to a string.
 */
export function compressImage(base64Image: string, width: number, height: number): Promise<string> {
	return new Promise((resolve, reject) => {
		const img = new Image();
		img.src = base64Image;
		img.onload = () => {
			const elem = document.createElement('canvas');
			elem.width = width;
			elem.height = height;
			const ctx = elem.getContext('2d');
			ctx.drawImage(img, 0, 0, width, height);
			const data = ctx.canvas.toDataURL();
			resolve(data);
		};
		img.onerror = (error) => reject(error);
	});
}

/**
 * How To Make A Sleep Function In TypeScript?
 *
 * @param ms
 * @returns
 */
export function sleep(ms: number) {
	return new Promise((r) => setTimeout(r, ms));
}

/**
 * Convert an array of objects to an object with specified key-value pairs.
 *
 * @param array - The array of objects.
 * @param key - The property to use as the key in the resulting object.
 * @param value - The property to use as the value in the resulting object.
 * @returns An object with key-value pairs based on the specified properties.
 */
export function arrayToObject<T extends Record<string, any>>(
	array: T[],
	key: keyof T,
	value: keyof T
): Record<string, any> {
	return array.reduce((prev, current) => {
		return {
			...prev,
			[String(current[key])]: current[value]
		};
	}, {});
}

/**
 * Converts a given input into a boolean value.
 * If the input is `undefined` or `null`, it returns `false`.
 *
 * @param value - The input to convert to a boolean.
 * @returns {boolean} - A boolean representation of the given input.
 */
export const parseToBoolean = (value: any): boolean => {
	if (value === undefined || value === null) {
		return false; // Return false for undefined or null
	}

	try {
		const parsed = JSON.parse(value); // Attempt to parse as JSON
		if (typeof parsed === 'boolean') {
			return parsed; // Return if it's already a boolean
		}

		// Convert numbers: 0 is false, other numbers are true
		if (typeof parsed === 'number') {
			return parsed !== 0;
		}

		// Convert common truthy/falsy strings
		if (typeof parsed === 'string') {
			const lowerCase = parsed.toLowerCase().trim();
			return lowerCase === 'true' || lowerCase === '1'; // Consider 'true' and '1' as true
		}

		return Boolean(parsed); // Fallback to Boolean conversion
	} catch (error) {
		// Handle JSON parse errors
		return false; // Return false on parsing errors
	}
};
