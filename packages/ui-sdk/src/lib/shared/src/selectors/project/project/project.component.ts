import { Component, OnInit, OnDestroy, Input, forwardRef, AfterViewInit, Output, EventEmitter } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { IOrganization, IOrganizationProject, CrudActionEnum, PermissionsEnum } from '@gauzy/contracts';
import { NG_VALUE_ACCESSOR } from '@angular/forms';
import { map, Observable, Subject, switchMap } from 'rxjs';
import { filter, tap } from 'rxjs/operators';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { Store, distinctUntilChange, isEmpty, isNotEmpty } from '@gauzy/ui-sdk/common';
import {
	NavigationService,
	OrganizationProjectStore,
	OrganizationProjectsService,
	ToastrService
} from '@gauzy/ui-sdk/core';
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
		private readonly organizationProjects: OrganizationProjectsService,
		private readonly store: Store,
		private readonly toastrService: ToastrService,
		private readonly _organizationProjectStore: OrganizationProjectStore,
		private readonly _truncatePipe: TruncatePipe,
		private readonly _navigationService: NavigationService,
		private readonly activatedRoute: ActivatedRoute
	) {}

	ngOnInit(): void {
		this.hasAddProject$ = this.store.userRolePermissions$.pipe(
			map(() => this.store.hasAnyPermission(PermissionsEnum.ALL_ORG_EDIT, PermissionsEnum.ORG_PROJECT_ADD))
		);
		this.subject$
			.pipe(
				switchMap(() => this.getProjects()),
				tap(() => {
					if (this.activatedRoute.snapshot.queryParams.projectId) {
						this.selectProjectById(this.activatedRoute.snapshot.queryParams.projectId);
					}
				}),
				untilDestroyed(this)
			)
			.subscribe();

		this.activatedRoute.queryParams
			.pipe(
				filter((query) => !!query.projectId),
				tap(({ projectId }) => this.selectProjectById(projectId)),
				untilDestroyed(this)
			)
			.subscribe();

		this.store.selectedOrganization$
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
	 * If an employee ID is provided, it retrieves projects associated with that employee.
	 * Otherwise, it retrieves all projects for the organization.
	 * Inserts an "All Projects" option if specified.
	 */
	async getProjects() {
		// Check if organization is defined
		if (!this.organization) {
			return;
		}

		// Extract user and organization details
		const { tenantId } = this.store.user;
		const { id: organizationId } = this.organization;

		// Construct query options based on provided parameters
		const queryOptions = {
			organizationId,
			tenantId,
			...(this.organizationContactId ? { organizationContactId: this.organizationContactId } : {})
		};

		// Retrieve projects based on whether employee ID is provided or not
		if (this.employeeId) {
			// Retrieve projects associated with the specified employee
			this.projects = await this.organizationProjects.getAllByEmployee(this.employeeId, queryOptions);
		} else {
			// Retrieve all projects for the organization
			const { items = [] } = await this.organizationProjects.getAll([], queryOptions);
			this.projects = items;
		}

		// Insert an "All Projects" option if specified
		if (this.showAllOption) {
			this.projects.unshift(ALL_PROJECT_SELECTED);
			this.selectProject(ALL_PROJECT_SELECTED);
		}
	}

	writeValue(value: string | string[]) {
		if (this.multiple) {
			this._projectId = value instanceof Array ? value : [value];
		} else {
			this._projectId = value;
		}
	}

	registerOnChange(fn: (rating: number) => void): void {
		this.onChange = fn;
	}

	registerOnTouched(fn: () => void): void {
		this.onTouched = fn;
	}

	setDisabledState(isDisabled: boolean): void {
		this.disabled = isDisabled;
	}

	/**
	 * Creates a new project with the given name.
	 * @param {string} name - The name of the new project.
	 */
	createNew = async (name: string) => {
		// Check if organization is defined
		if (!this.organization) {
			return;
		}

		try {
			// Extract tenantId and organizationId
			const { id: organizationId, tenantId } = this.organization;

			// Construct request object with common parameters
			const request = {
				name,
				organizationId,
				tenantId,
				...(this.organizationContactId && { organizationContactId: this.organizationContactId })
			};

			// Include member if employeeId or store user's employeeId is provided
			const employeeId = this.store.user.employee?.id;

			if (this.employeeId || employeeId) {
				const member: Record<string, string> = {
					id: this.employeeId || employeeId
				};
				request['members'] = [member];
			}

			// Create the project
			const project = await this.organizationProjects.create(request);

			// Call method to handle the created project
			this.createOrganizationProject(project);

			// Update projectId
			this.projectId = project.id;

			// Show success message
			this.toastrService.success('NOTES.ORGANIZATIONS.EDIT_ORGANIZATIONS_PROJECTS.ADD_PROJECT', { name });
		} catch (error) {
			// Show error message
			this.toastrService.error(error);
		}
	};

	/*
	 * After created new organization project pushed on dropdown
	 */
	createOrganizationProject(project: IOrganizationProject) {
		const projects: IOrganizationProject[] = this.projects || [];
		if (Array.isArray(projects)) {
			projects.push(project);
		}
		this.projects = [...projects].filter(isNotEmpty);
	}

	/*
	 * After updated existing organization project changed in the dropdown
	 */
	updateOrganizationProject(project: IOrganizationProject) {
		let projects: IOrganizationProject[] = this.projects || [];
		if (Array.isArray(projects) && projects.length) {
			projects = projects.map((item: IOrganizationProject) => {
				if (item.id === project.id) {
					return Object.assign({}, item, project);
				}
				return item;
			});
		}
		this.projects = [...projects].filter(isNotEmpty);
	}

	/*
	 * After deleted organization project removed on dropdown
	 */
	deleteOrganizationProject(project: IOrganizationProject) {
		let projects: IOrganizationProject[] = this.projects || [];
		if (Array.isArray(projects) && projects.length) {
			projects = projects.filter((item: IOrganizationProject) => item.id !== project.id);
		}
		this.projects = [...projects].filter(isNotEmpty);
	}

	selectProject(project: IOrganizationProject): void {
		if (!this.skipGlobalChange) {
			this.store.selectedProject = project || ALL_PROJECT_SELECTED;
			this.setAttributesToParams({ projectId: project?.id });
		}
		this.selectedProject = project || ALL_PROJECT_SELECTED;
		this.projectId = this.selectedProject.id;
		this.onChanged.emit(project);
	}

	/**
	 * Sets attributes to the current navigation parameters.
	 * @param params An object containing key-value pairs representing the parameters to set.
	 */
	private async setAttributesToParams(params: { [key: string]: string | string[] | boolean }) {
		await this._navigationService.updateQueryParams(params);
	}

	selectProjectById(projectId: string) {
		const project = this.projects.find((project: IOrganizationProject) => projectId === project.id);
		if (project) {
			this.selectProject(project);
		}
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
