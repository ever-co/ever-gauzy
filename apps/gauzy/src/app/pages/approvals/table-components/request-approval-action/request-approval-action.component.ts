import { Component, Input, OnInit, Output, EventEmitter } from '@angular/core';
import { RequestApprovalStatusTypesEnum, ComponentLayoutStyleEnum, RolesEnum } from '@gauzy/contracts';
import { Store } from '@gauzy/ui-sdk/common';

@Component({
	selector: 'ngx-request-approval-action',
	templateUrl: './request-approval-action.component.html'
})
export class RequestApprovalActionComponent implements OnInit {
	@Input()
	rowData: any;
	isApproval = true;
	isRefuse = true;
	isSuperAdmin = false;

	@Output() updateResult = new EventEmitter<any>();

	@Input()
	layout?: ComponentLayoutStyleEnum | undefined;

	@Input()
	value: string | number;

	constructor(private readonly store: Store) {}

	ngOnInit(): void {
		const { role } = this.store.user;
		if (role && role.name === RolesEnum.SUPER_ADMIN) {
			this.isSuperAdmin = true;
		}
		if (this.rowData && this.rowData.status) {
			if (this.isSuperAdmin) {
				switch (this.rowData.status.value) {
					case RequestApprovalStatusTypesEnum.APPROVED:
						this.isApproval = false;
						this.isRefuse = true;
						break;
					case RequestApprovalStatusTypesEnum.REFUSED:
						this.isApproval = true;
						this.isRefuse = false;
						break;
					default:
						this.isApproval = true;
						this.isRefuse = true;
						break;
				}
			} else {
				switch (this.rowData.status.value) {
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
