import { Component, OnInit, OnDestroy, AfterViewInit, Input } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { IOrganization, CrudActionEnum, PermissionsEnum } from '@gauzy/contracts';
import { filter, map, tap } from 'rxjs/operators';
import { Observable } from 'rxjs/internal/Observable';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { distinctUntilChange, isNotEmpty } from '@gauzy/common-angular';
import { uniq } from 'underscore';
import {
	OrganizationEditStore,
	Store,
	ToastrService,
	UsersOrganizationsService
} from './../../../../../@core/services';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ga-organization-selector',
	templateUrl: './organization.component.html',
	styleUrls: ['./organization.component.scss']
})
export class OrganizationSelectorComponent
	implements AfterViewInit, OnInit, OnDestroy {

	organizations: IOrganization[] = [];
	selectedOrganization: IOrganization;
	isOpen: boolean = false;
	public hasEditOrganization$: Observable<boolean>;

	/*
	* Getter & Setter for dynamic add tag option
	*/
	_addTag: boolean = true;
	get addTag(): boolean {
		return this._addTag;
	}
	@Input() set addTag(value: boolean) {
		this._addTag = value;
	}

	constructor(
		private readonly router: Router,
		private readonly toastrService: ToastrService,
		private readonly store: Store,
		private readonly userOrganizationService: UsersOrganizationsService,
		private readonly _organizationEditStore: OrganizationEditStore,
		private readonly activatedRoute: ActivatedRoute
	) { }

	ngOnInit() {
		this.hasEditOrganization$ = this.store.userRolePermissions$.pipe(
			map(() =>
				this.store.hasPermission(PermissionsEnum.ALL_ORG_EDIT)
			)
		);

		this.loadSelectedOrganization();

		this.loadOrganizations().then(() => {
			this.activatedRoute.queryParams
				.pipe(
					filter((query) => !!query.organizationId),
					tap(({ organizationId }) => this.selectOrganizationById(organizationId)),
					untilDestroyed(this)
				)
				.subscribe();
		});

	}

	selectOrganization(organization: IOrganization) {
		if (organization) {
			this.store.selectedOrganization = organization;
			this.store.organizationId = organization.id;
			this.store.selectedEmployee = null;

			this.updateQueryParams({ organizationId: organization.id })
		}
	}

	/**
	 * Updates query parameters while preserving specified parameters.
	 * @param newParams New query parameters to be added or updated.
	 */
	private updateQueryParams(newParams: { [key: string]: any }): void {
		// Preserve existing query parameters for 'date' and 'date_end'
		const preservedQueryParams = ['date', 'date_end'];

		// Get the current query parameters from the activated route snapshot
		const currentQueryParams = { ...this.activatedRoute.snapshot.queryParams };

		// Create a new object to store the query parameters to be updated
		const updatedQueryParams: { [key: string]: any } = {};

		// Loop through the preserved parameters and add them to the updatedQueryParams
		preservedQueryParams.forEach((key) => {
			if (currentQueryParams.hasOwnProperty(key)) {
				updatedQueryParams[key] = currentQueryParams[key];
			}
		});

		// Navigate to the updated route with the new query parameters
		this.router.navigate([], {
			relativeTo: this.activatedRoute,
			queryParams: { ...updatedQueryParams, ...newParams },
		});
	}

	private async loadOrganizations(): Promise<void> {
		const { tenantId } = this.store.user;
		const { userId } = this.store;

		const { items = [] } = await this.userOrganizationService.getAll(
			[
				'organization',
				'organization.contact',
				'organization.featureOrganizations',
				'organization.featureOrganizations.feature'
			],
			{ userId, tenantId }
		);

		const organizations = items.map(({ organization }) => organization);
		this.organizations = uniq(organizations, (item) => item.id);

		if (this.organizations.length > 0) {
			const defaultOrganization = this.organizations.find(
				(organization: IOrganization) => organization.isDefault
			);
			const [firstOrganization] = this.organizations;

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
				distinctUntilChange(),
				filter((organization: IOrganization) => !!organization),
				tap((organization: IOrganization) => {
					this.selectedOrganization = organization;
					this.store.featureOrganizations = organization.featureOrganizations || [];
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
	/**
	 * event fired on model change.
	 */
	onChange() {
		this.isOpen = false;
	}

	/**
	 * Create new employee from ng-select tag
	 *
	 * @param name
	 * @returns
	 */
	createNew = async (name: string) => {
		if (!this.store.hasPermission(PermissionsEnum.ALL_ORG_EDIT)) {
			return;
		}
		if (!this.selectedOrganization || !name) {
			return;
		}
		try {
			this.router.navigate(['/pages/organizations/'], {
				queryParams: {
					openAddDialog: true
				},
				state: {
					name: name,
					officialName: name
				}
			});
		} catch (error) {
			this.toastrService.error(error);
		}
	};

	onClickOutside(event) {
		if (this.isOpen && !event) this.isOpen = false;
	}

	selectOrganizationById(organizationId: string) {
		const organization = this.organizations.find(
			(organization: IOrganization) => organizationId === organization.id
		);
		if (organization) {
			this.selectOrganization(organization);
		}
	}

	ngOnDestroy() { }
}
