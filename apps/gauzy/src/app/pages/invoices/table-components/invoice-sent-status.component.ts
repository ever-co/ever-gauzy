import { Component } from '@angular/core';

@Component({
	template: `
		<div class="text-center d-block" *ngIf="!rowData.sentStatus">
			<div class="badge-danger">
				{{ 'INVOICES_PAGE.SEND.NOT_SENT' | translate }}
			</div>
		</div>
		<div class="text-center d-block" *ngIf="rowData.sentStatus">
			<div class="badge-success">
				{{ 'INVOICES_PAGE.SEND.SENT' | translate }}
			</div>
		</div>
	`,
	styles: []
})
export class InvoiceSentStatusComponent {
	rowData: any;
}
