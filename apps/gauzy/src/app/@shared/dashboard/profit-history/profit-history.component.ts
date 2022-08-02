import { OnInit, OnDestroy, Component, ViewChild } from '@angular/core';
import { LocalDataSource, Ng2SmartTableComponent } from 'ng2-smart-table';
import { DateViewComponent } from '../../table-components/date-view/date-view.component';
import { Store } from '../../../@core/services/store.service';
import { ExpenseTableComponent } from './table-components/expense-table.component';
import { IncomeTableComponent } from './table-components/income-table.component';
import { IEmployeeStatisticsHistory } from '@gauzy/contracts';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { debounceTime, tap } from 'rxjs/operators';
import { TranslateService } from '@ngx-translate/core';
import { NbDialogRef } from '@nebular/theme';
import { PaginationFilterBaseComponent } from '../../pagination/pagination-filter-base.component';
import { Subject } from 'rxjs/internal/Subject';
import { distinctUntilChange } from 'packages/common-angular/dist';

@UntilDestroy({ checkProperties: true })
@Component({
	templateUrl: './profit-history.component.html',
	styleUrls: ['./profit-history.component.scss']
})
export class ProfitHistoryComponent
	extends PaginationFilterBaseComponent
	implements OnInit, OnDestroy
{
	smartTableSettings;
	smartTableSource = new LocalDataSource();
	recordsData: {
		incomes: IEmployeeStatisticsHistory[];
		expenses: IEmployeeStatisticsHistory[];
		incomeTotal: number;
		expenseTotal: number;
		profit: number;
	};
	loading: boolean;

	currency: string;
	private _profitHistory$: Subject<any> = this.subject$;

	profileHistoryTable: Ng2SmartTableComponent;
	@ViewChild('profileHistoryTable') set content(
		content: Ng2SmartTableComponent
	) {
		if (content) {
			this.profileHistoryTable = content;
			this.onChangedSource();
		}
	}

	constructor(
		private store: Store,
		readonly translateService: TranslateService,
		private readonly dialogRef: NbDialogRef<ProfitHistoryComponent>
	) {
		super(translateService);
	}

	ngOnInit() {
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

	private _populateSmartTable() {
		this.loading = true;
		const incomeList = this.recordsData.incomes.map((inc) => {
			return {
				income: inc.amount,
				expense: 0,
				valueDate: inc.valueDate,
				notes: inc.notes
			};
		});
		const expenseList = this.recordsData.expenses.map((exp) => {
			return {
				expense: Math.abs(exp.amount),
				income: 0,
				valueDate: exp.valueDate,
				notes: exp.notes
			};
		});
		const combinedTableData = [...incomeList, ...expenseList];
		this.currency = this.store.selectedOrganization.currency;
		const { activePage, itemsPerPage } = this.getPagination();
		this.smartTableSource.setPaging(activePage, itemsPerPage, false);
		this.smartTableSource.load(combinedTableData);
		this.setPagination({
			...this.getPagination(),
			totalItems: this.smartTableSource.count()
		});
		this.loading = false;
	}

	loadSettingsSmartTable() {
		this.smartTableSettings = {
			actions: false,
			mode: 'external',
			editable: true,
			noDataMessage: this.getTranslation(
				'SM_TABLE.NO_DATA.PROFIT_HISTORY'
			),
			columns: {
				valueDate: {
					title: this.getTranslation(
						'DASHBOARD_PAGE.PROFIT_HISTORY.DATE'
					),
					type: 'custom',
					width: '25%',
					sortDirection: 'desc',
					renderComponent: DateViewComponent,
					filter: false
				},
				expense: {
					title: this.getTranslation(
						'DASHBOARD_PAGE.PROFIT_HISTORY.EXPENSES'
					),
					type: 'custom',
					renderComponent: ExpenseTableComponent
				},
				income: {
					title: this.getTranslation(
						'DASHBOARD_PAGE.PROFIT_HISTORY.INCOME'
					),
					type: 'custom',
					renderComponent: IncomeTableComponent
				},
				notes: {
					title: this.getTranslation(
						'DASHBOARD_PAGE.PROFIT_HISTORY.DESCRIPTION'
					),
					type: 'string'
				}
			},
			pager: {
				display: false,
				perPage: this.pagination
					? this.pagination.itemsPerPage
					: this.minItemPerPage
			}
		};
	}

	/*
	 * Table on changed source event
	 */
	onChangedSource() {
		this.profileHistoryTable.source.onChangedSource
			.pipe(
				untilDestroyed(this),
				tap(() => this.deselectAll())
			)
			.subscribe();
	}
	/*
	 * Deselect all table rows
	 */
	deselectAll() {
		if (this.profileHistoryTable && this.profileHistoryTable.grid) {
			this.profileHistoryTable.grid.dataSet['willSelect'] = 'false';
			this.profileHistoryTable.grid.dataSet.deselectAll();
		}
	}

	ngOnDestroy() {}

	public close() {
		this.dialogRef.close();
	}
}
