import { Component } from '@angular/core';

@Component({
    template: `<div>
    {{value | json}}
        <nb-checkbox [checked]="rowData && rowData.selected" (change)="onValueChange($event)" status="basic"></nb-checkbox>
	</div> `
})
export class SelectedRowComponent {
    value: any;
    rowData: any;

    onValueChange(e) {
        this.rowData.selected = e.target.checked;
    }

}
