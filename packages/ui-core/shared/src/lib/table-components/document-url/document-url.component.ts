import { Component, Input, OnInit } from '@angular/core';

@Component({
    selector: 'ga-document-url',
    template: `
		<div *ngIf="rowData?.documentUrl">
			{{ url }}
		</div>
	`,
    standalone: false
})
export class DocumentUrlTableComponent implements OnInit {
	@Input()
	rowData: any;
	url: string;
	ngOnInit() {
		this.url =
			this.rowData.documentUrl.slice(0, 25) +
			'...' +
			this.rowData.documentUrl.slice(-10, -1);
	}
}
