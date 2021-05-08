import { Component } from '@angular/core';
import { ViewCell } from 'ng2-smart-table';

@Component({
	template: `<div>
        <nb-checkbox [checked]="value" (change)="onValueChange($event)" status="basic"></nb-checkbox>
	</div> `
})
export class SelectedRowComponent implements ViewCell {
	value: any;
    rowData: any;

    onValueChange(e) {
        this.rowData.selected = e.target.checked;  
    }
    
}
