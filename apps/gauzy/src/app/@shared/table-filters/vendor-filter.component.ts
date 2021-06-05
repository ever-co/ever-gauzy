import {Component, OnChanges, SimpleChanges} from '@angular/core';
import { DefaultFilter } from 'ng2-smart-table';
import { IOrganizationVendor } from '@gauzy/contracts';

@Component({
    template: `
        <ga-vendor-select
            [clearable]="true"
            [searchable]="false"
            [addTag]="false"
            [placeholder]="'SM_TABLE.VENDOR' | translate"
            (onChanged)="selectedVendorEvent($event)"
        >
        </ga-vendor-select>
    `,
})
export class VendorFilterComponent extends DefaultFilter implements OnChanges {
    
    constructor() {
        super();
    }

    ngOnChanges(changes: SimpleChanges) {}

    onChange(event) {
        this.column.filterFunction(event);
    }

    selectedVendorEvent(currentTagSelection: IOrganizationVendor) {
        this.column.filterFunction(currentTagSelection);
	}
}