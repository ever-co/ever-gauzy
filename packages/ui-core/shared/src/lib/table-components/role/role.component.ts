import { Component, Input, OnInit } from '@angular/core';
import { NbComponentStatus } from '@nebular/theme';
import { IRole, RolesEnum } from '@gauzy/contracts';

@Component({
	selector: 'gauzy-role',
	templateUrl: './role.component.html',
	styleUrls: ['./role.component.scss']
})
export class RoleComponent implements OnInit {
	@Input()
	value: string | number | any;

	/*
	* Getter & Setter for status
	*/
	_status: NbComponentStatus;
	get status(): NbComponentStatus {
		return this._status;
	}
	@Input() set status(value: NbComponentStatus) {
		this._status = value;
	}

	/*
	* Getter & Setter for role
	*/
	_role: IRole;
	get role(): IRole {
		return this._role;
	}
	@Input() set role(value: IRole) {
		this._role = value;
	}

	constructor() {}

	ngOnInit(): void {
		this.role = this.value;
		switch (this.role.name) {
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
