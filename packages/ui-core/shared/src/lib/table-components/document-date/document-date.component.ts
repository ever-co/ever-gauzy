import { Component, Input, OnInit, ChangeDetectionStrategy } from '@angular/core';

@Component({
    selector: 'ga-document-date',
    template: `
		@if (rowData?.updatedAt) {
		  <div>
		    {{ rowData.updatedAt | dateTimeFormat }}
		  </div>
		}
		`,
    changeDetection: ChangeDetectionStrategy.Eager,
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
