import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
	name: 'filterArray',
	pure: false
})
export class FilterArrayPipe implements PipeTransform {
	/**
	 * Filters an array of values based on the provided input array.
	 *
	 * @param {any[]} values - The array of values to filter.
	 * @param {string[]} input - The array of strings to use for filtering.
	 * @return {any[]} The filtered array of values.
	 */
	transform(values: any, input: string[]): any {
		let output = [];
		if (input && input.length > 0) {
			values.forEach((value) => {
				if (input.indexOf(value.id) !== -1) output.push(value);
			});
		}
		return output;
	}
}
