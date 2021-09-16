import { Component, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { DatePipe } from '@angular/common';
import {
	ActivatedRoute,
	Router,
	RouterEvent,
	NavigationEnd
} from '@angular/router';
import { NbDialogService } from '@nebular/theme';
import { TranslateService } from '@ngx-translate/core';
import { filter, first, tap } from 'rxjs/operators';
import { LocalDataSource, Ng2SmartTableComponent } from 'ng2-smart-table';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import {
	IEmployee,
	IOrganization,
	IOrganizationContact,
	IOrganizationProject,
	IOrganizationProjectsCreateInput,
	PermissionsEnum,
	ComponentLayoutStyleEnum,
	CrudActionEnum
} from '@gauzy/contracts';
import { TranslationBaseComponent } from '../../@shared/language-base';
import {
	EmployeesService,
	OrganizationContactService,
	OrganizationProjectsService,
	OrganizationProjectStore,
	Store,
	ToastrService
} from '../../@core/services';
import { ComponentEnum } from '../../@core/constants';
import { PictureNameTagsComponent } from '../../@shared/table-components';
import { DeleteConfirmationComponent } from '../../@shared/user/forms';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ga-projects',
	templateUrl: './projects.component.html',
	styleUrls: ['./projects.component.scss']
})
export class ProjectsComponent
	extends TranslationBaseComponent
	implements OnInit, OnDestroy {

	loading: boolean;
	settingsSmartTable: object;
	viewComponentName: ComponentEnum;
	dataLayoutStyle = ComponentLayoutStyleEnum.CARDS_GRID;
	organization: IOrganization;
	showAddCard: boolean;
	projects: IOrganizationProject[] = [];
	organizationContacts: IOrganizationContact[] = [];
	employees: IEmployee[] = [];
	projectToEdit: IOrganizationProject;
	viewPrivateProjects: boolean;
	disableButton = true;
	selectedProject: IOrganizationProject;
	smartTableSource = new LocalDataSource();

	projectsTable: Ng2SmartTableComponent;
	@ViewChild('projectsTable') set content(content: Ng2SmartTableComponent) {
		if (content) {
			this.projectsTable = content;
			this.onChangedSource();
		}
	}

	constructor(
		private readonly organizationContactService: OrganizationContactService,
		private readonly organizationProjectsService: OrganizationProjectsService,
		private readonly toastrService: ToastrService,
		private readonly store: Store,
		private readonly employeesService: EmployeesService,
		public readonly translateService: TranslateService,
		private readonly route: ActivatedRoute,
		private readonly router: Router,
		private readonly dialogService: NbDialogService,
		private readonly organizationProjectStore: OrganizationProjectStore
	) {
		super(translateService);
		this.setView();
	}

	ngOnInit(): void {
		this.loadSmartTable();
		this._applyTranslationOnSmartTable();
		this.store.selectedOrganization$
			.pipe(
				filter((organization) => !!organization),
				tap(
					(organization: IOrganization) =>
						(this.organization = organization)
				),
				tap(() => this._initMethod()),
				untilDestroyed(this)
			)
			.subscribe();
		this.store.userRolePermissions$
			.pipe(untilDestroyed(this))
			.subscribe(() => {
				this.viewPrivateProjects = this.store.hasPermission(
					PermissionsEnum.ACCESS_PRIVATE_PROJECTS
				);
			});
		this.router.events
			.pipe(untilDestroyed(this))
			.subscribe((event: RouterEvent) => {
				if (event instanceof NavigationEnd) {
					this.setView();
				}
			});
		this.route.queryParamMap
			.pipe(untilDestroyed(this))
			.subscribe((params) => {
				if (params.get('openAddDialog')) {
					this.showAddCard =
						params.get('openAddDialog') === 'true' ? true : false;
					this._initMethod();
				}
			});
	}

	ngOnDestroy() {}

	private _initMethod() {
		if (!this.organization) {
			return;
		}

		this.loadProjects();
		this.loadEmployees();
		this.loadOrganizationContacts();
	}

	private async loadEmployees() {
		const { tenantId } = this.store.user;
		const { id: organizationId } = this.organization;
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
			.pipe(untilDestroyed(this))
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
			await this.organizationProjectsService
				.delete(this.selectedProject ? this.selectedProject.id : id)
				.then(() => {
					this.organizationProjectStore.organizationProjectAction = {
						project: this.selectedProject,
						action: CrudActionEnum.DELETED
					};
				});

			this.toastrService.success(
				'NOTES.ORGANIZATIONS.EDIT_ORGANIZATIONS_PROJECTS.REMOVE_PROJECT',
				{
					name: this.selectedProject
						? this.selectedProject.name
						: name
				}
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
					await this.organizationProjectsService
						.create(project)
						.then((project: IOrganizationProject) => {
							this.organizationProjectStore.organizationProjectAction = {
								project,
								action: CrudActionEnum.CREATED
							};
						});
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
				await this.organizationProjectsService
					.edit(project)
					.then((project: IOrganizationProject) => {
						this.organizationProjectStore.organizationProjectAction = {
							project,
							action: CrudActionEnum.UPDATED
						};
					});
				break;
		}

		this.toastrService.success(
			'NOTES.ORGANIZATIONS.EDIT_ORGANIZATIONS_PROJECTS.ADD_PROJECT',
			{
				name: project.name
			}
		);
		this.cancel();
		this.loadProjects();
	}

	async loadProjects() {
		this.loading = true;
		const { tenantId } = this.store.user;
		const { id: organizationId } = this.organization;
		this.organizationProjectsService
			.getAll(
				['organizationContact', 'members', 'members.user', 'tags'],
				{ organizationId, tenantId }
			)
			.then(({ items }) => {
				const canView = [];
				if (this.viewPrivateProjects) {
					this.projects = items;
					this.smartTableSource.load(items);
				} else {
					items.forEach((item) => {
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
			})
			.finally(() => {
				this.loading = false;
			});
	}

	async loadSmartTable() {
		this.settingsSmartTable = {
			noDataMessage: this.getTranslation('SM_TABLE.NO_DATA'),
			actions: false,
			columns: {
				name: {
					title: this.getTranslation('ORGANIZATIONS_PAGE.NAME'),
					type: 'custom',
					renderComponent: PictureNameTagsComponent
				},
				projectUrl: {
					title: this.getTranslation(
						'ORGANIZATIONS_PAGE.EDIT.PROJECT_URL'
					),
					type: 'text'
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
		this.disableButton = !isSelected;
		this.selectedProject = isSelected ? data : null;
	}

	_applyTranslationOnSmartTable() {
		this.translateService.onLangChange
			.pipe(untilDestroyed(this))
			.subscribe(() => {
				this.loadSmartTable();
			});
	}

	private loadOrganizationContacts() {
		const { tenantId } = this.store.user;
		const { id: organizationId } = this.organization;
		this.organizationContactService
			.getAll(['projects'], {
				organizationId,
				tenantId
			})
			.then(({ items }) => {
				this.organizationContacts = items;
			});
	}

	async editProject(project: IOrganizationProject) {
		this.projectToEdit = project;
		this.showAddCard = true;
	}

	/*
	 * Table on changed source event
	 */
	onChangedSource() {
		this.projectsTable.source.onChangedSource
			.pipe(
				untilDestroyed(this),
				tap(() => this.clearItem())
			)
			.subscribe();
	}

	/*
	 * Clear selected item
	 */
	clearItem() {
		this.selectProject({
			isSelected: false,
			data: null
		});
		this.deselectAll();
	}
	/*
	 * Deselect all table rows
	 */
	deselectAll() {
		if (this.projectsTable && this.projectsTable.grid) {
			this.projectsTable.grid.dataSet['willSelect'] = 'false';
			this.projectsTable.grid.dataSet.deselectAll();
		}
	}
}
