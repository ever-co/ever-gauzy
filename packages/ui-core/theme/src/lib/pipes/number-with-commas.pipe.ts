import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
    name: 'ngxNumberWithCommas',
    standalone: false
})
export class NumberWithCommasPipe implements PipeTransform {
	/**
	 * Formats a number with commas
	 *
	 * @param input Number to format
	 * @return Formatted number
	 */
	transform(input: number): string {
		return new Intl.NumberFormat().format(input);
	}
}
