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
				width: 100%;
				text-align: center;
				padding: 5px 30px;
			}
		`
	]
})
export class FeedbackStatusTableComponent {
	@Input()
	rowData: any;
}
