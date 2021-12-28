import { Component, OnInit, ViewChild, Input } from '@angular/core';
import { RolesEnum, IUser } from '@gauzy/contracts';
import { NbDialogRef } from '@nebular/theme';
import { Store, ToastrService } from '../../../@core/services';
import { BasicInfoFormComponent } from '../forms/basic-info/basic-info-form.component';

@Component({
	selector: 'ga-user-mutation',
	templateUrl: './user-mutation.component.html',
	styleUrls: ['./user-mutation.component.scss']
})
export class UserMutationComponent implements OnInit {
	
	@ViewChild('userBasicInfo')
	userBasicInfo: BasicInfoFormComponent;

	/*
	* Getter & Setter for check Super Admin
	*/
	_isSuperAdmin: boolean = false;
	get isSuperAdmin(): boolean {
		return this._isSuperAdmin;
	}
	@Input() set isSuperAdmin(value: boolean) {
		this._isSuperAdmin = value;
	}

	constructor(
		protected readonly dialogRef: NbDialogRef<UserMutationComponent>,
		protected readonly store: Store,
		private readonly toastrService: ToastrService
	) {}

	ngOnInit(): void {}

	closeDialog(user: IUser = null) {
		this.dialogRef.close({ user });
	}

	async add() {
		try {
			const organization = this.store.selectedOrganization;
			const user = await this.userBasicInfo.registerUser(
				RolesEnum.VIEWER, //TODO: take role from the form.
				organization.id,
				this.store.userId
			);
			this.closeDialog(user);
		} catch (error) {
			this.toastrService.danger(error);
		}
	}
}
