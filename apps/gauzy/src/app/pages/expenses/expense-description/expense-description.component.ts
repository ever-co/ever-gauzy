import { Component, Input } from '@angular/core';
import { ViewCell } from 'ng2-smart-table';

@Component({
	selector: 'ngx-expense-description',
	templateUrl: './expense-description.component.html',
	styleUrls: ['./expense-description.component.scss']
})
export class ExpenseDescriptionComponent implements ViewCell {
	@Input()
	rowData: any;

	value: string | number;
}
