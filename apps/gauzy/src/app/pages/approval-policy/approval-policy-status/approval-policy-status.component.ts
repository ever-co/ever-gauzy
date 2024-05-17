import { Component, Input, OnInit } from '@angular/core';
import { ApprovalPolicyTypesEnum } from '@gauzy/contracts';
import { TranslationBaseComponent } from '@gauzy/ui-sdk/shared';

@Component({
	selector: 'ngx-request-approval-status',
	templateUrl: './approval-policy-status.component.html'
})
export class ApprovalPolicyStatusComponent extends TranslationBaseComponent implements OnInit {
	@Input() rowData: any;

	value: string | number;

	ngOnInit(): void {
		switch (this.value) {
			case ApprovalPolicyTypesEnum.BUSINESS_TRIP:
				this.value = this.getTranslation('APPROVAL_POLICY_PAGE.BUSINESS_TRIP');
				break;
			case ApprovalPolicyTypesEnum.EQUIPMENT_SHARING:
				this.value = this.getTranslation('APPROVAL_POLICY_PAGE.EQUIPMENT_SHARING');
				break;
			case ApprovalPolicyTypesEnum.TIME_OFF:
				this.value = this.getTranslation('APPROVAL_POLICY_PAGE.TIME_OFF');
				break;
		}
	}
}
