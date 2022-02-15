/**
 * Check is function .
 * @param item
 * @returns {boolean}
 */
export function isFunction(item: any): boolean {
	return (item && typeof item === 'function' && !Array.isArray(item));
}

/**
 * Simple object check.
 * @param item
 * @returns {boolean}
 * From https://stackoverflow.com/a/34749873/772859
 */
export function isObject(item: any) {
	return (item && typeof item === 'object' && !Array.isArray(item));
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

export function isJsObject(object: any) {
	return (
		object !== null && object !== undefined && typeof object === 'object'
	);
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
		return ucFirst(email.substring(0, email.lastIndexOf('@')), true);
	}
	return;
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
export function isNullOrUndefined<T>(string: T | null | undefined): string is null | undefined {
	return typeof string === "undefined" || string === null
}