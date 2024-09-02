import { Component, Input } from '@angular/core';

@Component({
	selector: 'ngx-approval-policy-table',
	templateUrl: './approval-policy.component.html',
	styleUrls: ['./approval-policy.component.scss']
})
export class ApprovalPolicyComponent {
	@Input()
	rowData: any;

	value: any;
}
