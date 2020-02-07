import { Component, Input } from '@angular/core';
import { ViewCell } from 'ng2-smart-table';

@Component({
	templateUrl: './request-approval-icon.html',
	styleUrls: ['./request-approval-icon.scss']
})
export class RequestApprovalIcon implements ViewCell {
	@Input()
	rowData: any;

	value: string | number;
}
