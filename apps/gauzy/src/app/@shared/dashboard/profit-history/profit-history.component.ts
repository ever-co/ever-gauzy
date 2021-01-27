import { OnInit, OnDestroy, Component, ViewChild } from '@angular/core';
import { LocalDataSource, Ng2SmartTableComponent } from 'ng2-smart-table';
import { DateViewComponent } from '../../table-components/date-view/date-view.component';
import { Store } from '../../../@core/services/store.service';
import { ExpenseTableComponent } from './table-components/expense-table.component';
import { IncomeTableComponent } from './table-components/income-table.component';
import { IEmployeeStatisticsHistory } from '@gauzy/contracts';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { tap } from 'rxjs/operators';
import { TranslationBaseComponent } from '../../language-base/translation-base.component';
import { TranslateService } from '@ngx-translate/core';

@UntilDestroy({ checkProperties: true })
@Component({
	templateUrl: './profit-history.component.html',
	styleUrls: ['./profit-history.component.scss']
})
export class ProfitHistoryComponent
	extends TranslationBaseComponent
	implements OnInit, OnDestroy {
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
		readonly translateService: TranslateService
	) {
		super(translateService);
	}

	ngOnInit() {
		this.loading = true;
		this.loadSettingsSmartTable();
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

		this.smartTableSource.load(combinedTableData);
		this.loading = false;
	}

	loadSettingsSmartTable() {
		this.smartTableSettings = {
			actions: false,
			mode: 'external',
			editable: true,
			noDataMessage: this.getTranslation('SM_TABLE.NO_DATA'),
			columns: {
				valueDate: {
					title: this.getTranslation(
						'DASHBOARD_PAGE.PROFIT_HISTORY.DATE'
					),
					type: 'custom',
					width: '20%',
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
				display: true,
				perPage: 8
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
}
