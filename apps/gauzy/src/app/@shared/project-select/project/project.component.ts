import {
	Component,
	OnInit,
	OnDestroy,
	Input,
	forwardRef,
	AfterViewInit
} from '@angular/core';
import {
	IOrganization,
	IOrganizationProject,
	OrganizationProjectAction,
	PermissionsEnum
} from '@gauzy/contracts';
import { OrganizationProjectsService } from '../../../@core/services/organization-projects.service';
import { NG_VALUE_ACCESSOR } from '@angular/forms';
import { Subject } from 'rxjs';
import { debounceTime, filter, tap } from 'rxjs/operators';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { Store } from '../../../@core/services/store.service';
import { ToastrService } from '../../../@core/services/toastr.service';
import { OrganizationProjectStore } from '../../../@core/services/organization-projects-store.service';
import { isNotEmpty } from '@gauzy/common-angular';
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
		this.loadProjects$.next();
	}

	@Input()
	public get organizationContactId(): string {
		return this._organizationContactId;
	}

	public set organizationContactId(value: string) {
		this._organizationContactId = value;
		if (this._organizationContactId) {
			this.loadProjects$.next();
		}
	}

	@Input() placeholder: string;
	@Input() skipGlobalChange: boolean;

	loadProjects$: Subject<any> = new Subject();
	onChange: any = () => {};
	onTouched: any = () => {};

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
		this.loadProjects$
			.pipe(
				debounceTime(500),
				tap(() => this.getProjects()),
				untilDestroyed(this)
			)
			.subscribe();
		this.store.selectedOrganization$
			.pipe(
				filter((organization: IOrganization) => !!organization),
				tap((organization) => (this.organization = organization)),
				tap(({ id }) => (this.organizationId = id)),
				tap(() => this.loadProjects$.next()),
				untilDestroyed(this)
			)
			.subscribe();
	}

	ngAfterViewInit() {
		this._organizationProjectStore.organizationProjectAction$
			.pipe(
				filter(({ project }) => !!project),
				untilDestroyed(this)
			)
			.subscribe(({ project, action }) => {
				switch (action) {
					case OrganizationProjectAction.CREATED:
						this.createOrganizationProject(project);
						break;
					case OrganizationProjectAction.UPDATED:
						this.updateOrganizationProject(project);
						break;
					case OrganizationProjectAction.DELETED:
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

		this.projects.unshift(ALL_PROJECT_SELECTED);
		this.selectProject(ALL_PROJECT_SELECTED);
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
	}

	ngOnDestroy() {}
}
