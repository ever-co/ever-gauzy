import { HttpParams } from '@angular/common/http';
import * as moment from 'moment';
import * as timezone from 'moment-timezone';
import { distinctUntilChanged } from 'rxjs/operators';

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

function isJsObject(object: any) {
	return (
		object !== null && object !== undefined && typeof object === 'object'
	);
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
			if (
				item[key] === null ||
				item[key] === undefined ||
				item[key] === ''
			) {
				delete item[key];
			}
		}
		return Object.keys(item).length === 0;
	} else {
		return (
			!item ||
			(item + '').toLocaleLowerCase() === 'null' ||
			(item + '').toLocaleLowerCase() === 'undefined'
		);
	}
}

function toSubParams(params: HttpParams, key: string, object: any) {
	Object.keys(object).forEach((childKey) => {
		if (isJsObject(object[childKey])) {
			params = toSubParams(
				params,
				`${key}[${childKey}]`,
				object[childKey]
			);
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

			// if the property is an object, but not a File, use recursivity.
			if (obj[property] instanceof Date) {
				fd.append(formKey, obj[property].toISOString());
			} else if (
				typeof obj[property] === 'object' &&
				!(obj[property] instanceof File)
			) {
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
	if (value >= 75) {
		return 'success';
	} else if (value >= 50) {
		return 'warning';
	} else if (value >= 25) {
		return 'info';
	} else {
		return 'danger';
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
	return ucFirst(email.substring(0, email.lastIndexOf('@')), true);
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

export function toLocal(data: string | Date | moment.Moment): moment.Moment {
	return moment.utc(data).local();
}

export function toUTC(data: string | Date | moment.Moment): moment.Moment {
	return moment(data).utc();
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
}