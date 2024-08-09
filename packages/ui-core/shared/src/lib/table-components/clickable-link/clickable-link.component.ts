import { Component, Input, OnInit } from '@angular/core';

@Component({
	selector: 'ngx-clickable-link',
	templateUrl: './clickable-link.component.html',
	styleUrls: ['./clickable-link.component.scss']
})
export class ClickableLinkComponent implements OnInit {

	@Input() value: string;
	@Input() rowData: any;
	@Input() href: string;
	@Input() target: string = '_blank';

	ngOnInit() {
		// Your custom logic here
	}
}
