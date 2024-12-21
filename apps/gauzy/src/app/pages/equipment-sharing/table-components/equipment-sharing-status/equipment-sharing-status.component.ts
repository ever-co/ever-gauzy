import { Component, Input, OnInit } from '@angular/core';
import { RequestApprovalStatusTypesEnum } from '@gauzy/contracts';

@Component({
    selector: 'ngx-equipment-sharing-status',
    templateUrl: './equipment-sharing-status.component.html',
    standalone: false
})
export class EquipmentSharingStatusComponent implements OnInit {

	@Input() rowData: any;
	value: string | number;

	ngOnInit(): void {
		switch (this.value) {
			case RequestApprovalStatusTypesEnum.APPROVED:
				this.value = 'EQUIPMENT_SHARING_PAGE.APPROVED';
				break;
			case RequestApprovalStatusTypesEnum.REFUSED:
				this.value = 'EQUIPMENT_SHARING_PAGE.REFUSED';
				break;
			default:
				this.value = 'EQUIPMENT_SHARING_PAGE.REQUESTED';
				break;
		}
	}
}
