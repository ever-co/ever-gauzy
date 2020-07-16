import { Component, Input, OnInit, Output, EventEmitter } from '@angular/core';
import { ViewCell } from 'ng2-smart-table';
import { RequestApprovalStatusTypesEnum } from '@gauzy/models';

@Component({
	selector: 'ngx-equipment-sharing-action',
	templateUrl: './equipment-sharing-action.component.html'
})
export class EquipmentSharingActionComponent implements ViewCell, OnInit {
	@Input() rowData: any;
	@Output() updateResult = new EventEmitter<any>();
	isApproval = true;
	isRefuse = true;

	value: string | number;

	ngOnInit(): void {
		if (this.rowData && this.rowData.status) {
			switch (this.rowData.status) {
				case RequestApprovalStatusTypesEnum.APPROVED:
				case RequestApprovalStatusTypesEnum.REFUSED:
					this.isApproval = false;
					this.isRefuse = false;
					break;
				default:
					this.isApproval = true;
					this.isRefuse = true;
					break;
			}
		}
	}

	approval() {
		const params = {
			isApproval: true,
			data: this.rowData
		};
		this.updateResult.emit(params);
	}
	refuse() {
		const params = {
			isApproval: false,
			data: this.rowData
		};
		this.updateResult.emit(params);
	}
}
