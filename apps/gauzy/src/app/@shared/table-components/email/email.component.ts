import { Component, Input } from '@angular/core';
import { ViewCell } from 'ng2-smart-table';

@Component({
	selector: 'gauzy-email',
	templateUrl: './email.component.html',
	styleUrls: ['./email.component.scss']
})
export class EmailComponent implements ViewCell {
	@Input()
	value: string | number;
	@Input()
	rowData: any;

	constructor() {}
}
