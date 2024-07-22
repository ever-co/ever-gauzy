import { OnInit, Component } from '@angular/core';
import { debounceTime, filter, tap } from 'rxjs/operators';
import { Subject } from 'rxjs/internal/Subject';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { TranslateService } from '@ngx-translate/core';
import { NbDialogRef } from '@nebular/theme';
import { LocalDataSource, Cell } from 'angular2-smart-table';
import { IEmployeeStatisticsHistory, IOrganization } from '@gauzy/contracts';
import { distinctUntilChange } from '@gauzy/ui-core/common';
import { Store } from '@gauzy/ui-core/common';
import { ExpenseTableComponent } from './table-components/expense-table.component';
import { IncomeTableComponent } from './table-components/income-table.component';
import { DateViewComponent } from '../../table-components';
import { PaginationFilterBaseComponent } from '../../smart-table/pagination/pagination-filter-base.component';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ga-profit-history-selector',
	templateUrl: './profit-history.component.html',
	styleUrls: ['./profit-history.component.scss']
})
export class ProfitHistoryComponent extends PaginationFilterBaseComponent implements OnInit {
	public organization: IOrganization;
	public smartTableSettings: object;
	public smartTableSource = new LocalDataSource();
	public records: {
		incomes: IEmployeeStatisticsHistory[];
		expenses: IEmployeeStatisticsHistory[];
		incomeTotal: number;
		expenseTotal: number;
		profit: number;
	};
	public loading: boolean = false;
	private _profitHistory$: Subject<any> = this.subject$;

	constructor(
		private readonly store: Store,
		public readonly translateService: TranslateService,
		private readonly dialogRef: NbDialogRef<ProfitHistoryComponent>
	) {
		super(translateService);
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
	}

	ngAfterViewInit(): void {}

	private _populateSmartTable() {
		this.loading = true;

		const { activePage, itemsPerPage } = this.getPagination();
		const incomeList = this.records.incomes.map((inc) => {
			return {
				income: inc.amount,
				expense: 0,
				valueDate: inc.valueDate,
				notes: inc.notes
			};
		});
		const expenseList = this.records.expenses.map((exp) => {
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
					filter: false,
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
		this.dialogRef.close();
	}
}
