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

@Pipe({ name: 'position' })
export class CurrencyPositionPipe implements PipeTransform {
	transform(data: string, position: string): string {
		let val = data;
		const extracted = this.extract(data);
		switch (position) {
			case 'LEFT':
				val = extracted[0] + extracted[1];
				break;
			case 'RIGHT':
				val = extracted[1] + extracted[0];
				break;
			default:
				break;
		}
		return val;
	}
	/**
	 * This method extract currency symbol and value
	 * @param data should be a string value of a currency pipe
	 * @returns string
	 */
	extract(data: string): string[] {
		const regex = new RegExp('([^\\d\\.\\,\\s]+)', 'g');
		const currency = regex.exec(data)[0];
		const value = currency && data ? data.replace(currency, '') : '';
		return [currency, value];
	}
}


