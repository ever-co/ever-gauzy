import { Component, Input, OnInit } from '@angular/core';
import { ViewCell } from 'ng2-smart-table';
import { RequestApprovalStatusTypesEnum } from '@gauzy/models';

@Component({
	selector: 'ngx-request-approval-status',
	templateUrl: './request-approval-status.component.html',
	styleUrls: ['./request-approval-status.component.html']
})
export class RequestApprovalStatusComponent implements ViewCell, OnInit {
	@Input()
	rowData: any;

	value: string | number;

	ngOnInit(): void {
		switch (this.value) {
			case RequestApprovalStatusTypesEnum.APPROVED:
				this.value = 'Approved';
				break;
			case RequestApprovalStatusTypesEnum.REFUSED:
				this.value = 'Refused';
				break;
			default:
				this.value = 'Requested';
				break;
		}
	}
}
