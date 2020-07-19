import { Component, Input } from '@angular/core';
import { ViewCell } from 'ng2-smart-table';

@Component({
	selector: 'ngx-approval-policy',
	templateUrl: './approval-policy.component.html',
	styleUrls: ['./approval-policy.component.html']
})
export class ApprovalPolicyComponent implements ViewCell {
	@Input()
	rowData: any;

	value: any;
}
