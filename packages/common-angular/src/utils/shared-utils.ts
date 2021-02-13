import { HttpParams } from '@angular/common/http';

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
