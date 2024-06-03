import { Component, EventEmitter, Input, OnInit, Output, ViewChild } from '@angular/core';
import { UntypedFormBuilder, UntypedFormGroup } from '@angular/forms';
import { IOrganization, IUserOrganization, RolesEnum } from '@gauzy/contracts';
import { TranslationBaseComponent } from '@gauzy/ui-sdk/shared';
import { TranslateService } from '@ngx-translate/core';
import { Store } from '@gauzy/ui-sdk/common';
import { BasicInfoFormComponent } from '../../../@shared/user/forms/basic-info/basic-info-form.component';
import { UsersOrganizationsService } from '@gauzy/ui-sdk/core';

@Component({
	selector: 'ga-edit-user-mutation',
	templateUrl: './edit-user-mutation.component.html',
	styleUrls: ['./edit-user-mutation.component.scss']
})
export class EditUserMutationComponent extends TranslationBaseComponent implements OnInit {
	@ViewChild('userBasicInfo')
	userBasicInfo: BasicInfoFormComponent;
	@Input()
	userOrganization: IUserOrganization;
	@Input()
	organization: IOrganization;

	@Output()
	canceled = new EventEmitter();
	@Output()
	addOrEditUser = new EventEmitter();

	form: UntypedFormGroup;
	users: string[];
	selectedUsersIds: string[];
	selectedOrganizationId: string;
	disableButton = true;

	constructor(
		private readonly fb: UntypedFormBuilder,
		private usersOrganizationsService: UsersOrganizationsService,
		readonly translateService: TranslateService,
		private readonly store: Store
	) {
		super(translateService);
	}

	ngOnInit() {
		this._initializeForm();
		this._loadUsers();
	}

	private async _initializeForm() {
		this.form = this.fb.group({
			users: this.users
		});
	}

	private async _loadUsers() {
		const { tenantId } = this.store.user;
		const { id: organizationId } = this.store.selectedOrganization;

		const { items } = await this.usersOrganizationsService.getAll(['user', 'user.role', 'user.tags'], { tenantId });

		const usersVm = [];
		const existedUsers = items.filter((item) => item.organizationId === organizationId).map((item) => item.userId);

		for (const orgUser of items.filter((item) => !existedUsers.includes(item.userId))) {
			if (orgUser.isActive && orgUser.user.role.name !== RolesEnum.EMPLOYEE) {
				usersVm.push({
					firstName: orgUser.user.firstName || '',
					lastName: orgUser.user.lastName || '',
					email: orgUser.user.email,
					id: orgUser.userId,
					isActive: orgUser.isActive,
					imageUrl: orgUser.user.imageUrl,
					user: orgUser.user
				});
			}
		}

		const distinct = usersVm.reduce(
			(acc, curr) => (acc.some((user) => user.id === curr.id) ? acc : [...acc, curr]),
			[]
		);

		this.users = distinct;
	}

	onUsersSelected(users: string[]) {
		this.selectedUsersIds = users;

		if (this.selectedUsersIds.length > 0) {
			this.disableButton = false;
		} else {
			this.disableButton = true;
		}
	}

	cancel() {
		this.canceled.emit();
	}

	async submitForm() {
		if (this.form.valid) {
			for (let i = 0; i < this.selectedUsersIds.length; i++) {
				const organization = this.store.selectedOrganization;
				this.addOrEditUser.emit({
					userId: this.selectedUsersIds[i],
					organizationId: organization.id,
					tenantId: organization.tenantId,
					isActive: true
				});
			}
		}
	}
}
