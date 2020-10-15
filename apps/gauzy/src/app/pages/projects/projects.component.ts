import { Component, OnDestroy, OnInit, ViewChild } from '@angular/core';
import {
	IEmployee,
	IOrganization,
	IOrganizationContact,
	IOrganizationProject,
	IOrganizationProjectsCreateInput,
	PermissionsEnum,
	ComponentLayoutStyleEnum
} from '@gauzy/models';
import { NbToastrService, NbDialogService } from '@nebular/theme';
import { TranslateService } from '@ngx-translate/core';
import { Subject } from 'rxjs';
import { filter, first, takeUntil } from 'rxjs/operators';
import {
	ActivatedRoute,
	Router,
	RouterEvent,
	NavigationEnd
} from '@angular/router';
import { TranslationBaseComponent } from '../../@shared/language-base/translation-base.component';
import { Store } from '../../@core/services/store.service';
import { OrganizationContactService } from '../../@core/services/organization-contact.service';
import { OrganizationProjectsService } from '../../@core/services/organization-projects.service';
import { EmployeesService } from '../../@core/services';
import { ComponentEnum } from '../../@core/constants/layout.constants';
import { LocalDataSource } from 'ng2-smart-table';
import { DatePipe } from '@angular/common';
import { PictureNameTagsComponent } from '../../@shared/table-components/picture-name-tags/picture-name-tags.component';
import { DeleteConfirmationComponent } from '../../@shared/user/forms/delete-confirmation/delete-confirmation.component';

@Component({
	selector: 'ga-projects',
	templateUrl: './projects.component.html',
	styleUrls: ['./projects.component.scss']
})
export class ProjectsComponent
	extends TranslationBaseComponent
	implements OnInit, OnDestroy {
	private _ngDestroy$ = new Subject<void>();
	loading = true;
	settingsSmartTable: object;
	viewComponentName: ComponentEnum;
	dataLayoutStyle = ComponentLayoutStyleEnum.CARDS_GRID;

	organization: IOrganization;
	showAddCard: boolean;
	projects: IOrganizationProject[];
	organizationContacts: IOrganizationContact[];
	employees: IEmployee[] = [];
	projectToEdit: IOrganizationProject;
	viewPrivateProjects: boolean;
	disableButton = true;
	selectedProject: IOrganizationProject;
	smartTableSource = new LocalDataSource();

	@ViewChild('projectsTable') projectsTable;

	constructor(
		private readonly organizationContactService: OrganizationContactService,
		private readonly organizationProjectsService: OrganizationProjectsService,
		private readonly toastrService: NbToastrService,
		private store: Store,
		private readonly employeesService: EmployeesService,
		readonly translateService: TranslateService,
		private route: ActivatedRoute,
		private router: Router,
		private dialogService: NbDialogService
	) {
		super(translateService);
		this.setView();
	}

	ngOnInit(): void {
		this.loadSmartTable();
		this._applyTranslationOnSmartTable();
		this.store.selectedOrganization$
			.pipe(
				takeUntil(this._ngDestroy$),
				filter((organization) => !!organization)
			)
			.subscribe((organization) => {
				this.organization = organization;
				this._initMethod();
			});
		this.store.userRolePermissions$
			.pipe(takeUntil(this._ngDestroy$))
			.subscribe(() => {
				this.viewPrivateProjects = this.store.hasPermission(
					PermissionsEnum.ACCESS_PRIVATE_PROJECTS
				);
			});
		this.router.events
			.pipe(takeUntil(this._ngDestroy$))
			.subscribe((event: RouterEvent) => {
				if (event instanceof NavigationEnd) {
					this.setView();
				}
			});
		this.route.queryParamMap
			.pipe(takeUntil(this._ngDestroy$))
			.subscribe((params) => {
				if (params.get('openAddDialog')) {
					this.showAddCard =
						params.get('openAddDialog') === 'true' ? true : false;
					this._initMethod();
				}
			});
	}

	ngOnDestroy() {
		this._ngDestroy$.next();
		this._ngDestroy$.complete();
	}

	private _initMethod() {
		if (!this.organization) {
			return;
		}
		this.loadProjects();
		this.loadEmployees();
		this.loadOrganizationContacts();
	}

	private async loadEmployees() {
		if (!this.organization) {
			return;
		}

		const { id: organizationId, tenantId } = this.organization;
		const { items } = await this.employeesService
			.getAll(['user'], {
				organization: { id: organizationId },
				tenantId
			})
			.pipe(first())
			.toPromise();

		this.employees = items;
	}
	setView() {
		this.viewComponentName = ComponentEnum.PROJECTS;
		this.store
			.componentLayout$(this.viewComponentName)
			.pipe(takeUntil(this._ngDestroy$))
			.subscribe((componentLayout) => {
				this.dataLayoutStyle = componentLayout;
				this.selectedProject =
					this.dataLayoutStyle === 'CARDS_GRID'
						? null
						: this.selectedProject;
			});
	}

	async removeProject(id?: string, name?: string) {
		const result = await this.dialogService
			.open(DeleteConfirmationComponent, {
				context: {
					recordType: 'Project'
				}
			})
			.onClose.pipe(first())
			.toPromise();

		if (result) {
			await this.organizationProjectsService.delete(
				this.selectedProject ? this.selectedProject.id : id
			);

			this.toastrService.primary(
				this.getTranslation(
					'NOTES.ORGANIZATIONS.EDIT_ORGANIZATIONS_PROJECTS.REMOVE_PROJECT',
					{
						name: this.selectedProject
							? this.selectedProject.name
							: name
					}
				),
				this.getTranslation('TOASTR.TITLE.SUCCESS')
			);

			this.loadProjects();
		}
	}

	cancel() {
		this.projectToEdit = null;
		this.showAddCard = false;

		this.selectProject({
			isSelected: false,
			data: null
		});
	}

	public async addOrEditProject({
		action,
		project
	}: {
		action: 'add' | 'edit';
		project: IOrganizationProjectsCreateInput;
	}) {
		switch (action) {
			case 'add':
				if (project.name) {
					await this.organizationProjectsService.create(project);
				} else {
					this.toastrService.danger(
						this.getTranslation(
							'NOTES.ORGANIZATIONS.EDIT_ORGANIZATIONS_PROJECTS.INVALID_PROJECT_NAME'
						),
						this.getTranslation(
							'TOASTR.MESSAGE.NEW_ORGANIZATION_PROJECT_INVALID_NAME'
						)
					);
				}
				break;

			case 'edit':
				await this.organizationProjectsService.edit(project);
				break;
		}

		this.toastrService.primary(
			this.getTranslation(
				'NOTES.ORGANIZATIONS.EDIT_ORGANIZATIONS_PROJECTS.ADD_PROJECT',
				{
					name: project.name
				}
			),
			this.getTranslation('TOASTR.TITLE.SUCCESS')
		);

		this.cancel();
		this.loadProjects();
	}

	async loadProjects() {
		this.loading = false;
		if (!this.organization) {
			return;
		}
		const { id: organizationId, tenantId } = this.organization;
		const res = await this.organizationProjectsService.getAll(
			['organizationContact', 'members', 'members.user', 'tags'],
			{ organizationId, tenantId }
		);
		if (res) {
			const canView = [];
			if (this.viewPrivateProjects) {
				this.projects = res.items;
				this.smartTableSource.load(res.items);
			} else {
				res.items.forEach((item) => {
					if (item.public) {
						canView.push(item);
					} else {
						item.members.forEach((member) => {
							if (member.id === this.store.userId) {
								canView.push(item);
							}
						});
					}
				});
				this.projects = canView;
			}
		}
	}

	async loadSmartTable() {
		this.settingsSmartTable = {
			actions: false,
			columns: {
				name: {
					title: this.getTranslation(
						'ORGANIZATIONS_PAGE.ORGANIZATIONS'
					),
					type: 'custom',
					renderComponent: PictureNameTagsComponent
				},
				organizationContact: {
					title: this.getTranslation(
						'ORGANIZATIONS_PAGE.EDIT.CONTACT'
					),
					type: 'string',
					class: 'text-center',
					valuePrepareFunction: (value, item) => {
						if (item.hasOwnProperty('organizationContact')) {
							return item.organizationContact
								? item.organizationContact.name
								: null;
						}
						return value;
					}
				},
				startDate: {
					title: this.getTranslation(
						'ORGANIZATIONS_PAGE.EDIT.START_DATE'
					),
					type: 'date',
					filter: false,
					valuePrepareFunction: (date) =>
						new DatePipe('en-GB').transform(date, 'dd/MM/yyyy'),
					class: 'text-center'
				},
				endDate: {
					title: this.getTranslation(
						'ORGANIZATIONS_PAGE.EDIT.END_DATE'
					),
					type: 'date',
					filter: false,
					valuePrepareFunction: (date) =>
						new DatePipe('en-GB').transform(date, 'dd/MM/yyyy'),
					class: 'text-center'
				},
				billing: {
					title: this.getTranslation(
						'ORGANIZATIONS_PAGE.EDIT.BILLING'
					),
					type: 'string',
					filter: false
				},
				currency: {
					title: this.getTranslation(
						'ORGANIZATIONS_PAGE.EDIT.CURRENCY'
					),
					type: 'string',
					filter: false
				},
				owner: {
					title: this.getTranslation('ORGANIZATIONS_PAGE.EDIT.OWNER'),
					type: 'string',
					filter: false
				}
			}
		};
	}

	async selectProject({ isSelected, data }) {
		const selectedProject = isSelected ? data : null;
		if (this.projectsTable) {
			this.projectsTable.grid.dataSet.willSelect = false;
		}
		this.disableButton = !isSelected;
		this.selectedProject = selectedProject;
	}

	_applyTranslationOnSmartTable() {
		this.translateService.onLangChange
			.pipe(takeUntil(this._ngDestroy$))
			.subscribe(() => {
				this.loadSmartTable();
			});
	}

	private async loadOrganizationContacts() {
		if (!this.organization) {
			return;
		}

		const { id: organizationId, tenantId } = this.organization;
		const res = await this.organizationContactService.getAll(['projects'], {
			organizationId,
			tenantId
		});
		if (res) {
			this.organizationContacts = res.items;
		}
	}

	async editProject(project: IOrganizationProject) {
		this.projectToEdit = project;
		this.showAddCard = true;
	}
}
