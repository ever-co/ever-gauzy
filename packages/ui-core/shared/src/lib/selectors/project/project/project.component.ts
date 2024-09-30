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
	// changeDetection: ChangeDetectionStrategy.OnPush
})
export class ProjectSelectorComponent implements OnInit, OnDestroy, AfterViewInit {
	projects: IOrganizationProject[] = [];
	selectedProject: IOrganizationProject;
	hasAddProject$: Observable<boolean>;

	public organization: IOrganization;
	subject$: Subject<any> = new Subject();
	onChange: any = () => {};
	onTouched: any = () => {};

	@Input() shortened = false;
	@Input() disabled = false;
	@Input() multiple = false;
	@Input() label = null;

	private _projectId: string | string[];
	get projectId(): string | string[] {
		return this._projectId;
	}
	set projectId(val: string | string[]) {
		this._projectId = val;
		this.onChange(val);
		this.onTouched(val);
	}

	private _employeeId: string;
	public get employeeId() {
		return this._employeeId;
	}
	@Input() public set employeeId(value) {
		this._employeeId = value;
		this.subject$.next(true);
	}

	private _organizationContactId: string;
	public get organizationContactId(): string {
		return this._organizationContactId;
	}
	@Input() public set organizationContactId(value: string) {
		this._organizationContactId = value;
		this.subject$.next(true);
	}

	/*
	 * Getter & Setter for dynamic placeholder
	 */
	private _placeholder: string;
	get placeholder(): string {
		return this._placeholder;
	}
	@Input() set placeholder(value: string) {
		this._placeholder = value;
	}

	/*
	 * Getter & Setter for skip global change
	 */
	private _skipGlobalChange: boolean = false;
	get skipGlobalChange(): boolean {
		return this._skipGlobalChange;
	}
	@Input() set skipGlobalChange(value: boolean) {
		this._skipGlobalChange = value;
	}

	private _defaultSelected: boolean = true;
	get defaultSelected(): boolean {
		return this._defaultSelected;
	}
	@Input() set defaultSelected(value: boolean) {
		this._defaultSelected = value;
	}

	private _showAllOption: boolean = true;
	get showAllOption(): boolean {
		return this._showAllOption;
	}
	@Input() set showAllOption(value: boolean) {
		this._showAllOption = value;
	}

	@Output()
	onChanged = new EventEmitter<IOrganizationProject>();

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
