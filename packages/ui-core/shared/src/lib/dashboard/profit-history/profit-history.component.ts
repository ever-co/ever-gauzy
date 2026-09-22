import { Component, Input, OnChanges, OnInit, Optional, SimpleChanges } from '@angular/core';
import { debounceTime, filter, tap } from 'rxjs/operators';
import { Subject } from 'rxjs';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { TranslateService } from '@ngx-translate/core';
import { NbDialogRef } from '@nebular/theme';
import { LocalDataSource, Cell } from 'angular2-smart-table';
import { IEmployeeStatisticsHistory, IOrganization } from '@gauzy/contracts';
import { distinctUntilChange } from '@gauzy/ui-core/common';
import { Store } from '@gauzy/ui-core/core';
import { PaginationFilterBaseComponent } from '../../smart-data-layout/pagination/pagination-filter-base.component';
import { ExpenseTableComponent } from './table-components/expense-table.component';
import { IncomeTableComponent } from './table-components/income-table.component';
import { DateViewComponent } from '../../table-components';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ga-profit-history-selector',
	templateUrl: './profit-history.component.html',
	styleUrls: ['./profit-history.component.scss'],
	standalone: false
})
export class ProfitHistoryComponent extends PaginationFilterBaseComponent implements OnInit, OnChanges {
	public organization: IOrganization;
	public smartTableSettings: object;
	public smartTableSource = new LocalDataSource();

	/**
	 * The income/expense rows and their totals.
	 *
	 * An `@Input()` so the component can be used INLINE (the dashboard-builder
	 * widget) as well as through `NbDialogService`, which assigns the field
	 * directly from its `context` and is unaffected by the decorator.
	 */
	@Input() public records: {
		incomes: IEmployeeStatisticsHistory[];
		expenses: IEmployeeStatisticsHistory[];
		incomeTotal: number;
		expenseTotal: number;
		profit: number;
	};
	public loading: boolean = false;

	/** Guards {@link ngOnChanges} until the first population has happened in `ngOnInit`. */
	private _initialized = false;
	private _profitHistory$: Subject<any> = this.subject$;

	constructor(
		private readonly store: Store,
		public readonly translateService: TranslateService,
		// Optional so the component can also be rendered inline (the dashboard
		// builder's Profit History widget), where there is no dialog to close and
		// therefore no `NbDialogRef` in the injector.
		@Optional() private readonly dialogRef?: NbDialogRef<ProfitHistoryComponent>
	) {
		super(translateService);
	}

	/** True when this instance was opened as a dialog, i.e. when it can be closed. */
	public get isDialog(): boolean {
		return !!this.dialogRef;
	}

	ngOnInit() {
		this.store.selectedOrganization$
			.pipe(
				filter((organization: IOrganization) => !!organization),
				tap((organization: IOrganization) => (this.organization = organization)),
				untilDestroyed(this)
			)
			.subscribe();
		this._profitHistory$
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
				tap(() => this._profitHistory$.next(true)),
				untilDestroyed(this)
			)
			.subscribe();

		this.loadSettingsSmartTable();
		this._populateSmartTable();
		this._initialized = true;
	}

	ngAfterViewInit(): void {}

	/**
	 * Re-renders when the bound records change.
	 *
	 * Only inline usage rebinds — a dialog is opened with a fixed `context` and
	 * never changes it — so this is inert on the dialog path. `ngOnChanges` also
	 * runs BEFORE the first `ngOnInit`, which `_initialized` filters out so the
	 * table is not populated twice on creation.
	 *
	 * @param changes - The inputs Angular re-bound.
	 */
	ngOnChanges(changes: SimpleChanges): void {
		if (this._initialized && changes['records']) {
			this._profitHistory$.next(true);
		}
	}

	private _populateSmartTable() {
		this.loading = true;

		const { activePage, itemsPerPage } = this.getPagination();
		// Defensive: an inline host binds its records asynchronously, so the first
		// change detection pass can arrive before the request has resolved.
		const incomeList = (this.records?.incomes ?? []).map((inc) => {
			return {
				income: inc.amount,
				expense: 0,
				valueDate: inc.valueDate,
				notes: inc.notes
			};
		});
		const expenseList = (this.records?.expenses ?? []).map((exp) => {
			return {
				expense: Math.abs(exp.amount),
				income: 0,
				valueDate: exp.valueDate,
				notes: exp.notes
			};
		});
		const combinedTableData = [...incomeList, ...expenseList];
		this.smartTableSource.setPaging(activePage, itemsPerPage, false);
		this.smartTableSource.load(combinedTableData);
		this.setPagination({
			...this.getPagination(),
			totalItems: this.smartTableSource.count()
		});

		this.loading = false;
	}

	/**
	 *
	 */
	loadSettingsSmartTable() {
		this.smartTableSettings = {
			pager: {
				display: false,
				perPage: this.pagination ? this.pagination.itemsPerPage : this.minItemPerPage
			},
			actions: false,
			mode: 'external',
			selectedRowIndex: -1,
			editable: true,
			noDataMessage: this.getTranslation('SM_TABLE.NO_DATA.PROFIT_HISTORY'),
			columns: {
				valueDate: {
					title: this.getTranslation('DASHBOARD_PAGE.PROFIT_HISTORY.DATE'),
					type: 'custom',
					width: '25%',
					sortDirection: 'desc',
					isFilterable: false,
					renderComponent: DateViewComponent,
					componentInitFunction: (instance: DateViewComponent, cell: Cell) => {
						instance.rowData = cell.getRow().getData();
						instance.value = cell.getValue();
					}
				},
				expense: {
					title: this.getTranslation('DASHBOARD_PAGE.PROFIT_HISTORY.EXPENSES'),
					type: 'custom',
					renderComponent: ExpenseTableComponent,
					componentInitFunction: (instance: ExpenseTableComponent, cell: Cell) => {
						instance.rowData = cell.getRow().getData();
						instance.value = cell.getValue();
					}
				},
				income: {
					title: this.getTranslation('DASHBOARD_PAGE.PROFIT_HISTORY.INCOME'),
					type: 'custom',
					renderComponent: IncomeTableComponent,
					componentInitFunction: (instance: IncomeTableComponent, cell: Cell) => {
						instance.rowData = cell.getRow().getData();
						instance.value = cell.getValue();
					}
				},
				notes: {
					title: this.getTranslation('DASHBOARD_PAGE.PROFIT_HISTORY.DESCRIPTION'),
					type: 'string'
				}
			}
		};
	}

	public close() {
		this.dialogRef?.close();
	}
}
