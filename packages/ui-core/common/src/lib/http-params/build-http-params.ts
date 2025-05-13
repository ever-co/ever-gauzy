import { HttpParams } from '@angular/common/http';
import { CustomHttpParamEncoder } from './custom-http-param-encoder'; // Correct path

/**
 * Builds HttpParams from a nested object or array recursively.
 */
export function buildHttpParams(query: any, prefix: string = ''): HttpParams {
	let params = new HttpParams({ encoder: new CustomHttpParamEncoder() });
	return addToParams(params, query, prefix);
}

/**
 * Recursively adds query parameters to HttpParams.
 *
 * @param params - HttpParams to add query parameters to
 * @param query - Nested object or array to add query parameters from
 * @param prefix - Prefix for the query parameters
 * @returns HttpParams with query parameters added
 */
function addToParams(params: HttpParams, query: any, prefix: string): HttpParams {
	Object.entries(query).forEach(([key, value]) => {
		const paramKey = prefix ? `${prefix}[${key}]` : key;

		if (value === null || value === undefined) {
			// Skip null or undefined values
			return;
		}

		if (Array.isArray(value)) {
			// Append each array item individually
			value.forEach((item) => {
				if (typeof item === 'object') {
					params = addToParams(params, item, paramKey);
				} else {
					params = params.append(paramKey, item.toString());
				}
			});
		} else if (typeof value === 'object') {
			// Recursively handle nested objects
			params = addToParams(params, value, paramKey);
		} else {
			// Primitive value (string, number, boolean)
			params = params.append(paramKey, value.toString());
		}
	});

	return params;
}
