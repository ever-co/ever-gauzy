import { Component, Input, OnInit } from '@angular/core';
import { ViewCell } from 'ng2-smart-table';

@Component({
	selector: 'gauzy-name-with-description',
	templateUrl: './name-with-description.component.html',
	styleUrls: ['./name-with-description.component.scss']
})
export class NameWithDescriptionComponent implements OnInit, ViewCell {
	@Input()
	value: string | number;
	@Input()
	rowData: any;

	constructor() {}
	ngOnInit(): void {}
}
