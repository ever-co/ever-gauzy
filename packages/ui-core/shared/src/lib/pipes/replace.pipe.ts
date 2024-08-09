import { Pipe, PipeTransform } from '@angular/core';
import { isRegExp, isString, isUndefined } from 'underscore';
import { replaceAll } from '@gauzy/ui-core/common';

@Pipe({
	name: 'replace'
})
export class ReplacePipe implements PipeTransform {
	/**
	 * Transforms the input string by replacing occurrences of the pattern with the replacement.
	 *
	 * @param {any} input - The input string to be transformed.
	 * @param {any} pattern - The pattern to search for in the input string. It can be a string or a regular expression.
	 * @param {any} replacement - The string to replace the pattern with.
	 * @return {any} The transformed input string with the pattern replaced by the replacement string.
	 */
	transform(input: any, pattern: any, replacement: any): any {
		if (!isString(input) || isUndefined(pattern) || isUndefined(replacement)) {
			return input;
		}
		if (isRegExp(pattern)) {
			return input.replace(pattern, replacement);
		} else {
			return replaceAll(input, pattern, replacement);
		}
	}
}
