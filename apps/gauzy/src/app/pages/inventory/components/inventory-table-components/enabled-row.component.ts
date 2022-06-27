import { Component } from '@angular/core';
import { ViewCell } from 'ng2-smart-table';

@Component({
	template: `<div>
		<div *ngIf="!value">
			<div class="badge badge-disabled">
				{{ 'INVENTORY_PAGE.INACTIVE' | translate }}
			</div>
		</div>
		<div *ngIf="value">
			<div class="badge badge-success">
				{{ 'INVENTORY_PAGE.ACTIVE' | translate }}
			</div>
		</div>
	</div> `,
	styles: [
		`
			.badge-disabled {
				background-color: #ccc;
			}

			.badge {
				text-align: center;
				border-radius: 4px;
				padding: 4px 8px;
				font-size: 12px;
				font-weight: 600;
				line-height: 15px;
				letter-spacing: 0em;
				text-align: left;
			}
		`
	]
})
export class EnabledStatusComponent implements ViewCell {
	value: any;
	rowData: any;
}
