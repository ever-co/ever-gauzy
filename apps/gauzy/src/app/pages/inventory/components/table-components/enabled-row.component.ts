import { Component } from '@angular/core';
import { ViewCell } from 'ng2-smart-table';

@Component({
	template: `<div>
		<nb-icon *ngIf="value" icon="checkmark"></nb-icon>
		<nb-icon *ngIf="!value" icon="close"></nb-icon>
	</div> `
})
export class EnabledStatusComponent implements ViewCell {
	value: any;
	rowData: any;
}
