import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
	name: 'hash'
})
export class HashNumberPipe implements PipeTransform {
	/**
	 * Transforms a number or string into a hashed string.
	 *
	 * @param {number | string} value - The value to be transformed.
	 * @return {string} The transformed hashed string, or an empty string if the value is falsy or non-numeric.
	 */
	transform(value: number | string): string {
		if (value) {
			const numericValue = isNaN(Number(value)) ? value : Number(value);
			return '#' + numericValue;
		}
		return ''; // Return an empty string for non-numeric or falsy values
	}
}
