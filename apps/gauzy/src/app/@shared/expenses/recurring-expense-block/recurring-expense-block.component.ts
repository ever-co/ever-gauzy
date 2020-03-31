import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import {
	Organization,
	RecurringExpenseDefaultCategoriesEnum,
	RecurringExpenseModel
} from '@gauzy/models';
import { TranslateService } from '@ngx-translate/core';
import * as moment from 'moment';
import { defaultDateFormat } from '../../../@core/utils/date';
import { TranslationBaseComponent } from '../../language-base/translation-base.component';

@Component({
	selector: 'ga-recurring-expense-block',
	templateUrl: './recurring-expense-block.component.html',
	styleUrls: ['./recurring-expense-block.component.scss']
})
export class RecurringExpenseBlockComponent extends TranslationBaseComponent
	implements OnInit {
	@Input()
	recurringExpense: RecurringExpenseModel;

	@Input()
	splitExpense?: boolean;

	@Input()
	fetchedHistories: RecurringExpenseModel[];

	@Input()
	selectedOrganization: Organization;

	@Output()
	editRecurringExpense = new EventEmitter<void>();

	@Output()
	deleteRecurringExpense = new EventEmitter<void>();

	@Output()
	fetchRecurringExpenseHistory = new EventEmitter<void>();

	showMenu = false;
	showHistory = false;

	constructor(readonly translateService: TranslateService) {
		super(translateService);
	}

	ngOnInit() {}

	emitEdit() {
		this.editRecurringExpense.emit();
	}

	emitDelete() {
		this.deleteRecurringExpense.emit();
	}

	emitFetchHistory() {
		if (!this.showHistory) {
			this.fetchRecurringExpenseHistory.emit();
			this.showHistory = true;
			this.showMenu = true;
		} else {
			this.showHistory = false;
			this.showMenu = false;
		}
	}

	getStartDate() {
		return this.recurringExpense && this.selectedOrganization
			? moment(this.recurringExpense.startDate).format(
					this.selectedOrganization.dateFormat || defaultDateFormat
			  )
			: '';
	}

	getCategoryName(categoryName: string) {
		return categoryName in RecurringExpenseDefaultCategoriesEnum
			? this.getTranslation(
					`EXPENSES_PAGE.DEFAULT_CATEGORY.${categoryName}`
			  )
			: categoryName;
	}
}
