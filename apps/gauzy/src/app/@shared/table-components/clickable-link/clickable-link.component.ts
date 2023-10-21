import { Component, Input, OnInit } from '@angular/core';
import { ViewCell } from 'ng2-smart-table';

@Component({
	selector: 'ngx-clickable-link',
	templateUrl: './clickable-link.component.html',
	styleUrls: ['./clickable-link.component.scss']
})
export class ClickableLinkComponent implements OnInit, ViewCell {

	@Input() value: string;
	@Input() rowData: any;
	@Input() href: string;
	@Input() target: string = '_blank';

	ngOnInit() {
		// Your custom logic here
	}
}
