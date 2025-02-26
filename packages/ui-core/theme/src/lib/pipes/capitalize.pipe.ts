import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
    name: 'ngxCapitalize',
    standalone: false
})
export class CapitalizePipe implements PipeTransform {
	/**
	 * Capitalize first letter of every word
	 *
	 * @param input String to capitalize
	 * @return Capitalized string
	 */
	transform(input: string): string {
		return input && input.length ? input.charAt(0).toUpperCase() + input.slice(1).toLowerCase() : input;
	}
}
