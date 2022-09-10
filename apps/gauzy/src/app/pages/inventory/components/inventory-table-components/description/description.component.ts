import {Component, Input, OnInit} from '@angular/core';
import {ViewCell} from "ng2-smart-table";

@Component({
	selector: 'gauzy-description',
	templateUrl: './description.component.html',
	styleUrls: ['./description.component.css']
})
export class DescriptionComponent implements OnInit, ViewCell {
	@Input()
	value: string | number;
	@Input()
	rowData: any;

	constructor() {
	}

	ngOnInit(): void {
	}
}
