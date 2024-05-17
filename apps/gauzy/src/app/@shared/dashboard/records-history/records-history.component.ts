import { Component, OnInit } from '@angular/core';
import { debounceTime, tap } from 'rxjs/operators';
import { Subject } from 'rxjs/internal/Subject';
import { NbDialogRef } from '@nebular/theme';
import { TranslateService } from '@ngx-translate/core';
import { Cell, LocalDataSource } from 'angular2-smart-table';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import {
	RecurringExpenseDefaultCategoriesEnum,
	EmployeeStatisticsHistoryEnum as HistoryType,
	IEmployeeStatisticsHistory
} from '@gauzy/contracts';
import { distinctUntilChange } from '@gauzy/ui-sdk/common';
import { ContactLinksComponent, IncomeExpenseAmountComponent, DateViewComponent } from '../../table-components';
import { PaginationFilterBaseComponent } from '../../pagination/pagination-filter-base.component';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ngx-records-history',
	templateUrl: './records-history.component.html',
	styleUrls: ['./records-history.component.scss']
})
export class RecordsHistoryComponent extends PaginationFilterBaseComponent implements OnInit {
	type: HistoryType;
	recordsData: IEmployeeStatisticsHistory[];
	smartTableSource = new LocalDataSource();
	translatedType: string;
	loading: boolean;
	private _recordsHistory$: Subject<any> = this.subject$;

	smartTableSettings: Object = {
		actions: false,
		selectedRowIndex: -1,
		editable: true,
		noDataMessage: this.getTranslation('SM_TABLE.NO_DATA.HISTORY_RECORD'),
		pager: {
			display: false,
			perPage: this.pagination ? this.pagination.itemsPerPage : this.minItemPerPage
		}
	};

	constructor(
		readonly translateService: TranslateService,
		private readonly dialogRef: NbDialogRef<RecordsHistoryComponent>
	) {
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
				this.translatedType = this.getTranslation('INCOME_PAGE.INCOME').toUpperCase();
				break;
			case HistoryType.EXPENSES:
			case HistoryType.EXPENSES_WITHOUT_SALARY:
				viewModel = this.recordsData.map(
					({ valueDate, vendorName, categoryName, amount, notes, isRecurring, source, splitExpense }) => {
						return {
							valueDate,
							vendorName,
							categoryName,
							amount,
							notes,
							recurring: isRecurring,
							source,
							splitExpense: splitExpense,
							originalValue: splitExpense ? splitExpense.originalValue : '',
							employeeCount: splitExpense ? splitExpense.employeeCount : ''
						};
					}
				);
				this.translatedType = this.getTranslation('EXPENSES_PAGE.EXPENSES').toUpperCase();
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
							filter: false,
							renderComponent: DateViewComponent,
							componentInitFunction: (instance: DateViewComponent, cell: Cell) => {
								instance.rowData = cell.getRow().getData();
								instance.value = cell.getValue();
							}
						},
						client: {
							title: this.getTranslation('SM_TABLE.CONTACT'),
							type: 'custom',
							renderComponent: ContactLinksComponent,
							valuePrepareFunction: (row: { value?: any }) => {
								return row?.value ?? null;
							},
							componentInitFunction: (instance: ContactLinksComponent, cell: Cell) => {
								instance.rowData = cell.getRow().getData();
								instance.value = cell.getValue();
							}
						},
						amount: {
							title: this.getTranslation('SM_TABLE.VALUE'),
							type: 'custom',
							width: '15%',
							filter: false,
							renderComponent: IncomeExpenseAmountComponent,
							componentInitFunction: (instance: IncomeExpenseAmountComponent, cell: Cell) => {
								instance.rowData = cell.getRow().getData();
								instance.value = cell.getValue();
							}
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
							valuePrepareFunction: (_) =>
								`<div class='text-center'>
								${_ === 'org' ? '<i class="fas fa-building"></i>' : '<i class="fas fa-user-alt"></i>'}
								</div>
								`
						},
						valueDate: {
							title: this.getTranslation('SM_TABLE.DATE'),
							type: 'custom',
							width: '20%',
							filter: false,
							renderComponent: DateViewComponent,
							componentInitFunction: (instance: DateViewComponent, cell: Cell) => {
								instance.rowData = cell.getRow().getData();
								instance.value = cell.getValue();
							}
						},
						vendorName: {
							title: this.getTranslation('SM_TABLE.VENDOR'),
							type: 'string'
						},
						categoryName: {
							title: this.getTranslation('SM_TABLE.CATEGORY'),
							type: 'html',
							filter: false,
							valuePrepareFunction: (_) => this.getCategoryName(_)
						},
						amount: {
							title: this.getTranslation('SM_TABLE.VALUE'),
							type: 'custom',
							width: '15%',
							renderComponent: IncomeExpenseAmountComponent,
							componentInitFunction: (instance: IncomeExpenseAmountComponent, cell: Cell) => {
								instance.rowData = cell.getRow().getData();
								instance.value = cell.getValue();
							}
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

	/**
	 * Gets the translated category name if it is one of the default categories;
	 * otherwise, returns the original category name.
	 *
	 * @param category - The category name to be translated.
	 * @returns The translated category name or the original category name if not a default category.
	 */
	getCategoryName(category: string): string {
		const isDefaultCategory = category in RecurringExpenseDefaultCategoriesEnum;
		return isDefaultCategory ? this.getTranslation(`EXPENSES_PAGE.DEFAULT_CATEGORY.${category}`) : category;
	}

	_applyTranslationOnSmartTable() {
		this.translateService.onLangChange.pipe(untilDestroyed(this)).subscribe(() => {
			this.loadSettingsSmartTable();
			this._populateSmartTable();
		});
	}

	close() {
		this.dialogRef.close();
	}
}
