import { Component, OnInit, Input, EventEmitter, Output } from '@angular/core';
import { IOrganization } from '@gauzy/contracts';
import { TranslationBaseComponent } from '../../../../../@shared/language-base/translation-base.component';
import { OrganizationsService } from '../../../../../@core/services/organizations.service';
import { FormGroup, FormBuilder } from '@angular/forms';
import { TranslateService } from '@ngx-translate/core';
import { UsersOrganizationsService } from '../../../../../@core/services/users-organizations.service';
import { UserIdService } from '../../../../../@core/services/edit-user-data.service';
import { Store } from '../../../../../@core/services/store.service';

@Component({
	selector: 'ga-edit-user-organizations-mutation',
	templateUrl: './edit-user-organizations-mutation.component.html'
})
export class EditUserOrganizationsMutationComponent
	extends TranslationBaseComponent
	implements OnInit {
	@Input()
	organization: IOrganization;

	@Output()
	canceled = new EventEmitter();
	@Output()
	addOrg = new EventEmitter();

	form: FormGroup;
	organizations: IOrganization[];
	selectedOrganizationsId: string[];
	selectedUserId: string;
	userId: string;

	constructor(
		private readonly fb: FormBuilder,
		private organizationsService: OrganizationsService,
		private usersOrganizationService: UsersOrganizationsService,
		readonly translateService: TranslateService,
		private userIdService: UserIdService,
		private store: Store
	) {
		super(translateService);
	}

	ngOnInit() {
		this._loadOrganizations();
		this._initializeForm();
	}

	private async _initializeForm() {
		this.form = this.fb.group({
			organizations: this.organizations
		});
	}

	private async _loadOrganizations() {
		const { tenantId } = this.store.user;
		const users = await this.usersOrganizationService.getAll(
			['user', 'user.role'],
			{
				tenantId
			}
		);

		const { items } = await this.usersOrganizationService.getAll([], {
			id: this.userIdService.userId,
			tenantId
		});

		this.selectedUserId = items[0].userId;

		const all_orgs = await this.organizationsService.getAll([], {
			tenantId
		});

		const excludedOrgs = users.items.filter(
			(item) => item.user.id === items[0].userId
		);

		const filtered = all_orgs.items.filter(
			(a) => !excludedOrgs.filter((b) => b.organizationId === a.id).length
		);

		this.organizations = filtered;
	}

	cancel() {
		this.canceled.emit();
	}

	onOrganizationsSelected(organizations: string[]) {
		this.selectedOrganizationsId = organizations;
	}

	async submitForm() {
		if (this.form.valid) {
			const { tenantId } = this.store.user;
			for (let i = 0; i < this.selectedOrganizationsId.length; i++) {
				this.addOrg.emit({
					userId: this.selectedUserId,
					organizationId: this.selectedOrganizationsId[i],
					tenantId,
					isActive: true
				});
			}
		}
	}
}
