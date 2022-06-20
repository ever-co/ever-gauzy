import { Component } from '@angular/core';
import { ViewCell } from 'ng2-smart-table';

@Component({
	template: `<div>
		<div
			*ngIf="!value"			
		>
			<div class="badge badge-disabled">
				{{ 'INVENTORY_PAGE.INACTIVE' | translate }}
			</div>
		</div>
		<div *ngIf="value">
			<div class="badge badge-success">
				{{ 'INVENTORY_PAGE.ACTIVE' | translate }}
			</div>
		</div>
	</div>
	`,
	styles: [
		`
			.badge-disabled {
				background-color: #ccc;
			}

			.badge {
				text-align: center;
				padding: 6px 8px 4px;
			}
		`
	]
})
export class EnabledStatusComponent implements ViewCell {
	value: any;
	rowData: any;
}
