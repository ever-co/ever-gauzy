import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { RecurringExpenseModel } from '@gauzy/models';
import { TranslateService } from '@ngx-translate/core';
import { monthNames } from '../../../@core/utils/date';
import { TranslationBaseComponent } from '../../language-base/translation-base.component';

@Component({
	selector: 'ga-recurring-expense-history',
	templateUrl: './recurring-expense-history.component.html',
	styleUrls: ['./recurring-expense-history.component.scss']
})
export class RecurringExpenseHistoryComponent extends TranslationBaseComponent
	implements OnInit {
	@Input()
	recordsData: RecurringExpenseModel[] = [];

	@Output()
	closeHistory = new EventEmitter<void>();

	constructor(readonly translateService: TranslateService) {
		super(translateService);
	}

	emitClose = () => {
		this.closeHistory.emit();
	};

	ngOnInit() {}

	getMonthString(month: number) {
		return monthNames[month];
	}
}
