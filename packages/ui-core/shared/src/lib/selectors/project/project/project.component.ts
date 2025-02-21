import { Component, OnInit, Input, forwardRef, AfterViewInit, Output, EventEmitter } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { NG_VALUE_ACCESSOR } from '@angular/forms';
import { combineLatest, from, map, Observable, of, Subject, switchMap } from 'rxjs';
import { catchError, filter, tap } from 'rxjs/operators';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import {
	IOrganization,
	IOrganizationProject,
	CrudActionEnum,
	PermissionsEnum,
	ID,
	IOrganizationProjectsFindInput
} from '@gauzy/contracts';
import { distinctUntilChange, isEmpty, isNotEmpty } from '@gauzy/ui-core/common';
import {
	ErrorHandlingService,
	NavigationService,
	OrganizationProjectStore,
	OrganizationProjectsService,
	Store,
	ToastrService
} from '@gauzy/ui-core/core';
import { TruncatePipe } from '../../../pipes';
import { ALL_PROJECT_SELECTED } from './default-project';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ga-project-selector',
	templateUrl: './project.component.html',
	styleUrls: ['./project.component.scss'],
	providers: [
		{
			provide: NG_VALUE_ACCESSOR,
			useExisting: forwardRef(() => ProjectSelectorComponent),
			multi: true
		}
	]
})
export class ProjectSelectorComponent implements OnInit, AfterViewInit {
	public projects: IOrganizationProject[] = [];
	public selectedProject: IOrganizationProject;
	public hasAddProject$: Observable<boolean>;
	public organization: IOrganization;
	public subject$: Subject<any> = new Subject();

	private _projectId: ID | ID[]; // Internal storage for the project IDs.
	private _employeeId: ID; // Internal storage for the employee ID.
	private _organizationContactId: ID; // Internal storage for the organization contact ID.

	/**
	 * Determines whether the component should be displayed in a shortened form.
	 * This might control the size, visibility of certain elements, or compactness of the UI.
	 *
	 * @default false
	 */
	@Input() shortened = false;

	/**
	 * Determines whether the component is disabled and non-interactive.
	 * When set to `true`, user interactions (like clicking or selecting) are disabled.
	 *
	 * @default false
	 */
	@Input() disabled = false;

	/**
	 * Allows multiple selections if set to `true`.
	 * This could enable features like multi-select dropdowns or checkboxes.
	 *
	 * @default false
	 */
	@Input() multiple = false;

	/**
	 * The label text to be displayed alongside the component.
	 * This could be used for accessibility purposes or to provide context to the user.
	 *
	 * @default null
	 */
	@Input() label: string | null = null;

	/**
	 * The placeholder text to be displayed in the project selector.
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
	@Input() skipGlobalChange = false;

	/**
	 * Enables the default selection behavior.
	 * When `true`, the component may automatically select a default project upon initialization.
	 *
	 * @default true
	 */
	@Input() defaultSelected = true;

	/**
	 * Determines whether to display the "Show All" option in the selector.
	 * Allows users to view and select all available projects if enabled.
	 *
	 * @default true
	 */
	@Input() showAllOption = true;

	/**
	 * Sets the project ID and triggers change and touch events.
	 *
	 * @param value - The project ID or array of project IDs to be set.
	 */
	@Input()
	public set projectId(value: ID | ID[]) {
		this._projectId = value;
		this.onChange(value);
		this.onTouched();
	}

	/**
	 * Gets the current project ID
	 *
	 * @returns The current project ID or array of project IDs.
	 */
	public get projectId(): ID | ID[] {
		return this._projectId;
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
	 * Sets the organization contact ID and triggers change and touch events.
	 *
	 * @param value - The ID of the organization contact to be set.
	 */
	@Input()
	public set organizationContactId(value: ID) {
		this._organizationContactId = value;
		this.subject$.next(true);
	}

	/**
	 * Gets the current organization contact ID
	 *
	 * @returns The current organization contact ID or array of organization contact ID.
	 */
	public get organizationContactId(): ID | undefined {
		return this._organizationContactId;
	}

	@Output() onChanged = new EventEmitter<IOrganizationProject>();

	/**
	 * Callback function to notify changes in the form control.
	 */
	private onChange: (value: ID | ID[]) => void = () => {};

	/**
	 * Callback function to notify touch events in the form control.
	 */
	private onTouched: () => void = () => {};

	constructor(
		private readonly _organizationProjects: OrganizationProjectsService,
		private readonly _store: Store,
		private readonly _toastrService: ToastrService,
		private readonly _errorHandlingService: ErrorHandlingService,
		private readonly _organizationProjectStore: OrganizationProjectStore,
		private readonly _truncatePipe: TruncatePipe,
		private readonly _navigationService: NavigationService,
		private readonly _activatedRoute: ActivatedRoute
	) {}

	ngOnInit(): void {
		this.initializePermissions();
		this.initializeProjectSelection();
		this.initializeOrganizationSelection();

		// Handle organization changes and trigger project fetch
		this._store.selectedOrganization$
			.pipe(
				distinctUntilChange(),
				filter((organization: IOrganization) => !!organization),
				tap((organization: IOrganization) => {
					this.organization = organization;
					this.subject$.next(true); // Triggers project fetch when organization changes
				}),
				untilDestroyed(this)
			)
			.subscribe();
	}

	ngAfterViewInit(): void {
		this._organizationProjectStore.organizationProjectAction$
			.pipe(
				filter(({ action, project }) => !!action && !!project),
				tap(() => this._organizationProjectStore.destroy()),
				untilDestroyed(this)
			)
			.subscribe(({ project, action }) => {
				switch (action) {
					case CrudActionEnum.CREATED:
						this.createOrganizationProject(project);
						break;
					case CrudActionEnum.UPDATED:
						this.updateOrganizationProject(project);
						break;
					case CrudActionEnum.DELETED:
						this.deleteOrganizationProject(project);
						break;
					default:
						break;
				}
			});
	}

	/**
	 * Initializes the observable that determines if the user has edit permissions for projects.
	 */
	private initializePermissions(): void {
		this.hasAddProject$ = this._store.userRolePermissions$.pipe(
			map(() => this._store.hasAnyPermission(PermissionsEnum.ALL_ORG_EDIT, PermissionsEnum.ORG_PROJECT_ADD)),
			catchError((error) => {
				console.error('Error checking permissions:', error);
				return of(false);
			}),
			untilDestroyed(this)
		);
	}

	/**
	 * Handles the combined stream to fetch projects and select the appropriate project
	 * based on route parameters and subject emissions.
	 */
	private initializeProjectSelection(): void {
		combineLatest([this.subject$, this._activatedRoute.queryParams])
			.pipe(
				// Switch to a new observable each time the source observables emit
				switchMap(([_, queryParams]) =>
					// Fetch projects and handle errors during retrieval
					from(this.getProjects()).pipe(
						// Return the projectId from queryParams on success
						map(() => queryParams.projectId),
						// Handle any errors that occur during project fetching
						catchError((error) => {
							console.error('Error fetching projects:', error);
							return of(null); // Return a null value to prevent project selection on error
						})
					)
				),
				// After fetching, select the project if projectId exists
				tap((projectId: ID | null) => {
					if (projectId) {
						this.selectProjectById(projectId);
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
	 * Updates the local organization property and triggers a project fetch.
	 */
	private initializeOrganizationSelection(): void {
		this._store.selectedOrganization$
			.pipe(
				// Emit only when the selected organization changes
				distinctUntilChange(),
				// Proceed only if the organization is defined
				filter((organization: IOrganization) => !!organization),
				// Update the organization property and trigger a project fetch
				tap((organization: IOrganization) => {
					this.organization = organization;
					this.subject$.next(true); // Triggers the combined stream
				}),
				untilDestroyed(this)
			)
			.subscribe();
	}

	/**
	 * Retrieves projects based on specified parameters.
	 * If an employee ID is provided, retrieves projects associated with that employee.
	 * Otherwise, retrieves all projects for the organization. Optionally inserts an "All Projects" option.
	 */
	async getProjects(): Promise<void> {
		// Return early if the organization is not defined
		if (!this.organization) {
			console.warn('Organization is not defined.');
			return;
		}

		const { id: organizationId, tenantId } = this.organization;

		// Construct query options
		const queryOptions: IOrganizationProjectsFindInput = {
			...(this.organizationContactId && { organizationContactId: this.organizationContactId }),
			organizationId,
			tenantId
		};

		try {
			// Retrieve projects based on whether employeeId is provided
			this.projects = this.employeeId
				? await this._organizationProjects.getAllByEmployee(this.employeeId, queryOptions)
				: (await this._organizationProjects.getAll([], queryOptions)).items || [];

			// Optionally add "All Projects" option
			if (this.showAllOption) {
				this.projects.unshift(ALL_PROJECT_SELECTED);
				this.selectProject(ALL_PROJECT_SELECTED);
			}
		} catch (error) {
			console.error('Error retrieving projects:', error);
			this._errorHandlingService.handleError(error);
		}
	}

	/**
	 * Writes a value to the component, handling single or multiple selection modes.
	 *
	 * @param {ID | ID[]} value - The value(s) to write, either a single ID or IDs.
	 */
	writeValue(value: ID | ID[]): void {
		this._projectId = this.multiple ? (Array.isArray(value) ? value : [value]) : value;
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
	 * Creates a new project with the given name.
	 *
	 * @param {string} name - The name of the new project.
	 */
	createNew = async (name: string): Promise<void> => {
		// Return early if organization or project name is not defined
		if (!this.organization || !name) {
			console.warn('Organization or project name is missing.');
			return;
		}

		try {
			// Destructure tenantId and organizationId from organization
			const { id: organizationId, tenantId } = this.organization;

			// Include member if employeeId or store user's employeeId is provided
			const memberId = this.employeeId || this._store.user.employee?.id;

			// Create the project
			const project = await this._organizationProjects.create({
				name,
				...(memberId && { memberIds: [memberId] }),
				...(this.organizationContactId && { organizationContactId: this.organizationContactId }),
				organizationId,
				tenantId
			});

			// Handle the created project and update projectId
			this.createOrganizationProject(project);

			// Set the newly created project's ID
			this.projectId = project.id;

			// Show success message
			this._toastrService.success('NOTES.ORGANIZATIONS.EDIT_ORGANIZATIONS_PROJECTS.ADD_PROJECT', { name });
		} catch (error) {
			// Log and handle the error
			console.error('Error while creating new project: ', error);
			this._errorHandlingService.handleError(error);
		}
	};

	/**
	 * Adds a newly created organization project to the dropdown list.
	 *
	 * @param {IOrganizationProject} project - The project to add.
	 */
	createOrganizationProject(project: IOrganizationProject): void {
		if (!project) {
			console.warn('Invalid project provided');
			return;
		}

		// Ensure projects array is initialized, then add the new project
		this.projects = (this.projects ?? []).concat(project).filter(isNotEmpty);
	}

	/**
	 * Updates an existing organization project in the dropdown list.
	 *
	 * @param {IOrganizationProject} project - The project with updated details.
	 */
	updateOrganizationProject(project: IOrganizationProject): void {
		if (!project || !project.id) {
			console.warn('Invalid project or missing project ID');
			return;
		}

		// Map through projects to update the matching project
		this.projects = (this.projects ?? [])
			.map((item) => (item.id === project.id ? { ...item, ...project } : item))
			.filter(isNotEmpty);
	}

	/**
	 * Removes a deleted organization project from the dropdown list.
	 * @param {IOrganizationProject} project - The project to remove.
	 */
	deleteOrganizationProject(project: IOrganizationProject): void {
		if (!project || !project.id) {
			console.warn('Invalid project or missing project ID');
			return;
		}

		// Filter out the project with the matching ID
		this.projects = (this.projects ?? []).filter((item) => item.id !== project.id).filter(isNotEmpty);
	}

	/**
	 * Selects the specified project, updates relevant parameters, and emits the change event.
	 *
	 * @param {IOrganizationProject} project - The project to select.
	 */
	selectProject(project: IOrganizationProject): void {
		const selectedProject = project ?? ALL_PROJECT_SELECTED;

		// Update global store and parameters if global changes are allowed
		if (!this.skipGlobalChange) {
			this._store.selectedProject = selectedProject;
			this.setAttributesToParams({ projectId: selectedProject.id });
		}

		// Update local state and emit the change event
		this.selectedProject = selectedProject;
		this.projectId = selectedProject.id;
		this.onChanged.emit(selectedProject);
	}

	/**
	 * Sets attributes to the current navigation parameters.
	 * @param params An object containing key-value pairs representing the parameters to set.
	 */
	private async setAttributesToParams(params: { [key: string]: string | string[] | boolean }) {
		await this._navigationService.updateQueryParams(params);
	}

	/**
	 * Selects a project by its ID and triggers further processing if found.
	 *
	 * @param {ID} projectId - The unique identifier of the project to select.
	 */
	selectProjectById(projectId: ID): void {
		if (!projectId) {
			console.warn('Invalid project ID provided.');
			return;
		}

		const project = this.projects?.find((project) => project.id === projectId);

		if (project) {
			this.selectProject(project);
		} else {
			console.warn(`Project with ID ${projectId} not found.`);
		}
	}

	/**
	 * Determines if the project selector should display a clearable option.
	 *
	 * @returns {boolean} - Returns true if the project is clearable, false otherwise.
	 */
	isClearable(): boolean {
		return this.selectedProject !== ALL_PROJECT_SELECTED;
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
	 * Clears the selected project value if the "Show All" option is disabled.
	 */
	clearSelection(): void {
		if (!this.showAllOption) {
			this.projectId = null;
		}
	}

	markAsTouchedOnInteraction(): void {
		this.onTouched();
	}
}
