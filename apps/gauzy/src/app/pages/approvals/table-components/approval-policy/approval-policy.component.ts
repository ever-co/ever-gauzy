import { Component, Input, ChangeDetectionStrategy } from '@angular/core';

@Component({
    selector: 'ngx-approval-policy-table',
    templateUrl: './approval-policy.component.html',
    styleUrls: ['./approval-policy.component.scss'],
    changeDetection: ChangeDetectionStrategy.Eager,
    standalone: false
})
export class ApprovalPolicyComponent {
	@Input()
	rowData: any;

	value: any;
}
