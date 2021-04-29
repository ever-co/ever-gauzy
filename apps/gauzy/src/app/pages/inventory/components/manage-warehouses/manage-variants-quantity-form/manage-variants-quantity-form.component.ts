import { Component, ViewChild, ElementRef, OnInit } from '@angular/core';
import { ViewCell } from 'ng2-smart-table';

@Component({
	templateUrl: './manage-variants-quantity-form.component.html',
	styleUrls: ['./manage-variants-quantity-form.component.scss']
})
export class ManageVariantsQuantityComponent implements ViewCell, OnInit {
	value: any;
	rowData: any;

	constructor() {}

	ngOnInit() {
		//tstodo
		console.log(this.value, 'value');
	}
}
