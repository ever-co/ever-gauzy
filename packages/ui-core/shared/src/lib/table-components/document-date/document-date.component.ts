import { Component, Input, OnInit } from '@angular/core';

@Component({
    selector: 'ga-document-date',
    template: `
		<div *ngIf="rowData?.updatedAt">
			{{ rowData.updatedAt | dateTimeFormat }}
		</div>
	`,
    standalone: false
})
export class DocumentDateTableComponent implements OnInit {
	@Input()
	rowData: any;
	ngOnInit() {
		this.rowData.updatedAt =
			new Date(this.rowData.updatedAt).toDateString() +
			', ' +
			new Date(this.rowData.updatedAt).toLocaleTimeString();
	}
}
