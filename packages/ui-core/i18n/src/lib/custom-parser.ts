import { Injectable } from '@angular/core';
import { TranslateParser } from '@ngx-translate/core';

/**
 * Custom implementation of the TranslateParser.
 */
@Injectable()
export class CustomParser extends TranslateParser {
	/**
	 * Interpolates the given expression with the provided parameters.
	 *
	 * @param expr The expression to interpolate. It can be a string or a function.
	 * @param params The parameters to be used in the interpolation.
	 * @returns The interpolated string.
	 */
	interpolate(expr: string | Function, params?: any): string {
		// If the expression is a function, call it with the parameters.
		if (typeof expr === 'function') {
			return expr(params);
		}

		// Otherwise, replace any placeholder with the corresponding parameter value.
		if (typeof expr === 'string' && params) {
			return expr.replace(/\{\{(.*?)\}\}/g, (match, key) => {
				return params[key.trim()] || match;
			});
		}

		// If no parameters or replacements needed, return the original expression.
		return expr as string;
	}

	/**
	 * Retrieves the value associated with the given key from the target object.
	 *
	 * @param target The target object to retrieve the value from.
	 * @param key The key used to access the value.
	 * @returns The value associated with the key, or undefined if the key does not exist.
	 */
	getValue(target: any, key: string): any {
		// Split the key into parts in case it is a path (e.g., "a.b.c").
		const keys = key.split('.');

		// Reduce the target object using the keys, navigating to the desired value.
		return keys.reduce((result, currentKey) => {
			return result ? result[currentKey] : undefined;
		}, target);
	}
}
