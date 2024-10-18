import { Component, OnInit, OnDestroy, AfterViewInit, Input } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { catchError, distinctUntilChanged, filter, map, of, tap } from 'rxjs';
import { Observable } from 'rxjs/internal/Observable';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { uniq } from 'underscore';
import { IOrganization, CrudActionEnum, PermissionsEnum, ID } from '@gauzy/contracts';
import { isNotEmpty } from '@gauzy/ui-core/common';
import {
	NavigationService,
	OrganizationEditStore,
	Store,
	ToastrService,
	UsersOrganizationsService
} from '@gauzy/ui-core/core';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ga-organization-selector',
	templateUrl: './organization.component.html',
	styleUrls: ['./organization.component.scss']
})
export class OrganizationSelectorComponent implements AfterViewInit, OnInit, OnDestroy {
	public organizations: IOrganization[] = [];
	public selectedOrganization: IOrganization;
	public isOpen: boolean = false;
	public hasEditOrganization$: Observable<boolean>;

	/**
	 * Input properties for component customization.
	 *
	 * @property addTag - Whether adding new tags is allowed (default: true).
	 */
	@Input() addTag: boolean = true;

	constructor(
		private readonly _router: Router,
		private readonly _toastrService: ToastrService,
		private readonly _store: Store,
		private readonly _userOrganizationService: UsersOrganizationsService,
		private readonly _organizationEditStore: OrganizationEditStore,
		private readonly _activatedRoute: ActivatedRoute,
		private readonly _navigationService: NavigationService
	) {}

	ngOnInit() {
		this.initializePermissions();
		this.loadSelectedOrganization();

		this.loadOrganizations().then(() => {
			this._activatedRoute.queryParams
				.pipe(
					filter((query) => !!query.organizationId),
					tap(({ organizationId }) => this.selectOrganizationById(organizationId)),
					untilDestroyed(this)
				)
				.subscribe();
		});
	}

	/**
	 * Initializes the observable that determines if the user has edit permissions for organizations.
	 */
	private initializePermissions(): void {
		this.hasEditOrganization$ = this._store.userRolePermissions$.pipe(
			map(() => this._store.hasPermission(PermissionsEnum.ALL_ORG_EDIT)),
			catchError((error) => {
				console.error('Error checking permissions:', error);
				return of(false);
			}),
			untilDestroyed(this)
		);
	}

	/**
	 * Selects an organization and updates the store and query parameters accordingly.
	 *
	 * @param organization - The organization to select.
	 * @param isResetEmployeeStore - Whether to reset the selected employee. Defaults to true.
	 */
	public selectOrganization(
		organization: IOrganization | null | undefined,
		isResetEmployeeStore: boolean = true
	): void {
		if (!organization) {
			this._toastrService.warning('No organization provided to select.');
			console.warn('No organization provided to select.');
			return;
		}

		// Update the store with the selected organization details
		this._store.selectedOrganization = organization;
		this._store.organizationId = organization.id;

		// Reset the selected employee store if required
		if (isResetEmployeeStore) {
			this._store.selectedEmployee = null;
			console.info('Selected employee store has been reset.');
		}

		console.log(`Selected Organization: ${organization.name}`);

		// Update the query parameters in the URL
		this._navigationService.updateQueryParams({ organizationId: organization.id });
	}

	/**
	 * Updates query parameters while preserving specified parameters.
	 *
	 * @param queryParams New query parameters to be added or updated.
	 */
	private async updateQueryParams(queryParams: { [key: string]: any }): Promise<void> {
		await this._navigationService.updateQueryParams(queryParams);
	}

	/**
	 * Loads and initializes the list of organizations for the current user.
	 * Retrieves organizations associated with the user, ensures uniqueness,
	 * and sets the selected organization in the store based on predefined logic.
	 */
	private async loadOrganizations(): Promise<void> {
		try {
			// Retrieve the user's ID and tenant ID
			const { id: userId, tenantId } = this._store.user;

			// Define the relations to be included in the query
			const relations = [
				'organization',
				'organization.contact',
				'organization.featureOrganizations',
				'organization.featureOrganizations.feature'
			];

			// Fetch all organizations associated with the user
			const { items = [] } = await this._userOrganizationService.getAll(relations, { userId, tenantId });

			// Extract organizations from the fetched items
			const fetchedOrganizations: IOrganization[] = items.map(({ organization }) => organization);

			// Remove duplicate organizations based on their ID
			this.organizations = uniq(fetchedOrganizations, 'id');

			// Select and set the active organization
			this.selectAndSetOrganization();
		} catch (error) {
			// Handle errors during organization loading
			console.error('Failed to load organizations:', error);
		}
	}

	/**
	 * Selects and sets the active organization based on stored ID, default, or the first available.
	 */
	private selectAndSetOrganization(): void {
		// Check if there are organizations available
		if (this.organizations.length > 0) {
			// Select the organization based on the following priority:
			// 1. Organization with the stored ID
			// 2. Default organization
			// 3. First organization in the list
			this._store.selectedOrganization =
				this.organizations.find((org: IOrganization) => org.id === this._store.organizationId) ||
				this.organizations.find((org: IOrganization) => org.isDefault) ||
				this.organizations[0] ||
				null;

			// Log the selected organization if it exists
			if (this._store.selectedOrganization) {
				// Update the query parameters in the URL
				this.updateQueryParams({ organizationId: this._store.selectedOrganization.id });
			} else {
				// Handle the unlikely case where organizations exist but no selection was made
				console.warn('No valid organization found to select.');
				this.resetStore();
			}
		} else {
			// Handle the case where no organizations are available
			this.resetStore();
			console.warn('No organizations found for the user. Store has been reset.');
		}
	}

	/**
	 * Loads the currently selected organization from the store and updates local state.
	 */
	private loadSelectedOrganization(): void {
		this._store.selectedOrganization$
			.pipe(
				distinctUntilChanged((prev, curr) => prev?.id === curr?.id),
				filter((organization: IOrganization | null) => !!organization),
				tap((organization: IOrganization) => {
					this.selectedOrganization = organization;
					this._store.featureOrganizations = organization.featureOrganizations || [];
				}),
				untilDestroyed(this)
			)
			.subscribe({
				error: (error) => {
					console.error('Error loading selected organization:', error);
					this._toastrService.error('Failed to load selected organization.', error);
				}
			});
	}

	ngAfterViewInit() {
		this._organizationEditStore.organizationAction$
			.pipe(
				filter(({ action, organization }) => !!action && !!organization),
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

	/**
	 * Adds a new organization to the dropdown list.
	 *
	 * @param organization - The organization to add.
	 */
	public createOrganization(organization: IOrganization): void {
		// Initialize the organizations array if it's undefined or null
		const updatedOrganizations: IOrganization[] = [...(this.organizations ?? []), organization];

		// Filter out any empty or invalid entries, if necessary
		this.organizations = updatedOrganizations.filter(isNotEmpty);
	}

	/**
	 * Updates an existing organization in the dropdown list.
	 *
	 * @param organization - The organization with updated data.
	 */
	public updateOrganization(organization: IOrganization): void {
		// Check if the organization exists
		const exists = this.organizations.some((org) => org.id === organization.id);
		if (!exists) {
			console.log('updated organization not found: ', organization?.name);
			return;
		}

		try {
			// Update the organizations array immutably by mapping through existing organizations
			const updatedOrganizations = this.organizations.map((org) =>
				org.id === organization.id ? { ...org, ...organization } : org
			);

			// Update the store with the selected organization details
			this.selectOrganization(organization);

			// Assign the filtered and updated organizations list
			this.organizations = updatedOrganizations.filter(isNotEmpty);
		} catch (error) {
			console.error('Error updating organization:', error);
			this._toastrService.error('Failed to update organization.', error);
		}
	}

	/**
	 * Deletes an organization from the dropdown list.
	 *
	 * @param organization - The organization to delete.
	 */
	public deleteOrganization(organization: IOrganization): void {
		if (!organization) {
			console.warn('No organization provided to delete.');
			return;
		}

		// Check if the organization exists
		const exists = this.organizations.some((org) => org.id === organization.id);
		if (!exists) {
			console.warn(`Delete failed: Organization with ID ${organization.id} not found.`);
			return;
		}

		try {
			// Remove the organization immutably by filtering it out
			const updatedOrganizations = this.organizations.filter((org) => org.id !== organization.id);

			// Assign the filtered and updated organizations list
			this.organizations = updatedOrganizations.filter(isNotEmpty);

			// Check if the deleted organization was the selected one
			if (this._store.selectedOrganization?.id === organization.id) {
				if (updatedOrganizations.length > 0) {
					// Select a random organization from the updated list
					const organization = this.getRandomOrganization(updatedOrganizations);
					this.selectOrganization(organization);
				} else {
					// No organizations left; reset the store
					this.resetStore();
					console.warn('All organizations have been deleted. Store has been reset.');
				}
			}

			console.log(`Organization with ID ${organization.id} deleted successfully.`);
		} catch (error) {
			// Handle any errors that occur during deletion
			console.error(`Failed to delete organization with ID ${organization.id}`, error);
			this._toastrService.error(`Failed to delete organization "${organization.name}".`, error);
		}
	}

	/**
	 * event fired on model change.
	 */
	onChange() {
		this.isOpen = false;
	}

	/**
	 * Creates a new organization entry and navigates to the organization's page to open the add dialog.
	 *
	 * @param name - The name of the new organization to be created.
	 * @returns A promise that resolves if the organization creation process is successful or returns early if permissions or required data are missing.
	 */
	createNew = async (name: string): Promise<void> => {
		// Check if the user has the required permissions
		if (!this._store.hasPermission(PermissionsEnum.ALL_ORG_EDIT)) {
			return;
		}

		// Ensure that both the selected organization and name are provided
		if (!this.selectedOrganization || !name) {
			return;
		}

		try {
			// Navigate to the organization's page and open the add dialog with the provided name
			await this._router.navigate(['/pages/organizations/'], {
				queryParams: { openAddDialog: true },
				state: { name, officialName: name }
			});
		} catch (error) {
			// Display an error message in case of any navigation failure
			this._toastrService.error(error);
		}
	};

	/**
	 * Closes the component when a click occurs outside of it.
	 *
	 * @param event - The click event.
	 */
	onClickOutside(event: Event): void {
		if (this.isOpen && !event) this.isOpen = false;
	}

	/**
	 * Selects an organization by its ID.
	 *
	 * @param organizationId - The ID of the organization to select.
	 */
	selectOrganizationById(organizationId: ID): void {
		const organization = this.organizations.find(
			(organization: IOrganization) => organization.id === organizationId
		);
		if (organization) {
			this.selectOrganization(organization, false);
		}
	}

	/**
	 * Resets the store's selected organization, organization ID, and selected employee.
	 */
	private resetStore(): void {
		this._store.selectedOrganization = null;
		this._store.organizationId = null;
		this._store.selectedEmployee = null;
		console.info('Store reset: selectedOrganization, organizationId, and selectedEmployee have been cleared.');
	}

	/**
	 * Selects a random organization from the provided list.
	 *
	 * @param organizations - The list of organizations to select from.
	 * @returns A randomly selected organization.
	 */
	private getRandomOrganization(organizations: IOrganization[]): IOrganization {
		if (organizations.length === 0) {
			return null;
		}

		const randomIndex = Math.floor(Math.random() * organizations.length);
		return organizations[randomIndex];
	}

	ngOnDestroy() {}
}
