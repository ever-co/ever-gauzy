import { Component, OnInit } from '@angular/core';

@Component({
	template: `
		<div
			class="text-center d-block"
			*ngIf="!rowData.isAccepted && !isPending"
		>
			<div class="badge-danger">
				{{ 'INVOICES_PAGE.ESTIMATES.REJECTED' | translate }}
			</div>
		</div>
		<div class="text-center d-block" *ngIf="rowData.isAccepted">
			<div class="badge-success">
				{{ 'INVOICES_PAGE.ESTIMATES.ACCEPTED' | translate }}
			</div>
		</div>
		<div class="text-center d-block" *ngIf="isPending">
			<div class="badge-neutral">
				Pending
			</div>
		</div>
	`,
	styles: ['.badge-neutral { background-color: #e0e0e0; }']
})
export class EstimateAcceptedComponent implements OnInit {
	rowData: any;
	isPending: boolean;

	ngOnInit() {
		if (this.rowData.isAccepted === null) {
			this.isPending = true;
		}
	}
}
