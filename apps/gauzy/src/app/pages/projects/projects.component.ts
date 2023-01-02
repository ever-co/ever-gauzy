import { Component, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { NbDialogService } from '@nebular/theme';
import { TranslateService } from '@ngx-translate/core';
import { filter, tap } from 'rxjs/operators';
import { combineLatest, debounceTime, firstValueFrom, Subject } from 'rxjs';
import { Ng2SmartTableComponent } from 'ng2-smart-table';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import {
	IOrganization,
	IOrganizationContact,
	IOrganizationProject,
	IOrganizationProjectsCreateInput,
	PermissionsEnum,
	ComponentLayoutStyleEnum,
	CrudActionEnum,
	IEmployee,
	ITag
} from '@gauzy/contracts';
import { distinctUntilChange } from '@gauzy/common-angular';
import {
	OrganizationContactService,
	OrganizationProjectsService,
	OrganizationProjectStore,
	Store,
	ToastrService
} from '../../@core/services';
import { API_PREFIX, ComponentEnum } from '../../@core/constants';
import {
	ContactLinksComponent,
	DateViewComponent,
	EmployeesMergedTeamsComponent,
	ProjectOrganizationComponent,
	TagsOnlyComponent
} from '../../@shared/table-components';
import { DeleteConfirmationComponent } from '../../@shared/user/forms';
import { ServerDataSource } from '../../@core/utils/smart-table';
import { PaginationFilterBaseComponent } from '../../@shared/pagination/pagination-filter-base.component';
import { VisibilityComponent } from '../../@shared/table-components/visibility/visibility.component';
import { ProjectOrganizationGridComponent } from '../../@shared/table-components/project-organization-grid/project-organization-grid.component';
import { ProjectOrganizationGridDetailsComponent } from '../../@shared/table-components/project-organization-grid-details/project-organization-grid-details.component';
import { TagsColorFilterComponent } from '../../@shared/table-filters';
import { ProjectOrganizationEmployeesComponent } from '../../@shared/table-components/project-organization-employees/project-organization-employees.component';

@UntilDestroy({ checkProperties: true })
@Component({
	selector: 'ga-projects',
	templateUrl: './projects.component.html',
	styleUrls: ['./projects.component.scss']
})
export class ProjectsComponent extends PaginationFilterBaseComponent
	implements OnInit, OnDestroy {

	loading: boolean = false;
	settingsSmartTable: any;
	viewComponentName: ComponentEnum;
	dataLayoutStyle = ComponentLayoutStyleEnum.TABLE;
	componentLayoutStyleEnum = ComponentLayoutStyleEnum;
	selectedEmployeeId: IEmployee['id'] | null;
	organization: IOrganization;
	showAddCard: boolean = false;
	projects: IOrganizationProject[] = [];
	organizationContacts: IOrganizationContact[] = [];
	projectToEdit: IOrganizationProject;
	viewPrivateProjects: boolean;
	disableButton = true;
	selectedProject: IOrganizationProject;
	smartTableSource: ServerDataSource;
	project$: Subject<boolean> = this.subject$;
	private _refresh$: Subject<boolean> = new Subject();

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
		public readonly translateService: TranslateService,
		private readonly route: ActivatedRoute,
		private readonly dialogService: NbDialogService,
		private readonly organizationProjectStore: OrganizationProjectStore,
		private readonly httpClient: HttpClient
	) {
		super(translateService);
		this.setView();
	}

	ngOnInit(): void {
		this.project$
			.pipe(
				debounceTime(150),
				tap(() => (this.loading = !this.showAddCard)),
				tap(() => this.loadProjects()),
				tap(() => this.loadOrganizationContacts()),
				untilDestroyed(this)
			)
			.subscribe();
		const storeOrganization$ = this.store.selectedOrganization$;
		const storeEmployee$ = this.store.selectedEmployee$;
		combineLatest([storeOrganization$, storeEmployee$])
			.pipe(
				distinctUntilChange(),
				filter(([organization]) => !!organization),
				tap(([organization, employee]) => {
					this.organization = organization;
					this.selectedEmployeeId = employee ? employee.id : null;
				}),
				tap(() => this._refresh$.next(true)),
				tap(() => this.project$.next(true)),
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
		this.route.queryParamMap
			.pipe(untilDestroyed(this))
			.subscribe((params) => {
				if (params.get('openAddDialog')) {
					this.showAddCard =
						params.get('openAddDialog') === 'true' ? true : false;
				}
			});
		this.pagination$
			.pipe(
				debounceTime(100),
				distinctUntilChange(),
				tap(() => this.project$.next(true)),
				untilDestroyed(this)
			)
			.subscribe();
		this._refresh$
			.pipe(
				filter(
					() =>
						this.dataLayoutStyle ===
						ComponentLayoutStyleEnum.CARDS_GRID
				),
				tap(() => this.refreshPagination()),
				tap(() => (this.projects = [])),
				untilDestroyed(this)
			)
			.subscribe();
		this._loadSmartTableSettings();
		this._applyTranslationOnSmartTable();
	}

	ngOnDestroy() {}

	setView() {
		this.viewComponentName = ComponentEnum.PROJECTS;
		this.store
			.componentLayout$(this.viewComponentName)
			.pipe(
				debounceTime(300),
				tap(
					(componentLayout) =>
						(this.dataLayoutStyle = componentLayout)
				),
				tap(() => this._loadSmartTableSettings()),
				tap(() => this.refreshPagination()),
				filter(
					(componentLayout) =>
						componentLayout ===
						this.componentLayoutStyleEnum.CARDS_GRID
				),
				tap(() => (this.projects = [])),
				tap(() => this.project$.next(true)),
				untilDestroyed(this)
			)
			.subscribe();
	}

	async removeProject(selectedItem: IOrganizationProject) {
		if (selectedItem) {
			this.selectProject({
				isSelected: true,
				data: selectedItem
			});
		}
		const result = await firstValueFrom(
			this.dialogService.open(DeleteConfirmationComponent, {
				context: {
					recordType: 'Project'
				}
			}).onClose
		);
		if (result) {
			const { id, name } = this.selectedProject;
			await this.organizationProjectsService
				.delete(id)
				.then(() => {
					this.organizationProjectStore.organizationProjectAction = {
						project: this.selectedProject,
						action: CrudActionEnum.DELETED
					};
				});
			this.toastrService.success(
				'NOTES.ORGANIZATIONS.EDIT_ORGANIZATIONS_PROJECTS.REMOVE_PROJECT',
				{
					name
				}
			);
			this.cancel();
			this._refresh$.next(true);
			this.project$.next(true);
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
							this.organizationProjectStore.organizationProjectAction =
								{
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
						this.organizationProjectStore.organizationProjectAction =
							{
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
		this._refresh$.next(true);
		this.project$.next(true);
	}

	/*
	 * Register Smart Table Source Config
	 */
	setSmartTableSource() {
		if (!this.organization) {
			return;
		}

		const { tenantId } = this.store.user;
		const { id: organizationId } = this.organization;

		this.smartTableSource = new ServerDataSource(this.httpClient, {
			endPoint: `${API_PREFIX}/organization-projects/pagination`,
			relations: [
				'organizationContact',
				'organization',
				'members',
				'members.user',
				'tags'
			],
			join: {
				alias: 'organization_project',
				leftJoin: {
					tags: 'organization_project.tags'
				}
			},
			where: {
				organizationId,
				tenantId,
				...(this.selectedEmployeeId
					? {
							members: {
								id: this.selectedEmployeeId
							}
					  }
					: {}),
				...(this.filters.where ? this.filters.where : {})
			},
			resultMap: (project: IOrganizationProject) => {
				return Object.assign({}, project, {
					...this.privatePublicProjectMapper(project),
					employeesMergedTeams: [project.members]
				});
			},
			finalize: () => {
				if (this._isGridCardLayout) {
					const projects = this.smartTableSource.getData();
					this.projects.push(...projects);
				}
				this.setPagination({
					...this.getPagination(),
					totalItems: this.smartTableSource.count()
				});
			}
		});
	}

	private get _isGridCardLayout(): boolean {
		return (
			this.dataLayoutStyle === this.componentLayoutStyleEnum.CARDS_GRID
		);
	}

	async loadProjects() {
		const { activePage, itemsPerPage } = this.getPagination();
		if (!this.organization) return;
		try {
			this.setSmartTableSource();
			this.smartTableSource.setPaging(activePage, itemsPerPage, false);
			this.loadGridLayoutData();
			this.loading = false;
		} catch (error) {
			console.log(error);
			this.loading = false;
		}
	}

	private async loadGridLayoutData() {
		if (this._isGridCardLayout) {
			await this.smartTableSource.getElements();
		}
	}

	private privatePublicProjectMapper(project: IOrganizationProject) {
		return this.viewPrivateProjects
			? project
			: project.public
			? project
			: project.members.map(
					(member: IEmployee) => member.id === this.store.userId
			  );
	}

	private _loadSmartTableSettings() {
		const pagination = this.getPagination();
		this.settingsSmartTable = {
			noDataMessage: this.getTranslation('SM_TABLE.NO_DATA.PROJECT'),
			actions: false,
			pager: {
				display: false,
				perPage: pagination
					? this.pagination.itemsPerPage
					: this.minItemPerPage
			},
			columns: { ...this.columnsSmartTableMapper() }
		};
	}

	private columnsSmartTableMapper() {
		let columns: any;

		switch (this.dataLayoutStyle) {
			case this.componentLayoutStyleEnum.TABLE:
				columns = {
					project: {
						title: this.getTranslation('ORGANIZATIONS_PAGE.NAME'),
						type: 'custom',
						renderComponent: ProjectOrganizationComponent
					},
					public: {
						title: this.getTranslation(
							'ORGANIZATIONS_PAGE.EDIT.VISIBILITY'
						),
						type: 'custom',
						filter: false,
						renderComponent: VisibilityComponent,
						onComponentInitFunction: (instance: any) => {
							instance.visibilityChange.subscribe({
								next: (visibility: boolean) => {
									this.updateProjectVisiblility(
										instance.rowData.id,
										visibility
									);
								},
								error: (err: any) => {
									console.warn(err);
								}
							});
						}
					},
					organizationContact: {
						title: this.getTranslation(
							'ORGANIZATIONS_PAGE.EDIT.CONTACT'
						),
						type: 'custom',
						class: 'text-center',
						renderComponent: ContactLinksComponent
					},
					startDate: {
						title: this.getTranslation(
							'ORGANIZATIONS_PAGE.EDIT.START_DATE'
						),
						type: 'custom',
						filter: false,
						renderComponent: DateViewComponent,
						class: 'text-center'
					},
					endDate: {
						title: this.getTranslation(
							'ORGANIZATIONS_PAGE.EDIT.END_DATE'
						),
						type: 'custom',
						filter: false,
						renderComponent: DateViewComponent,
						class: 'text-center'
					},
					employeesMergedTeams: {
						title: this.getTranslation(
							'ORGANIZATIONS_PAGE.EDIT.MEMBERS'
						),
						type: 'custom',
						renderComponent: EmployeesMergedTeamsComponent
					},
					tags: {
						title: this.getTranslation('SM_TABLE.TAGS'),
						type: 'custom',
						renderComponent: TagsOnlyComponent,
						width: '10%',
						filter: {
							type: 'custom',
							component: TagsColorFilterComponent
						},
						filterFunction: (tags: ITag[]) => {
							const tagIds = [];
							for (const tag of tags) {
								tagIds.push(tag.id);
							}
							this.setFilter({ field: 'tags', search: tagIds });
						},
						sort: false
					}
				};
				break;
			case this.componentLayoutStyleEnum.CARDS_GRID:
				columns = {
					project: {
						title: 'Image',
						type: 'custom',
						renderComponent: ProjectOrganizationGridComponent
					},
					organizationContact: {
						title: 'Image',
						type: 'custom',
						class: 'text-center',
						renderComponent: ProjectOrganizationGridDetailsComponent
					},
					employeesMergedTeams: {
						title: 'Image',
						type: 'custom',
						renderComponent: ProjectOrganizationEmployeesComponent
					}
				};
				break;
			default:
				console.log('Problem with a Layout view');
				break;
		}
		return columns;
	}

	async selectProject({ isSelected, data }) {
		this.disableButton = !isSelected;
		this.selectedProject = isSelected ? data : null;
	}

	private _applyTranslationOnSmartTable() {
		this.translateService.onLangChange
			.pipe(
				tap(() => this._loadSmartTableSettings()),
				untilDestroyed(this)
			)
			.subscribe();
	}

	private async updateProjectVisiblility(
		projectId: string,
		visibility: boolean
	) {
		await this.organizationProjectsService
			.edit({
				public: visibility,
				id: projectId
			})
			.then(() => {
				this.toastrService.success(
					'NOTES.ORGANIZATIONS.EDIT_ORGANIZATIONS_PROJECTS.VISIBILITY',
					{
						name: visibility
							? this.getTranslation('BUTTONS.PRIVATE')
							: this.getTranslation('BUTTONS.PUBLIC')
					}
				);
			})
			.finally(() => {
				this._refresh$.next(true);
				this.project$.next(true);
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
