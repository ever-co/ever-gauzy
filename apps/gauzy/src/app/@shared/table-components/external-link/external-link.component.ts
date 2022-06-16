import { Component, Input } from '@angular/core';
import { ViewCell } from 'ng2-smart-table';

@Component({
	selector: 'gauzy-external-link',
	templateUrl: './external-link.component.html',
	styleUrls: ['./external-link.component.scss']
})
export class ExternalLinkComponent implements ViewCell {
	@Input()
	value: string;

	@Input()
	rowData: any;
	
	constructor() {}
}
