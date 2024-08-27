import { AfterViewInit, Component, EventEmitter, Input, NgZone, OnInit, Output } from '@angular/core';
import { IOrganization, IUser } from '@gauzy/contracts';
import { uniq } from 'underscore';
import { ElectronService } from '../../electron/services';
import { Store } from '../../services';
import { UserOrganizationService } from './user-organization.service';

@Component({
	selector: 'ngx-desktop-timer-organization-selector',
	templateUrl: './organization-selector.component.html',
	styleUrls: ['./organization-selector.component.scss']
})
export class OrganizationSelectorComponent implements OnInit, AfterViewInit {
	public organizations: IOrganization[] = [];
	public selectedOrganization: IOrganization;

	/* A getter and setter. */
	private _isDisabled: boolean;
	public get disabled(): boolean {
		return this._isDisabled;
	}
	@Input() public set disabled(value: boolean) {
		this._isDisabled = value;
	}

	/* A getter and setter. */
	private _user: IUser;
	public get user(): IUser {
		return this._user;
	}
	public set user(value: IUser) {
		if (value) {
			this._user = value;
		}
	}

	@Output() organizationChange: EventEmitter<IOrganization>;

	constructor(
		private readonly _userOrganizationService: UserOrganizationService,
		private readonly _electronService: ElectronService,
		private readonly _store: Store,
		private readonly _ngZone: NgZone
	) {
		this.organizationChange = new EventEmitter();
		this._isDisabled = false;
	}

	ngOnInit() {}

	/**
	 * Component lifecycle hook for operations after the view initializes.
	 */
	ngAfterViewInit(): void {
		// Subscribe to Electron IPC events and handle in Angular's zone
		this._electronService.ipcRenderer.on('timer_tracker_show', (event, arg) => {
			this._ngZone.run(async () => {
				try {
					// Fetch user details
					this.user = await this._userOrganizationService.detail();
					// Load organizations for the user
					await this.loadOrganizations();
				} catch (error) {
					console.error('Error handling IPC event:', error); // Log the error with context
				}
			});
		});
	}

	/**
	 * Sets the selected organization and emits an event indicating that the organization has changed.
	 *
	 * @param organization The organization to select.
	 */
	public selectOrganization(organization: IOrganization): void {
		// Ensure that a valid organization is provided
		if (!organization) {
			console.warn('No organization provided to select.');
			return; // Exit early if organization is null or undefined
		}

		// Set the selected organization
		this.selectedOrganization = organization;

		// Emit an event indicating the organization has changed
		if (this.organizationChange) {
			this._store.selectedOrganization = this.selectedOrganization;
			this.organizationChange.emit(organization);
		}
	}

	/**
	 * Load organizations for the current user and set the selected organization based on predefined conditions.
	 *
	 * This function fetches organizations from the `_userOrganizationService`, filters them based on the current user,
	 * and sets the `selectedOrganization` property accordingly.
	 *
	 * @returns A promise that resolves when organizations are loaded.
	 */
	private async loadOrganizations(): Promise<void> {
		// Return early if the user is not defined
		if (!this.user) {
			return;
		}

		try {
			const { id: userId, tenantId } = this.user;

			// Fetch all user organizations, including related 'organization' data
			const { items = [] } = await this._userOrganizationService.getAll(['organization'], { userId, tenantId });

			// Extract organizations where the user ID matches
			const organizations: IOrganization[] = items
				.map(({ organization, userId }) => (userId === this.user.id ? organization : null))
				.filter(Boolean); // Remove null values

			// Remove duplicate organizations by unique ID
			this.organizations = uniq(organizations, (item: IOrganization) => item.id);

			if (this.organizations.length > 0) {
				// Find the default organization
				const defaultOrganization = this.organizations.find((organization) => organization.isDefault);

				// Select the first organization from the list
				const [firstOrganization] = this.organizations;

				if (this.organizationId) {
					// Find the organization that matches the provided ID
					const matchingOrganization = this.organizations.find(
						(organization) => organization.id === this.organizationId
					);

					// Set the selected organization, fallback to default or first
					this.selectedOrganization = matchingOrganization || defaultOrganization || firstOrganization;
				} else {
					// If no specific ID, use default or first organization
					this.selectedOrganization = defaultOrganization || firstOrganization;
				}

				this._store.selectedOrganization = this.selectedOrganization;
			}
		} catch (error) {
			console.error('Error loading organizations:', error); // Error handling
		}
	}

	/**
	 * Getter for the organization ID from the selected organization.
	 *
	 * This getter retrieves the 'id' of the selected organization if available.
	 * If 'selectedOrganization' is not set, it returns `null`.
	 *
	 * @returns The organization ID or `null` if not available.
	 */
	public get organizationId(): string | null {
		// Return the ID if 'selectedOrganization' is defined, otherwise return null
		return this.selectedOrganization?.id ?? null;
	}
}
