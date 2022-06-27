import { Component, Input, OnInit } from '@angular/core';
import { ViewCell } from 'ng2-smart-table';

@Component({
	selector: 'ga-phone-url',
	templateUrl: './phone-url.component.html',
	styleUrls: ['./phone-url.component.scss']
})
export class PhoneUrlComponent implements ViewCell {
	@Input()
	value: string | number;
	@Input()
	rowData: any;
	constructor() {}
}
