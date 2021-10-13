import {
	Component,
	OnInit,
	OnDestroy,
	Input,
	forwardRef,
	AfterViewInit,
	Output,
	EventEmitter
} from '@angular/core';
import {
	IOrganization,
	IOrganizationProject,
	CrudActionEnum,
	PermissionsEnum
} from '@gauzy/contracts';
import { NG_VALUE_ACCESSOR } from '@angular/forms';
import { Subject } from 'rxjs';
import { debounceTime, filter, tap } from 'rxjs/operators';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { isNotEmpty } from '@gauzy/common-angular';
import { ALL_PROJECT_SELECTED } from './default-project';
import { OrganizationProjectsService, OrganizationProjectStore, Store, ToastrService } from '../../../@core/services';

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
export class ProjectSelectorComponent
	implements OnInit, OnDestroy, AfterViewInit {
	private _projectId: string | string[];
	private _employeeId: string;
	private _organizationContactId: string;
	projects: IOrganizationProject[] = [];
	organization: IOrganization;

	selectedProject: IOrganizationProject;

	@Input() disabled = false;
	@Input() multiple = false;
	organizationId: string;
	hasPermissionProjEdit: boolean;

	@Input()
	public get employeeId() {
		return this._employeeId;
	}
	public set employeeId(value) {
		this._employeeId = value;
		this.subject$.next(true);
	}

	@Input()
	public get organizationContactId(): string {
		return this._organizationContactId;
	}

	public set organizationContactId(value: string) {
		this._organizationContactId = value;
		if (this._organizationContactId) {
			this.subject$.next(true);
		}
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

	subject$: Subject<any> = new Subject();
	onChange: any = () => {};
	onTouched: any = () => {};

	@Output()
	onChanged = new EventEmitter<IOrganizationProject>();

	constructor(
		private readonly organizationProjects: OrganizationProjectsService,
		private readonly store: Store,
		private readonly toastrService: ToastrService,
		private readonly _organizationProjectStore: OrganizationProjectStore
	) {}

	set projectId(val: string | string[]) {
		this._projectId = val;
		this.onChange(val);
		this.onTouched(val);
	}

	get projectId(): string | string[] {
		return this._projectId;
	}

	ngOnInit() {
		this.store.userRolePermissions$
			.pipe(untilDestroyed(this))
			.subscribe(() => {
				this.hasPermissionProjEdit = this.store.hasPermission(
					PermissionsEnum.ORG_PROJECT_EDIT
				);
			});
		this.subject$
			.pipe(
				debounceTime(200),
				tap(() => this.getProjects()),
				untilDestroyed(this)
			)
			.subscribe();
		this.store.selectedOrganization$
			.pipe(
				filter((organization: IOrganization) => !!organization),
				tap((organization) => (this.organization = organization)),
				tap(({ id }) => (this.organizationId = id)),
				tap(() => this.subject$.next(true)),
				untilDestroyed(this)
			)
			.subscribe();
	}

	ngAfterViewInit() {
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

	async getProjects() {
		const { tenantId } = this.store.user;
		const { id: organizationId } = this.organization;		
		if (this.employeeId) {
			this.projects = await this.organizationProjects.getAllByEmployee(
				this.employeeId,
				{
					organizationContactId: this.organizationContactId,
					...(this.organizationId ? { organizationId, tenantId } : {})
				}
			);
		} else {
			const { items = [] } = await this.organizationProjects.getAll([], {
				organizationContactId: this.organizationContactId,
				...(this.organizationId ? { organizationId, tenantId } : {})
			});
			this.projects = items;
		}

		//Insert All Employees Option
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

	createNew = async (name: string) => {
		try {
			const member: any = {
				id: this.employeeId || this.store.user.employeeId
			};

			const request = {
				name,
				organizationId: this.organizationId,
				members: [member],
				...(this.organizationContactId
					? { contactId: this.organizationContactId }
					: {})
			};

			const project = await this.organizationProjects.create(request);

			this.projects = this.projects.concat([project]);
			this.projectId = project.id;

			this.toastrService.success(
				'NOTES.ORGANIZATIONS.EDIT_ORGANIZATIONS_PROJECTS.ADD_PROJECT',
				{ name }
			);
		} catch (error) {
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
			projects = projects.filter(
				(item: IOrganizationProject) => item.id !== project.id
			);
		}
		this.projects = [...projects].filter(isNotEmpty);
	}

	selectProject(project: IOrganizationProject): void {
		if (!this.skipGlobalChange) {
			this.store.selectedProject = project || ALL_PROJECT_SELECTED;
		}
		this.selectedProject = project || ALL_PROJECT_SELECTED;
		this.projectId = this.selectedProject.id;
		this.onChanged.emit(project);
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

	ngOnDestroy() {}
}
