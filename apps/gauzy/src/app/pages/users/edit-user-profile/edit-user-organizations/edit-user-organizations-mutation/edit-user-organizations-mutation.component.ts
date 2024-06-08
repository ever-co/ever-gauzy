import { Component, OnInit, Input, EventEmitter, Output } from '@angular/core';
import { UntypedFormBuilder, UntypedFormGroup } from '@angular/forms';
import { TranslateService } from '@ngx-translate/core';
import { IOrganization } from '@gauzy/contracts';
import { TranslationBaseComponent } from '@gauzy/ui-sdk/i18n';
import { OrganizationsService, UserIdService, UsersOrganizationsService } from '@gauzy/ui-sdk/core';
import { Store } from '@gauzy/ui-sdk/common';

@Component({
	selector: 'ga-edit-user-organizations-mutation',
	templateUrl: './edit-user-organizations-mutation.component.html',
	styleUrls: ['../../../edit-user-mutation/edit-user-mutation.component.scss']
})
export class EditUserOrganizationsMutationComponent extends TranslationBaseComponent implements OnInit {
	@Input()
	organization: IOrganization;

	@Output()
	canceled = new EventEmitter();
	@Output()
	addOrg = new EventEmitter();

	form: UntypedFormGroup;
	organizations: IOrganization[];
	selectedOrganizationsId: string[];
	selectedUserId: string;
	userId: string;

	constructor(
		private readonly fb: UntypedFormBuilder,
		private readonly organizationsService: OrganizationsService,
		private readonly usersOrganizationService: UsersOrganizationsService,
		public readonly translateService: TranslateService,
		private readonly userIdService: UserIdService,
		private readonly store: Store
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
		const users = await this.usersOrganizationService.getAll(['user', 'user.role'], {
			tenantId
		});

		const { items } = await this.usersOrganizationService.getAll([], {
			userId: this.userIdService.userId,
			tenantId
		});

		this.selectedUserId = items[0].userId;

		const all_orgs = await this.organizationsService.getAll({
			tenantId
		});

		const excludedOrgs = users.items.filter((item) => item.user.id === items[0].userId);

		const filtered = all_orgs.items.filter((a) => !excludedOrgs.filter((b) => b.organizationId === a.id).length);

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
