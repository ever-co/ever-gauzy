import { OnInit, OnDestroy, Component } from '@angular/core';
import { LocalDataSource } from 'ng2-smart-table';
import { DateViewComponent } from '../../table-components/date-view/date-view.component';
import { Store } from '../../../@core/services/store.service';
import { ExpenseTableComponent } from './table-components/expense-table.component';
import { IncomeTableComponent } from './table-components/income-table.component';
import { EmployeeStatisticsHistory } from '@gauzy/models';

@Component({
	templateUrl: './profit-history.component.html',
	styleUrls: ['./profit-history.component.scss']
})
export class ProfitHistoryComponent implements OnInit, OnDestroy {
	smartTableSettings;
	smartTableSource = new LocalDataSource();
	recordsData: {
		incomes: EmployeeStatisticsHistory[];
		expenses: EmployeeStatisticsHistory[];
		incomeTotal: number;
		expenseTotal: number;
		profit: number;
	};

	currency: string;

	constructor(private store: Store) {}

	ngOnInit() {
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
	}

	loadSettingsSmartTable() {
		this.smartTableSettings = {
			actions: false,
			mode: 'external',
			editable: true,
			noDataMessage: 'No Data',
			columns: {
				valueDate: {
					title: 'Date',
					type: 'custom',
					width: '20%',
					sortDirection: 'desc',
					renderComponent: DateViewComponent,
					filter: false
				},
				expense: {
					title: 'Expenses',
					type: 'custom',
					renderComponent: ExpenseTableComponent
				},
				income: {
					title: 'Income',
					type: 'custom',
					renderComponent: IncomeTableComponent
				},
				notes: {
					title: 'Description',
					type: 'string'
				}
			},
			pager: {
				display: true,
				perPage: 8
			}
		};
	}

	ngOnDestroy() {}
}
