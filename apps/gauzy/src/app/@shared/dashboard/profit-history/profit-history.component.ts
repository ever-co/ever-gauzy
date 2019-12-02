import { OnInit, OnDestroy, Component } from '@angular/core';
import { LocalDataSource } from 'ng2-smart-table';
import { DateViewComponent } from '../../table-components/date-view/date-view.component';
import * as moment from 'moment';

@Component({
	templateUrl: './profit-history.component.html',
	styleUrls: ['./profit-history.component.scss']
})
export class ProfitHistoryComponent implements OnInit, OnDestroy {
	smartTableSettings;
	smartTableSource = new LocalDataSource();
	recordsData: any;
	incomeTotal: number;
	expensesTotal: number;

	constructor() {}

	ngOnInit() {
		this.loadSettingsSmartTable();
		const incomeList = this.recordsData.income.map((inc) => {
			return {
				income: inc.amount,
				expense: 0,
				valueDate: inc.valueDate,
				notes: inc.notes
			};
		});

		const expenseList = this.recordsData.expenses.map((exp) => {
			return {
				expense: exp.amount,
				income: 0,
				valueDate: exp.valueDate,
				notes: exp.notes
			};
		});
		const combinedTableData = [...incomeList, ...expenseList];

		this.incomeTotal = combinedTableData.reduce((a, b) => a + b.income, 0);

		this.expensesTotal = combinedTableData.reduce(
			(a, b) => a + b.expense,
			0
		);

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
					type: 'string'
				},
				income: {
					title: 'Income',
					type: 'string'
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
