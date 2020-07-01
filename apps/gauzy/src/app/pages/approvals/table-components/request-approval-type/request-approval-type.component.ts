import { Component, Input, OnInit } from '@angular/core';
import { ViewCell } from 'ng2-smart-table';
import { ApprovalPolicyTypesEnum } from '@gauzy/models';

@Component({
	selector: 'ngx-request-approval-type',
	templateUrl: './request-approval-type.component.html',
	styleUrls: ['./request-approval-type.component.scss']
})
export class RequestApprovalTypeComponent implements ViewCell, OnInit {
	@Input()
	rowData: any;

	value: string | number;

	ngOnInit(): void {
		switch (this.value) {
			case ApprovalPolicyTypesEnum.BUSINESS_TRIP:
				this.value = 'Business Trip';
				break;
			case ApprovalPolicyTypesEnum.EQUIPMENT_SHARING:
				this.value = 'Equipment Sharing';
				break;
			default:
				this.value = 'Time Off';
				break;
		}
	}
}
