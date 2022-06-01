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
import { map, Observable, Subject } from 'rxjs';
import { debounceTime, filter, tap } from 'rxjs/operators';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { distinctUntilChange, isEmpty, isNotEmpty } from '@gauzy/common-angular';
import { ALL_PROJECT_SELECTED } from './default-project';
import {
	OrganizationProjectsService,
	OrganizationProjectStore,
	Store,
	ToastrService
} from '../../../@core/services';
import { TruncatePipe } from '../../pipes';

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

	projects: IOrganizationProject[] = [];
	selectedProject: IOrganizationProject;
	hasEditProject$: Observable<boolean>;
	
	public organization: IOrganization;
	subject$: Subject<any> = new Subject();
	onChange: any = () => {};
	onTouched: any = () => {};
	
	@Input() shortened = false;
	@Input() disabled = false;
	@Input() multiple = false;

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
		private readonly _truncatePipe: TruncatePipe
	) {}

	ngOnInit() {
		this.hasEditProject$ = this.store.userRolePermissions$.pipe(
			map(() =>
				this.store.hasPermission(PermissionsEnum.ORG_PROJECT_EDIT)
			)
		);
		this.subject$
			.pipe(
				debounceTime(200),
				tap(() => this.getProjects()),
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
		if (!this.organization) {
			return;
		}
		const { tenantId } = this.store.user;
		const { id: organizationId } = this.organization;
		const { organizationContactId } = this;

		if (this.employeeId) {
			this.projects = await this.organizationProjects.getAllByEmployee(
				this.employeeId,
				{
					organizationContactId,
					organizationId,
					tenantId
				}
			);
		} else {
			const { items = [] } = await this.organizationProjects.getAll([], {
				organizationContactId,
				organizationId,
				tenantId
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
		if (!this.organization) {
			return;
		}
		try {
			const { tenantId } = this.store.user;
			const { id: organizationId } = this.organization;
			
			const request = {
				name,
				organizationId,
				tenantId,
				...(this.organizationContactId
					? { contactId: this.organizationContactId }
					: {})
			};
			if (this.employeeId || this.store.user.employeeId) {
				const member: any = {
					id: this.employeeId || this.store.user.employeeId
				};
				request['members'] = [member];
			}

			const project = await this.organizationProjects.create(request);

			this.projects = this.projects.concat([project]);
			this.projectId = project.id;

			this.toastrService.success('NOTES.ORGANIZATIONS.EDIT_ORGANIZATIONS_PROJECTS.ADD_PROJECT', {
				name
			});
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

	/**
	 * GET Shortend Name
	 * 
	 * @param name 
	 * @returns 
	 */
	getShortenedName(name: string) {
		if (isEmpty(name)) {
			return;
		}
		const chunks = name.split(/\s+/);
		const [firstName, lastName] = [chunks.shift(), chunks.join(' ')];
		if (firstName && lastName) {
			return this._truncatePipe.transform(firstName, 10) + ' ' + this._truncatePipe.transform(lastName, 10);
		} else {
			return this._truncatePipe.transform(firstName, 20) || this._truncatePipe.transform(lastName, 20) || '[error: bad name]';
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

	ngOnDestroy() {}
}
