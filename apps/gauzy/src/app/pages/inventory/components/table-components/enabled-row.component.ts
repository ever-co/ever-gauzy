import { Component } from '@angular/core';
import { ViewCell } from 'ng2-smart-table';

@Component({
	template: `<div>
		<nb-icon *ngIf="rowData.enabled" icon="checkmark"></nb-icon>
		<nb-icon *ngIf="!rowData.enabled" icon="close"></nb-icon>
	</div> `
})
export class EnabledStatusComponent implements ViewCell {
	value: string | number;
	rowData: any;
}
