import { Component, Input, OnInit } from '@angular/core';
import { ViewCell } from 'ng2-smart-table';
import { RequestApprovalStatusTypesEnum } from '@gauzy/models';

@Component({
	selector: 'ngx-equipment-sharing-status',
	templateUrl: './equipment-sharing-status.component.html'
})
export class EquipmentSharingStatusComponent implements ViewCell, OnInit {
	@Input()
	rowData: any;

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
