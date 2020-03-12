import {
	Component,
	EventEmitter,
	Input,
	OnInit,
	Output,
	ViewChild
} from '@angular/core';
import { FormBuilder, FormGroup } from '@angular/forms';
import { Organization, UserOrganization } from '@gauzy/models';
import { UsersOrganizationsService } from '../../../@core/services/users-organizations.service';
import { TranslationBaseComponent } from '../../../@shared/language-base/translation-base.component';
import { TranslateService } from '@ngx-translate/core';
import { NbToastrService } from '@nebular/theme';
import { Store } from '../../../@core/services/store.service';
import { BasicInfoFormComponent } from '../../../@shared/user/forms/basic-info/basic-info-form.component';

@Component({
	selector: 'ga-edit-user-mutation',
	templateUrl: './edit-user-mutation.component.html'
})
export class EditUserMutationComponent extends TranslationBaseComponent
	implements OnInit {
	@ViewChild('userBasicInfo', { static: false })
	userBasicInfo: BasicInfoFormComponent;
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
		private usersOrganizationsService: UsersOrganizationsService,
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
		this.form = this.fb.group({
			users: this.users
		});
	}

	private async _loadUsers() {
		const { items } = await this.usersOrganizationsService.getAll(['user']);

		const usersVm = [];

		const existedUsers = items
			.filter((item) => item.orgId === this.store.selectedOrganization.id)
			.map((item) => item.userId);

		for (const orgUser of items.filter(
			(item) => !existedUsers.includes(item.userId)
		)) {
			usersVm.push({
				fullName: `${orgUser.user.firstName || ''} ${orgUser.user
					.lastName || ''}`,
				email: orgUser.user.email,
				id: orgUser.userId,
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

	async submitForm() {
		if (this.form.valid) {
			for (let i = 0; i < this.selectedUsersIds.length; i++) {
				console.log(this.selectedUsersIds[i]);
				const organization = this.store.selectedOrganization;
				this.addOrEditUser.emit({
					userId: this.selectedUsersIds[i],
					orgId: organization.id,
					isActive: true
				});
			}
		}
	}
}
