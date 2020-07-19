import { Component, OnInit, Input, EventEmitter, Output } from '@angular/core';
import { Organization } from '@gauzy/models';
import { TranslationBaseComponent } from 'apps/gauzy/src/app/@shared/language-base/translation-base.component';
import { OrganizationsService } from 'apps/gauzy/src/app/@core/services/organizations.service';
import { FormGroup, FormBuilder } from '@angular/forms';
import { TranslateService } from '@ngx-translate/core';
import { UsersOrganizationsService } from 'apps/gauzy/src/app/@core/services/users-organizations.service';
import { UserIdService } from 'apps/gauzy/src/app/@core/services/edit-user-data.service';

@Component({
	selector: 'ga-edit-user-organizations-mutation',
	templateUrl: './edit-user-organizations-mutation.component.html'
})
export class EditUserOrganizationsMutationComponent
	extends TranslationBaseComponent
	implements OnInit {
	@Input()
	organization: Organization;

	@Output()
	canceled = new EventEmitter();
	@Output()
	addOrg = new EventEmitter();

	form: FormGroup;
	organizations: Organization[];
	selectedOrganizationsId: string[];
	selectedUserId: string;
	userId: string;

	constructor(
		private readonly fb: FormBuilder,
		private organizationsService: OrganizationsService,
		private usersOrganizationService: UsersOrganizationsService,
		readonly translateService: TranslateService,
		private userIdService: UserIdService
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
		const users = await this.usersOrganizationService.getAll([
			'user',
			'user.role'
		]);

		const { items } = await this.usersOrganizationService.getAll([], {
			id: this.userIdService.userId
		});

		this.selectedUserId = items[0].userId;

		const all_orgs = await this.organizationsService.getAll();

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
			for (let i = 0; i < this.selectedOrganizationsId.length; i++) {
				this.addOrg.emit({
					userId: this.selectedUserId,
					organizationId: this.selectedOrganizationsId[i],
					isActive: true
				});
			}
		}
	}
}
