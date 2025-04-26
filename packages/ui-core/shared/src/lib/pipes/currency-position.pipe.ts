import { Pipe, PipeTransform } from '@angular/core';
import { CurrencyPosition } from '@gauzy/contracts';

@Pipe({
    name: 'position',
    standalone: false
})
export class CurrencyPositionPipe implements PipeTransform {
	/**
	 * Transforms the given data string based on the specified position.
	 *
	 * @param {string} data - The data string to be transformed.
	 * @param {string} position - The position to determine the transformation.
	 * @return {string} The transformed data string.
	 */
	transform(data: string, position: string): string {
		let val = data;
		const extracted = this.extract(data);
		switch (position) {
			case CurrencyPosition.LEFT:
				val = extracted[0] + ' ' + extracted[1];
				break;
			case CurrencyPosition.RIGHT:
				val = extracted[1] + ' ' + extracted[0];
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
