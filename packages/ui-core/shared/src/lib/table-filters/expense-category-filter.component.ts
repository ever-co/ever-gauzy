import { Component, OnChanges, type SimpleChanges, ChangeDetectionStrategy } from '@angular/core';
import { RestorableFilterComponent } from './restorable-filter.component';
import { IExpenseCategory } from '@gauzy/contracts';

@Component({
	selector: 'ga-expense-category-select-filter',
	template: `
		<ga-expense-category-select
			[ngModel]="restored"
			[clearable]="true"
			[searchable]="false"
			[addTag]="false"
			[placeholder]="'SM_TABLE.CATEGORY' | translate"
			(onChanged)="selectedExpenseCategoryEvent($event)"
		></ga-expense-category-select>
	`,
	changeDetection: ChangeDetectionStrategy.Eager,
	standalone: false
})
export class ExpenseCategoryFilterComponent extends RestorableFilterComponent implements OnChanges {
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
		this.applyFilter(value);
	}
}
