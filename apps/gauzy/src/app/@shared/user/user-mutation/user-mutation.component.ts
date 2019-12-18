import { Component, OnInit, ViewChild } from '@angular/core';
import { NbDialogRef, NbToastrService } from '@nebular/theme';
import { BasicInfoFormComponent } from '../forms/basic-info/basic-info-form.component';
import { RolesEnum, Employee, UserOrganization } from '@gauzy/models';
import { OrganizationsService } from '../../../@core/services/organizations.service';
import { EmployeesService } from '../../../@core/services/employees.service';
import { Store } from '../../../@core/services/store.service';
import { first } from 'rxjs/operators';
import { UsersService } from '../../../@core/services';
import { UsersOrganizationsService } from '../../../@core/services/users-organizations.service';

@Component({
	selector: 'ga-user-mutation',
	templateUrl: './user-mutation.component.html',
	styleUrls: ['./user-mutation.component.scss']
})
export class UserMutationComponent implements OnInit {
	@ViewChild('userBasicInfo', { static: false })
	userBasicInfo: BasicInfoFormComponent;

	constructor(
		protected dialogRef: NbDialogRef<UserMutationComponent>,
		protected organizationsService: OrganizationsService,
		protected usersOrganizationsService: UsersOrganizationsService,
		protected store: Store,
		private toastrService: NbToastrService
	) {}

	ngOnInit(): void {}

	closeDialog(userOrganization: UserOrganization = null) {
		this.dialogRef.close(userOrganization);
	}

	async add() {
		try {
			const user = await this.userBasicInfo.registerUser(
				RolesEnum.VIEWER
			);
			const organization = this.store.selectedOrganization;
			const userOrganization = await this.usersOrganizationsService
				.create({
					userId: user.id,
					orgId: organization.id,
					isActive: true
				})
				.pipe(first())
				.toPromise();

			this.closeDialog({ ...userOrganization, user });
		} catch (error) {
			this.toastrService.danger(
				error.error ? error.error.message : error.message,
				'Error'
			);
		}
	}
}
