import { Component, OnInit, OnDestroy, AfterViewInit } from '@angular/core';
import { IOrganization, CrudActionEnum } from '@gauzy/contracts';
import { filter, tap } from 'rxjs/operators';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { isNotEmpty } from '@gauzy/common-angular';
import { uniq } from 'underscore';
import { OrganizationEditStore, Store, UsersOrganizationsService } from './../../../../../@core/services';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ga-organization-selector',
	templateUrl: './organization.component.html',
	styleUrls: ['./organization.component.scss']
})
export class OrganizationSelectorComponent implements AfterViewInit, OnInit, OnDestroy {
	organizations: IOrganization[] = [];
	selectedOrganization: IOrganization;

	constructor(
		private readonly store: Store,
		private readonly userOrganizationService: UsersOrganizationsService,
		private readonly _organizationEditStore: OrganizationEditStore
	) {}

	ngOnInit() {
		this.loadSelectedOrganization();
		this.loadOrganizations();
	}

	selectOrganization(organization: IOrganization) {
		if (organization) {
			this.store.selectedOrganization = organization;
			this.store.organizationId = organization.id;
			this.store.selectedEmployee = null;
		}
	}

	private async loadOrganizations(): Promise<void> {
		const { tenantId } = this.store.user;
		const { userId } = this.store;
		
		const { items = [] } = await this.userOrganizationService.getAll([
			'organization',
			'organization.contact',
			'organization.featureOrganizations',
			'organization.featureOrganizations.feature'
		], { userId, tenantId });

		const organizations = items.map(({ organization }) => organization);
		this.organizations = uniq(organizations, (item) => item.id);
		
		if (this.organizations.length > 0) {
			const defaultOrganization = this.organizations.find((organization: IOrganization) => organization.isDefault);
			const [ firstOrganization ] = this.organizations;
	
			if (this.store.organizationId) {
				const organization = this.organizations.find(
					(organization: IOrganization) => organization.id === this.store.organizationId
				);
				this.store.selectedOrganization = organization || defaultOrganization || firstOrganization;
			} else {
				// set default organization as selected
				this.store.selectedOrganization = defaultOrganization || firstOrganization;
			}
		}
	}

	private loadSelectedOrganization() {
		this.store.selectedOrganization$
			.pipe(
				filter((organization) => !!organization),
				tap((organization: IOrganization) => {
					this.selectedOrganization = organization;
					this.store.featureOrganizations =
						organization.featureOrganizations || [];
				}),
				untilDestroyed(this)
			)
			.subscribe();
	}

	ngAfterViewInit() {
		this._organizationEditStore.organizationAction$
			.pipe(
				filter(
					({ action, organization }) => !!action && !!organization
				),
				tap(() => this._organizationEditStore.destroy()),
				untilDestroyed(this)
			)
			.subscribe(({ organization, action }) => {
				switch (action) {
					case CrudActionEnum.CREATED:
						this.createOrganization(organization);
						break;
					case CrudActionEnum.UPDATED:
						this.updateOrganization(organization);
						break;
					case CrudActionEnum.DELETED:
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
		const organizations: IOrganization[] = this.organizations || [];
		if (Array.isArray(organizations)) {
			organizations.push(organization);
			this.organizations = [...organizations].filter(isNotEmpty);
		}
	}

	/*
	 * After updated existing organization changed in the dropdown
	 */
	updateOrganization(organization: IOrganization) {
		let organizations: IOrganization[] = this.organizations || [];
		if (Array.isArray(organizations) && organizations.length) {
			organizations = organizations.map((item: IOrganization) => {
				if (item.id === organization.id) {
					return Object.assign({}, item, organization);
				}
				return item;
			});
		}

		this.store.selectedOrganization = organization;
		this.organizations = [...organizations].filter(isNotEmpty);
	}

	/*
	 * After deleted organization removed on dropdown
	 */
	deleteOrganization(organization: IOrganization) {
		let organizations: IOrganization[] = this.organizations || [];
		if (Array.isArray(organizations) && organizations.length) {
			organizations = organizations.filter(
				(item: IOrganization) => item.id !== organization.id
			);
		}

		this.organizations = [...organizations].filter(isNotEmpty);
	}

	ngOnDestroy() {}
}
