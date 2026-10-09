import { Component, Input, OnChanges, OnInit, Optional, SimpleChanges } from '@angular/core';
import { debounceTime, tap } from 'rxjs/operators';
import { Subject } from 'rxjs';
import { NbDialogRef } from '@nebular/theme';
import { TranslateService } from '@ngx-translate/core';
import { Cell, LocalDataSource } from 'angular2-smart-table';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import {
	RecurringExpenseDefaultCategoriesEnum,
	EmployeeStatisticsHistoryEnum as HistoryType,
	IEmployeeStatisticsHistory
} from '@gauzy/contracts';
import { distinctUntilChange } from '@gauzy/ui-core/common';
import { PaginationFilterBaseComponent } from '../../smart-data-layout/pagination/pagination-filter-base.component';
import { ContactLinksComponent, DateViewComponent, IncomeExpenseAmountComponent } from '../../table-components';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ngx-records-history',
	templateUrl: './records-history.component.html',
	styleUrls: ['./records-history.component.scss'],
	standalone: false
})
export class RecordsHistoryComponent extends PaginationFilterBaseComponent implements OnInit, OnChanges {
	/**
	 * Which history to render.
	 *
	 * An `@Input()` so the component can be used INLINE (the dashboard-builder
	 * widget) as well as through `NbDialogService`, which assigns the field
	 * directly from its `context` and is unaffected by the decorator.
	 */
	@Input() type: HistoryType;

	/** The rows to render; see {@link RecordsHistoryComponent.type} on the input. */
	@Input() records: IEmployeeStatisticsHistory[];

	smartTableSource = new LocalDataSource();
	translatedType: string;
	loading: boolean;

	/** Guards {@link ngOnChanges} until the first population has happened in `ngOnInit`. */
	private _initialized = false;
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
		translateService: TranslateService,
		// Optional so the component can also be rendered inline (the dashboard
		// builder's Records History widget), where there is no dialog to close and
		// therefore no `NbDialogRef` in the injector.
		@Optional() private readonly dialogRef?: NbDialogRef<RecordsHistoryComponent>
	) {
		super(translateService);
	}

	/** True when this instance was opened as a dialog, i.e. when it can be closed. */
	public get isDialog(): boolean {
		return !!this.dialogRef;
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
		this._initialized = true;
	}

	/**
	 * Re-renders when the bound history changes.
	 *
	 * Only inline usage rebinds — a dialog is opened with a fixed `context` and
	 * never changes it — so this is inert on the dialog path. `ngOnChanges` also
	 * runs BEFORE the first `ngOnInit`, which `_initialized` filters out so the
	 * table is not populated twice on creation.
	 *
	 * @param changes - The inputs Angular re-bound.
	 */
	ngOnChanges(changes: SimpleChanges): void {
		if (!this._initialized) {
			return;
		}
		if (changes['type']) {
			// The columns differ per history type (income has a contact, expenses a
			// vendor and a category), so the settings have to be rebuilt first.
			this.loadSettingsSmartTable();
		}
		if (changes['type'] || changes['records']) {
			this._recordsHistory$.next(true);
		}
	}

	private _populateSmartTable() {
		this.loading = true;
		let viewModel: any;
		// Defensive: an inline host binds its rows asynchronously, and the expense
		// branch below would throw on the very first change detection pass.
		const records = this.records ?? [];
		switch (this.type) {
			case HistoryType.INCOME:
			case HistoryType.BONUS_INCOME:
			case HistoryType.NON_BONUS_INCOME:
				viewModel = records;
				this.translatedType = this.getTranslation('INCOME_PAGE.INCOME').toUpperCase();
				break;
			case HistoryType.EXPENSES:
			case HistoryType.EXPENSES_WITHOUT_SALARY:
				viewModel = records.map(
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
							isFilterable: false,
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
							componentInitFunction: (instance: ContactLinksComponent, cell: Cell) => {
								instance.rowData = cell.getRow().getData();
								instance.value = cell.getRawValue();
							}
						},
						amount: {
							title: this.getTranslation('SM_TABLE.VALUE'),
							type: 'custom',
							width: '15%',
							isFilterable: false,
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
							isFilterable: false,
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
							isFilterable: false,
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
							isFilterable: false,
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
		this.dialogRef?.close();
	}
}
