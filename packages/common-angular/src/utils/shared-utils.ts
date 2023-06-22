import { HttpParams } from '@angular/common/http';
import * as moment from 'moment';
import * as timezone from 'moment-timezone';
import { distinctUntilChanged } from 'rxjs/operators';
import slugify from 'slugify';

// It will use for pass nested object or array in query params in get method.
export function toParams(query) {
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

export function isJsObject(object: any) {
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

export function getContrastColor(hex: string) {
	const threshold = 130;
	const hexToRGB = (h) => {
		const hexValue = h.charAt(0) === '#' ? h.substring(1, 7) : h;
		return {
			red: parseInt(hexValue.substring(0, 2), 16),
			blue: parseInt(hexValue.substring(2, 4), 16),
			green: parseInt(hexValue.substring(4, 6), 16)
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

export function toLocal(date: string | Date | moment.Moment): moment.Moment {
	return moment.utc(date).local();
}

export function toUTC(date: string | Date | moment.Moment): moment.Moment {
	return moment(date).utc();
}

export function distinctUntilChange<T>() {
	try {
		return distinctUntilChanged<T>((a, b) => JSON.stringify(a) === JSON.stringify(b));
	} catch (error) {
		console.log({ error });
	}
}

export const compareDate = (date1: any, date2: any) => {
	const d1 = new Date(date1);
	const d2 = new Date(date2);

	const same = d1.getTime() === d2.getTime();
	if (same) {
		return false;
	}
	return d1 > d2;
};

export function splitCamelCase(word: string): string {
	let output: string[];
	if (typeof word !== 'string') {
		throw new Error('The "word" parameter must be a string.');
	}

	output = [];

	const split = word.split('_');
	split.forEach((text: string) => {
		output.push(ucFirst(text, true));
	});
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
export function cleanKeys(data, deleteKeys) {
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
 *
 * @param row
 * @returns partial employee state
 */

export function employeeMapper(row: any) {
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
