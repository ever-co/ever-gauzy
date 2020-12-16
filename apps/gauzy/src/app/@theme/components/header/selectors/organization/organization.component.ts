import { Component, OnInit, OnDestroy } from '@angular/core';
import { IOrganization, OrganizationAction } from '@gauzy/models';
import { Store } from 'apps/gauzy/src/app/@core/services/store.service';
import { filter } from 'rxjs/operators';
import { UsersOrganizationsService } from 'apps/gauzy/src/app/@core/services/users-organizations.service';
import { OrganizationEditStore } from 'apps/gauzy/src/app/@core/services/organization-edit-store.service';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ga-organization-selector',
	templateUrl: './organization.component.html',
	styleUrls: ['./organization.component.scss']
})
export class OrganizationSelectorComponent implements OnInit, OnDestroy {
	organizations: IOrganization[];
	selectedOrganization: IOrganization;

	constructor(
		private store: Store,
		private userOrganizationService: UsersOrganizationsService,
		private readonly _organizationEditStore: OrganizationEditStore
	) {}

	ngOnInit() {
		this.loadSelectedOrganization();
		this.loadOrganizations();
		this.organizationAction();
	}

	selectOrganization(organization: IOrganization) {
		if (organization) {
			this.store.selectedOrganization = organization;
			this.store.organizationId = organization.id;
			this.store.selectedEmployee = null;
		}
	}

	private async loadOrganizations(): Promise<void> {
		const tenantId = this.store.user.tenantId;
		const { items = [] } = await this.userOrganizationService.getAll(
			['organization'],
			{ userId: this.store.userId, tenantId }
		);
		this.organizations = items.map((userOrg) => userOrg.organization);
		if (this.organizations.length > 0) {
			const [defaultOrganization] = this.organizations;
			if (this.store.organizationId) {
				const organization = this.organizations.find(
					(organization: IOrganization) =>
						organization.id === this.store.organizationId
				);
				this.store.selectedOrganization =
					organization || defaultOrganization;
			} else {
				// set first organizations as default
				this.store.selectedOrganization = defaultOrganization;
			}
		}
	}

	private loadSelectedOrganization() {
		this.store.selectedOrganization$
			.pipe(
				filter((organization) => !!organization),
				untilDestroyed(this)
			)
			.subscribe((organization: IOrganization) => {
				this.selectedOrganization = organization;
			});
	}

	private organizationAction() {
		this._organizationEditStore.organizationAction$
			.pipe(
				filter(({ organization }) => !!organization),
				untilDestroyed(this)
			)
			.subscribe(({ organization, action }) => {
				switch (action) {
					case OrganizationAction.CREATED:
						this.createOrganization(organization);
						break;
					case OrganizationAction.UPDATED:
						this.updateOrganization(organization);
						break;
					case OrganizationAction.DELETED:
						this.deleteOrganization(organization);
						break;
					default:
						break;
				}
			});
	}

	/*
	 * After created new organization pushed on dropdown
	 */
	createOrganization(organization: IOrganization) {
		const organizations: IOrganization[] = this.organizations;
		organizations.push(organization);

		this.organizations = [...organizations];
	}

	/*
	 * After updated existing organization changed in the dropdown
	 */
	updateOrganization(organization: IOrganization) {
		let organizations: IOrganization[] = this.organizations;
		organizations = organizations.map((item: IOrganization) =>
			item.id === organization.id ? organization : item
		);

		this.store.selectedOrganization = organization;
		this.organizations = [...organizations];
	}

	/*
	 * After deleted organization removed on dropdown
	 */
	deleteOrganization(organization: IOrganization) {
		let organizations: IOrganization[] = this.organizations;
		organizations = organizations.filter(
			(item: IOrganization) => item.id !== organization.id
		);

		this.organizations = [...organizations];
	}

	ngOnDestroy() {}
}
