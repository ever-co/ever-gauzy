import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
    name: 'ngxPlural',
    standalone: false
})
export class PluralPipe implements PipeTransform {
	/**
	 * Pluralizes a word based on a number
	 *
	 * @param input Number to pluralize
	 * @param label Singular form of the word
	 * @param pluralLabel Plural form of the word
	 * @return Pluralized word
	 */
	transform(input: number, label: string, pluralLabel: string = ''): string {
		input = input || 0;
		return input === 1 ? `${input} ${label}` : pluralLabel ? `${input} ${pluralLabel}` : `${input} ${label}s`;
	}
}
