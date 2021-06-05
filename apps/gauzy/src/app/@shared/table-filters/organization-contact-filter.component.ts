import {Component, OnChanges, SimpleChanges} from '@angular/core';
import { DefaultFilter } from 'ng2-smart-table';

@Component({
    template: `
        <ga-contact-select 
            [clearable]="true"
            [placeholder]="'PAYMENTS_PAGE.CONTACT' | translate"
            (onChanged)="onChange($event)"
        ></ga-contact-select>
    `,
})
export class OrganizationContactFilterComponent extends DefaultFilter implements OnChanges {
    
    constructor() {
        super();
    }

    ngOnChanges(changes: SimpleChanges) {}

    onChange(event) {
        this.column.filterFunction(event);
    }
}