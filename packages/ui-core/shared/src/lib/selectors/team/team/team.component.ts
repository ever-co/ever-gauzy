import { Component, OnInit, OnDestroy, Input, forwardRef, Output, EventEmitter } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import {
	IOrganization,
	IOrganizationTeam,
	CrudActionEnum,
	PermissionsEnum,
	ID,
	IOrganizationTeamFindInput
} from '@gauzy/contracts';
import { NG_VALUE_ACCESSOR } from '@angular/forms';
import { combineLatest, from, map, Observable, of, Subject, switchMap } from 'rxjs';
import { catchError, filter, tap } from 'rxjs/operators';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { distinctUntilChange, isEmpty, isNotEmpty } from '@gauzy/ui-core/common';
import {
	ErrorHandlingService,
	NavigationService,
	OrganizationTeamStore,
	OrganizationTeamsService,
	Store,
	ToastrService
} from '@gauzy/ui-core/core';
import { TruncatePipe } from '../../../pipes';
import { ALL_TEAM_SELECTED } from './default-team';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ga-team-selector',
	templateUrl: './team.component.html',
	styleUrls: ['./team.component.scss'],
	providers: [
		{
			provide: NG_VALUE_ACCESSOR,
			useExisting: forwardRef(() => TeamSelectorComponent),
			multi: true
		}
	]
})
export class TeamSelectorComponent implements OnInit, OnDestroy {
	public organization: IOrganization;
	public subject$: Subject<any> = new Subject();
	public hasAddTeam$: Observable<boolean>;
	public teams: IOrganizationTeam[] = [];
	public selectedTeam: IOrganizationTeam;

	private _organizationTeamId: ID | ID[]; // Internal storage for the organization team ID.
	private _employeeId: ID; // Internal storage for the employee ID.
	private _projectId: ID; // Internal storage for the project ID.

	/**
	 * Determines whether the component should be displayed in a shortened form.
	 * This might control the size, visibility of certain elements, or compactness of the UI.
	 *
	 * @default false
	 */
	@Input() shortened: boolean = false;

	/**
	 * Determines whether the component is disabled and non-interactive.
	 * When set to `true`, user interactions (like clicking or selecting) are disabled.
	 *
	 * @default false
	 */
	@Input() disabled: boolean = false;

	/**
	 * Allows multiple selections if set to `true`.
	 * This could enable features like multi-select dropdowns or checkboxes.
	 *
	 * @default false
	 */
	@Input() multiple: boolean = false;

	/**
	 * The label text to be displayed alongside the component.
	 * This could be used for accessibility purposes or to provide context to the user.
	 *
	 * @default null
	 */
	@Input() label: string | null = null;

	/**
	 * The placeholder text to be displayed in the team selector.
	 * Provides guidance to the user on what action to take or what information to provide.
	 *
	 */
	@Input() placeholder: string | null = null;

	/**
	 * Determines whether to skip triggering global change detection.
	 * Useful for optimizing performance by preventing unnecessary change detection cycles.
	 *
	 * @default false
	 */
	@Input() skipGlobalChange: boolean = false;

	/**
	 * Enables the default selection behavior.
	 * When `true`, the component may automatically select a default team upon initialization.
	 *
	 * @default true
	 */
	@Input() defaultSelected: boolean = true;

	/**
	 * Determines whether to display the "Show All" option in the selector.
	 * Allows users to view and select all available teams if enabled.
	 *
	 * @default true
	 */
	@Input() showAllOption: boolean = true;

	/**
	 * Sets the team ID and triggers change and touch events.
	 *
	 * @param value - The team ID or array of team IDs to be set.
	 */
	@Input()
	public set organizationTeamId(value: ID | ID[]) {
		this._organizationTeamId = value;
		this.onChange(value);
		this.onTouched();
	}

	/**
	 * Gets the current team ID
	 *
	 * @returns The current team ID or array of team IDs.
	 */
	public get organizationTeamId(): ID | ID[] {
		return this._organizationTeamId;
	}

	/**
	 * Sets the employee ID and triggers change and touch events.
	 *
	 * @param value - The ID of the employee to be set.
	 */
	@Input()
	public set employeeId(value: ID) {
		this._employeeId = value;
		this.subject$.next(true);
	}

	/**
	 * Gets the current employee ID
	 *
	 * @returns The current employee ID or array of employee IDs.
	 */
	public get employeeId(): ID | undefined {
		return this._employeeId;
	}

	/**
	 * Sets the project ID and triggers change and touch events.
	 *
	 * @param value - The ID of the project to be set.
	 */
	@Input()
	public set projectId(value: ID) {
		this._projectId = value;
		this.subject$.next(true);
	}

	/**
	 * Gets the current project ID
	 *
	 * @returns The current project ID or array of project IDs.
	 */
	public get projectId(): ID | undefined {
		return this._projectId;
	}

	@Output() onChanged = new EventEmitter<IOrganizationTeam>();

	/**
	 * Callback function to notify changes in the form control.
	 */
	private onChange: (value: ID | ID[]) => void = () => {};

	/**
	 * Callback function to notify touch events in the form control.
	 */
	private onTouched: () => void = () => {};

	constructor(
		private readonly _activatedRoute: ActivatedRoute,
		private readonly _organizationTeamsService: OrganizationTeamsService,
		private readonly _store: Store,
		private readonly _toastrService: ToastrService,
		private readonly _errorHandlingService: ErrorHandlingService,
		private readonly _organizationTeamStore: OrganizationTeamStore,
		private readonly _truncatePipe: TruncatePipe,
		private readonly _navigationService: NavigationService
	) {}

	ngOnInit(): void {
		this.initializePermissions();
		this.initializeTeamSelection();
		this.initializeOrganizationSelection();
	}

	ngAfterViewInit(): void {
		this._organizationTeamStore.organizationTeamAction$
			.pipe(
				filter(({ action, team }) => !!action && !!team),
				tap(() => this._organizationTeamStore.destroy()),
				untilDestroyed(this)
			)
			.subscribe(({ team, action }) => {
				switch (action) {
					case CrudActionEnum.CREATED:
						this.createOrganizationTeam(team);
						break;
					case CrudActionEnum.UPDATED:
						this.updateOrganizationTeam(team);
						break;
					case CrudActionEnum.DELETED:
						this.deleteOrganizationTeam(team);
						break;
					default:
						break;
				}
			});
	}

	/**
	 * Initializes the observable that determines if the user has edit permissions for teams.
	 */
	private initializePermissions(): void {
		this.hasAddTeam$ = this._store.userRolePermissions$.pipe(
			map(() => this._store.hasAnyPermission(PermissionsEnum.ALL_ORG_EDIT, PermissionsEnum.ORG_TEAM_ADD)),
			catchError((error) => {
				console.error('Error checking permissions:', error);
				return of(false);
			}),
			untilDestroyed(this)
		);
	}

	/**
	 * Handles the combined stream to fetch teams and select the appropriate team
	 * based on route parameters and subject emissions.
	 */
	private initializeTeamSelection(): void {
		combineLatest([this.subject$, this._activatedRoute.queryParams])
			.pipe(
				// Switch to a new observable each time the source observables emit
				switchMap(([_, queryParams]) =>
					// Fetch teams and handle errors during retrieval
					from(this.getTeams()).pipe(
						// Return the teamId from queryParams on success
						map(() => queryParams.teamId),
						// Handle any errors that occur during team fetching
						catchError((error) => {
							console.error('Error fetching teams:', error);
							return of(null); // Return a null value to prevent team selection on error
						})
					)
				),
				// After fetching, select the team if teamId exists
				tap((teamId: ID | null) => {
					if (teamId) {
						this.selectTeamById(teamId);
					}
				}),
				// Automatically unsubscribe when the component is destroyed
				untilDestroyed(this)
			)
			.subscribe();
	}

	/**
	 * Handles changes in the selected organization.
	 *
	 * Updates the local organization property and triggers a team fetch.
	 */
	private initializeOrganizationSelection(): void {
		this._store.selectedOrganization$
			.pipe(
				distinctUntilChange(),
				filter((organization: IOrganization) => !!organization),
				tap((organization: IOrganization) => (this.organization = organization)),
				tap(() => this.subject$.next(true)),
				untilDestroyed(this)
			)
			.subscribe();
	}

	/**
	 * Retrieves teams based on specified parameters.
	 * If an employee ID is provided, retrieves teams associated with that employee.
	 * Otherwise, retrieves all teams for the organization. Optionally inserts an "All Projects" option.
	 */
	async getTeams() {
		// Return early if the organization is not defined
		if (!this.organization) {
			console.warn('Organization is not defined.');
			return;
		}

		const { id: organizationId, tenantId } = this.organization;

		// Construct query options
		const queryOptions: IOrganizationTeamFindInput = {
			organizationId,
			tenantId,
			...(this.projectId && { projects: { id: this.projectId } })
		};

		try {
			// Retrieve teams based on whether employeeId is provided
			const teamsResponse = this.employeeId
				? await this._organizationTeamsService.getMyTeams({
						...queryOptions,
						...(this.employeeId && { members: { employeeId: this.employeeId } })
				  })
				: await this._organizationTeamsService.getAll([], queryOptions);

			// Assign teams from response
			this.teams = teamsResponse.items || [];

			// Optionally add "All Projects" option
			if (this.showAllOption) {
				this.teams.unshift(ALL_TEAM_SELECTED);
				this.selectTeam(ALL_TEAM_SELECTED);
			}
		} catch (error) {
			console.error('Error retrieving teams:', error);
			this._errorHandlingService.handleError(error);
		}
	}

	/**
	 * Writes a value to the component, handling single or multiple selection modes.
	 *
	 * @param {ID | ID[]} value - The value(s) to write, either a single ID or IDs.
	 */
	writeValue(value: ID | ID[]): void {
		this._organizationTeamId = this.multiple ? (Array.isArray(value) ? value : [value]) : value;
	}

	/**
	 * Registers a callback function to be called when the control's value changes.
	 * This method is used by Angular forms to bind the model to the view.
	 *
	 * @param fn - The callback function to register for the 'onChange' event.
	 */
	registerOnChange(fn: (value: ID | ID[]) => void): void {
		this.onChange = fn;
	}

	/**
	 * Registers a callback function to be called when the component is touched.
	 * @param {() => void} fn - The callback function to register.
	 */
	registerOnTouched(fn: () => void): void {
		this.onTouched = fn;
	}

	/**
	 * Sets the disabled state of the component.
	 *
	 * @param {boolean} isDisabled - The disabled state to set.
	 */
	setDisabledState(isDisabled: boolean): void {
		this.disabled = isDisabled;
	}

	/**
	 * Creates a new team with the given name.
	 *
	 * @param {string} name - The name of the new team.
	 */
	createNew = async (name: string): Promise<void> => {
		// Return early if organization is not defined
		if (!this.organization) {
			console.warn('Organization is not defined.');
			return;
		}

		try {
			const { id: organizationId, tenantId } = this.organization;

			// Include member if employeeId or store user's employeeId is provided
			const memberId = this.employeeId || this._store.user.employee?.id;

			// Construct request object with common parameters
			const request = {
				name,
				...(memberId && { memberIds: [memberId] }),
				...(this.projectId && { projects: [{ id: this.projectId }] }),
				organizationId,
				tenantId
			};

			// Handle the created team and update teamId
			const team = await this._organizationTeamsService.create(request);

			// Handle the created team
			this.createOrganizationTeam(team);

			// Set the newly created team's ID
			this.organizationTeamId = team.id;

			// Show success message
			this._toastrService.success('NOTES.ORGANIZATIONS.EDIT_ORGANIZATIONS_TEAM.ADD_NEW_TEAM', { name });
		} catch (error) {
			// Log and show error message
			console.error('Error while creating new team: ', error);
			this._errorHandlingService.handleError(error);
		}
	};

	/**
	 * Adds a newly created organization team to the dropdown list.
	 *
	 * @param team - The new organization team to add.
	 */
	createOrganizationTeam(team: IOrganizationTeam): void {
		if (!team) {
			console.warn('Invalid team or empty team provided.');
			return; // Ensure the team is valid and not empty before proceeding.
		}

		this.teams = [...(this.teams || []), team].filter(isNotEmpty);
	}

	/**
	 * Updates an existing organization team in the dropdown.
	 *
	 * @param team - The updated organization team.
	 */
	updateOrganizationTeam(team: IOrganizationTeam): void {
		if (!team || !team.id) {
			console.warn('Invalid team or empty team provided.');
			return; // Ensure the team and its ID are valid before proceeding.
		}

		this.teams = (this.teams || [])
			.map((item: IOrganizationTeam) => (item.id === team.id ? { ...item, ...team } : item))
			.filter(isNotEmpty);
	}

	/**
	 * Removes a deleted organization team from the dropdown.
	 *
	 * @param team - The organization team to remove.
	 */
	deleteOrganizationTeam(team: IOrganizationTeam): void {
		if (!team || !team.id) {
			console.warn('Invalid team or empty team provided.');
			return; // Ensure the team and its ID are valid before proceeding.
		}

		this.teams = (this.teams || []).filter((item: IOrganizationTeam) => item.id !== team.id).filter(isNotEmpty);
	}

	selectTeam(team: IOrganizationTeam): void {
		if (!this.skipGlobalChange) {
			this._store.selectedTeam = team || ALL_TEAM_SELECTED;
			this.setAttributesToParams({ teamId: team?.id });
		}
		this.selectedTeam = team || ALL_TEAM_SELECTED;
		this.organizationTeamId = this.selectedTeam.id;
		this.onChanged.emit(team);
	}

	/**
	 * Sets attributes to the current navigation parameters.
	 * @param params An object containing key-value pairs representing the parameters to set.
	 */
	private async setAttributesToParams(params: { [key: string]: string | string[] | boolean }) {
		await this._navigationService.updateQueryParams(params);
	}

	/**
	 * Selects a team by its ID.
	 *
	 * @param teamId - The ID of the team to select.
	 */
	selectTeamById(teamId: ID): void {
		const team = this.teams.find((team: IOrganizationTeam) => teamId === team.id);
		if (team) {
			this.selectTeam(team);
		}
	}

	/**
	 * Determines if the "clear" option should be displayed in the team selector.
	 *
	 * @returns True if the "clear" option should be displayed, false otherwise.
	 */
	isClearable(): boolean {
		return this.selectedTeam !== ALL_TEAM_SELECTED;
	}

	/**
	 * Returns a shortened version of the name, with truncation applied to both first and last names.
	 *
	 * @param {string} name - The full name to be shortened.
	 * @param {number} [limit=20] - The maximum character limit for the shortened name.
	 * @returns {string | undefined} - The shortened name, or undefined if the name is empty.
	 */
	getShortenedName(name: string, limit = 20): string | undefined {
		if (isEmpty(name)) {
			return;
		}

		const chunks = name.split(/\s+/);
		const firstName = chunks.shift();
		const lastName = chunks.join(' ');

		// If both first and last names exist, truncate both
		if (firstName && lastName) {
			return (
				this._truncatePipe.transform(firstName, Math.floor(limit / 2), false, '') +
				' ' +
				this._truncatePipe.transform(lastName, Math.floor(limit / 2), false, '.')
			);
		}

		// Fallback to truncating either firstName or lastName if available
		return this._truncatePipe.transform(firstName || lastName, limit) || '[error: bad name]';
	}

	/**
	 * Clears the selected team value if the "Show All" option is disabled.
	 */
	clearSelection(): void {
		if (!this.showAllOption) {
			this.organizationTeamId = null;
		}
	}

	ngOnDestroy(): void {}
}
