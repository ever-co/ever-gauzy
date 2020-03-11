import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { FormBuilder, FormGroup } from '@angular/forms';
import { Employee, Organization, UserOrganization } from '@gauzy/models';
import { UsersOrganizationsService } from '../../../@core/services/users-organizations.service';
import { TranslationBaseComponent } from '../../../@shared/language-base/translation-base.component';
import { TranslateService } from '@ngx-translate/core';
import { NbToastrService } from '@nebular/theme';
import { Store } from '../../../@core/services/store.service';

@Component({
	selector: 'ga-edit-user-mutation',
	templateUrl: './edit-user-mutation.component.html'
})
export class EditUserMutationComponent extends TranslationBaseComponent
	implements OnInit {
	@Input()
	employees: Employee[];
	@Input()
	userOrganization: UserOrganization;
	@Input()
	organization: Organization;

	@Output()
	canceled = new EventEmitter();
	@Output()
	addOrEditUser = new EventEmitter();

	form: FormGroup;
	users: string[];
	selectedUsersIds: string[];
	selectedOrganizationId: string;

	constructor(
		private readonly fb: FormBuilder,
		private userOrganizationsService: UsersOrganizationsService,
		readonly translateService: TranslateService,
		private readonly toastrService: NbToastrService,
		private readonly store: Store
	) {
		super(translateService);
	}

	ngOnInit() {
		this._initializeForm();
		this._loadUsers();
	}

	private async _initializeForm() {
		// if (!this.organization) {
		// 	return;
		// }

		this.form = this.fb.group({
			users: this.users
		});
	}

	private async _loadUsers() {
		const { items } = await this.userOrganizationsService.getAll(['user']);

		const usersVm = [];

		for (const orgUser of items.filter(
			(item) => item.orgId !== this.store.selectedOrganization.id
		)) {
			usersVm.push({
				fullName: `${orgUser.user.firstName || ''} ${orgUser.user
					.lastName || ''}`,
				email: orgUser.user.email,
				id: orgUser.id,
				isActive: orgUser.isActive,
				imageUrl: orgUser.user.imageUrl,
				user: orgUser.user
			});
		}

		this.users = usersVm;
	}

	onUsersSelected(users: string[]) {
		this.selectedUsersIds = users;
	}

	cancel() {
		this.canceled.emit();
	}

	async addOneOrMany() {
		if (this.form.valid) {
			this.toastrService.primary(
				this.getTranslation(
					'NOTES.ORGANIZATIONS.ADD_NEW_USER_TO_ORGANIZATION',
					{
						username: '',
						orgname: ''
					}
				),
				this.getTranslation('TOASTR.TITLE.SUCCESS')
			);
		}
	}
}
