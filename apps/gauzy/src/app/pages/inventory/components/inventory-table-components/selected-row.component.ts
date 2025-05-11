import { Component, Input } from '@angular/core';

@Component({
    selector: 'ga-selected-row-table-selector',
    template: `
        <div>
            <nb-checkbox
                [checked]="rowData && rowData.selected"
                (change)="onValueChange($event)"
                status="basic"
            ></nb-checkbox>
        </div>
    `,
    standalone: false
})
export class SelectedRowComponent {

    @Input() value: any;
    @Input() rowData: any;

    onValueChange(event: any) {
        this.rowData.selected = event.target.checked;
    }
}
