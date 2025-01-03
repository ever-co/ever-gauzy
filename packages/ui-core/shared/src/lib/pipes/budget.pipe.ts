import { CurrencyPipe } from '@angular/common';
import { Pipe, PipeTransform } from '@angular/core';
import { CurrenciesEnum } from '@gauzy/contracts';

@Pipe({
    name: 'budget',
    standalone: false
})
export class JobBudgetPipe implements PipeTransform {
	constructor(private readonly currencyPipe: CurrencyPipe) {}
	/**
	 * Convert string to currency format
	 *
	 * @param budget
	 * @param currency
	 * @returns
	 */
	transform(budget: string, currency: string = CurrenciesEnum.USD): string {
		try {
			const budgets = budget.split('-').map((item: string) => this.currencyPipe.transform(item, currency));
			return budgets.join(' - ');
		} catch (error) {
			console.log('Error while converting string budget', error);
		}
	}
}
