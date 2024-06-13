import { Component, OnChanges, SimpleChanges } from '@angular/core';
import { DefaultFilter } from 'angular2-smart-table';
import { IExpenseCategory } from '@gauzy/contracts';

@Component({
	selector: 'ga-expense-category-select-filter',
	template: `
		<ga-expense-category-select
			[clearable]="true"
			[searchable]="false"
			[addTag]="false"
			[placeholder]="'SM_TABLE.CATEGORY' | translate"
			(onChanged)="selectedExpenseCategoryEvent($event)"
		></ga-expense-category-select>
	`
})
export class ExpenseCategoryFilterComponent extends DefaultFilter implements OnChanges {
	constructor() {
		super();
	}

	/**
	 *
	 * @param changes
	 */
	ngOnChanges(changes: SimpleChanges) {}

	/**
	 *
	 * @param value
	 */
	selectedExpenseCategoryEvent(value: IExpenseCategory) {
		this.column.filterFunction(value, this.column.id);
	}
}
