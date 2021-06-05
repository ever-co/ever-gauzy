import {Component, OnChanges, SimpleChanges} from '@angular/core';
import { DefaultFilter } from 'ng2-smart-table';
import { PaymentMethodEnum } from '@gauzy/contracts';

@Component({
    template: `
        <ng-select
            [clearable]="true"
            [closeOnSelect]="true"
            [placeholder]="'INVOICES_PAGE.PAYMENTS.PAYMENT_METHOD' | translate" 
            (change)="onChange($event)"
        >
            <ng-option *ngFor="let paymentMethod of paymentMethods" [value]="paymentMethod">
                {{ 'INVOICES_PAGE.PAYMENTS.' + paymentMethod | translate }}
            </ng-option>
        </ng-select>
    `,
})
export class PaymentMethodFilterComponent extends DefaultFilter implements OnChanges {
    
    paymentMethods = Object.values(PaymentMethodEnum);

    constructor() {
        super();
    }

    ngOnChanges(changes: SimpleChanges) {}

    onChange(event) {
        this.column.filterFunction(event);
    }
}