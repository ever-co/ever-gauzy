import { Component, OnInit, ViewChild } from '@angular/core';
import {
	RecurringExpenseDefaultCategoriesEnum,
	EmployeeStatisticsHistoryEnum as HistoryType,
	IEmployeeStatisticsHistory
} from '@gauzy/contracts';
import { TranslateService } from '@ngx-translate/core';
import { LocalDataSource, Ng2SmartTableComponent } from 'ng2-smart-table';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import {
	DateViewComponent,
	IncomeExpenseAmountComponent
} from '../../table-components';
import { debounceTime, tap } from 'rxjs/operators';
import { ContactLinksComponent } from '../../table-components';
import { PaginationFilterBaseComponent } from '../../pagination/pagination-filter-base.component';
import { Subject } from 'rxjs/internal/Subject';
import { distinctUntilChange } from 'packages/common-angular/dist';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ngx-records-history',
	templateUrl: './records-history.component.html',
	styleUrls: ['./records-history.component.scss']
})
export class RecordsHistoryComponent
	extends PaginationFilterBaseComponent
	implements OnInit
{
	type: HistoryType;
	recordsData: IEmployeeStatisticsHistory[];
	smartTableSource = new LocalDataSource();
	translatedType: string;
	loading: boolean;
	private _recordsHistory$: Subject<any> = this.subject$;

	smartTableSettings: Object = {
		actions: false,
		editable: true,
		noDataMessage: this.getTranslation('SM_TABLE.NO_DATA.HISTORY_RECORD'),
		pager: {
			display: false,
			perPage: this.pagination
				? this.pagination.itemsPerPage
				: this.minItemPerPage
		}
	};

	recordHistoryTable: Ng2SmartTableComponent;
	@ViewChild('recordHistoryTable') set content(
		content: Ng2SmartTableComponent
	) {
		if (content) {
			this.recordHistoryTable = content;
			this.onChangedSource();
		}
	}

	constructor(readonly translateService: TranslateService) {
		super(translateService);
	}

	ngOnInit() {
		this._recordsHistory$
			.pipe(
				debounceTime(300),
				tap(() => this._populateSmartTable()),
				untilDestroyed(this)
			)
			.subscribe();
		this.pagination$
			.pipe(
				debounceTime(100),
				distinctUntilChange(),
				tap(() => this._recordsHistory$.next(true)),
				untilDestroyed(this)
			)
			.subscribe();
		this._populateSmartTable();
		this.loadSettingsSmartTable();
		this._applyTranslationOnSmartTable();
	}

	private _populateSmartTable() {
		this.loading = true;
		let viewModel: any;
		switch (this.type) {
			case HistoryType.INCOME:
			case HistoryType.BONUS_INCOME:
			case HistoryType.NON_BONUS_INCOME:
				viewModel = this.recordsData;
				this.translatedType =
					this.getTranslation('INCOME_PAGE.INCOME').toUpperCase();
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
		const { activePage, itemsPerPage } = this.getPagination();
		this.smartTableSource.setPaging(activePage, itemsPerPage, false);
		this.smartTableSource.load(viewModel);
		this.setPagination({
			...this.getPagination(),
			totalItems: this.smartTableSource.count()
		});
		this.loading = false;
	}

	loadSettingsSmartTable() {
		switch (this.type) {
			case HistoryType.INCOME:
			case HistoryType.BONUS_INCOME:
			case HistoryType.NON_BONUS_INCOME:
				this.smartTableSettings = {
					...this.smartTableSettings,
					columns: {
						valueDate: {
							title: this.getTranslation('SM_TABLE.DATE'),
							type: 'custom',
							width: '30%',
							renderComponent: DateViewComponent,
							filter: false
						},
						client: {
							title: this.getTranslation('SM_TABLE.CONTACT'),
							type: 'custom',
							renderComponent: ContactLinksComponent,
							valuePrepareFunction: (cell, row) => {
								return row.client ? row.client : null;
							}
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
					}
				};
				break;
			case HistoryType.EXPENSES:
			case HistoryType.EXPENSES_WITHOUT_SALARY:
				this.smartTableSettings = {
					...this.smartTableSettings,
					columns: {
						source: {
							title: this.getTranslation('SM_TABLE.SOURCE'),
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
		this.translateService.onLangChange
			.pipe(untilDestroyed(this))
			.subscribe(() => {
				this.loadSettingsSmartTable();
				this._populateSmartTable();
			});
	}

	/*
	 * Table on changed source event
	 */
	onChangedSource() {
		this.recordHistoryTable.source.onChangedSource
			.pipe(
				untilDestroyed(this),
				tap(() => this.clearItem())
			)
			.subscribe();
	}

	/*
	 * Clear selected item
	 */
	clearItem() {
		this.deselectAll();
	}
	/*
	 * Deselect all table rows
	 */
	deselectAll() {
		if (this.recordHistoryTable && this.recordHistoryTable.grid) {
			this.recordHistoryTable.grid.dataSet['willSelect'] = 'false';
			this.recordHistoryTable.grid.dataSet.deselectAll();
		}
	}
}
