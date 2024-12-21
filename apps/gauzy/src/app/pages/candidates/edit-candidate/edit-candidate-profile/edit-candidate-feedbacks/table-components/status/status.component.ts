import { Component, Input } from '@angular/core';

@Component({
    selector: 'ga-feedback-status',
    template: `
		<div *ngIf="rowData?.status === 'REJECTED'">
			<div class="badge badge-danger">
				{{ 'CANDIDATES_PAGE.REJECTED' | translate }}
			</div>
		</div>
		<div *ngIf="rowData?.status === 'HIRED'">
			<div class="badge badge-success">
				{{ 'CANDIDATES_PAGE.HIRED' | translate }}
			</div>
		</div>
	`,
    styles: [
        `
			.badge-danger {
				background-color: #ff3d71;
			}
			.badge-success {
				background-color: #00d68f;
			}
			.badge {
				width: fit-content;
				display: flex;
				justify-content: center;
				align-items: center;
				padding: 5px 8px;
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
export class FeedbackStatusTableComponent {
	@Input()
	rowData: any;
}
