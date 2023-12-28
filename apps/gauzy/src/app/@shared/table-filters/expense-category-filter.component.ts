import { Component, OnChanges, SimpleChanges } from '@angular/core';
import { DefaultFilter } from 'angular2-smart-table';
import { IOrganizationVendor } from '@gauzy/contracts';

@Component({
    template: `
        <ga-expense-category-select
            [clearable]="true"
            [searchable]="false"
            [addTag]="false"
            [placeholder]="'SM_TABLE.CATEGORY' | translate"
            (onChanged)="selectedVendorEvent($event)"
        ></ga-expense-category-select>
    `,
})
export class ExpenseCategoryFilterComponent extends DefaultFilter implements OnChanges {

    constructor() {
        super();
    }

    /**
     *
     * @param changes
     */
    ngOnChanges(changes: SimpleChanges) { }

    /**
     *
     * @param event
     */
    onChange(event) {
        // this.column.filterFunction(event);
    }

    /**
     *
     * @param currentTagSelection
     */
    selectedVendorEvent(currentTagSelection: IOrganizationVendor) {
        // this.column.filterFunction(currentTagSelection);
    }
}
