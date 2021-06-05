import {Component, OnChanges, SimpleChanges} from '@angular/core';
import { DefaultFilter } from 'ng2-smart-table';
import { IOrganizationVendor } from '@gauzy/contracts';

@Component({
    template: `
        <ga-expense-category-select
            [clearable]="true"
            [searchable]="false"
            [addTag]="false"
            [placeholder]="'SM_TABLE.CATEGORY' | translate"
            (onChanged)="selectedVendorEvent($event)"
        >
        </ga-expense-category-select>
    `,
})
export class ExpenseCategoryFilterComponent extends DefaultFilter implements OnChanges {
    
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