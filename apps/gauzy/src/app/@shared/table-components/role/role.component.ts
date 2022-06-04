import { Component, Input, OnInit } from '@angular/core';
import { NbComponentStatus } from '@nebular/theme';
import { ViewCell } from 'ng2-smart-table';
import { RolesEnum } from 'packages/contracts/dist';

@Component({
	selector: 'gauzy-role',
	templateUrl: './role.component.html',
	styleUrls: ['./role.component.scss']
})
export class RoleComponent implements OnInit, ViewCell {
	@Input()
	value: string | number;
	@Input()
	rowData: any;

	status: NbComponentStatus;

	constructor() {}

	ngOnInit(): void {
		switch (this.rowData?.role) {
			case RolesEnum.ADMIN:
				this.status = 'primary';
				break;
			case RolesEnum.CANDIDATE:
				this.status = 'control';
				break;
			case RolesEnum.SUPER_ADMIN:
				this.status = 'success';
				break;
			case RolesEnum.DATA_ENTRY:
				this.status = 'info';
				break;
			case RolesEnum.INTERVIEWER:
				this.status = 'primary';
				break;
			case RolesEnum.MANAGER:
				this.status = 'danger';
				break;
			case RolesEnum.VIEWER:
				this.status = 'warning';
				break;
			case RolesEnum.EMPLOYEE:
				this.status = 'info';
				break;
			default:
				break;
		}
	}
}
