import { Component, OnInit } from '@angular/core';
import { LocalDataSource } from 'ng2-smart-table';
import { TranslateService } from '@ngx-translate/core';
import { DateViewComponent } from '../../table-components/date-view/date-view.component';

export enum HistoryType {
	INCOME = 'INCOME',
	EXPENSES = 'EXPENSES'
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
	translatedType: string;

	smartTableSettings: Object;

	constructor(private translateService: TranslateService) {}

	ngOnInit() {
		let viewModel: any;
		this.loadSettingsSmartTable();
		this._applyTranslationOnSmartTable();

		switch (this.type) {
			case HistoryType.INCOME:
				viewModel = this.recordsData.map((i) => {
					return {
						id: i.id,
						valueDate: i.valueDate,
						clientName: i.clientName,
						clientId: i.clientId,
						amount: i.amount,
						notes: i.notes
					};
				});
				this.translatedType = this.getTranslation(
					'INCOME_PAGE.INCOME'
				).toUpperCase();
				break;

			case HistoryType.EXPENSES:
				viewModel = this.recordsData.map((i) => {
					return {
						id: i.id,
						valueDate: i.valueDate,
						vendorId: i.vendorId,
						vendorName: i.vendorName,
						categoryId: i.categoryId,
						categoryName: i.categoryName,
						amount: i.amount,
						notes: i.notes
					};
				});
				this.translatedType = this.getTranslation(
					'EXPENSES_PAGE.EXPENSES'
				).toUpperCase();
				break;
		}

		this.smartTableSource.load(viewModel);
	}

	loadSettingsSmartTable() {
		switch (this.type) {
			case HistoryType.INCOME:
				this.smartTableSettings = {
					actions: false,
					mode: 'external',
					editable: true,
					noDataMessage: this.getTranslation('SM_TABLE.NO_DATA'),
					columns: {
						valueDate: {
							title: this.getTranslation('SM_TABLE.DATE'),
							type: 'custom',
							width: '20%',
							renderComponent: DateViewComponent,
							filter: false
						},
						clientName: {
							title: this.getTranslation('SM_TABLE.CLIENT_NAME'),
							type: 'string'
						},
						amount: {
							title: this.getTranslation('SM_TABLE.VALUE'),
							type: 'number',
							width: '15%',
							filter: false
						},
						notes: {
							title: this.getTranslation('SM_TABLE.NOTES'),
							type: 'string'
						}
					},
					pager: {
						display: true,
						perPage: 8
					}
				};
				break;
			case HistoryType.EXPENSES:
				this.smartTableSettings = {
					actions: false,
					editable: true,
					noDataMessage: this.getTranslation('SM_TABLE.NO_DATA'),
					columns: {
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
							type: 'string'
						},
						amount: {
							title: this.getTranslation('SM_TABLE.VALUE'),
							type: 'number',
							width: '15%',
							filter: false
						},
						notes: {
							title: this.getTranslation('SM_TABLE.NOTES'),
							type: 'string'
						}
					},
					pager: {
						display: true,
						perPage: 8
					}
				};
				break;
		}
	}

	getTranslation(prefix: string) {
		let result = '';
		this.translateService.get(prefix).subscribe((res) => {
			result = res;
		});

		return result;
	}

	_applyTranslationOnSmartTable() {
		this.translateService.onLangChange.subscribe(() => {
			this.loadSettingsSmartTable();
		});
	}
}
