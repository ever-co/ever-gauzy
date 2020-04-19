import { Component, OnInit } from '@angular/core';
import {
	RecurringExpenseDefaultCategoriesEnum,
	EmployeeStatisticsHistoryEnum as HistoryType,
	EmployeeStatisticsHistory
} from '@gauzy/models';
import { TranslateService } from '@ngx-translate/core';
import { LocalDataSource } from 'ng2-smart-table';
import { DateViewComponent } from '../../table-components/date-view/date-view.component';
import { TranslationBaseComponent } from '../../language-base/translation-base.component';
import { IncomeExpenseAmountComponent } from '../../table-components/income-amount/income-amount.component';

@Component({
	selector: 'ngx-records-history',
	templateUrl: './records-history.component.html',
	styleUrls: ['./records-history.component.scss']
})
export class RecordsHistoryComponent extends TranslationBaseComponent
	implements OnInit {
	type: HistoryType;
	recordsData: EmployeeStatisticsHistory[];
	smartTableSource = new LocalDataSource();
	translatedType: string;

	smartTableSettings: Object;

	constructor(readonly translateService: TranslateService) {
		super(translateService);
	}

	ngOnInit() {
		this.loadSettingsSmartTable();
		this._applyTranslationOnSmartTable();
		this._populateSmartTable();
	}

	private _populateSmartTable() {
		let viewModel: any;
		switch (this.type) {
			case HistoryType.INCOME:
			case HistoryType.BONUS_INCOME:
			case HistoryType.NON_BONUS_INCOME:
				viewModel = this.recordsData;
				this.translatedType = this.getTranslation(
					'INCOME_PAGE.INCOME'
				).toUpperCase();
				break;

			case HistoryType.EXPENSES:
			case HistoryType.EXPENSES_WITHOUT_SALARY:
				viewModel = this.recordsData.map(
					({
						valueDate,
						vendorName,
						categoryName,
						amount,
						notes,
						isRecurring,
						source,
						splitExpense
					}) => {
						return {
							valueDate,
							vendorName,
							categoryName,
							amount,
							notes,
							recurring: isRecurring,
							source,
							splitExpense: splitExpense,
							originalValue: splitExpense
								? splitExpense.originalValue
								: '',
							employeeCount: splitExpense
								? splitExpense.employeeCount
								: ''
						};
					}
				);
				this.translatedType = this.getTranslation(
					'EXPENSES_PAGE.EXPENSES'
				).toUpperCase();
				break;
		}

		this.smartTableSource.load(viewModel);
	}

	loadSettingsSmartTable() {
		switch (this.type) {
			case HistoryType.INCOME:
			case HistoryType.BONUS_INCOME:
			case HistoryType.NON_BONUS_INCOME:
				this.smartTableSettings = {
					actions: false,
					mode: 'external',
					editable: true,
					noDataMessage: this.getTranslation('SM_TABLE.NO_DATA'),
					columns: {
						valueDate: {
							title: this.getTranslation('SM_TABLE.DATE'),
							type: 'custom',
							width: '20%',
							renderComponent: DateViewComponent,
							filter: false
						},
						clientName: {
							title: this.getTranslation('SM_TABLE.CLIENT_NAME'),
							type: 'string'
						},
						amount: {
							title: this.getTranslation('SM_TABLE.VALUE'),
							type: 'custom',
							width: '15%',
							filter: false,
							renderComponent: IncomeExpenseAmountComponent
						},
						notes: {
							title: this.getTranslation('SM_TABLE.NOTES'),
							type: 'string'
						}
					},
					pager: {
						display: true,
						perPage: 8
					}
				};
				break;
			case HistoryType.EXPENSES:
			case HistoryType.EXPENSES_WITHOUT_SALARY:
				this.smartTableSettings = {
					actions: false,
					editable: true,
					noDataMessage: this.getTranslation('SM_TABLE.NO_DATA'),
					columns: {
						source: {
							title: 'Source',
							type: 'html',
							class: 'text-center',
							filter: false,
							width: '8%',
							valuePrepareFunction: (_, e) =>
								`<div class='text-center'>
								${
									_ === 'org'
										? '<i class="fas fa-building"></i>'
										: '<i class="fas fa-user-alt"></i>'
								}
								</div>
								`
						},
						valueDate: {
							title: this.getTranslation('SM_TABLE.DATE'),
							type: 'custom',
							width: '20%',
							renderComponent: DateViewComponent,
							filter: false
						},
						vendorName: {
							title: this.getTranslation('SM_TABLE.VENDOR'),
							type: 'string'
						},
						categoryName: {
							title: this.getTranslation('SM_TABLE.CATEGORY'),
							type: 'html',
							valuePrepareFunction: (_, e) =>
								`${this.getCategoryName(_)}`,
							filter: false
						},
						amount: {
							title: this.getTranslation('SM_TABLE.VALUE'),
							type: 'custom',
							width: '15%',
							renderComponent: IncomeExpenseAmountComponent
						},
						notes: {
							title: this.getTranslation('SM_TABLE.NOTES'),
							type: 'string'
						}
					},
					pager: {
						display: true,
						perPage: 8
					}
				};
				break;
		}
	}

	getCategoryName(categoryName: string) {
		return categoryName in RecurringExpenseDefaultCategoriesEnum
			? this.getTranslation(
					`EXPENSES_PAGE.DEFAULT_CATEGORY.${categoryName}`
			  )
			: categoryName;
	}

	_applyTranslationOnSmartTable() {
		this.translateService.onLangChange.subscribe(() => {
			this.loadSettingsSmartTable();
		});
	}
}
