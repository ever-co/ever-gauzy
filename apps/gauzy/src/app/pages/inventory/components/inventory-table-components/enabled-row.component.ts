import { Component, Input } from '@angular/core';

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
    ],
    standalone: false
})
export class EnabledStatusComponent {
	@Input() value: any;
	@Input() rowData: any;
}
