import { Component, Input, OnInit } from '@angular/core';
import { ViewCell } from 'ng2-smart-table';
import { ApprovalPolicyTypesEnum } from '@gauzy/models';

@Component({
	selector: 'ngx-request-approval-status',
	templateUrl: './approval-policy-status.component.html'
})
export class ApprovalPolicyStatusComponent implements ViewCell, OnInit {
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
			case ApprovalPolicyTypesEnum.TIME_OFF:
				this.value = 'Time Off';
				break;
		}
	}
}
