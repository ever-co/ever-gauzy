import { AfterViewInit, Component, EventEmitter, Input, NgZone, OnInit, Output, ChangeDetectionStrategy } from '@angular/core';
import { IOrganization, IUser } from '@gauzy/contracts';
import { uniq } from 'underscore';
import { ElectronService } from '../../electron/services';
import { Store } from '../../services';
import { OrganizationSwitchService } from './organization-switch.service';
import { UserOrganizationService } from './user-organization.service';
import { NgSelectComponent, NgOptionTemplateDirective, NgLabelTemplateDirective } from '@ng-select/ng-select';
import { NbTooltipModule } from '@nebular/theme';
import { FormsModule } from '@angular/forms';
import { TranslatePipe } from '@ngx-translate/core';

@Component({
    selector: 'ngx-desktop-timer-organization-selector',
    templateUrl: './organization-selector.component.html',
    styleUrls: ['./organization-selector.component.scss'],
    changeDetection: ChangeDetectionStrategy.Eager,
    imports: [NgSelectComponent, NbTooltipModule, FormsModule, NgOptionTemplateDirective, NgLabelTemplateDirective, TranslatePipe]
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

	/** True while the API is asked to switch organization; the selector is disabled meanwhile. */
	public switching = false;

	constructor(
		private readonly _userOrganizationService: UserOrganizationService,
		private readonly _electronService: ElectronService,
		private readonly _store: Store,
		private readonly _ngZone: NgZone,
		private readonly _organizationSwitchService: OrganizationSwitchService
	) {
		this.organizationChange = new EventEmitter();
		this._isDisabled = false;
	}

	ngOnInit() {
		this.setSelection(this._store.selectedOrganization);
	}

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
	 * Handles the user picking an organization in the selector.
	 *
	 * The API confines a non-admin to the organization of their access token, so the pick first asks the API to switch
	 * (`OrganizationSwitchService`), which stores the new tokens; only then does the selection change and
	 * `organizationChange` fire. When the switch is refused, the selector goes back to the organization the timer still
	 * works in and the user is shown why.
	 *
	 * @param organization The organization picked.
	 */
	public async selectOrganization(organization: IOrganization): Promise<void> {
		// Ensure that a valid organization is provided
		if (!organization) {
			console.warn('No organization provided to select.');
			return; // Exit early if organization is null or undefined
		}

		// The organization the timer works in before this pick (ngModel has already moved `selectedOrganization`).
		const previous = this.currentOrganization;
		if (previous?.id === organization.id) {
			this.selectedOrganization = previous;
			return;
		}

		this.switching = true;
		try {
			const switched = await this._organizationSwitchService.switchOrganization(organization);
			if (!switched) {
				// Keep the old selection; the service has told the user why.
				this.selectedOrganization = previous;
				return;
			}
			this.setSelection(organization);
		} finally {
			this.switching = false;
		}
	}

	/**
	 * Sets the selected organization without asking the API to switch, and emits `organizationChange`.
	 *
	 * @param organization The organization to show as selected.
	 */
	private setSelection(organization: IOrganization): void {
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
	 * The organization the timer works in: the one whose token the store holds.
	 */
	private get currentOrganization(): IOrganization | null {
		const organizationId = this._store.organizationId;
		return (
			this.organizations.find((organization) => organization.id === organizationId) ??
			this._store.selectedOrganization ??
			null
		);
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

				// The organization the session's token was issued for comes first, so the selector never shows an
				// organization the timer does not work in (picking that one would then not even reach the switch).
				const workingOrganizationId = this._store.organizationId ?? this.organizationId;

				if (workingOrganizationId) {
					// Find the organization that matches the provided ID
					const matchingOrganization = this.organizations.find(
						(organization) => organization.id === workingOrganizationId
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
