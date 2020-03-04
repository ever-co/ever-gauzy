import { Component, OnInit } from '@angular/core';
import { RecurringExpenseDefaultCategoriesEnum } from '@gauzy/models';
import { TranslateService } from '@ngx-translate/core';
import { LocalDataSource } from 'ng2-smart-table';
import { DateViewComponent } from '../../table-components/date-view/date-view.component';
import { TranslationBaseComponent } from '../../language-base/translation-base.component';
import { IncomeExpenseAmountComponent } from '../../table-components/income-amount/income-amount.component';

export enum HistoryType {
	NON_BONUS_INCOME = 'NON_BONUS_INCOME',
	BONUS_INCOME = 'BONUS_INCOME',
	INCOME = 'INCOME',
	EXPENSES = 'EXPENSES',
	SALARY = 'SALARY',
	EXPENSES_WITHOUT_SALARY = 'EXPENSES_WITHOUT_SALARY'
}

@Component({
	selector: 'ngx-records-history',
	templateUrl: './records-history.component.html',
	styleUrls: ['./records-history.component.scss']
})
export class RecordsHistoryComponent extends TranslationBaseComponent
	implements OnInit {
	type: HistoryType;
	recordsData: any;
	smartTableSource = new LocalDataSource();
	translatedType: string;

	smartTableSettings: Object;

	constructor(readonly translateService: TranslateService) {
		super(translateService);
	}

	ngOnInit() {
		let viewModel: any;
		this.loadSettingsSmartTable();
		this._applyTranslationOnSmartTable();

		switch (this.type) {
			case HistoryType.INCOME:
			case HistoryType.BONUS_INCOME:
			case HistoryType.NON_BONUS_INCOME:
				viewModel = this.recordsData.map((i) => {
					return {
						id: i.id,
						valueDate: i.valueDate,
						clientName: i.clientName,
						clientId: i.clientId,
						amount: i.amount,
						notes: i.notes,
						isBonus: i.isBonus
					};
				});
				this.translatedType = this.getTranslation(
					'INCOME_PAGE.INCOME'
				).toUpperCase();
				break;

			case HistoryType.EXPENSES:
			case HistoryType.EXPENSES_WITHOUT_SALARY:
			case HistoryType.SALARY:
				viewModel = this.recordsData.map((i) => {
					return {
						id: i.id,
						valueDate: i.valueDate,
						vendorId: i.vendorId,
						vendorName: i.vendorName,
						categoryId: i.categoryId,
						categoryName: i.categoryName,
						amount: i.amount,
						notes: i.notes,
						recurring: i.recurring,
						source: i.source,
						originalValue: i.originalValue,
						employeeCount: i.employeeCount,
						splitExpense: i.splitExpense
					};
				});
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
			case HistoryType.SALARY:
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
