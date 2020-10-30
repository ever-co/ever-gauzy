import { Pipe, PipeTransform } from '@angular/core';
import { isRegExp, isString, isUndefined } from 'underscore';

@Pipe({
	name: 'replace'
})
export class ReplacePipe implements PipeTransform {
	transform(input: any, pattern: any, replacement: any): any {
		if (
			!isString(input) ||
			isUndefined(pattern) ||
			isUndefined(replacement)
		) {
			return input;
		}
		if (isRegExp(pattern)) {
			return input.replace(pattern, replacement);
		} else {
			return this.replaceAll(input, pattern, replacement);
		}
	}

	replaceAll(string, search, replace) {
		return string.split(search).join(replace);
	}
}
