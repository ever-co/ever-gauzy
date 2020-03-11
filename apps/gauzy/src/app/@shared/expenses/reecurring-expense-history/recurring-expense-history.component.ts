import { Component, OnInit, Input } from '@angular/core';
import { RecurringExpenseModel } from '@gauzy/models';
import { TranslateService } from '@ngx-translate/core';
import { LocalDataSource } from 'ng2-smart-table';
import { TranslationBaseComponent } from '../../language-base/translation-base.component';
import { DateViewComponent } from '../../table-components/date-view/date-view.component';
import { IncomeExpenseAmountComponent } from '../../table-components/income-amount/income-amount.component';

@Component({
	selector: 'ga-recurring-expense-history',
	templateUrl: './recurring-expense-history.component.html',
	styleUrls: ['./recurring-expense-history.component.scss']
})
export class RecurringExpenseHistoryComponent extends TranslationBaseComponent
	implements OnInit {
	@Input()
	recordsData: RecurringExpenseModel[] = [];

	constructor(readonly translateService: TranslateService) {
		super(translateService);
	}

	ngOnInit() {}
}
