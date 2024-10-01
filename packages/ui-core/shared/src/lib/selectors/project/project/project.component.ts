import { Component, OnInit, OnDestroy, Input, forwardRef, AfterViewInit, Output, EventEmitter } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import {
	IOrganization,
	IOrganizationProject,
	CrudActionEnum,
	PermissionsEnum,
	ID,
	IOrganizationProjectsFindInput
} from '@gauzy/contracts';
import { NG_VALUE_ACCESSOR } from '@angular/forms';
import { map, Observable, Subject, switchMap } from 'rxjs';
import { filter, tap } from 'rxjs/operators';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
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
export class ProjectSelectorComponent implements OnInit, OnDestroy, AfterViewInit {
	public projects: IOrganizationProject[] = [];
	public selectedProject: IOrganizationProject;
	public hasAddProject$: Observable<boolean>;
	public organization: IOrganization;
	public subject$: Subject<any> = new Subject();

	@Input() shortened = false;
	@Input() disabled = false;
	@Input() multiple = false;
	@Input() label = null;

	/**
	 * Sets the project ID for this component and triggers change and touch events.
	 * @param val - The project ID or array of project IDs to be set.
	 */
	private _projectId: ID | ID[];
	set projectId(val: ID | ID[]) {
		this._projectId = val;
		this.onChange(val);
		this.onTouched(val);
	}
	get projectId(): ID | ID[] {
		return this._projectId;
	}

	/**
	 * Sets the employee ID for this component and triggers an update.
	 * @param value - The ID of the employee to be set.
	 */
	private _employeeId: ID;
	@Input() public set employeeId(value: ID) {
		this._employeeId = value;
		this.subject$.next(true);
	}
	public get employeeId() {
		return this._employeeId;
	}

	/**
	 * Sets the organization contact ID for this component and triggers an update.
	 * @param value - The ID of the organization contact to be set.
	 */
	private _organizationContactId: ID;
	@Input() public set organizationContactId(value: ID) {
		this._organizationContactId = value;
		this.subject$.next(true);
	}
	public get organizationContactId(): ID {
		return this._organizationContactId;
	}

	/**
	 * Sets the placeholder text for this component.
	 * @param value - The placeholder text to be displayed.
	 */
	private _placeholder: string;
	@Input() set placeholder(value: string) {
		this._placeholder = value;
	}
	get placeholder(): string {
		return this._placeholder;
	}

	/**
	 * Sets the flag to determine whether to skip triggering global change detection.
	 * @param value - A boolean indicating whether to skip global change detection.
	 */
	private _skipGlobalChange: boolean = false;
	@Input() set skipGlobalChange(value: boolean) {
		this._skipGlobalChange = value;
	}
	get skipGlobalChange(): boolean {
		return this._skipGlobalChange;
	}

	/**
	 * Sets the default selection flag for this component.
	 * @param value - A boolean indicating whether to enable the default selection.
	 */
	private _defaultSelected: boolean = true;
	@Input() set defaultSelected(value: boolean) {
		this._defaultSelected = value;
	}
	get defaultSelected(): boolean {
		return this._defaultSelected;
	}

	/**
	 * Sets the flag to determine whether to display the "Show All" option.
	 * @param value - A boolean indicating whether to show the "Show All" option.
	 */
	private _showAllOption: boolean = true;
	@Input() set showAllOption(value: boolean) {
		this._showAllOption = value;
	}
	get showAllOption(): boolean {
		return this._showAllOption;
	}

	@Output() onChanged = new EventEmitter<IOrganizationProject>();

	onChange: any = () => {};
	onTouched: any = () => {};

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
		this.hasAddProject$ = this._store.userRolePermissions$.pipe(
			map(() => this._store.hasAnyPermission(PermissionsEnum.ALL_ORG_EDIT, PermissionsEnum.ORG_PROJECT_ADD))
		);
		this.subject$
			.pipe(
				switchMap(() => this.getProjects()),
				tap(() => {
					if (this._activatedRoute.snapshot.queryParams.projectId) {
						this.selectProjectById(this._activatedRoute.snapshot.queryParams.projectId);
					}
				}),
				untilDestroyed(this)
			)
			.subscribe();

		this._activatedRoute.queryParams
			.pipe(
				filter((query) => !!query.projectId),
				tap(({ projectId }) => this.selectProjectById(projectId)),
				untilDestroyed(this)
			)
			.subscribe();

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
	 * Retrieves projects based on specified parameters.
	 * If an employee ID is provided, retrieves projects associated with that employee.
	 * Otherwise, retrieves all projects for the organization. Optionally inserts an "All Projects" option.
	 */
	async getProjects(): Promise<void> {
		if (!this.organization) return;

		const { id: organizationId, tenantId } = this.organization;
		const queryOptions: IOrganizationProjectsFindInput = {
			organizationId,
			tenantId,
			...(this.organizationContactId && { organizationContactId: this.organizationContactId })
		};

		// Retrieve projects based on the presence of employeeId
		this.projects = this.employeeId
			? await this._organizationProjects.getAllByEmployee(this.employeeId, queryOptions)
			: (await this._organizationProjects.getAll([], queryOptions)).items || [];

		// Optionally add "All Projects" selection
		if (this.showAllOption) {
			this.projects.unshift(ALL_PROJECT_SELECTED);
			this.selectProject(ALL_PROJECT_SELECTED);
		}
	}

	/**
	 * Writes a value to the component, handling single or multiple selection modes.
	 * @param {string | string[]} value - The value(s) to write, either a single string or an array of strings.
	 */
	writeValue(value: string | string[]): void {
		this._projectId = this.multiple ? (Array.isArray(value) ? value : [value]) : value;
	}

	/**
	 * Registers a callback function to be called when the rating changes.
	 * @param {(rating: number) => void} fn - The callback function to register.
	 */
	registerOnChange(fn: (rating: number) => void): void {
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
	 * @param {boolean} isDisabled - The disabled state to set.
	 */
	setDisabledState(isDisabled: boolean): void {
		this.disabled = isDisabled;
	}

	/**
	 * Creates a new project with the given name.
	 * @param {string} name - The name of the new project.
	 */
	createNew = async (name: string): Promise<void> => {
		// Return early if organization is not defined
		if (!this.organization) return;

		try {
			// Destructure tenantId and organizationId from organization
			const { id: organizationId, tenantId } = this.organization;

			// Create the project
			const project = await this._organizationProjects.create({
				name,
				organizationId,
				tenantId,
				...(this.organizationContactId && { organizationContactId: this.organizationContactId }),
				memberIds: [this.employeeId || this._store.user.employee?.id].filter(Boolean) // Filter out falsy values
			});

			// Handle the created project and update projectId
			this.createOrganizationProject(project);
			this.projectId = project.id;

			// Show success message
			this._toastrService.success('NOTES.ORGANIZATIONS.EDIT_ORGANIZATIONS_PROJECTS.ADD_PROJECT', { name });
		} catch (error) {
			// Handle the error
			console.log('Error while creating new project: ', error);
			this._errorHandlingService.handleError(error);
		}
	};

	/**
	 * Adds a newly created organization project to the dropdown list.
	 * @param {IOrganizationProject} project - The project to add.
	 */
	createOrganizationProject(project: IOrganizationProject): void {
		this.projects = [...(this.projects || []), project].filter(isNotEmpty);
	}

	/**
	 * Updates an existing organization project in the dropdown list.
	 * @param {IOrganizationProject} project - The project with updated details.
	 */
	updateOrganizationProject(project: IOrganizationProject): void {
		this.projects = (this.projects || [])
			.map((item) => (item.id === project.id ? { ...item, ...project } : item))
			.filter(isNotEmpty);
	}

	/**
	 * Removes a deleted organization project from the dropdown list.
	 * @param {IOrganizationProject} project - The project to remove.
	 */
	deleteOrganizationProject(project: IOrganizationProject): void {
		this.projects = (this.projects || []).filter((item) => item.id !== project.id).filter(isNotEmpty);
	}

	/**
	 * Selects the specified project, updates relevant parameters, and emits the change event.
	 * @param {IOrganizationProject} project - The project to select.
	 */
	selectProject(project: IOrganizationProject): void {
		const selectedProject = project || ALL_PROJECT_SELECTED;

		if (!this.skipGlobalChange) {
			this._store.selectedProject = selectedProject;
			this.setAttributesToParams({ projectId: selectedProject.id });
		}

		this.selectedProject = selectedProject;
		this.projectId = selectedProject.id;
		this.onChanged.emit(project);
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
	 * @param {ID} projectId - The unique identifier of the project to select.
	 */
	selectProjectById(projectId: ID): void {
		const project = this.projects.find((project) => project.id === projectId);
		if (project) this.selectProject(project);
	}

	/**
	 * Display clearable option in project selector
	 *
	 * @returns
	 */
	isClearable(): boolean {
		if (this.selectedProject === ALL_PROJECT_SELECTED) {
			return false;
		}
		return true;
	}

	/**
	 * GET Shortened Name
	 *
	 * @param name
	 * @returns
	 */
	getShortenedName(name: string, limit = 20) {
		if (isEmpty(name)) {
			return;
		}
		const chunks = name.split(/\s+/);
		const [firstName, lastName] = [chunks.shift(), chunks.join(' ')];

		if (firstName && lastName) {
			return (
				this._truncatePipe.transform(firstName, limit / 2, false, '') +
				' ' +
				this._truncatePipe.transform(lastName, limit / 2, false, '.')
			);
		} else {
			return (
				this._truncatePipe.transform(firstName, limit) ||
				this._truncatePipe.transform(lastName, limit) ||
				'[error: bad name]'
			);
		}
	}

	/**
	 * Clear Selector Value
	 *
	 */
	clearSelection() {
		if (!this.showAllOption) {
			this.projectId = null;
		}
	}

	ngOnDestroy(): void {}
}
