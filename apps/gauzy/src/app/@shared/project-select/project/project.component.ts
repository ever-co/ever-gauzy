import { Component, OnInit, OnDestroy, Input, forwardRef } from '@angular/core';
import {
	IOrganization,
	IOrganizationProject,
	PermissionsEnum
} from '@gauzy/models';
import { OrganizationProjectsService } from 'apps/gauzy/src/app/@core/services/organization-projects.service';
import { NG_VALUE_ACCESSOR } from '@angular/forms';
import { Subject } from 'rxjs';
import { debounceTime } from 'rxjs/operators';
import { untilDestroyed } from 'ngx-take-until-destroy';
import { Store } from '../../../@core/services/store.service';
import { ToastrService } from '../../../@core/services/toastr.service';

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
export class ProjectSelectorComponent implements OnInit, OnDestroy {
	private _projectId: string | string[];
	private _employeeId: string;
	private _organizationContactId: string;
	projects: IOrganizationProject[] = [];
	organization: IOrganization;

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

	loadProjects$: Subject<any> = new Subject();
	onChange: any = () => {};
	onTouched: any = () => {};

	constructor(
		private organizationProjects: OrganizationProjectsService,
		private store: Store,
		private toastrService: ToastrService
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
			.pipe(untilDestroyed(this), debounceTime(500))
			.subscribe(async () => {
				if (this.employeeId) {
					this.projects = await this.organizationProjects.getAllByEmployee(
						this.employeeId,
						{
							organizationContactId: this.organizationContactId,
							...(this.organizationId
								? {
										organizationId: this.organizationId,
										tenantId: this.organization.tenantId
								  }
								: {})
						}
					);
				} else {
					const {
						items = []
					} = await this.organizationProjects.getAll([], {
						organizationContactId: this.organizationContactId,
						...(this.organizationId
							? {
									organizationId: this.organizationId,
									tenantId: this.organization.tenantId
							  }
							: {})
					});
					this.projects = items;
				}
			});

		this.store.selectedOrganization$.subscribe((organization) => {
			if (organization) {
				this.organization = organization;
				this.organizationId = organization.id;
				this.loadProjects$.next();
			}
		});
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
				null,
				{ name }
			);
		} catch (error) {
			this.toastrService.error(error);
		}
	};

	ngOnDestroy() {}
}
