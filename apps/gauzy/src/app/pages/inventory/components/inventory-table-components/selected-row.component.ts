import { Component } from '@angular/core';
import { ViewCell } from 'angular2-smart-table';

@Component({
    template: `<div>
    {{value | json}}
        <nb-checkbox [checked]="rowData && rowData.selected" (change)="onValueChange($event)" status="basic"></nb-checkbox>
	</div> `
})
export class SelectedRowComponent implements ViewCell {
    value: any;
    rowData: any;

    onValueChange(e) {
        this.rowData.selected = e.target.checked;
    }

}
