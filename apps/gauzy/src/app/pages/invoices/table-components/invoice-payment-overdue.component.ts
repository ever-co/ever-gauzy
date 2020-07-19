import { Component } from '@angular/core';

@Component({
	template: `
		<div class="text-center d-block" *ngIf="rowData.overdue">
			<div class="badge-danger">
				{{ 'INVOICES_PAGE.PAYMENTS.OVERDUE' | translate }}
			</div>
		</div>
		<div class="text-center d-block" *ngIf="!rowData.overdue">
			<div class="badge-success">
				{{ 'INVOICES_PAGE.PAYMENTS.ON_TIME' | translate }}
			</div>
		</div>
	`,
	styles: []
})
export class InvoicePaymentOverdueComponent {
	rowData: any;
}
