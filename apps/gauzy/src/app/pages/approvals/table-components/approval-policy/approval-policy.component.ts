import { Component, Input } from '@angular/core';

@Component({
    selector: 'ngx-approval-policy-table',
    templateUrl: './approval-policy.component.html',
    styleUrls: ['./approval-policy.component.scss'],
    standalone: false
})
export class ApprovalPolicyComponent {
	@Input()
	rowData: any;

	value: any;
}
