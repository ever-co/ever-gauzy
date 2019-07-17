import { Component, OnInit } from '@angular/core';
import { IncomeViewModel, IncomeComponent } from '../../../pages/income/income.component';
import { LocalDataSource } from 'ng2-smart-table';
import { ExpensesComponent } from '../../../pages/expenses/expenses.component';

export enum HistoryType {
    INCOME = 'INCOME',
    EXPENSE = 'EXPENSE'
}

@Component({
    selector: 'ngx-records-history',
    templateUrl: './records-history.component.html',
    styleUrls: ['./records-history.component.scss']
})
export class RecordsHistoryComponent implements OnInit {
    type: HistoryType;
    recordsData: any;
    smartTableSource = new LocalDataSource();

    smartTableSettings: Object;

    constructor() { }

    ngOnInit() {
        let viewModel: IncomeViewModel[];

        switch (this.type) {
            case HistoryType.INCOME:
                viewModel = this.recordsData.map(i => {
                    return {
                        id: i.id,
                        valueDate: new Date(i.valueDate).toLocaleDateString('uk'),
                        clientName: i.clientName,
                        clientId: i.clientId,
                        amount: i.amount
                    }
                });

                this.smartTableSettings = IncomeComponent.smartTableSettings;
                break;
            case HistoryType.EXPENSE:
                viewModel = this.recordsData.map(i => {
                    return {
                        id: i.id,
                        valueDate: new Date(i.valueDate).toLocaleDateString(),
                        vendorId: i.vendorId,
                        vendorName: i.vendorName,
                        categoryId: i.categoryId,
                        categoryName: i.categoryName,
                        amount: i.amount,
                        notes: i.notes
                    }
                });

                this.smartTableSettings = ExpensesComponent.smartTableSettings;
                break;
        }

        this.smartTableSource.load(viewModel);
    }
}
